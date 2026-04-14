# /heal-test

Update broken Playwright E2E tests after UI changes by identifying
equivalent DOM elements and replacing stale locators.

## Before executing

Read `docs/skills/testing/knowledge/test-strategy.md` section on
the quarantine pattern — a test being healed must first be
quarantined until the healed version is verified.

## Steps

1. Quarantine the failing test immediately:
```typescript
   // Mark as quarantined before beginning any repair work
   it.skip('[QUARANTINED - healing] user can complete checkout', async () => {
     // ...
   });
```

2. Run the failing test in headed mode with Playwright trace enabled
   to understand exactly what changed:
```bash
   # Run with trace to capture the failure
   playwright test tests/e2e/checkout.test.ts \
     --headed \
     --trace on \
     --reporter=list

   # Open the trace viewer
   playwright show-trace test-results/trace.zip
```

3. In the trace viewer, identify the failing step:
   - Find the step that produced a timeout or element-not-found error
   - Screenshot shows the actual DOM at the time of failure
   - Note: what the old locator was targeting, what has changed

4. Inspect the current DOM to find the equivalent element:
```bash
   # Open Playwright inspector to explore the live page
   playwright codegen http://localhost:3000/checkout
```

   Priority order for locator selection (most to least resilient):
```typescript
   // 1. Role-based (best — tied to semantic meaning, not implementation)
   page.getByRole('button', { name: 'Complete purchase' })

   // 2. Label-based (excellent — tests accessibility too)
   page.getByLabel('Card number')

   // 3. Test ID (good — explicit, stable, not tied to visual design)
   page.getByTestId('checkout-submit-button')

   // 4. Text content (acceptable for unique, stable text)
   page.getByText('Complete purchase')

   // 5. CSS class or XPath (last resort — brittle, avoid)
   page.locator('.checkout-btn') // ✗ breaks on style changes
   page.locator('//button[@class="btn primary"]') // ✗ very brittle
```

5. Update the test with the new locator:
```typescript
   // Before (stale locator)
   await page.locator('.checkout-submit').click();

   // After (resilient locator)
   await page.getByRole('button', { name: 'Complete purchase' }).click();
```

6. If the test structure changed (not just the locator), review
   whether the test still validates the correct behavior:
   - Does the new flow still test the same user journey?
   - Are the assertions still meaningful?
   - Does the test still fail when the feature is broken?

7. Run the healed test in isolation to verify it passes:
```bash
   playwright test tests/e2e/checkout.test.ts --headed
```

8. Run the healed test 5 times to verify it is not flaky:
```bash
   playwright test tests/e2e/checkout.test.ts --repeat-each=5
```

9. **Human review required before un-quarantining:**
   - Present the old and new locators side by side
   - Confirm the test still validates the correct behavior
   - Confirm the test fails when the feature is intentionally broken
   - Get explicit sign-off from a team member who understands
     the feature being tested

10. Un-quarantine only after human review sign-off:
```typescript
    // Remove it.skip — test is back in the active suite
    it('user can complete checkout', async ({ page }) => {
      // healed implementation
    });
```

## Do not

- Never un-quarantine a healed test without human review —
  a weaker locator can make a test pass even when the feature is broken
- Never heal a test by making assertions less strict to avoid failures —
  this defeats the purpose of the test
- Never use CSS class locators in healed tests — they will break again
- Never mark a test as healed without running it at least 5 times
  to verify stability