# Modern Auth Attack Vectors and OWASP Failures

Modern authentication failures rarely originate from brute force.
They come from business logic flaws that bypass well-intentioned
implementations. An agent must recognize these patterns and refuse
to produce code that enables them.

## OWASP Top 10 Auth-Relevant Vulnerabilities (2025)

### A01: Broken Access Control
The most prevalent web vulnerability. Occurs when authorization checks
are missing, bypassable, or enforced only on the client.

**Common failure patterns:**
- Horizontal privilege escalation: user A accesses user B's resources
  by manipulating an ID in the request (`/api/orders/12345` →
  `/api/orders/12346`)
- Vertical privilege escalation: non-admin user accesses admin endpoints
  because role check is missing on the server
- Missing function-level access control: UI hides admin buttons but the
  API endpoint accepts requests from any authenticated user
- Insecure Direct Object Reference (IDOR): internal identifiers
  (database IDs, file paths) exposed directly in URLs without
  authorization checks on each access

**Detection pattern:**
Every endpoint that accepts a resource identifier must verify that the
authenticated user has explicit permission to access that specific
resource instance, not just that they are authenticated.

---

### A02: Cryptographic Failures
Sensitive data exposed due to weak or absent cryptographic protection.

**Common failure patterns:**
- Passwords stored as MD5 or SHA-1 hashes — both are trivially reversible
  with modern GPU-based rainbow table attacks
- JWT signed with `alg: none` or weak HMAC secrets
- Sensitive data transmitted over HTTP (no TLS)
- Encryption keys stored alongside encrypted data
- Custom cryptographic implementations replacing audited libraries

**Non-negotiable:** Use Argon2id for password hashing (preferred over
bcrypt due to memory-hardness). Use AES-256-GCM for symmetric encryption.
Use RS256 or ES256 for JWT signing — asymmetric algorithms allow public
verification without exposing the signing key.

---

### A07: Identification and Authentication Failures

**Insecure password recovery:**
Password reset flows are a primary attack surface. Common failures:
- Reset tokens with insufficient entropy (predictable or short-lived
  in the wrong way — too long-lived, not single-use)
- Reset tokens transmitted via URL parameters (appear in server logs,
  referrer headers, browser history)
- Security questions as a recovery factor (easily researched or guessed)
- Account enumeration via different error messages for "email not found"
  vs "incorrect password"

**Safe reset flow:**
1. Generate a cryptographically random token (≥32 bytes, `crypto.randomBytes`)
2. Store a hash of the token (not the token itself) with a 15-minute expiry
3. Transmit the token in the email body only — never in URL logs
4. Invalidate the token immediately upon first use
5. Return identical error messages regardless of whether the email exists

**Bypassable MFA:**
- OTP codes accepted outside their validity window (clock skew exploit)
- MFA step skippable by directly navigating to the post-auth URL
- SMS OTP vulnerable to SIM-swap attacks — prefer TOTP or hardware keys
- MFA enforcement applied only in the UI, not enforced in the API

**Session token mishandling:**
- Tokens not invalidated on logout (server must maintain a denylist
  or use short-lived tokens with refresh rotation)
- Session fixation: session ID not rotated after authentication
- Long-lived sessions without re-authentication for sensitive operations

---

## Business Logic Auth Flaws

**Rate limiting bypass:**
Rate limits applied only by IP address are bypassed via distributed
attacks or IP rotation. Apply rate limits by user identity after
authentication succeeds, and by IP before authentication.

**Mass assignment:**
APIs that bind request body fields directly to model attributes allow
attackers to set `role: "admin"` or `verified: true` in registration
requests. Always use explicit allowlists for fields accepted from
client input.

**JWT confusion attacks:**
- Algorithm confusion: if the server accepts both RS256 and HS256,
  an attacker signs a token with the public key as an HMAC secret
- Key ID injection: `kid` header parameter used in file path or SQL
  query without sanitization
- Claim manipulation: `exp`, `iat`, and `nbf` claims not validated

**Safe JWT validation:**
```typescript
import { jwtVerify } from 'jose';

const { payload } = await jwtVerify(token, publicKey, {
  algorithms: ['RS256'], // never accept 'none' or multiple algorithms
  issuer: 'https://your-issuer.com',
  audience: 'your-api',
});
// Always validate: exp, iat, iss, aud, sub
```