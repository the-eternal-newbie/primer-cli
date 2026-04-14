# /diagnose-flakiness

Analyze CI execution logs and pass/fail histories to identify the
root cause of intermittent test failures and classify them for
targeted remediation.

## Before executing

Read `docs/skills/testing/knowledge/test-strategy.md` sections on
the quarantine pattern and pipeline speed limits.
Read `docs/skills/testing/knowledge/ai-code-failures.md` section on
race conditions — many flaky tests expose real race conditions in
application code.

## Steps

1. Quarantine the flaky test immediately before diagnosis:
```typescript
   it.skip('[QUARANTINED - diagnosing] payment webhook delivery', async () => {
     // ...
   });
```

2. Collect the failure history from CI:
```bash
   # GitHub Actions — view run history
   gh run list --workflow=ci.yml --limit=50 --json status,conclusion,url

   # Download logs for failed runs
   gh run download <run-id> --name=test-results
```

   Record:
   - Failure rate (failures / total runs over last 30 days)
   - Time of day pattern (more failures at peak load?)
   - Which CI runner (same runner always? random?)
   - Error message and stack trace consistency

3. Classify the root cause using this decision tree:

   **Async timing issues:**
   - Symptom: test fails with timeout or "element not found"
     after passing intermittently
   - Evidence: failure rate correlates with CI load or runner speed
   - Diagnosis: missing or insufficient dynamic wait
   - Fix: replace fixed sleeps with `page.waitForSelector`,
     `vi.waitFor()`, or network request interception

   **Data race / order dependency:**
   - Symptom: test passes alone but fails in the full suite
   - Evidence: failure only occurs after specific other tests run
   - Diagnosis: shared mutable state between tests
   - Fix: enforce data isolation (transaction rollback or fresh seed)

   **External dependency flakiness:**
   - Symptom: test fails with network error or timeout
   - Evidence: failure correlates with third-party API availability
   - Diagnosis: test depends on a real external service
   - Fix: mock or record the external dependency

   **Resource exhaustion:**
   - Symptom: failures increase over time within a run,
     early tests pass, late tests fail
   - Evidence: open handle warnings, connection pool errors
   - Diagnosis: resource leak — connections, file handles, timers
   - Fix: enforce cleanup in afterEach/afterAll

   **Race condition in application code:**
   - Symptom: test catches a real bug — the application
     behaves differently under concurrent load
   - Evidence: failure rate increases under parallel test execution
   - Diagnosis: genuine concurrency bug in application code
   - Fix: fix the application code (see ai-code-failures.md),
     add a concurrency test to prevent regression

4. Reproduce the failure locally:
```bash
   # Run the test repeatedly to reproduce intermittent failure
   vitest run --reporter=verbose tests/payment.test.ts \
     --sequence.repeat=50

   # For Playwright
   playwright test tests/e2e/webhook.test.ts --repeat-each=20
```

5. For async timing issues, add explicit waits:
```typescript
   // Before (flaky)
   await page.click('[data-testid="submit"]');
   await page.screenshot(); // captures before navigation completes

   // After (stable)
   await page.click('[data-testid="submit"]');
   await page.waitForURL('/success'); // wait for the expected state
   await page.screenshot();
```

6. For data race issues, enforce isolation:
```typescript
   // Before (order-dependent)
   let userId: string;
   beforeAll(async () => {
     userId = (await createUser()).id; // shared across tests
   });

   // After (isolated)
   let userId: string;
   beforeEach(async () => {
     userId = (await createUser()).id; // fresh per test
   });
   afterEach(async () => {
     await prisma.user.delete({ where: { id: userId } });
   });
```

7. Produce a flakiness diagnosis report:
   - Test name and location
   - Failure rate (%)
   - Root cause classification
   - Evidence supporting the classification
   - Proposed fix
   - Estimated remediation effort (hours)
   - Priority: Critical (blocks deployment) / High / Medium

8. After applying the fix, verify stability:
```bash
   # Run 50 times in CI-equivalent conditions
   vitest run --sequence.repeat=50 <test-file>
```
   Zero failures in 50 runs is the minimum bar for
   un-quarantining a previously flaky test.

## Do not

- Never configure automatic retries (retry: 3) as a permanent
  solution — retries mask root causes and slow down CI
- Never un-quarantine a test after a single passing run —
  50 consecutive passes is the minimum bar
- Never diagnose flakiness by reading code alone —
  reproduce the failure first, then read the code
- Never ignore a flaky test that fails with a real application
  error — it may be exposing a genuine production bug