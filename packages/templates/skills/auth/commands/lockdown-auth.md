# /lockdown-auth

Enforce immediate step-up authentication or block threat vectors
during an active credential stuffing or account takeover attack.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` sections on
rate limiting bypass and identification failures.
Read `docs/skills/auth/knowledge/frontend-security.md` section on
CORS and security headers.

## Steps

1. Detect the attack pattern:
   - **Credential stuffing:** High volume of failed auth attempts
     across many different accounts from distributed IPs
   - **Account takeover:** Successful logins from unusual geolocations
     or devices for specific high-value accounts
   - **Brute force:** High volume of failed attempts against
     specific accounts

2. Implement immediate rate limiting via middleware:
```typescript
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(5, '1m'), // 5 attempts per minute
     analytics: true,
   });

   export async function authRateLimiter(identifier: string) {
     const { success, remaining, reset } = await ratelimit.limit(identifier);
     if (!success) {
       throw new Error(`Rate limit exceeded. Reset at ${new Date(reset).toISOString()}`);
     }
   }

   // Apply both IP and user-identity rate limits
   await authRateLimiter(`ip:${clientIp}`);
   await authRateLimiter(`user:${email}`);
```

3. Enforce step-up MFA for affected accounts:
```typescript
   // Flag accounts for mandatory MFA re-verification
   await prisma.user.updateMany({
     where: { id: { in: affectedUserIds } },
     data: { requireMfaAt: new Date() },
   });

   // In session validation middleware
   if (user.requireMfaAt && session.mfaVerifiedAt < user.requireMfaAt) {
     redirect('/verify-mfa');
   }
```

4. Block identified malicious IP ranges:
```typescript
   // Next.js middleware IP blocking
   const BLOCKED_RANGES = ['192.168.x.x', '10.x.x.x']; // replace with actual ranges

   export function middleware(request: NextRequest) {
     const clientIp = request.ip ?? request.headers.get('x-forwarded-for');
     if (clientIp && isInBlockedRange(clientIp, BLOCKED_RANGES)) {
       return new Response('Forbidden', { status: 403 });
     }
   }
```

5. Enable CAPTCHA on auth endpoints:
   - Integrate Cloudflare Turnstile or hCaptcha on login and
     registration forms during active attack
   - Verify CAPTCHA server-side — never trust client-side verification

6. Alert and escalate:
   - Notify the security team immediately with attack metrics
   - Document the attack pattern, affected accounts, and mitigations
   - Preserve logs for forensic analysis — do not rotate logs
     during or immediately after an incident

7. Post-incident review:
   - Identify how the attack bypassed existing controls
   - Implement permanent mitigations (tighter rate limits,
     bot detection, behavioral analytics)
   - Update the incident runbook with lessons learned

## Do not

- Never block legitimate users based on shared IP ranges
  without manual review (VPN/NAT IP ranges affect many users)
- Never rely on IP blocking as the sole mitigation —
  attackers rotate IPs trivially
- Never disable logging during an incident to reduce noise —
  logs are your primary forensic tool
- Never communicate breach details publicly before containment
  is confirmed and legal review is complete