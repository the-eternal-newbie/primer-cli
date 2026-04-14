# /diagnose-incident

Act as an SRE teammate during an active outage — correlate telemetry,
trace dependencies, and form root cause hypotheses.

## Before executing

Read `docs/skills/backend/knowledge/distributed-resilience.md`
in full — understand the failure modes before diagnosing them.
Read `docs/skills/backend/knowledge/traffic-control.md` section
on load shedding to understand degraded-state behavior.

## Steps

1. Establish the blast radius immediately:
   - Which endpoints are affected? (Check error rate by endpoint)
   - Which users or tenants are affected? (Check error rate by user/tenant)
   - When did the incident start? (Find the inflection point in metrics)
   - Is the incident ongoing, stabilizing, or recovering?

2. Collect the timeline from observability sources:

   **Distributed traces (OpenTelemetry):**

   - Find traces with high error rates in the affected time window
   - Identify the first span that started failing
   - Trace the failure upstream to find the root dependency

**Structured logs:**
   ```bash
      # Query for errors in the incident window
      # Example: Datadog, Grafana Loki, or CloudWatch
      level:error service:<service_name> @timestamp:[<start> TO <end>]
      | group by @message
      | sort by count desc
   ```

   **Metrics:**
   - Error rate: spike indicates new failure mode
   - Latency p99: spike indicates slowdown or dependency timeout
   - Throughput: drop indicates traffic shedding or availability issue
   - Saturation (CPU, memory, connections): indicates resource exhaustion

3. Form hypotheses using the RED method:
   - **Rate:** Is throughput abnormal? (Traffic spike, traffic drop)
   - **Errors:** What error types are occurring? (5xx type, dependency)
   - **Duration:** Is latency elevated? (Slow dependency, lock contention)

4. Test each hypothesis against the evidence:

   | Symptom | Hypothesis | Evidence to check |
   |---|---|---|
   | 503 spike | Downstream service unavailable | Circuit breaker state, dependency health |
   | Latency spike | Database slow query | Slow query log, connection pool saturation |
   | Memory growth | Memory leak | Heap dump, GC pressure metrics |
   | 429 spike | Rate limit misconfiguration | Rate limiter logs, client identity |
   | Error on deploy | Regression | Git blame, deployment timestamp correlation |

5. Identify the contributing factors:
   - Root cause (the thing that actually failed)
   - Trigger (what caused the root cause to manifest)
   - Contributing factors (conditions that made it worse)

6. Implement the immediate mitigation:
   - Rollback if a deploy correlates with the incident start
   - Scale horizontally if resource saturation is the cause
   - Open the circuit breaker manually if a dependency is not recovering
   - Enable load shedding if the service is overwhelmed

7. Document findings in real time — do not rely on memory for the
   postmortem. Record timestamps, evidence, and actions taken.

## Do not

- Never assume the most recent deployment is the cause without evidence
- Never make configuration changes without recording them in the
  incident log — changes that don't fix the problem cause confusion
- Never close the incident before verifying the fix holds under
  normal traffic load for at least 15 minutes