# Advanced Authorization Models

Authorization is not a boolean. Modern applications require contextual,
relationship-aware, and attribute-driven access decisions that RBAC
alone cannot express safely.

## Role-Based Access Control (RBAC)

The most common model. Users are assigned roles; roles are assigned
permissions.

**When RBAC is sufficient:**
- Small number of distinct roles (< 10)
- Permissions are static and do not depend on resource attributes
- No ownership or hierarchy relationships required

**RBAC failure mode — role explosion:**
As applications grow, RBAC degrades into dozens of highly specific roles
(`admin`, `senior-admin`, `regional-admin`, `read-only-admin`) that are
difficult to maintain and reason about. When you have more roles than
you can enumerate on one screen, RBAC has failed.

**Implementation:**
```typescript
// Clerk RBAC with organizations
const { has } = auth();
if (!has({ permission: 'org:reports:read' })) {
  throw new Error('Forbidden');
}

// Cerbos RBAC
const decision = await cerbos.checkResource({
  principal: { id: userId, roles: ['editor'] },
  resource: { kind: 'document', id: documentId },
  actions: ['read', 'update'],
});
```

---

## Attribute-Based Access Control (ABAC)

Access decisions based on attributes of the subject (user), resource,
and environment (context).

**When ABAC is required:**
- Access depends on resource attributes (e.g., `document.classification`)
- Access depends on environmental context (time of day, IP region,
  device trust level)
- Access depends on user attributes beyond role (department, clearance,
  contract status)

**Example policies:**
```
# Cerbos policy: ABAC
rules:
  - actions: ['read']
    effect: EFFECT_ALLOW
    condition:
      match:
        all:
          of:
            - expr: request.resource.attr.classification == 'internal'
            - expr: request.principal.attr.department == request.resource.attr.owner_department
            - expr: now().getHours() >= 9 && now().getHours() <= 17
```

---

## Relationship-Based Access Control (ReBAC)

Access decisions based on the relationship graph between users and
resources. The model used by Google Zanzibar and derived systems.

**When ReBAC is required:**
- Ownership hierarchies: "Manager can access files owned by team members"
- Inheritance: "Editor of a folder can edit all documents in the folder"
- Sharing: "User can access a document if someone with access shared it"
- Organizational structure: "Member of org can view org resources"

**Example (Google Zanzibar tuple notation):**
```
document:budget_2026#editor@user:alice
document:budget_2026#viewer@group:finance_team
group:finance_team#member@user:bob
```
Bob can view `budget_2026` because:
Bob → member of finance_team → viewer of document

**Implementation with Cerbos (derived roles):**
```yaml
derivedRoles:
  name: document_roles
  definitions:
    - name: owner
      parentRoles: ['user']
      condition:
        match:
          expr: request.resource.attr.owner_id == request.principal.id
    - name: team_member
      parentRoles: ['user']
      condition:
        match:
          expr: request.principal.attr.team_id == request.resource.attr.team_id
```

---

## Choosing the Right Model

| Scenario | Model |
|---|---|
| Fixed roles, static permissions | RBAC |
| Context-dependent access (time, region, attributes) | ABAC |
| Ownership and hierarchy relationships | ReBAC |
| Complex enterprise with all of the above | RBAC + ABAC + ReBAC (layered) |

**The composition rule:** Start with RBAC for coarse-grained access.
Layer ABAC conditions for context. Add ReBAC for relationships.
Never mix policy logic into application code — use a centralized engine.

---

## Authorization Anti-Patterns

**UI-driven authorization:**
Hiding a button in the UI is not access control. Every action must be
validated server-side regardless of what the UI shows.

**Flat permission strings:**
`can_edit`, `can_delete`, `can_view` without resource scoping are
meaningless at scale. Permissions must always include resource type
and action: `document:edit`, `report:delete`, `user:view`.

**Ambient authority:**
Code that performs privileged operations without explicitly checking
whether the caller is authorized. Every function that accesses sensitive
data must verify authorization at its entry point.