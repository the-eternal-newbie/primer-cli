# /audit-access-control

Scan routing logic and API endpoints to ensure every resource
is protected by server-side authorization, preventing IDOR
and broken access control vulnerabilities.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` section on
broken access control and IDOR patterns.
Read `docs/skills/auth/knowledge/authorization-models.md` section
on authorization anti-patterns.
Read `docs/skills/auth/knowledge/authorization-decoupling.md`
section on the policy enforcement point pattern.

## Steps

1. Enumerate all API routes and server actions:
```bash
   # Next.js App Router — list all route handlers
   find app -name "route.ts" | sort

   # List all server actions
   grep -r "use server" app --include="*.ts" -l
```

2. For each route, verify the authorization checklist:
   - [ ] Authentication check: is the user authenticated?
   - [ ] Authorization check: does the user have permission for
         this action type?
   - [ ] Resource-level check: does the user have permission for
         this specific resource instance?
   - [ ] Input validation: are all user-supplied IDs validated
         against the authenticated user's accessible set?

3. Identify unprotected routes:
```bash
  # Find route files that access prisma without an auth check
  # Run separately to stay portable across GNU and BSD grep
  grep -r "prisma\." app/api --include="route.ts" -l | \
    xargs grep -L "auth()\|getSession\|currentUser"
```

4. Test for IDOR vulnerabilities:
   - Authenticate as User A
   - Record a resource ID belonging to User A
   - Authenticate as User B
   - Attempt to access User A's resource ID via direct URL manipulation
   - Expected: 403 Forbidden or 404 Not Found
   - Failure: 200 OK with User A's data

5. Verify authorization occurs before data fetching:
```typescript
   // Correct: check before fetching
   export async function GET(req, { params }) {
     const session = await auth();
     if (!session) return new Response(null, { status: 401 });

     const canAccess = await authorize(session.user.id, 'read', params.id);
     if (!canAccess) return new Response(null, { status: 403 });

     const data = await prisma.resource.findUnique({ where: { id: params.id } });
     return Response.json(data);
   }

   // Wrong: fetch first, check after
   export async function GET(req, { params }) {
     const data = await prisma.resource.findUnique({ where: { id: params.id } });
     const session = await auth();
     if (data.ownerId !== session.user.id) return new Response(null, { status: 403 });
     return Response.json(data); // data already fetched — timing attack possible
   }
```

6. Produce an access control audit report with:
   - Total routes audited
   - Routes missing authentication check (Critical)
   - Routes missing resource-level authorization (High)
   - Routes with authorization after data fetch (Medium)
   - Routes with only client-side checks (Critical)

## Do not

- Never mark a route as "secure" based on UI hiding alone
- Never rely on obscure URLs as a security mechanism
- Never skip resource-level checks for "low-sensitivity" data —
  attackers determine sensitivity, not developers