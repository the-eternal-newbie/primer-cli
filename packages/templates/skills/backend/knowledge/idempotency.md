# Idempotency and State Management

Networks are inherently unreliable. Clients will retry failed requests.
An idempotent operation produces the same result whether executed once
or a hundred times. Every state-mutating backend operation must be
designed with this reality as a first principle.

## Why Idempotency Matters

Without idempotency, a retry after a network timeout can:
- Charge a customer twice for the same order
- Create duplicate records in the database
- Send the same email notification multiple times
- Trigger duplicate webhook deliveries to partners

The client cannot know whether the original request succeeded before
the network failed. The server must be designed to handle the retry
safely regardless.

---

## Idempotency Key Pattern

The standard mechanism: the client generates a unique key for each
logical operation and includes it in every request. The server uses
this key to detect and deduplicate retries.

```typescript
// Client: generate a stable key per logical operation
const idempotencyKey = crypto.randomUUID(); // store this per operation attempt

// Include in request header
fetch('/api/payments', {
  method: 'POST',
  headers: {
    'Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ amount: 9999, currency: 'USD' }),
});
```

**Server implementation:**

```typescript
// NestJS interceptor for idempotency
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['idempotency-key'];

    if (!key) return next.handle(); // idempotency optional for reads

    const cached = await this.redis.get(`idempotency:${key}`);
    if (cached) {
      // Return the cached response — this is a retry
      return of(JSON.parse(cached));
    }

    return next.handle().pipe(
      tap(async (response) => {
        // Cache the response with TTL matching your retry window
        await this.redis.setex(
          `idempotency:${key}`,
          86400, // 24 hours
          JSON.stringify(response)
        );
      })
    );
  }
}
```

**FastAPI implementation:**

```python
from fastapi import Header, Request, Response
from fastapi.responses import JSONResponse
import json

async def idempotency_middleware(
    request: Request,
    call_next,
    redis_client: redis.Redis,
):
    idempotency_key = request.headers.get("idempotency-key")

    if not idempotency_key or request.method not in ("POST", "PUT", "PATCH"):
        return await call_next(request)

    cached = await redis_client.get(f"idempotency:{idempotency_key}")
    if cached:
        # Return the cached success response directly — not an exception
        data = json.loads(cached)
        return JSONResponse(
            content=data["body"],
            status_code=data["status_code"],
            headers={"X-Idempotent-Replayed": "true"},
        )

    response = await call_next(request)

    if response.status_code < 300:
        # Read and cache the response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        await redis_client.setex(
            f"idempotency:{idempotency_key}",
            86400,
            json.dumps({
                "status_code": response.status_code,
                "body": json.loads(body),
            }),
        )

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )

    return response
```

**Why not HTTPException for cached responses:** `HTTPException` in FastAPI
is for error handling and serializes into the framework's error envelope.
Returning a cached success response via `HTTPException(status_code=200)`
produces the wrong response shape and diverges from the declared response
model. Always return cached responses through the normal response path.

---

## Exactly-Once vs At-Least-Once Delivery

| Guarantee | Mechanism | Use case |
|---|---|---|
| At-least-once | Retry until acknowledged | Most operations — safe with idempotency keys |
| Exactly-once | Distributed transactions or idempotent consumers | Payment processing, inventory mutations |
| At-most-once | No retry | Acceptable only for non-critical notifications |

True exactly-once delivery in distributed systems is extremely expensive.
The practical standard is at-least-once delivery with idempotent consumers —
design the consumer to be safe to call multiple times, and retry freely.

---

## Database-Backed Idempotency

For operations that cannot use Redis (cold start, consistency requirements):

```sql
CREATE TABLE idempotency_keys (
  key         VARCHAR(255) PRIMARY KEY,
  response    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

```typescript
// Atomic insert-or-ignore pattern
async function processWithIdempotency(key: string, operation: () => Promise<unknown>) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.idempotencyKey.findUnique({ where: { key } });
    if (existing) return existing.response;

    const response = await operation();

    await tx.idempotencyKey.create({
      data: {
        key,
        response,
        expiresAt: new Date(Date.now() + 86400 * 1000),
      },
    });

    return response;
  });
}
```

---

## Idempotency Key TTL and Cleanup

- TTL must exceed the client's maximum retry window
- 24 hours is the industry standard for payment operations
- Run a scheduled job to clean expired keys:

```sql
DELETE FROM idempotency_keys WHERE expires_at < NOW();
```

- Never reuse idempotency keys across different operation types —
  scope keys to the operation: `payment:${uuid}`, `order:${uuid}`