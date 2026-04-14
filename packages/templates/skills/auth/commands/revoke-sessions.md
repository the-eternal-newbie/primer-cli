# /revoke-sessions

Instantly invalidate active tokens and sessions globally or
for specific users during a suspected breach.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` section on
session token mishandling.
Read `docs/skills/auth/knowledge/machine-identity.md` section on
non-human identity principles.

## Steps

1. Assess the revocation scope:
   - Single user (suspected account compromise)
   - All users (suspected signing key compromise or mass breach)
   - Specific session (device revocation by user request)
   - Service credentials (suspected M2M token compromise)

2. For JWT-based sessions (single user):
```typescript
   // Maintain a token denylist (Redis recommended for performance)
   import { redis } from '@/lib/redis';

   export async function revokeUserSessions(userId: string): Promise<void> {
     // Add a revocation marker with TTL matching max token lifetime
     await redis.setex(
       `revoked:user:${userId}`,
       3600, // max token lifetime in seconds
       Date.now().toString()
     );
   }

   // In JWT verification middleware
   export async function verifyToken(token: string) {
     const { payload } = await jwtVerify(token, publicKey);

     // Check denylist
     const revokedAt = await redis.get(`revoked:user:${payload.sub}`);
     if (revokedAt && payload.iat < parseInt(revokedAt) / 1000) {
       throw new Error('Token revoked');
     }

     return payload;
   }
```

3. For Auth.js database sessions (single user):
```typescript
   // Delete all sessions for the user from the database
   await prisma.session.deleteMany({ where: { userId } });
```

4. For Clerk (single user):
```typescript
   import { clerkClient } from '@clerk/nextjs/server';

   const sessionList = await clerkClient.users.getUserSessionList({ userId });
   for (const session of sessionList.data) {
     await clerkClient.sessions.revokeSession(session.id);
   }
```

5. For global revocation (signing key compromise):
   - Rotate the JWT signing key immediately (see `/rotate-secrets`)
   - All existing tokens become invalid instantly
   - All users will be required to re-authenticate
   - Communicate planned disruption to users before executing
     if the threat assessment allows time

6. For M2M credential revocation:
   - Revoke the client secret in the identity provider
   - Rotate to new credentials (see `/rotate-secrets`)
   - Update all services consuming the compromised credentials

7. Log the revocation event:
   - Scope (user ID or global)
   - Reason (compromise suspected, routine rotation, user request)
   - Operator identity
   - Timestamp
   - Number of sessions invalidated

## Do not

- Never rely solely on cookie deletion for session invalidation —
  the server must maintain revocation state
- Never delay global revocation pending user communication
  if active compromise is confirmed
- Never reuse a signing key after it has been compromised
- Never skip logging revocation events — they are critical
  for incident forensics