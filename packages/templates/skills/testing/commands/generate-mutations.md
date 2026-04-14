# /generate-mutations

Inject deliberate faults into the codebase, run the test suite
against each mutant, and calculate a mutation score to verify
the test suite actually catches regressions.

## Before executing

Read `docs/skills/testing/knowledge/mutation-testing.md` in full.
Read `docs/skills/testing/knowledge/ai-code-failures.md` — mutation
testing is the primary defense against AI-generated logical errors.

## Steps

1. Install Stryker:
```bash
   pnpm add -D @stryker-mutator/core @stryker-mutator/vitest-runner \
     @stryker-mutator/typescript-checker
```

2. Initialize Stryker configuration:
```bash
   pnpm stryker init
```

   Update the generated config:
```typescript
   // stryker.config.mts
   import type { Config } from '@stryker-mutator/core';

   export default {
     testRunner: 'vitest',
     checkers: ['typescript'],
     tsconfigFile: 'tsconfig.json',
     mutate: [
       'src/**/*.ts',
       'src/**/*.tsx',
       '!src/**/*.test.ts',
       '!src/**/*.spec.ts',
       '!src/**/*.d.ts',
       '!src/shared/config/**',  // exclude configuration files
     ],
     reporters: ['html', 'progress', 'dashboard'],
     htmlReporter: { fileName: 'reports/mutation/index.html' },
     thresholds: {
       high: 80,
       low: 60,
       break: 50,
     },
     timeoutMS: 30000,
     concurrency: 4,
   } satisfies Config;
```

3. Run mutation tests on a specific high-value module first:
```bash
   # Start with business-critical logic
   pnpm stryker run \
     --mutate "src/features/payment/payment.service.ts"
```

4. Review the HTML report:
```bash
   open reports/mutation/index.html
```

   For each surviving mutant:
   - **Is it a real gap?** Add a test that catches this mutation.
   - **Is it an equivalent mutant?** Document it with a comment
     and mark as acceptable.
   - **Is it in non-critical code?** Record it in the mutation
     findings log and prioritize by business impact.

5. Write tests to kill surviving mutants:
```typescript
   // Surviving mutant: balance >= amount → balance > amount
   // Add boundary test:
   it('allows transfer when balance exactly equals amount', async () => {
     const account = await createAccount({ balance: 100_00 });
     await expect(
       transferFunds(account.id, 'target', 100_00)
     ).resolves.not.toThrow();
   });

   // Surviving mutant: audit log call removed
   // Add verification of side effects:
   it('records audit log entry for every transfer', async () => {
     const account = await createAccount({ balance: 200_00 });
     await transferFunds(account.id, 'target', 100_00);

     const logs = await prisma.auditLog.findMany({
       where: { entityType: 'transfer' },
     });
     expect(logs).toHaveLength(1);
     expect(logs[0]).toMatchObject({
       action: 'TRANSFER',
       amount: 100_00,
     });
   });
```

6. Run the full mutation suite and record the score:
```bash
   pnpm stryker run
```

7. Produce a mutation findings report:
   - Overall mutation score
   - Score per module (highest risk modules first)
   - List of surviving mutants with business impact classification
   - Tests written to address gaps
   - Equivalent mutants documented and accepted

## Do not

- Never run mutation tests on every PR — they are slow by design.
  Run nightly in CI or on-demand for changed modules only.
- Never accept surviving mutants in core business logic without
  explicit documentation explaining why the mutation is safe
- Never use mutation score as the only quality metric —
  a high score with poor test design is still a poor test suite
- Never mutate configuration, generated code, or test files themselves