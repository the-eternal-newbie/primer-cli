# /design-schema

Design a normalized, constraint-enforced schema for a new business entity.

## Before executing

Read `knowledge/anti-patterns.md` in full.
Read `knowledge/governance.md` sections on PII classification and lineage.

## Steps

1. Identify the business entity and its attributes:
   - List all data points the entity must store
   - Classify each attribute: identifier, descriptor, relationship,
     temporal, or derived
   - Flag any PII attributes for governance treatment

2. Apply normalization:
   - 1NF: eliminate repeating groups — each column contains atomic values
   - 2NF: eliminate partial dependencies — all non-key attributes depend
     on the entire primary key
   - 3NF: eliminate transitive dependencies — non-key attributes depend
     only on the primary key, not on other non-key attributes
   - Stop at 3NF unless performance requirements justify denormalization,
     and document the denormalization decision explicitly

3. Define the primary key:
   - Use UUID (v4 or v7) for entities exposed in APIs — prevents
     enumeration attacks and supports distributed generation
   - Use BIGSERIAL only for internal-only tables where sequential IDs
     are acceptable and performance is critical
   - PostgreSQL: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`

4. Define foreign key constraints with explicit cascade behavior:
   - RESTRICT: prevent deletion of referenced records (default for
     most business entities)
   - CASCADE: delete child records when parent is deleted (use sparingly)
   - SET NULL: nullify the foreign key when parent is deleted (requires
     nullable column)

5. Add standard governance columns:
```sql
   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   deleted_at  TIMESTAMPTZ,          -- soft delete
   created_by  UUID REFERENCES users(id),
   updated_by  UUID REFERENCES users(id)
```

6. Plan indexes:
   - Primary key index is automatic
   - Add indexes on all foreign key columns
   - Add indexes on columns used in frequent WHERE, ORDER BY, or JOIN
   - Evaluate covering indexes for high-frequency read queries
   - Document the query patterns each index serves

7. Write the Prisma schema definition and validate:
```bash
   prisma validate
   prisma format
```

8. Review the generated SQL with a migration diff before applying:
```bash
   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

## Do not

- Never use EAV — see anti-patterns knowledge document
- Never use polymorphic associations without documenting the tradeoff
- Never omit foreign key constraints (except PlanetScale — document this)
- Never use FLOAT or DECIMAL without explicit precision for monetary values
- Never expose sequential integer IDs in public-facing APIs