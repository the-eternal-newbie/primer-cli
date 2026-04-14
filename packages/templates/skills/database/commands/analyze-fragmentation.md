# /analyze-fragmentation

Detect and remediate table and index bloat caused by MVCC dead tuples
and fragmented storage.

## Before executing

Read `knowledge/performance.md` section on VACUUM and bloat.

## Steps

1. Measure table bloat:
```sql
   SELECT schemaname, tablename,
     n_dead_tup,
     n_live_tup,
     round(n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0) * 100, 2)
       AS dead_ratio,
     last_autovacuum,
     last_vacuum
   FROM pg_stat_user_tables
   WHERE n_dead_tup > 1000
   ORDER BY dead_ratio DESC;
```
   Dead ratio > 20% warrants immediate VACUUM.

2. Measure index bloat (requires pgstattuple extension):
```sql
   CREATE EXTENSION IF NOT EXISTS pgstattuple;
   SELECT * FROM pgstattuple('index_name');
   -- dead_tuple_percent > 20% warrants REINDEX
```

3. For routine bloat (dead_ratio 20-50%):
```sql
   VACUUM ANALYZE table_name;
```

4. For severe bloat (dead_ratio > 50%) or index bloat:
   - Do NOT use VACUUM FULL in production — takes ACCESS EXCLUSIVE lock
   - Use pg_repack for zero-downtime bloat removal:
```bash
   pg_repack -t table_name -d database_name
```

5. For bloated indexes:
```sql
   REINDEX INDEX CONCURRENTLY index_name;
   -- CONCURRENTLY available in PostgreSQL 12+
```

6. If autovacuum cannot keep up with a high-churn table, tune per-table:
```sql
   ALTER TABLE high_churn_table SET (
     autovacuum_vacuum_scale_factor = 0.01,  -- trigger at 1% dead tuples
     autovacuum_analyze_scale_factor = 0.005
   );
```

## Do not

- Never run VACUUM FULL on production tables during business hours
- Never skip pg_repack in favor of VACUUM FULL on large tables
- Never ignore autovacuum lag — it compounds over time