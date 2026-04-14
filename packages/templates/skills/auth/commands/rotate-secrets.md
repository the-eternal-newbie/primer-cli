# /rotate-secrets

Execute zero-downtime rotation of API keys, JWT signing keys,
and service credentials.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` section on
cryptographic failures.
Read `docs/skills/auth/knowledge/machine-identity.md` section on
non-human identity principles.

## Steps

1. Identify all secrets requiring rotation:
   - JWT signing keys (rotate every 90 days or immediately on compromise)
   - Third-party API keys (provider webhooks, payment processors)
   - Database credentials (per-service roles)
   - OAuth2 client secrets
   - Encryption keys (data-at-rest)

2. For JWT signing key rotation (zero-downtime):
   - Generate new signing key
   - Add new key to JWKS endpoint alongside old key (both active)
   - Deploy new key as the signing key for new tokens
   - Wait for all existing tokens to expire (max session duration)
   - Remove old key from JWKS endpoint
```typescript
   // Support multiple keys during rotation via kid (key ID)
   const JWKS = createLocalJWKSet({
     keys: [newKey, oldKey] // both valid during rotation window
   });

   const { payload } = await jwtVerify(token, JWKS, {
     algorithms: ['RS256'],
   });
```

3. For API key rotation:
   - Generate new key in the provider console or secrets manager
   - Update the secret in your secrets manager (Vault, AWS Secrets Manager)
   - Deploy the updated secret reference to all services
     (trigger a rolling restart if secrets are injected at startup)
   - Verify all services are using the new key via health checks
   - Revoke the old key only after confirming zero usage

4. For database credential rotation with Vault:
```bash
   # Vault dynamic secrets — generates a new credential on every request
   vault read database/creds/<role>
   # Returns: username, password (valid for configured TTL)

   # Rotate static credentials
   vault write -force database/rotate-role/<role>
```

5. Document the rotation in the incident/maintenance log:
   - Which secret was rotated
   - Reason (scheduled vs incident response)
   - Operator identity
   - Timestamp
   - Verification steps completed

6. Update the next rotation date in the secrets registry.

## Do not

- Never revoke the old secret before confirming the new one is active
- Never rotate secrets by committing new values to source control
- Never use the same secret across multiple environments
- Never rotate manually without updating the secrets manager record
- Never skip the verification step after rotation