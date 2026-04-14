# API Contract Governance

An API is a promise to its consumers. Breaking that promise causes
outages in systems you don't control, by teams you may never meet.
The OpenAPI specification is the non-negotiable source of truth for
every API surface — not the code, not the documentation, not the
developer's memory.

## What Constitutes a Breaking Change

**Breaking changes (require version increment):**
- Removing an endpoint
- Removing a required or optional request field
- Adding a new required request field
- Changing a field type (string → integer)
- Changing a field name
- Changing HTTP method of an existing endpoint
- Removing a response field that clients may depend on
- Changing error response structure
- Changing authentication requirements

**Non-breaking changes (backward compatible):**
- Adding a new optional request field
- Adding a new response field
- Adding a new endpoint
- Relaxing validation constraints (min → lower min)
- Adding new enum values (with caution — clients may not handle unknown values)

**The golden rule:** If an existing client, unchanged, would behave
differently after your change — it is a breaking change.

---

## OpenAPI as the Source of Truth

The OpenAPI spec must be generated from code, never hand-written.
Hand-written specs drift from implementation immediately.

**NestJS with @nestjs/swagger:**
```typescript
// Decorator-driven spec generation
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  @Post()
  @ApiOperation({ summary: 'Create a payment' })
  @ApiResponse({ status: 201, type: PaymentResponseDto })
  @ApiResponse({ status: 422, type: ValidationErrorDto })
  async createPayment(@Body() dto: CreatePaymentDto): Promise<PaymentResponseDto> {
    return this.paymentsService.create(dto);
  }
}
```

**FastAPI (automatic spec generation):**
```python
# FastAPI generates OpenAPI spec automatically from type hints
@router.post("/payments", response_model=PaymentResponse, status_code=201)
async def create_payment(
    payment: CreatePaymentRequest,
    current_user: User = Depends(get_current_user)
) -> PaymentResponse:
    return await payment_service.create(payment, current_user.id)
```

**ASP.NET Core with Scalar:**
```csharp
builder.Services.AddOpenApi();
// Scalar provides a modern UI replacing Swagger UI
app.MapScalarApiReference();
app.MapOpenApi();
```

---

## Versioning Strategies

### URL Path Versioning (recommended for most APIs)
```
GET /v1/users/{id}
GET /v2/users/{id}
```
Most explicit, easiest to route, cache, and debug. The default choice.

### Header Versioning
```
GET /users/{id}
API-Version: 2
```
Cleaner URLs but harder to test in a browser and cache by CDN.
Use when URL cleanliness is a strong requirement.

### Content Negotiation
```
Accept: application/vnd.api+json;version=2
```
Most RESTful but highest implementation complexity.
Use only when strict REST compliance is a requirement.

**Never use query parameter versioning** (`/users?version=2`).
Query parameters are semantically for filtering, not for protocol selection.

---

## API Deprecation Lifecycle

Every removed endpoint must go through a deprecation period.

```
Phase 1: Announce deprecation
  - Add `Deprecation` and `Sunset` headers to responses
  - Update OpenAPI spec with `deprecated: true`
  - Notify consumers via changelog and email

Phase 2: Deprecation period (minimum 6 months for external APIs)
  - Continue serving the deprecated endpoint
  - Log usage by consumer to identify who still depends on it
  - Actively reach out to high-volume consumers

Phase 3: Sunset
  - Return 410 Gone with migration guidance
  - Remove from OpenAPI spec
```

```typescript
// Deprecation headers
response.headers.set('Deprecation', 'true');
response.headers.set('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
response.headers.set('Link', '</v2/payments>; rel="successor-version"');
```

---

## Consumer-Driven Contract Testing

Contract tests verify that the provider API actually satisfies what
consumers expect — not just that the provider matches its own spec.

**With Pact (Node.js):**
```typescript
// Consumer defines the contract
const interaction = {
  uponReceiving: 'a request for user profile',
  withRequest: { method: 'GET', path: '/v1/users/123' },
  willRespondWith: {
    status: 200,
    body: { id: '123', email: like('user@example.com'), name: like('Alice') },
  },
};

// Provider verifies the contract in CI
const verifier = new Verifier({
  provider: 'UserService',
  pactUrls: ['./pacts/frontend-userservice.json'],
  providerBaseUrl: 'http://localhost:3000',
});
```