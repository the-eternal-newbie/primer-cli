# /audit-accessibility

Verify the accessibility tree, semantic HTML correctness, focus
management, ARIA usage, and keyboard navigation paths.

## Before executing

Read `docs/skills/frontend/knowledge/architecture.md` section on
the shared UI layer — accessibility fixes often belong in shared
components and propagate to the entire application.

## Steps

1. Install automated accessibility scanning:
```bash
   pnpm add -D @axe-core/react axe-playwright
```

   Configure axe in development:
```typescript
   // src/app/providers.tsx
   if (process.env.NODE_ENV !== 'production') {
     const { default: ReactDOM } = await import('react-dom');
     const axe = await import('@axe-core/react');
     axe.default(React, ReactDOM, 1000);
     // Reports violations to the browser console
   }
```

2. Run automated scan and triage violations:
```bash
   # Playwright accessibility audit
   pnpm exec playwright test --grep "a11y"
```

```typescript
   // tests/a11y/pages.test.ts
   import { test, expect } from '@playwright/test';
   import AxeBuilder from '@axe-playwright/playwright';

   test('homepage has no accessibility violations', async ({ page }) => {
     await page.goto('/');
     const results = await new AxeBuilder({ page }).analyze();
     expect(results.violations).toEqual([]);
   });
```

   Violations are classified by impact:
   - **Critical:** Must fix — prevents access for some users
   - **Serious:** Should fix — significantly impairs access
   - **Moderate:** Should fix — creates barriers for some users
   - **Minor:** Nice to fix — minor inconvenience

3. Audit semantic HTML structure:
```bash
   # Check for missing landmark regions
   grep -rn "<div" src --include="*.tsx" | wc -l
   # High div count is a signal — review for missing semantic elements

   # Verify heading hierarchy
   # h1 → h2 → h3, never skip levels
   grep -rn "<h[1-6]" src --include="*.tsx" | sort
```

   Required semantic structure:
```html
   <header>        ← site header
   <nav>           ← navigation (use aria-label if multiple nav elements)
   <main>          ← main content (only one per page)
   <aside>         ← sidebar content
   <footer>        ← site footer
   <section>       ← thematic grouping (requires heading)
   <article>       ← self-contained content
```

4. Audit interactive element accessibility:
```bash
   # Find buttons without accessible names
   grep -rn "<button" src --include="*.tsx" -A 2 \
     | grep -v "aria-label\|aria-labelledby\|children"

   # Find icon-only buttons (common accessibility failure)
   grep -rn "<button" src --include="*.tsx" -A 3 \
     | grep -E "<svg|<Icon|<Lucide"
```

   Fix icon-only buttons:
```typescript
   // WRONG: no accessible name
   <button onClick={close}>
     <XIcon />
   </button>

   // CORRECT: aria-label provides the accessible name
   <button onClick={close} aria-label="Close dialog">
     <XIcon aria-hidden="true" />
   </button>
```

5. Audit focus management:
   - Tab through the entire page — every interactive element must be reachable
   - Focus indicator must be visible at 3:1 contrast minimum against adjacent colors
   - Focus order must match visual reading order
   - Dialogs must trap focus inside when open and return focus on close

```typescript
   // Shadcn Dialog handles focus trap automatically via Radix UI
   // Verify focus returns to trigger after close:
   <Dialog onOpenChange={(open) => {
     if (!open) triggerRef.current?.focus();
   }}>
```

6. Audit color and contrast:
```bash
   # Use axe DevTools browser extension for contrast checking
   # Or run programmatically:
   pnpm dlx @contrast-checker/cli --url http://localhost:3000
```

   Requirements:
   - Normal text: 4.5:1 contrast ratio minimum (WCAG AA)
   - Large text (18pt+ or 14pt bold): 3:1 minimum
   - Interactive focus indicators: 3:1 against adjacent color
   - Non-text elements (icons, borders): 3:1 minimum

7. Audit touch target sizes:
```bash
   # Find small interactive elements
   grep -rn "className" src --include="*.tsx" \
     | grep -E "w-[1-5] |h-[1-5] |p-0 |p-1 "
```

   Minimum sizes:
   - Absolute minimum: 24×24px (WCAG 2.2 Success Criterion 2.5.8)
   - Recommended for primary actions: 44×44px

8. Test keyboard navigation manually:
   - Tab: move to next interactive element
   - Shift+Tab: move to previous
   - Enter/Space: activate buttons and links
   - Escape: close dialogs, menus, tooltips
   - Arrow keys: navigate within menus, radio groups, sliders

9. Produce an accessibility report:
   - Critical violations (must fix before release)
   - Serious violations (fix in current sprint)
   - Moderate violations (fix in next sprint)
   - Manual test results (keyboard nav, focus management)
   - Contrast failures by component

## Do not

- Never use ARIA to fix semantic HTML problems — use correct HTML first
- Never use `aria-hidden="true"` on focusable elements
- Never remove the focus outline with `outline: none` without
  providing an equivalent visible focus indicator
- Never rely solely on automated tools — keyboard and screen reader
  testing is required for complete coverage
- Never mark an accessibility audit complete without manual
  keyboard navigation testing