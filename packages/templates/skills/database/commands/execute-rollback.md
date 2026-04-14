# /execute-rollback

Execute a safe database rollback with integrity verification and
minimal downtime.

## Before executing

Read `docs/skills/database/knowledge/migration-safety.md` section on rollback strategy.
Confirm the migration being rolled back is classified as reversible.

## Steps

1. Assess rollback safety:
   - Is the migration reversible? (See migration-safety knowledge document)
   - Has data been written to new structures that must be preserved?
   - Are dependent services relying on the new schema?
   - What is the blast radius if rollback fails?

2. Take a point-in-time backup immediately before rollback:
```bash
   pg_dump -Fc database_name > pre_rollback_$(date +%Y%m%d_%H%M%S).dump
```
   Verify the backup completed successfully before proceeding.

3. Put the application in maintenance mode or redirect traffic
   away from the affected service before executing DDL.

4. Execute the rollback SQL (from the migration's documented rollback
   procedure):
```sql
   BEGIN;
   -- Execute rollback statements
   -- Verify row counts and data integrity
   SELECT count(*) FROM affected_table;
   COMMIT;  -- or ROLLBACK if verification fails
```

5. Verify data integrity after rollback:
```sql
   -- Verify referential integrity
   -- Check for orphaned records
   -- Verify row counts match pre-migration baseline
   -- Run application smoke tests against the rolled-back schema
```

6. Update migration history to reflect the rollback:
   - Mark the rolled-back migration as reverted in your migration tool
   - Document the rollback in the incident log with timestamp, reason,
     and operator

7. Restore application traffic only after integrity verification passes.

8. Conduct a post-rollback review:
   - Why did the migration need to be rolled back?
   - Was the expand/contract pattern followed? If not, why not?
   - What process change prevents this in future?

## Do not

- Never rollback without a backup taken immediately before
- Never rollback irreversible migrations (column drops, data transformations)
  — restore from backup instead
- Never skip integrity verification after rollback
- Never restore traffic before verification is complete
- Never rollback without documenting the incident