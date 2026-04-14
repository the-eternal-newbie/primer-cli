# /audit-hydration

Scan the component tree for hydration mismatches, browser-only API
usage during SSR, invalid DOM nesting, and non-deterministic rendering.

## Before executing

Read `docs/skills/frontend/knowledge/hydration.md` in full.
Read `docs/skills/frontend/knowledge/rsc-boundary.md` section on
when to use Client Components.

## Steps

1. Scan for non-deterministic values in the render path:
```bash
   # Find Math.random() in component files
   grep -r "Math\.random()" src --include="*.tsx" --include="*.ts" \
     | grep -v "\.test\." | grep -v "\.spec\."

   # Find Date.now() in component files
   grep -r "Date\.now()" src --include="*.tsx" \
     | grep -v "\.test\." | grep -v "\.spec\."

   # Find new Date() in render paths (not in useEffect/event handlers)
   grep -rn "new Date()" src --include="*.tsx"
```
   For each match: verify it is inside `useEffect`, an event handler,
   or a Server Component that passes the result as a stable prop.
   Flag any match in the direct render path of a Client Component.

2. Scan for browser-only API usage outside `useEffect`:
```bash
   # Find window usage
   grep -rn "window\." src --include="*.tsx" \
     | grep -v "useEffect\|useLayoutEffect\|typeof window"

   # Find localStorage/sessionStorage
   grep -rn "localStorage\|sessionStorage" src --include="*.tsx" \
     | grep -v "useEffect\|useLayoutEffect\|typeof window"

   # Find document usage
   grep -rn "document\." src --include="*.tsx" \
     | grep -v "useEffect\|useLayoutEffect"
```

3. Detect `useLayoutEffect` in components that render on the server:
```bash
   grep -rn "useLayoutEffect" src --include="*.tsx"
```
   For each match: verify the file has `'use client'` at the top.
   If the component renders on the server, replace with
   `useIsomorphicLayoutEffect` pattern.

4. Scan for invalid HTML nesting patterns:
```bash
   # Detect <p> containing block elements
   grep -rn "<p>" src --include="*.tsx" -A 5 \
     | grep -E "<div|<section|<article|<header|<footer|<ul|<ol"

   # Detect <a> containing interactive elements
   grep -rn "<a " src --include="*.tsx" -A 5 \
     | grep -E "<button|<a |<input|<select|<textarea"

   # Detect <button> containing <button>
   grep -rn "<button" src --include="*.tsx" -A 5 | grep "<button"
```

5. Check for non-serializable props crossing the RSC boundary:
```bash
   # Find components that receive function props from Server Components
   # Look for props typed as Function, () => void, etc. in Server Components
   grep -rn "onClick\|onChange\|onSubmit" src/app --include="*.tsx" \
     | grep -v "'use client'"
```

6. Run Next.js build to surface hydration errors:
```bash
   pnpm build 2>&1 | grep -i "hydrat\|mismatch\|warning"
```

7. Test in the browser with React DevTools:
   - Open DevTools → Console tab
   - Look for: "Warning: Prop `X` did not match"
   - Look for: "Error: Hydration failed"
   - Look for: "Warning: An update to X inside a test was not wrapped in act"

8. Produce a findings report:
   - Critical: non-deterministic render values, browser APIs in render path
   - High: invalid HTML nesting, useLayoutEffect without 'use client'
   - Medium: non-serializable prop patterns, missing suppressHydrationWarning
     on intentionally dynamic values

## Do not

- Never use suppressHydrationWarning to silence bugs — only use it
  for intentionally dynamic values like timestamps
- Never add 'use client' to fix a hydration error without understanding
  why the mismatch occurred
- Never ignore hydration warnings in development — they indicate
  real production bugs