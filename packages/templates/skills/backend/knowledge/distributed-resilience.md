# Distributed Resilience: Circuit Breakers, Timeouts, and Backoff

In distributed systems, failure is not an exception — it is a design
constraint. Every service call to an external dependency can fail.
The agent must design for failure as a first principle, not as an
afterthought.

## The Three Failure Modes

**Crash failure:** The dependency returns an error immediately.
Easy to handle — catch the error, apply fallback.

**Omission failure:** The dependency does not respond.
Dangerous — without a timeout, threads block indefinitely,
exhausting the thread pool and cascading the failure.

**Timing failure:** The dependency responds, but too slowly.
Insidious — partial success with degraded performance that
quietly degrades user experience and resource utilization.

The timeout is the universal defense against omission and timing failures.
**Every network call must have a timeout. A missing timeout is a bug.**

---

## Timeout Design

Timeouts must be set based on SLO requirements, not guesswork.

```typescript
// NestJS HTTP module with timeout
@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,         // 5 second timeout
      maxRedirects: 3,
    }),
  ],
})

// Per-request timeout with AbortController
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Timeout budget:** When service A calls service B which calls service C,
each hop must use a fraction of the total budget. If the user-facing
SLO is 500ms, and A→B is 100ms, B→C must be ≤200ms (leaving 200ms
for processing).

---

## Exponential Backoff with Jitter

Pure exponential backoff: `delay = base * 2^attempt`

The problem: if 1,000 clients all fail at the same moment, they all
retry at the same intervals. The recovering service receives synchronized
waves of traffic — the thundering herd — and fails again.

**Jitter breaks synchronization:**

```typescript
function backoffWithJitter(
  attempt: number,
  baseMs: number = 100,
  maxMs: number = 30000
): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), maxMs);
  // Full jitter: random value between 0 and exponential
  return Math.random() * exponential;
}

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      if (!isRetryable(error)) throw error; // don't retry 4xx errors

      const delay = backoffWithJitter(attempt);
      await sleep(delay);
    }
  }
  throw new Error('Max retry attempts exceeded');
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    // Retry 429, 503, 504 — never retry 400, 401, 403, 404
    return [429, 503, 504].includes(error.statusCode);
  }
  return error instanceof NetworkError || error instanceof TimeoutError;
}
```

---

## Circuit Breaker Pattern

The circuit breaker prevents a struggling dependency from being
overwhelmed by requests from a healthy caller. It monitors failures
and temporarily stops sending requests when failure rate exceeds
a threshold.

**States:**
- **Closed (normal):** All requests pass through. Failures are counted.
- **Open (tripped):** All requests fail immediately without hitting
  the dependency. A timer controls how long the circuit stays open.
- **Half-open (probing):** A single test request is allowed through.
  If it succeeds, the circuit closes. If it fails, the circuit opens again.

**Node.js with cockatiel:**
```typescript
import { CircuitBreakerPolicy, ConsecutiveBreaker, ExponentialBackoff, retry, circuitBreaker, handleAll } from 'cockatiel';

const policy = circuitBreaker(
  retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff() }),
  {
    halfOpenAfter: 10_000,    // probe after 10 seconds
    breaker: new ConsecutiveBreaker(5), // open after 5 consecutive failures
  }
);

// Usage
const result = await policy.execute(() => externalService.call());
```

**Java with Resilience4j:**
```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
  .failureRateThreshold(50)           // open at 50% failure rate
  .waitDurationInOpenState(Duration.ofSeconds(10))
  .slidingWindowSize(10)
  .build();

CircuitBreaker circuitBreaker = CircuitBreakerRegistry
  .of(config)
  .circuitBreaker("externalService");

Supplier<String> decoratedSupplier = CircuitBreaker
  .decorateSupplier(circuitBreaker, externalService::call);
```

**.NET with Polly:**
```csharp
var pipeline = new ResiliencePipelineBuilder()
  .AddCircuitBreaker(new CircuitBreakerStrategyOptions
  {
    FailureRatio = 0.5,
    SamplingDuration = TimeSpan.FromSeconds(10),
    MinimumThroughput = 5,
    BreakDuration = TimeSpan.FromSeconds(10),
  })
  .Build();
```

---

## Bulkhead Pattern

The bulkhead isolates failures in one part of the system from
cascading to others. Named after the watertight compartments in ships
— if one floods, the others remain intact.

```typescript
// Separate thread pools per dependency
const paymentPool = new Semaphore(10);  // max 10 concurrent payment calls
const inventoryPool = new Semaphore(20); // max 20 concurrent inventory calls

async function processOrder(order: Order) {
  // Payment and inventory failures don't affect each other's capacity
  await paymentPool.use(() => paymentService.charge(order));
  await inventoryPool.use(() => inventoryService.reserve(order));
}
```

---

## Resilience Checklist

Before deploying any service that calls external dependencies:

- [ ] Every outbound HTTP call has an explicit timeout
- [ ] Retries use exponential backoff with jitter
- [ ] Non-retryable errors (4xx) are never retried
- [ ] Circuit breaker configured for each critical dependency
- [ ] Fallback behavior defined for circuit-open state
- [ ] Bulkheads isolate high-risk dependencies
- [ ] Timeout budget cascades correctly through the call chain