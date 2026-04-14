# /create-migration

Author a safe, backward-compatible migration using the expand/contract pattern.

## Before executing

Read `docs/skills/database/knowledge/migration-safety.md` in full before authoring any migration.

## Steps

1. Classify the migration type:
   - Additive (safe): new table, new nullable column, new index
   - Destructive (requires expand/contract): column rename, type change,
     NOT NULL addition, column removal, table rename

2. For additive migrations:
```bash
   prisma migrate dev --name descriptive_migration_name
   # Review generated SQL before proceeding
   cat prisma/migrations/<timestamp>_<name>/migration.sql
```

3. For destructive migrations, execute expand/contract:
   - Phase 1 (current migration): add new structure
   - Phase 2 (application deployment): update code to use new structure
   - Phase 3 (subsequent migration, after full rollout): remove old structure
   - Never combine phases 1 and 3 in a single migration

4. Add CONCURRENTLY to all index creation on tables > 100,000 rows:
```sql
   -- Edit the generated migration.sql directly
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

5. Document the rollback procedure as a comment in the migration file:
```sql
   -- Rollback: ALTER TABLE users DROP COLUMN display_name;
   -- Safe to rollback until Phase 3 (contract) migration is applied
```

6. Test in development:
```bash
   prisma migrate dev   # applies and tests migration
   prisma migrate reset # verify clean apply from scratch
```

7. Generate production migration script:
```bash
   prisma migrate deploy
```

8. For production execution:
   - Apply during low-traffic window for risky operations
   - Monitor lock wait times during application
   - Verify row counts and data integrity after apply
   - Keep rollback script ready for immediate execution

## Do not

- Never modify a migration file that has been applied to any environment
- Never run `prisma migrate dev` in production — use `migrate deploy`
- Never skip the rollback documentation step
- Never combine expand and contract phases in a single migration
- Never apply without reviewing the generated SQL