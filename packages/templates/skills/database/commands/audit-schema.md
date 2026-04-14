# /audit-schema

Audit an existing schema for anti-patterns, missing constraints,
index gaps, and governance deficiencies.

## Steps

1. Detect missing indexes on foreign key columns:
```sql
   SELECT c.conrelid::regclass AS table,
     a.attname AS column,
     c.confrelid::regclass AS references
   FROM pg_constraint c
   JOIN pg_attribute a ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
   WHERE c.contype = 'f'
   AND NOT EXISTS (
     SELECT 1 FROM pg_index i
     WHERE i.indrelid = c.conrelid
     AND a.attnum = ANY(i.indkey)
   );
```

2. Detect tables without primary keys:
```sql
   SELECT tablename FROM pg_tables
   WHERE schemaname = 'public'
   AND tablename NOT IN (
     SELECT t.relname FROM pg_class t
     JOIN pg_constraint c ON c.conrelid = t.oid
     WHERE c.contype = 'p'
   );
```

3. Detect nullable columns that should not be nullable:
   - Review all foreign key columns — should be NOT NULL unless
     the relationship is genuinely optional
   - Review all status/type columns — should be NOT NULL with a default

4. Detect missing soft delete columns on business entity tables:
   - Tables without `deleted_at` that contain business records

5. Detect missing governance columns:
   - Tables without `created_at` or `updated_at`

6. Identify bloated tables and indexes:
```sql
   SELECT tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total,
     pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)
       - pg_relation_size(schemaname||'.'||tablename)) AS indexes
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

7. Produce a prioritized findings report:
   - Critical: missing PKs, missing FKs, referential integrity gaps
   - High: missing indexes on FK columns, nullable columns that should
     not be
   - Medium: missing governance columns, enum-as-varchar patterns
   - Low: naming inconsistencies, missing comments

## Do not

- Never modify the schema during an audit — document findings only
- Never prioritize cosmetic issues over integrity issues