# Auth Skill Package

This skill package equips an AI agent with deep, production-grade knowledge
covering modern authentication patterns, advanced authorization models,
secrets lifecycle management, and incident response.

## When to load this skill

Load this skill when working on any task involving:
- Identity provider integration or SSO configuration
- Authorization policy design or enforcement
- Token lifecycle and session management
- Secrets rotation or credential hygiene
- Security auditing of access control logic
- Incident response for suspected breaches

## Knowledge base

Read all relevant knowledge documents before executing any command.
Auth commands frequently require cross-domain knowledge — do not skip.

| Document | When to read |
|---|---|
| `knowledge/attack-vectors.md` | Before any auth implementation or audit task |
| `knowledge/authorization-models.md` | Before designing or modifying access policies |
| `knowledge/authorization-decoupling.md` | Before integrating a policy engine or refactoring access logic |
| `knowledge/machine-identity.md` | Before implementing service-to-service or agent-to-agent auth |
| `knowledge/frontend-security.md` | Before handling tokens, cookies, or browser security config |

## Commands

| Command | Category | Purpose |
|---|---|---|
| `/setup-auth-provider` | Setup | Configure OIDC/OAuth2 provider with SSO and MFA |
| `/configure-access-policy` | Setup | Define RBAC/ABAC/ReBAC policies in a centralized engine |
| `/rotate-secrets` | Lifecycle | Zero-downtime rotation of keys and credentials |
| `/audit-dependencies` | Lifecycle | SCA scan for auth package and crypto vulnerabilities |
| `/audit-access-control` | Auditing | Scan endpoints for missing server-side authorization |
| `/revoke-sessions` | Incident Response | Invalidate active tokens globally or per user |
| `/lockdown-auth` | Incident Response | Enforce step-up MFA or block IPs during active attack |

## Non-negotiables

See `rules/auth.mdc` for the five rules that apply to every auth
operation regardless of stack, scale, or deadline pressure.