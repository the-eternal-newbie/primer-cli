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

2. Define the API surface before writing any implementation:
```yaml
   # openapi.yaml — written first, implementation follows
   openapi: 3.1.0
   info:
     title: <ServiceName> API
     version: 1.0.0
   paths:
     /v1/<resources>:
       get:
         summary: List <resources>
         parameters:
           - name: cursor
             in: query
             schema: { type: string }
         responses:
           '200':
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/<Resource>ListResponse'
       post:
         summary: Create <resource>
         parameters:
           - name: Idempotency-Key
             in: header
             required: true
             schema: { type: string, format: uuid }
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 $ref: '#/components/schemas/Create<Resource>Request'
         responses:
           '201':
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/<Resource>Response'
           '422':
             description: Validation error
```

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

7. Commit the OpenAPI spec to version control before the implementation.

## Do not

- Never implement an endpoint before defining it in the OpenAPI spec
- Never mix HTTP concerns into the service layer
- Never create a service without defining its boundary explicitly
- Never omit idempotency keys from state-mutating endpoints