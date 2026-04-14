# Test Strategy and Pipeline Architecture

A test suite that takes 45 minutes to run and produces 30 flaky
failures is worse than no test suite — it trains the team to ignore
CI results. Test strategy is an architectural decision, not an
afterthought.

## The Test Pyramid

```
        /\
       /E2E\          Few — verify critical user journeys end-to-end
      /──────\
     /Integr. \       Some — verify service boundaries and contracts
    /────────────\
   /  Unit Tests  \   Many — verify business logic in isolation
  /────────────────\
```

**Unit tests:** Test a single function or class in complete isolation.
No network, no database, no filesystem. Fast (< 1ms per test).
Best for: business logic, data transformations, utility functions.

**Integration tests:** Test multiple components working together,
including real dependencies (database, cache, external APIs via mocks).
Slower (10ms - 1s per test). Best for: API endpoints, database queries,
service interactions.

**E2E tests:** Test the full application stack from the user's
perspective in a real browser. Slowest (5s - 60s per test).
Best for: critical user journeys only — login, checkout, core workflows.

**The common mistake:** Writing E2E tests for everything because
they "test the real thing." E2E tests are expensive to write,
expensive to run, and brittle to maintain. Reserve them for the
10-15 most critical user flows.

---

## Data Isolation Patterns

### Transaction Rollback (fastest)
Wrap each test in a database transaction and roll back after the test.
The database never sees the data — no cleanup required.

```typescript
// Vitest with Prisma — correct rollback pattern
import { test, expect } from 'vitest';
import { prisma } from '@/shared/api/client';

// Sentinel error used to force rollback after each test body completes
const ROLLBACK = new Error('rollback test transaction');

// Wrapper that runs each test inside a transaction and rolls it back
async function testWithRollback(
  name: string,
  fn: (tx: typeof prisma) => Promise<void>
) {
  test(name, async () => {
    try {
      await prisma.$transaction(async (tx) => {
        // All DB operations inside fn use the tx client
        await fn(tx as unknown as typeof prisma);
        // Force rollback after the test body — no data persists
        throw ROLLBACK;
      });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }
  });
}

// Usage
testWithRollback('creates a user', async (tx) => {
  const user = await tx.user.create({
    data: { email: 'test@example.com', name: 'Test User' },
  });
  expect(user.email).toBe('test@example.com');
  // Transaction is rolled back — user never persists to the database
});
```

**Key requirement:** All database access inside the test must use the
`tx` client passed to the callback — not the global `prisma` client.
Operations on the global `prisma` client will run outside the transaction
and will not be rolled back.

### In-Memory Database (fastest, most isolated)
Use an in-memory SQLite database for tests that don't require
PostgreSQL-specific features.

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
});

// tests/setup.ts
import { execSync } from 'node:child_process';

beforeAll(() => {
  process.env.DATABASE_URL = 'file::memory:?cache=shared';
  execSync('prisma migrate deploy');
});
```

### Test Containers (production-equivalent)
Spin up real database containers per test suite using Testcontainers.
Slowest but most accurate — uses the exact same database as production.

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  process.env.DATABASE_URL = container.getConnectionUri();
  // Run migrations
});

afterAll(async () => {
  await container.stop();
});
```

---

## The Quarantine Pattern

A flaky test is not a passing test — it is an unreliable test that
erodes confidence in the entire CI pipeline.

**Never:** Re-run the test until it passes and merge anyway.
**Never:** Disable the test and create a ticket that never gets fixed.
**Always:** Quarantine immediately, track for remediation.

```typescript
// Vitest: mark flaky tests explicitly
it.skip('payment webhook retry — known flaky, quarantined 2026-04-14', async () => {
  // Test body preserved for remediation reference
});

// Or use a custom quarantine wrapper
function quarantine(name: string, _fn: () => void) {
  it.skip(`[QUARANTINED] ${name}`, () => {});
}

quarantine('payment webhook retry', async () => {
  // ...
});
```

Quarantined tests must be:
- Tracked in a dedicated issue with root cause analysis
- Assigned an owner for remediation
- Reviewed weekly — a test quarantined for > 2 weeks is deleted
  and rewritten from scratch

---

## CI Pipeline Speed Limits

Critical feedback path target: **5-10 minutes** from push to result.

**Parallelization strategy:**

```yaml
# GitHub Actions matrix — run test shards in parallel
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run Vitest shard
        run: vitest run --shard=${{ matrix.shard }}/4

      - name: Run Playwright shard
        run: playwright test --shard=${{ matrix.shard }}/4
```

**Speed optimization checklist:**
- [ ] Unit tests complete in < 60 seconds
- [ ] Integration tests complete in < 3 minutes
- [ ] E2E tests run in parallel shards, complete in < 5 minutes
- [ ] Test database setup/teardown < 10 seconds per suite
- [ ] No test waits on real external APIs — use mocks or recorded fixtures
- [ ] Vitest runs in `--reporter=dot` mode in CI (faster output)
- [ ] Playwright runs headless in CI

**Turborepo task caching for monorepos:**

```json
// turbo.json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

If no source files changed, Turborepo serves the cached test result
without re-running — eliminating redundant test execution across
packages in a monorepo.