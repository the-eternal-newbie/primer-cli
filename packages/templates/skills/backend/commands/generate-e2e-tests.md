# /generate-e2e-tests

Write integration and end-to-end tests that validate the main user
flows and prevent regressions.

## Before executing

Read `docs/skills/backend/knowledge/api-contracts.md` section on
consumer-driven contract testing.
Read `docs/skills/backend/knowledge/idempotency.md` to ensure
idempotency behavior is explicitly tested.

## Steps

1. Identify the main user flows to test:
   - Happy path: the core business transaction succeeds end-to-end
   - Authentication boundary: unauthenticated requests are rejected
   - Authorization boundary: unauthorized users cannot access
     resources they do not own
   - Idempotency: duplicate requests with the same idempotency key
     return the original response, not a duplicate
   - Error handling: malformed input returns structured 422 errors
   - Rate limiting: excessive requests return 429 with Retry-After

2. Structure the test suite by flow, not by endpoint:
```typescript
   // tests/flows/payment.test.ts
   describe('Payment flow', () => {
     describe('Happy path', () => {
       it('creates a payment and returns 201 with payment ID');
       it('returns the same payment on duplicate idempotency key');
       it('lists the payment in the user payment history');
     });

     describe('Authorization', () => {
       it('returns 401 for unauthenticated requests');
       it('returns 403 when accessing another user payment');
     });

     describe('Validation', () => {
       it('returns 422 for missing required fields');
       it('returns 422 for invalid currency code');
       it('returns 422 for negative amount');
     });
   });
```

3. Implement API integration tests using the OpenAPI spec as the contract:
```typescript
   // Use supertest (Node) or httpx (Python) against a real server instance
   import request from 'supertest';
   import { app } from '../src/app';

   describe('POST /v1/payments', () => {
     it('creates payment with valid idempotency key', async () => {
       const idempotencyKey = crypto.randomUUID();

       const response = await request(app)
         .post('/v1/payments')
         .set('Authorization', `Bearer ${testToken}`)
         .set('Idempotency-Key', idempotencyKey)
         .send({ amount: 1000, currency: 'USD', recipientId: 'user_123' })
         .expect(201);

       expect(response.body).toMatchObject({
         id: expect.stringMatching(/^pay_/),
         amount: 1000,
         currency: 'USD',
         status: 'pending',
       });
     });

     it('returns cached response on duplicate idempotency key', async () => {
       const idempotencyKey = crypto.randomUUID();
       const payload = { amount: 1000, currency: 'USD', recipientId: 'user_123' };

       const first = await request(app)
         .post('/v1/payments')
         .set('Authorization', `Bearer ${testToken}`)
         .set('Idempotency-Key', idempotencyKey)
         .send(payload)
         .expect(201);

       const second = await request(app)
         .post('/v1/payments')
         .set('Authorization', `Bearer ${testToken}`)
         .set('Idempotency-Key', idempotencyKey)
         .send(payload)
         .expect(201);

       // Same response — not a duplicate record
       expect(second.body.id).toBe(first.body.id);
     });
   });
```

4. Test circuit breaker and resilience behavior:
```typescript
   it('returns 503 when downstream service is unavailable', async () => {
     // Stub the downstream service to return 500
     mockPaymentProcessor.mockRejectedValue(new ServiceUnavailableError());

     await request(app)
       .post('/v1/payments')
       .set('Authorization', `Bearer ${testToken}`)
       .set('Idempotency-Key', crypto.randomUUID())
       .send(validPayload)
       .expect(503)
       .expect(res => {
         expect(res.body.retryAfter).toBeDefined();
       });
   });
```

5. Validate response shapes against the OpenAPI spec:
```typescript
   import Ajv from 'ajv';
   import spec from '../openapi.json';

   const ajv = new Ajv();
   const validatePaymentResponse = ajv.compile(
     spec.components.schemas.PaymentResponse
   );

   it('response matches OpenAPI schema', async () => {
     const response = await request(app).get('/v1/payments/pay_123')...;
     expect(validatePaymentResponse(response.body)).toBe(true);
   });
```

6. Run tests against a production-like environment:
```bash
   # Never run E2E tests against mocked services only
   # Use test containers for real database and cache instances
   pnpm test:e2e
```

## Do not

- Never mock the database in E2E tests — use real test containers
- Never share state between test cases — each test must set up
  and tear down its own data
- Never skip idempotency tests — they are the most important
  correctness property to verify
- Never assert only on status codes — validate response body
  shape against the OpenAPI spec