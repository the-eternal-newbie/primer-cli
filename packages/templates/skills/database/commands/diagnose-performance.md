# /diagnose-performance

Identify slow queries, missing indexes, and systemic performance
bottlenecks using database instrumentation.

## Before executing

Read `docs/skills/database/knowledge/performance.md` in full.

## Steps

1. Enable and query pg_stat_statements for worst offenders:
```sql
   -- Requires pg_stat_statements extension
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

   SELECT query,
     calls,
     round(total_exec_time::numeric / calls, 2) AS avg_ms,
     round(total_exec_time::numeric, 2) AS total_ms,
     rows / calls AS avg_rows
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC
   LIMIT 20;
```

2. Run EXPLAIN ANALYZE on each slow query:
```sql
   EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) <slow_query>;
```
   Evaluate:
   - Sequential scans on large tables (missing index)
   - Estimated rows vs actual rows divergence > 10x (stale statistics)
   - High buffer reads (disk I/O bottleneck)
   - Nested loop joins on large datasets (consider hash join)

3. Check table statistics freshness:
```sql
   SELECT relname, last_analyze, last_autoanalyze, last_vacuum
   FROM pg_stat_user_tables
   WHERE last_analyze < NOW() - INTERVAL '7 days'
   ORDER BY n_live_tup DESC;
```
   Run manual ANALYZE on stale high-traffic tables.

4. Identify lock contention:
```sql
   SELECT pid, now() - query_start AS duration,
     wait_event_type, wait_event, query
   FROM pg_stat_activity
   WHERE wait_event_type = 'Lock'
   ORDER BY duration DESC;
```

5. Check connection pool saturation:
```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```
   If `idle in transaction` count is high: application is not closing
   transactions promptly — fix connection handling in application code.

6. Document findings with query text, execution plan, and recommended fix.

## Do not

- Never run EXPLAIN ANALYZE on production with high-frequency queries
  during peak hours — it executes the query
- Never modify queries without first capturing the baseline execution plan
- Never apply index changes without verifying with EXPLAIN ANALYZE first