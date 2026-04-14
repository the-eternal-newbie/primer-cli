# Migration Safety and Zero-Downtime Architecture

Every migration that has caused a production outage violated at least
one principle in this document.

## The Expand/Contract Pattern

The only safe model for schema changes in a live system with zero
downtime. Every breaking change is decomposed into three phases:

**Phase 1 — Expand:** Add the new structure alongside the old.
The old structure remains fully operational. Both old and new application
code can run simultaneously.

**Phase 2 — Migrate:** Copy or transform data from the old structure
to the new. Application code is updated to write to both structures
during this phase.

**Phase 3 — Contract:** Remove the old structure once all application
instances have been updated and verified. The old structure is now dead.

```
Example: Renaming a column `full_name` to `display_name`

Phase 1 (Expand):
  ALTER TABLE users ADD COLUMN display_name VARCHAR(255);

Phase 2 (Migrate):
  UPDATE users SET display_name = full_name WHERE display_name IS NULL;
  -- Application writes to both columns during rollout

Phase 3 (Contract):
  ALTER TABLE users DROP COLUMN full_name;
  -- Only after 100% of application instances use display_name
```

---

## Dangerous Operations and Their Safe Alternatives

### Adding a NOT NULL column without a default

**Dangerous:**
```sql
ALTER TABLE users ADD COLUMN tier VARCHAR(50) NOT NULL;
-- Takes full table lock, fails if any existing row exists
```

**Safe (PostgreSQL 11+):**
```sql
-- Constant defaults are applied without rewriting the table in PG11+
ALTER TABLE users ADD COLUMN tier VARCHAR(50) NOT NULL DEFAULT 'standard';
-- Then remove default if desired (separate migration)
ALTER TABLE users ALTER COLUMN tier DROP DEFAULT;
```

### Dropping a column

**Dangerous:** Dropping immediately while application code still
references the column.

**Safe:** Expand/contract. First deploy application code that no longer
references the column. Then drop the column in a subsequent migration.

### Adding an index on a large table

**Dangerous:**
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- Locks the table for the duration of index build
```

**Safe:**
```sql
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
-- Builds index without locking writes, takes longer but safe
```

**Prisma callout:** Prisma Migrate does not use CONCURRENTLY by default.
For large tables, create indexes manually with CONCURRENTLY and mark the
migration as applied without re-running it, or use a raw SQL migration.

### Changing a column type

Always a table rewrite requiring an exclusive lock on large tables.
Use shadow columns (expand/contract) instead of direct type changes.

---

## Lock Escalation

PostgreSQL locks escalate from row-level to table-level during DDL
operations. Operations that acquire `ACCESS EXCLUSIVE` locks block
all reads and writes:

| Operation | Lock level |
|---|---|
| `ALTER TABLE ADD COLUMN` (with volatile default) | ACCESS EXCLUSIVE |
| `ALTER TABLE DROP COLUMN` | ACCESS EXCLUSIVE |
| `CREATE INDEX` (non-concurrent) | SHARE |
| `CREATE INDEX CONCURRENTLY` | No table lock |
| `TRUNCATE` | ACCESS EXCLUSIVE |
| `DROP TABLE` | ACCESS EXCLUSIVE |

**Detection:** Long-running transactions block lock acquisition and
cause lock queues. Monitor with:
```sql
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < now() - interval '30 seconds';
```

---

## Migration Immutability

A migration file that has been applied to any environment must never
be modified. Modifying applied migrations causes:

- Checksum failures in migration tools (Prisma, Flyway, Liquibase)
- Divergence between schema history and actual database state
- Inability to reproduce the schema state at any point in history

If a migration contains an error that has already been applied:
1. Write a new corrective migration — never edit the original
2. Document the correction in the new migration's description

---

## Rollback Strategy

Not every migration is reversible. Classify before applying:

| Migration type | Reversible? | Strategy |
|---|---|---|
| Add column (nullable) | Yes | Drop column |
| Add column (NOT NULL) | Yes (PG11+) | Drop column |
| Drop column | No | Restore from backup |
| Add index | Yes | Drop index |
| Data transformation | Maybe | Depends on data integrity |
| Rename via expand/contract | Yes | Reverse the contract phase |

**Always document the rollback procedure in the migration file itself
as a comment before applying to production.**

---

## Prisma-Specific Migration Safety

```bash
# Never run in production without review:
prisma migrate dev    # development only, resets shadow database

# Production migration workflow:
prisma migrate diff   # preview the SQL that will be generated
prisma migrate deploy # applies pending migrations, no reset
```

Always inspect the generated SQL before deploying:
```bash
cat prisma/migrations/<timestamp>_<name>/migration.sql
```

Never use `--force-reset` outside of local development.