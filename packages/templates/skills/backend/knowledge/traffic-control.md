# Traffic Control: Rate Limiting, Backpressure, and Load Shedding

Systems can be killed by success. A viral moment, a DDoS attack, or
a misbehaving client can overwhelm a backend that has no traffic
control mechanisms. The agent must understand how to protect downstream
systems at each layer of the traffic control stack.

## Rate Limiting Algorithms

### Token Bucket
A bucket holds tokens up to a maximum capacity. Each request consumes
one token. Tokens are replenished at a fixed rate. Requests arriving
when the bucket is empty are rejected.

**Characteristics:** Allows short bursts up to bucket capacity.
Best for APIs where occasional bursts are acceptable.

### Sliding Window
Track request timestamps in a rolling time window. Count requests
in the window and reject if the count exceeds the limit.

**Characteristics:** Smoother than token bucket, no burst allowance.
Best for strict per-user rate limits.

### Fixed Window
Count requests in fixed time intervals (e.g., per minute). Reset
counter at interval boundary.

**Characteristics:** Simple but susceptible to boundary attacks —
a client can make 2× the limit by sending requests at the end of
one window and the start of the next.

**Recommendation:** Use sliding window for user-facing APIs.
Use token bucket for internal service-to-service calls where
burst tolerance is needed.

---

## Implementation

**Node.js with Upstash Ratelimit:**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Different limits for different tiers
const rateLimiters = {
  free: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1m'),
    prefix: 'rl:free',
  }),
  pro: new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(100, '1m'),
    prefix: 'rl:pro',
  }),
  agent: new Ratelimit({
    redis: Redis.fromEnv(),
    // AI agents get token bucket to handle burst tool calls
    limiter: Ratelimit.tokenBucket(50, '1m', 10),
    prefix: 'rl:agent',
  }),
};

export async function applyRateLimit(userId: string, tier: 'free' | 'pro' | 'agent') {
  const { success, limit, remaining, reset } = await rateLimiters[tier].limit(userId);

  if (!success) {
    throw new RateLimitError({
      limit,
      remaining: 0,
      reset: new Date(reset),
      retryAfter: Math.ceil((reset - Date.now()) / 1000),
    });
  }

  return { limit, remaining, reset };
}
```

**FastAPI with slowapi:**
```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/resource")
@limiter.limit("10/minute")
async def get_resource(request: Request):
    return {"data": "..."}
```

---

## Backpressure

Backpressure signals upstream producers to slow down when the
downstream consumer cannot keep up. Without backpressure, buffers
fill, memory exhausts, and services crash.

**Queue-based backpressure:**
```typescript
// When queue depth exceeds threshold, reject new work
const MAX_QUEUE_DEPTH = 1000;

async function enqueueWork(task: Task): Promise<void> {
  const depth = await queue.getWaitingCount();

  if (depth > MAX_QUEUE_DEPTH) {
    throw new ServiceUnavailableError(
      'Queue at capacity. Retry after backoff.'
    );
  }

  await queue.add(task);
}
```

**Streaming backpressure (Node.js):**
```typescript
// Use highWaterMark to control buffer size
const readable = new Readable({
  highWaterMark: 16 * 1024, // 16KB buffer
  read() {},
});

// Check if consumer is ready before pushing
if (!readable.push(chunk)) {
  // Consumer is slow — pause the source
  source.pause();
  readable.once('drain', () => source.resume());
}
```

---

## Load Shedding

When backpressure is insufficient and the system approaches capacity,
load shedding drops requests to keep the system alive for critical
traffic. The key question: what do you drop first?

**Priority tiers (drop lowest priority first):**

| Priority | Traffic type | Action under load |
|---|---|---|
| P0 | Health checks, core transactions | Never shed |
| P1 | Authenticated user write operations | Shed last |
| P2 | Authenticated user read operations | Shed under high load |
| P3 | Background jobs, analytics, webhooks | Shed first |
| P4 | Unauthenticated or anonymous traffic | Shed immediately |

```typescript
// NestJS load shedding middleware
@Injectable()
export class LoadSheddingMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const load = await this.getSystemLoad(); // CPU + queue depth metric

    if (load > 0.95 && req.priority === 'P4') {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        retryAfter: 30,
      });
    }

    if (load > 0.85 && req.priority === 'P3') {
      return res.status(503).json({
        error: 'Non-critical operations temporarily suspended',
        retryAfter: 10,
      });
    }

    next();
  }
}
```

---

## Rate Limit Response Standards

Always return structured rate limit headers so clients can adapt:

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1714000000
Retry-After: 47
Content-Type: application/json

{"error": "rate_limit_exceeded", "retryAfter": 47}
```

Never return a bare 429 without retry guidance — clients that cannot
determine when to retry will hammer the service immediately.