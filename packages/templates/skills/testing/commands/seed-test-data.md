# /seed-test-data

Provision isolated test databases and generate schema-compliant
synthetic data without cross-test state leakage.

## Before executing

Read `docs/skills/testing/knowledge/test-strategy.md` sections on
data isolation patterns and the quarantine pattern.
Read `docs/skills/testing/knowledge/ai-code-failures.md` section on
race conditions to understand what the test data must stress-test.

## Steps

1. Select the isolation strategy based on test type:
   - Unit tests: no database — use in-memory fakes or mocks
   - Integration tests: transaction rollback (fastest) or
     test containers (most accurate)
   - E2E tests: dedicated test database with snapshot restore

2. Install test data tooling:
```bash
   pnpm add -D @faker-js/faker @testcontainers/postgresql
```

3. Create typed factory functions for each entity:
```typescript
   // tests/factories/user.factory.ts
   import { faker } from '@faker-js/faker';
   import type { Prisma } from '@prisma/client';

   export function buildUser(
     overrides: Partial<Prisma.UserCreateInput> = {}
   ): Prisma.UserCreateInput {
     return {
       id: faker.string.uuid(),
       email: faker.internet.email(),
       name: faker.person.fullName(),
       createdAt: faker.date.past(),
       plan: 'free',
       ...overrides,
     };
   }

   // Persist to database
   export async function createUser(
     overrides: Partial<Prisma.UserCreateInput> = {}
   ) {
     return prisma.user.create({ data: buildUser(overrides) });
   }
```

4. Implement transaction rollback isolation for integration tests:
```typescript
   // tests/setup/database.ts
   import { beforeEach, afterEach } from 'vitest';
   import { prisma } from '@/shared/api/client';

   export function useIsolatedDatabase() {
     beforeEach(async () => {
       // Begin transaction — all test operations run inside it
       await prisma.$executeRaw`BEGIN`;
     });

     afterEach(async () => {
       // Roll back — no data persists between tests
       await prisma.$executeRaw`ROLLBACK`;
     });
   }
```

5. For E2E tests, use Testcontainers for a real isolated database:
```typescript
   // tests/setup/e2e-database.ts
   import { PostgreSqlContainer } from '@testcontainers/postgresql';

   let container: StartedPostgreSqlContainer;

   export async function startTestDatabase() {
     container = await new PostgreSqlContainer('postgres:16')
       .withDatabase('test_db')
       .start();

     process.env.DATABASE_URL = container.getConnectionUri();

     // Run migrations against the fresh container
     execSync('pnpm prisma migrate deploy');

     return container;
   }

   export async function stopTestDatabase() {
     await container?.stop();
   }
```

6. Seed scenario-specific data for each test:
```typescript
   describe('Payment flow', () => {
     it('prevents overdraft', async () => {
       // Seed exactly the state this test needs
       const user = await createUser({ plan: 'free' });
       const account = await createAccount({
         userId: user.id,
         balance: 50_00, // $50.00 in cents
       });

       // Test the specific scenario
       await expect(
         transferFunds(account.id, 'other-account', 100_00)
       ).rejects.toThrow('Insufficient funds');
     });
   });
```

7. Generate bulk data for load and performance tests:
```typescript
   // Generate 10,000 users with realistic distribution
   async function seedLoadTestData() {
     const users = Array.from({ length: 10_000 }, () => buildUser({
       plan: faker.helpers.weightedArrayElement([
         { weight: 70, value: 'free' },
         { weight: 25, value: 'pro' },
         { weight: 5, value: 'enterprise' },
       ]),
     }));

     // Batch insert for performance
     await prisma.user.createMany({ data: users, skipDuplicates: true });
   }
```

## Do not

- Never use production data in tests — even anonymized production
  data creates GDPR compliance risk in test environments
- Never share factory instances between tests — always create fresh data
- Never hardcode IDs in factories — always generate with faker.string.uuid()
- Never seed data in beforeAll and mutate it in individual tests —
  mutations create order dependencies