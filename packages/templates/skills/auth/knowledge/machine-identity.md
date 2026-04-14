# Machine Identity and Agent-to-Agent Authentication

Traditional OAuth2 flows are designed for human authorization. As AI
agents and automated services increasingly consume APIs, a different
identity model is required — one based on machine credentials,
short-lived secrets, and cryptographic proof of identity.

## Why Human OAuth2 Flows Fail for Machines

Human OAuth2 flows (Authorization Code, Implicit) require:
- A browser redirect for user consent
- A human to authenticate and approve
- Long-lived sessions for usability

Machine-to-machine communication requires:
- No human in the loop
- Short-lived, automatically rotated credentials
- Cryptographic proof of the caller's identity, not just possession
  of a secret

---

## OAuth2 Client Credentials Flow

The standard for M2M authentication. The client authenticates directly
with the authorization server using its own credentials (no user involved).

```
Service A → POST /oauth/token (client_id + client_secret) → Auth Server
Auth Server → access_token (short-lived, 1 hour) → Service A
Service A → API request + Bearer token → Service B
Service B → verify token → Auth Server (or local JWKS)
```

**Implementation:**
```typescript
// Requesting a machine token
const tokenResponse = await fetch('https://auth.example.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SERVICE_CLIENT_ID,
    client_secret: process.env.SERVICE_CLIENT_SECRET,
    scope: 'api:read api:write',
  }),
});

const { access_token, expires_in } = await tokenResponse.json();
// Cache token until expires_in - 60 seconds
// Never request a new token on every API call
```

**Token caching is mandatory:** Requesting a new token on every API
call causes auth server rate limiting and adds latency. Cache tokens
and refresh before expiry.

---

## Mutual TLS (mTLS) for Service-to-Service Trust

mTLS provides cryptographic proof of identity in both directions —
the server proves its identity to the client AND the client proves
its identity to the server. No shared secrets required.

```
Service A → TLS handshake + client certificate → Service B
Service B → verifies certificate against CA → grants access
Service B → sends response + server certificate → Service A
Service A → verifies server certificate → trusts response
```

**When to use mTLS over OAuth2 Client Credentials:**
- Zero-trust internal service mesh (Istio, Linkerd)
- Services that cannot safely store client secrets
- Environments where certificate rotation is automated (cert-manager)
- Regulatory requirements for mutual authentication

---

## Just-in-Time (JIT) Secrets for AI Agents

AI agents present a unique challenge: they may be dynamically spawned,
execute for short periods, and operate across trust boundaries. Static,
long-lived API keys are inappropriate.

**JIT secret pattern:**
```
Orchestrator → request short-lived credentials for task → Vault/KMS
Vault → verify orchestrator identity → issue time-bound token (15 min)
Orchestrator → provision token to agent → agent executes task
Token expires → agent loses access automatically
```

**Implementation with HashiCorp Vault:**
```bash
# Issue a short-lived database credential for a specific agent task
vault write database/creds/agent-role \
  ttl=15m \
  # Returns: username, password valid for 15 minutes only
```

**Verifiable Credentials for AI Agents:**
Emerging standard (W3C VC Data Model) that allows agents to present
cryptographically signed claims about their identity and capabilities
without contacting the issuer on every request.

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "AgentCapabilityCredential"],
  "issuer": "https://orchestrator.example.com",
  "credentialSubject": {
    "id": "did:example:agent-xyz",
    "capabilities": ["read:reports", "write:summaries"],
    "taskId": "task-abc-123",
    "expiresAt": "2026-04-14T15:00:00Z"
  },
  "proof": { "type": "Ed25519Signature2020", ... }
}
```

---

## Non-Human Identity Principles

- Machine credentials must never be committed to source control
- Client secrets must be rotated on a defined schedule (90 days maximum)
- Each service/agent must have its own dedicated credentials —
  no shared service accounts
- Token scopes must be minimal — request only the permissions
  required for the specific task
- All machine authentication events must be logged with caller
  identity, requested scope, and timestamp
- Prefer short-lived tokens (≤1 hour) with automatic refresh
  over long-lived API keys