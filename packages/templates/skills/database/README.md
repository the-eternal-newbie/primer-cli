# Database Skill Package

This skill package equips an AI agent with deep, production-grade database
knowledge covering schema design, performance optimization, migration safety,
and data governance.

## When to load this skill

Load this skill when working on any task involving:
- Schema design or modification
- Query writing or optimization
- Migration authoring or execution
- Database infrastructure provisioning
- Security auditing or PII handling
- Incident response and rollback

## Knowledge base

Read the relevant knowledge document before executing any command:

| Document | When to read |
|---|---|
| `knowledge/anti-patterns.md` | Before designing any schema or writing queries |
| `knowledge/performance.md` | Before optimizing queries or diagnosing slow operations |
| `knowledge/migration-safety.md` | Before authoring or executing any migration |
| `knowledge/governance.md` | Before handling PII, auditing, or retention decisions |

## Commands

| Command | Category | Purpose |
|---|---|---|
| `/setup-connection` | Infrastructure | Configure database connection with pooling |
| `/plan-capacity` | Infrastructure | Estimate storage, connections, and growth |
| `/design-schema` | Schema | Design normalized schema with constraints |
| `/create-migration` | Schema | Author safe, backward-compatible migration |
| `/audit-schema` | Schema | Detect anti-patterns and constraint gaps |
| `/diagnose-performance` | Performance | Identify slow queries and bottlenecks |
| `/analyze-fragmentation` | Performance | Detect index and table bloat |
| `/optimize-query` | Performance | Rewrite queries for maximum efficiency |
| `/mask-pii` | Security | Identify and mask PII columns |
| `/audit-security` | Security | Audit privileges and connection security |
| `/execute-rollback` | Recovery | Execute safe rollback with integrity check |

## Non-negotiables

See `rules/database.mdc` for the seven rules that apply to every database
operation regardless of stack, scale, or deadline pressure.