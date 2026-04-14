# /optimize-vitals

Identify and fix Core Web Vitals bottlenecks — LCP, INP, and CLS —
through targeted architectural changes.

## Before executing

Read `docs/skills/frontend/knowledge/performance.md` sections on
"Top-Level Await and Streaming" and "Async Boundaries in Layouts
Disable Streaming".
Read `docs/skills/frontend/knowledge/rsc-boundary.md` section on
Next.js App Router caching.

## Steps

1. Measure current baselines before making any changes:
```bash
   # Run Lighthouse CI against production or staging
   pnpm dlx lighthouse-ci autorun

   # Or use Next.js built-in analytics
   # Add to next.config.ts:
   # experimental: { webVitalsAttribution: ['CLS', 'LCP', 'INP'] }
```
   Record: LCP score, INP score, CLS score, TTFB, bundle sizes.

2. Identify LCP bottlenecks:
```bash
   # Find the LCP element using Chrome DevTools:
   # Performance tab → record page load → find "LCP" marker
   # Identify: is it an image, text block, or background image?
```

   **If LCP is an image:**
```typescript
   // Add priority to the LCP image
   <Image src={heroImage} alt="Hero" priority width={1200} height={630}
     sizes="(max-width: 768px) 100vw, 1200px" />
```

   **If LCP is text blocked by layout shift:**
```typescript
   // Use next/font to eliminate FOUT
   import { Inter } from 'next/font/google';
   const inter = Inter({ subsets: ['latin'], display: 'swap' });
```

   **If LCP is blocked by a slow server response:**
```typescript
   // Move slow data fetches inside Suspense boundaries
   // The page shell (including the LCP element placeholder) streams first
   export default function Page() {
     return (
       <>
         <HeroSection /> {/* renders immediately — contains LCP element */}
         <Suspense fallback={<ContentSkeleton />}>
           <SlowContent /> {/* fetches after shell streams */}
         </Suspense>
       </>
     );
   }
```

3. Identify INP bottlenecks:
```bash
   # Use Chrome DevTools → Performance tab → Interactions
   # Long tasks > 50ms on the main thread degrade INP
```

   **Fix long event handlers:**
```typescript
   // WRONG: synchronous heavy computation in event handler
   function handleClick() {
     const result = heavyComputation(data); // blocks main thread
     setState(result);
   }

   // CORRECT: yield to the browser between chunks
   async function handleClick() {
     // Process in chunks, yielding between each
     for (const chunk of chunks) {
       processChunk(chunk);
       await new Promise(resolve => setTimeout(resolve, 0)); // yield
     }
   }

   // CORRECT: move heavy computation to a Web Worker
   const worker = new Worker('/workers/heavy-computation.js');
   worker.postMessage(data);
   worker.onmessage = (e) => setState(e.data);
```

4. Identify and fix CLS sources:
```bash
   # Find images without explicit dimensions
   grep -rn "<img " src --include="*.tsx" | grep -v "width\|height"
   grep -rn "<Image " src --include="*.tsx" | grep -v "width\|height\|fill"
```

```typescript
   // Fix: always provide dimensions or use fill with a sized container
   <div style={{ position: 'relative', height: '400px' }}>
     <Image src={image} alt="Product" fill style={{ objectFit: 'cover' }} />
   </div>
```

5. Analyze and reduce bundle size:
```bash
   ANALYZE=true pnpm build
   # Opens bundle analyzer — identify chunks > 100KB
```

   For each large chunk:
   - Is it used on the initial render? If not: `dynamic(() => import(...))`
   - Is it a large library with a smaller alternative?
   - Is it imported incorrectly (full library instead of specific function)?

6. Verify parallel data fetching (eliminate server-side waterfalls):
```typescript
   // WRONG: sequential — 300ms + 200ms = 500ms total
   async function Page() {
     const user = await getUser();         // 300ms
     const posts = await getUserPosts();   // 200ms
     return <Dashboard user={user} posts={posts} />;
   }

   // CORRECT: parallel — max(300ms, 200ms) = 300ms total
   async function Page() {
     const [user, posts] = await Promise.all([
       getUser(),        // 300ms
       getUserPosts(),   // 200ms — runs concurrently
     ]);
     return <Dashboard user={user} posts={posts} />;
   }
```

7. Measure again after each fix and compare to baseline:
```bash
   pnpm build && pnpm start
   # Run Lighthouse against local production build
   pnpm dlx lighthouse http://localhost:3000 --view
```

8. Produce an optimization report:
   - Before/after scores for LCP, INP, CLS
   - Changes made with rationale
   - Remaining issues with estimated impact

## Do not

- Never optimize without measuring first — guessing wastes time
- Never add `priority` to more than one or two images per page
- Never use `suppressHydrationWarning` as a performance fix
- Never skip the re-measurement step — regressions are common