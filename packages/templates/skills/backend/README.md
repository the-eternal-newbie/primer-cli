# Backend Skill Package

This skill package equips an AI agent with production-grade knowledge
covering distributed systems design, API contract governance, traffic
control, resilience patterns, and agentic backend architecture.

## When to load this skill

Load this skill when working on any task involving:
- Service scaffolding or API design
- Rate limiting, backpressure, or load shedding implementation
- Circuit breaker or retry policy configuration
- OpenAPI contract validation or versioning
- Observability and SLO/SLI instrumentation
- Incident response or postmortem drafting
- AI agent execution layer design

## Knowledge base

Read all relevant knowledge documents before executing any command.
Backend commands frequently require cross-domain knowledge.

| Document | When to read |
|---|---|
| `knowledge/idempotency.md` | Before designing any state-mutating endpoint |
| `knowledge/traffic-control.md` | Before implementing rate limiting or load shedding |
| `knowledge/distributed-resilience.md` | Before configuring retries, timeouts, or circuit breakers |
| `knowledge/api-contracts.md` | Before any API change or versioning decision |
| `knowledge/agentic-backends.md` | Before designing endpoints consumed by AI agents |

## Commands

| Command | Category | Purpose |
|---|---|---|
| `/scaffold-service` | Setup | Generate service blueprint, boilerplate, and OpenAPI spec |
| `/setup-observability` | Setup | Inject structured logging, telemetry, SLO/SLI metrics |
| `/validate-contract` | Validation | Lint API changes for breaking changes before deployment |
| `/generate-e2e-tests` | Validation | Write integration and E2E tests for main user flows |
| `/diagnose-incident` | Incident Response | Correlate telemetry and form root cause hypotheses |
| `/draft-postmortem` | Incident Response | Generate incident review with timeline and follow-ups |

## Non-negotiables

See `rules/backend.mdc` for the five rules that apply to every backend
operation regardless of stack, scale, or deadline pressure.