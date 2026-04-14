# AI-Specific Code Failure Modes

AI agents introduce systemic failure patterns that traditional testing
misses. Standard happy-path functional tests are insufficient for
AI-generated code. A testing agent must understand these failure modes
and actively design tests to catch them.

## Knowledge Conflicting Hallucinations (KCHs)

AI agents frequently invent non-existent API parameters, method
signatures, or library behaviors that are semantically plausible
but factually incorrect. These errors compile successfully, pass
linters, and only fail at runtime — often in production.

**Common KCH patterns:**

```typescript
// KCH: invented parameter name
// Prisma's actual parameter is 'where', not 'filter'
const user = await prisma.user.findUnique({ filter: { id } }); // ✗
const user = await prisma.user.findUnique({ where: { id } });  // ✓

// KCH: invented method
// fetch() does not have a .json() method on the request
const body = await request.json(); // ✓ (Next.js Request)
const body = await request.body.json(); // ✗ invented chaining

// KCH: subtle semantic error
// Array.prototype.find returns undefined, not null
const item = items.find(i => i.id === id);
if (item === null) return; // ✗ never triggers — find returns undefined
if (item === undefined) return; // ✓
```

**How to catch KCHs:**

1. Type coverage: enable `strict: true` and `noUncheckedIndexedAccess`
   in tsconfig.json — these catch many KCH patterns at compile time
2. Integration tests against real dependencies: mock-based unit tests
   cannot catch invented API parameters — the mock accepts anything
3. Runtime validation at boundaries: use Zod to validate the shape
   of all external data before it enters the application

```typescript
// Runtime validation catches KCH at the boundary, not in production
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
});

// If the AI hallucinated the response shape, this throws immediately
const user = UserSchema.parse(await response.json());
```

---

## Type System Misuse

AI agents are significantly more likely than human developers to:
- Use `any` to resolve type errors instead of fixing the underlying issue
- Use type assertions (`as SomeType`) without verifying correctness
- Bypass strict null checks with non-null assertions (`!`)
- Use `@ts-ignore` or `@ts-expect-error` to suppress legitimate warnings

**Detection:**

```bash
# Count any usage in the codebase
grep -rn ": any\|as any\|<any>" src --include="*.ts" --include="*.tsx" \
  | grep -v "\.test\.\|\.spec\." | wc -l

# Find non-null assertions
grep -rn "!\." src --include="*.ts" --include="*.tsx" \
  | grep -v "\.test\.\|\.spec\." | wc -l

# Find ts-ignore usage
grep -rn "@ts-ignore\|@ts-expect-error" src --include="*.ts"
```

**Prevention:**

```json
// tsconfig.json — maximum type safety
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Add to ESLint config to flag type system bypasses:
```javascript
// eslint.config.js
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
  }
}
```

---

## Race Conditions in AI-Generated Async Code

AI agents consistently generate async code with subtle race conditions
that only manifest under concurrent load or specific timing conditions.

**Common patterns:**

```typescript
// Race condition: check-then-act without atomicity
async function transferFunds(fromId: string, toId: string, amount: number) {
  const from = await db.account.findUnique({ where: { id: fromId } });
  // Another request can modify `from.balance` between this check and the update
  if (from.balance < amount) throw new Error('Insufficient funds');

  await db.account.update({ where: { id: fromId },
    data: { balance: from.balance - amount } }); // ✗ race condition
}

// Correct: atomic operation using database transaction
async function transferFunds(fromId: string, toId: string, amount: number) {
  await db.$transaction(async (tx) => {
    const from = await tx.account.findUnique({
      where: { id: fromId },
      // Lock the row for the duration of the transaction
    });
    if (from.balance < amount) throw new Error('Insufficient funds');
    await tx.account.update({
      where: { id: fromId },
      data: { balance: { decrement: amount } }, // ✓ atomic
    });
    await tx.account.update({
      where: { id: toId },
      data: { balance: { increment: amount } },
    });
  });
}
```

**How to test for race conditions:**

```typescript
// Run the operation concurrently and verify invariants hold
it('prevents double-spend under concurrent requests', async () => {
  await seedAccount({ id: 'acc-1', balance: 100 });

  // Fire 10 concurrent transfer requests for the same funds
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      transferFunds('acc-1', 'acc-2', 100)
    )
  );

  // Exactly one should succeed
  const successes = results.filter(r => r.status === 'fulfilled');
  expect(successes).toHaveLength(1);

  // Balance should never go negative
  const account = await db.account.findUnique({ where: { id: 'acc-1' } });
  expect(account.balance).toBeGreaterThanOrEqual(0);
});
```

---

## Resource and Memory Leaks

AI-generated code frequently fails to clean up resources — database
connections, file handles, event listeners, timers, and streams.

**Common leak patterns:**

```typescript
// Leak: database connection not released on error
async function processData() {
  const connection = await pool.getConnection();
  const data = await connection.query('SELECT * FROM large_table');
  // If processRecord throws, connection is never released
  for (const record of data) {
    await processRecord(record); // ✗ can throw, leaving connection open
  }
  connection.release();
}

// Correct: always release in finally
async function processData() {
  const connection = await pool.getConnection();
  try {
    const data = await connection.query('SELECT * FROM large_table');
    for (const record of data) {
      await processRecord(record);
    }
  } finally {
    connection.release(); // ✓ always runs
  }
}

// Leak: event listener never removed
function setupWebSocket(ws: WebSocket) {
  const handler = (event: MessageEvent) => processMessage(event.data);
  ws.addEventListener('message', handler);
  // ✗ handler is never removed when ws closes
}

// Correct: clean up in close handler
function setupWebSocket(ws: WebSocket) {
  const handler = (event: MessageEvent) => processMessage(event.data);
  ws.addEventListener('message', handler);
  ws.addEventListener('close', () => {
    ws.removeEventListener('message', handler); // ✓
  });
}
```

**Detection in tests:**

```typescript
// Verify no open handles after test suite
// Vitest: use --detectOpenHandles flag
// vitest.config.ts
export default defineConfig({
  test: {
    teardownTimeout: 10000,
    // Fail if handles remain open after tests complete
  },
});
```

```bash
# Run with leak detection
vitest run --reporter=verbose 2>&1 | grep "open handle\|leak"
```