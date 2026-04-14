# Advanced Hydration Mechanics

Hydration is the process of attaching React event handlers to
server-rendered HTML. When hydration fails, React either throws
a visible error or silently produces a broken UI. Understanding
why hydration fails is required to prevent it.

## How Hydration Works

1. Server renders the component tree to HTML
2. Browser displays the HTML immediately (fast initial paint)
3. React downloads, parses, and executes the JavaScript bundle
4. React renders the component tree again in memory
5. React compares the in-memory tree to the existing DOM (reconciliation)
6. If they match: React attaches event handlers — hydration succeeds
7. If they differ: React throws a hydration error or silently patches

**The critical constraint:** The server render and the client render
must produce identical output. Any source of non-determinism in the
render path will cause a mismatch.

---

## Sources of Hydration Failure

### 1. Non-Deterministic Values in the Render Path

```typescript
// WRONG: Math.random() produces different values on server and client
function Avatar() {
  const seed = Math.random(); // server: 0.432, client: 0.891 → MISMATCH
  return <img src={`https://avatar.example.com/${seed}`} />;
}

// WRONG: Date.now() or new Date() without stabilization
function Timestamp() {
  return <span>{new Date().toLocaleTimeString()}</span>;
  // server: "14:23:01", client (50ms later): "14:23:01" — may match
  // but: client (after bundle loads, 2s later): "14:23:03" → MISMATCH
}

// CORRECT: Generate random values server-side and pass as props
async function ServerWrapper() {
  const seed = crypto.randomUUID(); // stable, generated once on server
  return <Avatar seed={seed} />;
}

// CORRECT: Use suppressHydrationWarning for intentionally dynamic values
function Timestamp() {
  return (
    <time suppressHydrationWarning>
      {new Date().toLocaleTimeString()}
    </time>
    // suppressHydrationWarning: React skips this node during reconciliation
    // Use sparingly — only for values that are intentionally dynamic
  );
}
```

### 2. Browser-Only APIs During SSR

```typescript
// WRONG: window is not defined on the server
function ThemeToggle() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // ^ ReferenceError on server → component fails to render
}

// WRONG: localStorage is not defined on the server
function UserPreferences() {
  const theme = localStorage.getItem('theme'); // ReferenceError on server
}

// CORRECT: Access browser APIs only after mount
'use client'
function ThemeToggle() {
  const [isDark, setIsDark] = useState(false); // safe default for SSR

  useEffect(() => {
    // useEffect only runs on the client, after hydration
    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  return <button>{isDark ? '🌙' : '☀️'}</button>;
}
```

### 3. useLayoutEffect on the Server

```typescript
// WRONG: useLayoutEffect fires synchronously after DOM mutations
// React warns: "useLayoutEffect does nothing on the server"
'use client'
function MeasureElement() {
  useLayoutEffect(() => {
    // This runs on client after paint — fine
    // But React warns when SSR renders this component
  }, []);
}

// CORRECT: Use useIsomorphicLayoutEffect
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

### 4. Invalid HTML Nesting

The browser silently "fixes" invalid HTML before React hydrates.
React's in-memory tree does not match the browser's corrected DOM.

```typescript
// WRONG: <p> cannot contain block-level elements
function Article() {
  return (
    <p>
      <div>Content</div> {/* browser moves <div> outside <p> */}
    </p>
  );
}

// WRONG: <a> cannot contain interactive elements
function NavItem() {
  return (
    <a href="/page">
      <button>Click me</button> {/* invalid nesting */}
    </a>
  );
}

// WRONG: <button> cannot contain <button>
// WRONG: <table> content must follow strict rules (thead, tbody, tr, td/th)
// WRONG: <li> must be a direct child of <ul> or <ol>

// CORRECT: Use div/span for layout, semantic elements correctly
function NavItem() {
  return (
    <a href="/page" role="button">
      Click me
    </a>
  );
}
```

---

## Diagnosing Hydration Errors

**Error message: "Hydration failed because the initial UI does not match what was rendered on the server"**

Steps to diagnose:
1. Open browser devtools → React DevTools → Components
2. Look for the component highlighted in the hydration error
3. Check for: random values, Date usage, browser APIs, invalid nesting
4. Add `suppressHydrationWarning` temporarily to isolate which node mismatches
5. Fix the root cause — suppress only as a last resort for intentionally dynamic nodes

**Error message: "Text content does not match server-rendered HTML"**

Usually caused by:
- Locale-dependent formatting (number formatting, date formatting)
- User agent sniffing in the render path
- Environment-specific values (NODE_ENV checks in render)

---

## The Correct Mental Model

Think of the server render as a "snapshot" and the client render
as an "exact copy" of that snapshot. Anything that cannot produce
the exact same output from both environments must be deferred to
after hydration using `useEffect`.