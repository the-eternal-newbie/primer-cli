# /configure-access-policy

Define and deploy access control policies using a centralized
policy engine, translating business requirements into RBAC,
ABAC, or ReBAC rules.

## Before executing

Read `docs/skills/auth/knowledge/authorization-models.md` in full.
Read `docs/skills/auth/knowledge/authorization-decoupling.md` in full.

## Steps

1. Classify the access requirement:
   - Static roles → RBAC
   - Context-dependent (time, region, attributes) → ABAC
   - Ownership/hierarchy relationships → ReBAC
   - Complex enterprise → layered combination

2. Select and install the policy engine:
```bash
   # Cerbos (recommended for most TypeScript projects)
   pnpm add @cerbos/grpc
   # or HTTP client
   pnpm add @cerbos/http

   # Start Cerbos sidecar (Docker)
   docker run --rm -v ./policies:/policies \
     ghcr.io/cerbos/cerbos:0.35.0
   # Pin to a specific version — check https://github.com/cerbos/cerbos/releases
   # Update on a quarterly cadence or when security patches are released
```

3. Define the resource policy in version-controlled YAML:
```yaml
   # policies/<resource>.yaml
   apiVersion: api.cerbos.dev/v1
   resourcePolicy:
     version: default
     resource: <resource_name>
     rules:
       - actions: ['read']
         effect: EFFECT_ALLOW
         roles: ['viewer', 'editor', 'admin']
       - actions: ['create', 'update']
         effect: EFFECT_ALLOW
         roles: ['editor', 'admin']
         condition:
           match:
             expr: request.resource.attr.status != 'archived'
       - actions: ['delete']
         effect: EFFECT_ALLOW
         roles: ['admin']
```

4. Implement the Policy Enforcement Point in API middleware:
```typescript
   import { GRPC as Cerbos } from '@cerbos/grpc';

   const cerbos = new Cerbos('localhost:3593', { tls: false });

   export async function authorize(
     userId: string,
     userRoles: string[],
     userAttr: Record<string, unknown>,
     resourceKind: string,
     resourceId: string,
     resourceAttr: Record<string, unknown>,
     action: string
   ): Promise<void> {
     const decision = await cerbos.checkResource({
       principal: { id: userId, roles: userRoles, attr: userAttr },
       resource: { kind: resourceKind, id: resourceId, attr: resourceAttr },
       actions: [action],
     });

     if (!decision.isAllowed(action)) {
       throw new Error(`FORBIDDEN: ${action} on ${resourceKind}/${resourceId}`);
     }
   }
```

5. Write policy tests before deploying:
```yaml
   # policies/<resource>_test.yaml
   tests:
     - name: editor can update active resource
       input:
         principal: { id: 'u1', roles: ['editor'] }
         resource: { kind: '<resource>', id: 'r1', attr: { status: 'active' } }
         actions: ['update']
       expected:
         - action: update
           effect: EFFECT_ALLOW

     - name: editor cannot delete
       input:
         principal: { id: 'u1', roles: ['editor'] }
         resource: { kind: '<resource>', id: 'r1', attr: {} }
         actions: ['delete']
       expected:
         - action: delete
           effect: EFFECT_DENY
```

6. Run policy tests before deploying:
```bash
   cerbos compile --tests ./policies
```

7. Deploy policies independently of application code via CI/CD pipeline.

## Do not

- Never embed policy logic in route handlers or UI components
- Never deploy policy changes without accompanying test cases
- Never grant permissions by default — all policies start with DENY
- Never use string comparison for role checks in application code —
  delegate all decisions to the policy engine