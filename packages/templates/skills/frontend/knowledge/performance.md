# Performance as Architecture

Core Web Vitals are not audit metrics to address after shipping.
They are architectural constraints that must be designed into the
system from the first component. An agent that treats performance
as a post-build concern will produce systems that cannot be fixed
without architectural rewrites.

## Core Web Vitals Defined

### Largest Contentful Paint (LCP)
Measures when the largest visible element finishes rendering.
Target: < 2.5 seconds.

**What determines LCP:** The largest image, video poster, or text
block visible in the viewport on initial load.

**What blocks LCP:**
- Render-blocking resources (CSS, synchronous JS in `<head>`)
- Server response time (slow TTFB)
- Resource load time (unoptimized images, no CDN)
- Client-side rendering of the LCP element (no SSR)

### Interaction to Next Paint (INP)
Measures the latency of all user interactions throughout the page lifetime.
Target: < 200ms. Replaced FID in March 2024.

**What determines INP:** The worst interaction latency recorded
during a user session. A single slow click can fail the metric.

**What blocks INP:**
- Long tasks on the main thread (JavaScript execution > 50ms)
- Heavy event handlers without yielding to the browser
- Synchronous layout (reading then writing DOM in the same task)

### Cumulative Layout Shift (CLS)
Measures unexpected layout shifts during page load.
Target: < 0.1.

**What causes CLS:**
- Images without explicit width/height attributes
- Ads or embeds without reserved space
- Dynamically injected content above existing content
- Web fonts causing FOUT (Flash of Unstyled Text)

---

## Top-Level Await and Streaming

The most expensive performance mistake in Next.js App Router:
blocking the entire page render on a slow data fetch.

```typescript
// WRONG: await in the layout blocks the entire page shell
// The user sees nothing until all awaits resolve
export default async function DashboardLayout({ children }) {
  const user = await db.users.findUnique({ where: { id: getCurrentUser() } });
  const settings = await db.settings.findOne({ where: { userId: user.id } });
  // ^ Sequential awaits: 200ms + 150ms = 350ms before any HTML streams

  return (
    <div>
      <Sidebar user={user} settings={settings} />
      {children}
    </div>
  );
}
```

```typescript
// CORRECT: Stream the shell immediately, defer slow data
export default async function DashboardLayout({ children }) {
  // Only fetch what's needed for the shell synchronously
  // Fast: < 50ms
  const user = await db.users.findUnique({
    where: { id: getCurrentUser() },
    select: { id: true, name: true, avatarUrl: true }, // minimal select
  });

  return (
    <div>
      <Sidebar user={user}>
        {/* Slow data loads inside Suspense — doesn't block shell */}
        <Suspense fallback={<SettingsSkeleton />}>
          <UserSettings userId={user.id} />
        </Suspense>
      </Sidebar>
      {children}
    </div>
  );
}

// UserSettings fetches its own slow data
async function UserSettings({ userId }: { userId: string }) {
  const settings = await db.settings.findOne({ where: { userId } }); // 150ms
  return <SettingsPanel settings={settings} />;
}
```

---

## Async Boundaries in Layouts Disable Streaming

A single missing `<Suspense>` boundary in a layout disables
streaming for the entire subtree below it.

```typescript
// WRONG: No Suspense boundary — Next.js cannot stream this route
export default async function Layout({ children }) {
  const data = await slowFetch(); // 500ms wait before ANY HTML streams
  return <div>{children}</div>;
}

// CORRECT: Suspense enables streaming
export default function Layout({ children }) {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <SlowHeader /> {/* fetches internally */}
      </Suspense>
      {children}
    </div>
  );
}
```

---

## Bundle Size and Code Splitting

**Identify bundle size issues:**
```bash
# Next.js bundle analyzer
pnpm add -D @next/bundle-analyzer

# next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({});

# Run analysis
ANALYZE=true pnpm build
```

**Common bundle bloat sources:**

| Pattern | Problem | Fix |
|---|---|---|
| `import * as _ from 'lodash'` | Imports entire 71KB library | `import debounce from 'lodash/debounce'` |
| `import { format } from 'date-fns'` | Tree-shaking may fail | Verify with bundle analyzer |
| Large icon libraries | `import { Icon } from 'react-icons/all'` | Import from specific sub-path |
| Moment.js | 67KB + locale files | Replace with `date-fns` or `dayjs` |

**Dynamic imports for non-critical components:**
```typescript
import dynamic from 'next/dynamic';

// Heavy component not needed on initial load
const RichTextEditor = dynamic(() => import('@/features/editor'), {
  loading: () => <EditorSkeleton />,
  ssr: false, // if the component uses browser APIs
});
```

---

## Image Optimization

```typescript
import Image from 'next/image';

// CORRECT: always specify width, height, and priority for LCP images
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={630}
  priority  // preloads the LCP image — use only for above-the-fold
  sizes="(max-width: 768px) 100vw, 1200px"
/>

// WRONG: using <img> directly loses optimization
<img src="/hero.jpg" alt="Hero" /> {/* no optimization, no lazy loading */}
```

**Priority rule:** Use `priority` only on the LCP image.
Multiple `priority` images defeat the purpose — the browser
cannot prioritize everything equally.

---

## Font Loading

```typescript
// next/font eliminates FOUT and prevents layout shift
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',      // show fallback font while loading
  variable: '--font-inter', // CSS variable for use in Tailwind
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
```

Never import fonts via CSS `@import` — it creates a render-blocking
request chain. Always use `next/font`.