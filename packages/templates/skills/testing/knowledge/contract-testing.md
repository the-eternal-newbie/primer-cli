# Consumer-Driven Contract Testing with Pact

E2E tests that span multiple services are the most brittle tests
in any test suite — they are slow, flaky, and fail for reasons
unrelated to the code being tested. Contract testing replaces
cross-service E2E tests with fast, isolated verification that
each service honors its agreements.

## The Core Concept

In contract testing, the **consumer** (the service that calls the API)
defines what it expects from the **provider** (the service that serves
the API). This expectation is recorded as a **pact** (a JSON contract file).
The provider then verifies it can satisfy that contract in isolation —
no real consumer required.

```
Consumer test → generates pact file → Provider test reads pact → verifies
```

---

## Consumer Side (TypeScript/Node.js)

```bash
pnpm add -D @pact-foundation/pact
```

```typescript
// tests/contracts/user-service.consumer.test.ts
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { UserApiClient } from '@/shared/api/user-client';

const { like, string, integer } = MatchersV3;

const provider = new PactV3({
  consumer: 'PaymentService',
  provider: 'UserService',
  dir: './pacts', // pact files written here
});

describe('UserService contract — PaymentService consumer', () => {
  it('returns user profile for a valid user ID', async () => {
    await provider
      .uponReceiving('a request for user profile')
      .withRequest({
        method: 'GET',
        path: '/v1/users/user-123',
        headers: { Authorization: like('Bearer token') },
      })
      .willRespondWith({
        status: 200,
        body: {
          id: string('user-123'),
          email: string('user@example.com'),
          plan: string('pro'),
          creditLimit: integer(10000),
        },
      })
      .executeTest(async (mockServer) => {
        // Test against the Pact mock server — no real UserService needed
        const client = new UserApiClient(mockServer.url);
        const user = await client.getUser('user-123');

        expect(user.id).toBe('user-123');
        expect(user.creditLimit).toBeGreaterThan(0);
      });
  });
});
```

---

## Provider Side Verification

```typescript
// tests/contracts/user-service.provider.test.ts
// tests/contracts/user-service.provider.test.ts
import { Verifier } from '@pact-foundation/pact';
import { startServer, stopServer } from '../helpers/server';

describe('UserService — provider verification', () => {
  let server: { port: number };

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(async () => {
    await stopServer();
  });

  it('satisfies all consumer contracts', async () => {
    const verifier = new Verifier({
      provider: 'UserService',
      providerBaseUrl: `http://localhost:${server.port}`,
      pactUrls: ['./pacts/PaymentService-UserService.json'],
      // Or fetch from Pact Broker:
      // pactBrokerUrl: process.env.PACT_BROKER_URL,
      // publishVerificationResult: true,
      // providerVersion: process.env.GIT_SHA,
    });

    await verifier.verifyProvider();
  });
});
```

---

## Pact Broker for Team Workflows

The Pact Broker stores and shares pact files between teams,
enabling independent deployment verification.

```yaml
# docker-compose.yml — local Pact Broker
services:
  pact-broker:
    image: pactfoundation/pact-broker:latest
    ports:
      - '9292:9292'
    environment:
      PACT_BROKER_DATABASE_URL: postgresql://postgres:password@db/pact_broker
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: pact_broker
```

```bash
# Publish pacts after consumer tests pass
pnpm pact-broker publish ./pacts \
  --broker-base-url http://localhost:9292 \
  --consumer-app-version $(git rev-parse HEAD) \
  --branch $(git branch --show-current)

# Provider verifies before deployment
pnpm pact-broker can-i-deploy \
  --pacticipant UserService \
  --version $(git rev-parse HEAD) \
  --to-environment production
```

---

## What Contract Tests Replace

| Scenario | Without contracts | With contracts |
|---|---|---|
| Consumer changes expected response field | E2E test fails in staging | Consumer pact fails immediately |
| Provider removes an endpoint | Discovered in integration environment | Provider verification fails in CI |
| Breaking API change deployed | Production incident | `can-i-deploy` blocks the deployment |
| New consumer added | Manual coordination required | Consumer publishes pact, provider verifies |

---

## Contract Testing vs Integration Testing

Contract tests do not replace all integration tests. They verify
the **interface contract** between services — not the business logic
within a service.

| What to contract test | What to integration test |
|---|---|
| Response shape and field types | Business rule correctness |
| Required vs optional fields | Database query accuracy |
| Status codes for known inputs | Authorization logic |
| Error response format | Side effects (emails, webhooks) |