# Authorization Decoupling and Policy-as-Code

The most catastrophic authorization failures occur when policy logic
is scattered across application code, middleware, and UI components.
A single refactor can accidentally remove a permission check. A UI
change can expose a backend capability. Decoupling authorization from
application code is the architectural solution.

## The Core Problem

**Coupled authorization (anti-pattern):**
```typescript
// Policy logic scattered in route handlers
router.get('/reports/:id', async (req, res) => {
  if (req.user.role === 'admin' || req.user.department === 'finance') {
    // fetch report
  }
});

// Same logic duplicated in middleware
if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

// And again in the UI
{user.role === 'admin' && <DeleteButton />}
```

Problems:
- Policy logic exists in 3+ places — impossible to audit or change atomically
- A UI change (removing the button) doesn't remove the API permission
- No single source of truth for "who can do what"

---

## The Policy Decision Point Pattern

Separate the system into three components:

**Policy Enforcement Point (PEP):** Where access decisions are enforced.
Lives in API middleware or route handlers. Makes a call to the PDP and
enforces the result. Contains no policy logic itself.

**Policy Decision Point (PDP):** Where access decisions are made.
The policy engine (Cerbos, OPA, Oso). Evaluates policy against
principal + resource + action. Returns ALLOW or DENY.

**Policy Administration Point (PAP):** Where policies are defined
and stored. Policy files in version control, deployed independently
of application code.

```
Request → PEP (middleware) → PDP (Cerbos) → Policy files (PAP)
                ↓
           ALLOW / DENY
                ↓
          PEP enforces
```

---

## Cerbos Integration Pattern

```typescript
// PEP: enforcement in tRPC middleware
const authzMiddleware = t.middleware(async ({ ctx, next, meta }) => {
  const decision = await cerbos.checkResource({
    principal: {
      id: ctx.user.id,
      roles: ctx.user.roles,
      attr: {
        department: ctx.user.department,
        clearance: ctx.user.clearance,
      },
    },
    resource: {
      kind: meta?.resource ?? 'unknown',
      id: meta?.resourceId ?? '*',
      attr: await getResourceAttributes(meta?.resourceId),
    },
    actions: [meta?.action ?? 'read'],
  });

  if (!decision.isAllowed(meta?.action ?? 'read')) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next();
});

// Policy file (PAP) — version controlled, deployed independently
// policies/document.yaml
resource: document
rules:
  - actions: ['read']
    effect: EFFECT_ALLOW
    roles: ['viewer', 'editor', 'admin']
  - actions: ['update']
    effect: EFFECT_ALLOW
    roles: ['editor', 'admin']
    condition:
      match:
        expr: request.resource.attr.status != 'locked'
  - actions: ['delete']
    effect: EFFECT_ALLOW
    roles: ['admin']
```

---

## Oso Integration Pattern

```python
# Python backend with Oso
from oso import Oso

oso = Oso()
oso.load_files(["policies/main.polar"])

# PEP: enforcement at API layer
def require_permission(actor, action, resource):
    if not oso.is_allowed(actor, action, resource):
        raise ForbiddenError()

# Policy (PAP) — main.polar
allow(actor: User, "read", resource: Document) if
    actor.role = "admin" or
    resource.owner_id = actor.id or
    actor in resource.shared_with;
```

---

## Policy Versioning and Deployment

Policies must be:
- Stored in version control alongside application code
- Reviewed and approved like code changes (PR process)
- Deployed independently of application deployments
- Tested with explicit allow/deny test cases before deployment

```yaml
# Cerbos policy test
tests:
  - name: editor can update unlocked document
    input:
      principal: { id: "user1", roles: ["editor"] }
      resource: { kind: "document", id: "doc1", attr: { status: "active" } }
      actions: ["update"]
    expected:
      - action: update
        effect: EFFECT_ALLOW

  - name: editor cannot update locked document
    input:
      principal: { id: "user1", roles: ["editor"] }
      resource: { kind: "document", id: "doc2", attr: { status: "locked" } }
      actions: ["update"]
    expected:
      - action: update
        effect: EFFECT_DENY
```