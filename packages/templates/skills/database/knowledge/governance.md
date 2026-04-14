# Data Governance, Lineage, and Dynamic Masking

Data governance is not a compliance checkbox. It is the engineering
discipline that prevents data from becoming a liability.

## PII Classification

All personal data must be classified before storage decisions are made.

| Class | Examples | Handling requirement |
|---|---|---|
| Direct identifiers | Name, email, SSN, passport | Encrypt at rest, mask in logs |
| Quasi-identifiers | DOB, ZIP, gender | Aggregate before analytics use |
| Sensitive attributes | Health, financial, biometric | Encrypt, strict access control |
| Behavioral data | Clickstream, purchase history | Pseudonymize for analytics |
| Derived data | Credit score, risk profile | Treat as source class |

**Pseudonymization vs Anonymization:**
- Pseudonymization replaces identifiers with tokens — reversible with
  the mapping table. Still considered personal data under GDPR.
- Anonymization is irreversible — the individual cannot be re-identified.
  Truly anonymized data is not subject to GDPR.

---

## Soft Delete vs Hard Delete

**Soft delete:** Set `deleted_at = NOW()`, filter `WHERE deleted_at IS NULL`
in all queries.

**When to use soft delete:**
- Any business entity with audit requirements
- Financial transactions (always)
- User accounts (regulatory requirement in most jurisdictions)
- Any entity referenced by other tables

**When hard delete is acceptable:**
- Ephemeral session data with no business value
- Cache/queue tables
- After documented retention period has elapsed and soft-delete record
  has been archived

**Implementing soft delete correctly:**
```sql
-- Add deleted_at to the table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Partial index for active records (exclude deleted from normal queries)
CREATE INDEX idx_users_active ON users(id) WHERE deleted_at IS NULL;

-- View for application use (hides deleted records)
CREATE VIEW active_users AS
  SELECT * FROM users WHERE deleted_at IS NULL;
```

**Prisma callout:** Prisma does not support soft deletes natively.
Use middleware to intercept `delete` calls and convert them to updates,
or the `prisma-soft-delete-middleware` package.

---

## Audit Trail Design

Every mutation on a compliance-critical table must produce an immutable
audit record containing:

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID | Unique audit event identifier |
| `table_name` | VARCHAR | Which table was affected |
| `record_id` | UUID | Which record was affected |
| `operation` | ENUM | INSERT, UPDATE, DELETE |
| `old_values` | JSONB | Previous state (NULL for INSERT) |
| `new_values` | JSONB | New state (NULL for DELETE) |
| `actor_id` | UUID | Who performed the operation |
| `actor_type` | ENUM | USER, SERVICE, SYSTEM |
| `ip_address` | INET | Origin IP address |
| `trace_id` | VARCHAR | Distributed trace correlation ID |
| `occurred_at` | TIMESTAMPTZ | When the operation occurred |

**Implementation approach:** PostgreSQL triggers are the most reliable
mechanism — they fire regardless of how the mutation reaches the database
(ORM, raw SQL, admin tools, migrations).

```sql
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, record_id, operation,
    old_values, new_values, occurred_at
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

---

## Dynamic Data Masking

Masking must occur at the data layer, not the application layer.
Application-layer masking can be bypassed by direct database access,
debugging tools, or application bugs.

**PostgreSQL approach:** Row Security Policies (RLS) combined with
views that mask sensitive columns based on the connecting role.

```sql
-- Role-based column masking
CREATE VIEW users_masked AS
SELECT
  id,
  CASE
    WHEN current_setting('app.user_role') = 'admin'
    THEN email
    ELSE regexp_replace(email, '(^[^@]{3})[^@]*', '\1***')
  END AS email,
  name,
  -- SSN never exposed through view
  'REDACTED' AS ssn
FROM users;
```

**GDPR/CCPA requirements:**
- Right to erasure: implement as anonymization (replace PII with
  irreversible tokens), not deletion, to preserve audit trail integrity
- Data portability: design schema with export capability from the start
- Retention limits: implement automated retention jobs that anonymize
  records past their retention period

---

## Data Lineage

Every piece of data must have a traceable origin. For derived or
transformed data, the lineage chain must be preserved.

Minimum lineage fields on every significant table:
```sql
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by    UUID REFERENCES users(id),
updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_by    UUID REFERENCES users(id),
source        VARCHAR(100), -- 'user_input', 'import', 'api', 'derived'
source_ref    VARCHAR(255)  -- external ID or import batch reference
```

For analytics and reporting tables, document the transformation logic
that produced each column in a schema registry or data catalog.