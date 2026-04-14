# /scaffold-service

Generate a service blueprint, boilerplate structure, and OpenAPI
specification from a business requirement.

## Before executing

Read `docs/skills/backend/knowledge/api-contracts.md` in full.
Read `docs/skills/backend/knowledge/idempotency.md` section on
idempotency key pattern.

## Steps

1. Define the service boundary from the business requirement:
   - What is the single responsibility of this service?
   - What data does it own exclusively?
   - What does it depend on from other services?
   - What does it expose to other services or clients?

2. Design the API surface before writing any implementation code.
   Use schema-first thinking to define endpoints, request/response
   shapes, and error contracts. For teams that want a design artifact,
   sketch the surface in a temporary document or whiteboard — but the
   authoritative OpenAPI spec is always generated from code, never
   hand-authored.

   Questions to answer before writing code:
   - What resources does this service expose?
   - What HTTP methods and status codes does each endpoint use?
   - What are the required and optional fields per operation?
   - What error shapes does each endpoint return?
   - Which endpoints require idempotency keys?

3. Generate the service scaffold for the target stack:

   **NestJS:**
```bash
   nest generate module <resource>
   nest generate controller <resource>
   nest generate service <resource>
```

   **FastAPI:**
```bash
   mkdir -p app/routers app/schemas app/services
   # Create: app/routers/<resource>.py
   # Create: app/schemas/<resource>.py
   # Create: app/services/<resource>.py
```

   **ASP.NET Core:**
```bash
   dotnet new webapi -n <ServiceName>
   # Generate controller, service, and model classes
```

   **Spring Boot:**
```bash
   # Use Spring Initializr or generate:
   # Controller, Service, Repository, and DTO classes
```

4. Implement the layered architecture:
   - **Router/Controller:** HTTP concerns only — deserialize request,
     call service, serialize response. No business logic.
   - **Service:** Business logic, orchestration, validation.
     No HTTP concerns.
   - **Repository:** Data access only. No business logic.

5. Wire idempotency handling for all POST/PUT/PATCH endpoints
   (see `/setup-observability` for middleware registration).

6. Verify the generated spec matches the implementation:
```bash
   # NestJS: spec auto-generated from decorators
   curl http://localhost:3000/api-json | jq .

   # FastAPI: spec auto-generated from type hints
   curl http://localhost:8000/openapi.json | jq .
```

7. Export the generated spec and commit it as a baseline artifact
   for contract diffing in CI — this is a generated snapshot, not
   a hand-authored source of truth:

```bash
   # NestJS: export generated spec
   curl http://localhost:3000/api-json > openapi.json

   # FastAPI: export generated spec
   curl http://localhost:8000/openapi.json > openapi.json

   # Commit as a generated artifact — update on every release
   git add openapi.json
   git commit -m "chore: update OpenAPI baseline snapshot"
  ```

   The spec in version control is a snapshot for diffing only.
   The running service is always the authoritative source.

## Do not

- Never implement an endpoint before defining it in the OpenAPI spec
- Never mix HTTP concerns into the service layer
- Never create a service without defining its boundary explicitly
- Never omit idempotency keys from state-mutating endpoints