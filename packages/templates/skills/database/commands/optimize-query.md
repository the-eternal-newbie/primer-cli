# /optimize-query

Rewrite a slow query for maximum efficiency using index-aware
query patterns and execution plan analysis.

## Before executing

Read `docs/skills/database/knowledge/performance.md` sections on index types, covering
indexes, and EXPLAIN ANALYZE.

## Steps

1. Capture the baseline execution plan:
```sql
   EXPLAIN (ANALYZE, BUFFERS) <original_query>;
```
   Record: total execution time, buffer hits/reads, plan type.

2. Identify the bottleneck:
   - Sequential scan on large table → add or fix index
   - Index scan with high heap fetches → convert to covering index
   - Nested loop on large datasets → investigate hash join possibility
   - Sort operation without index → add index matching ORDER BY
   - High estimated vs actual row divergence → run ANALYZE

3. Add missing index if required:
```sql
   -- For simple lookups:
   CREATE INDEX CONCURRENTLY idx_name ON table(column);

   -- For queries that select specific columns:
   CREATE INDEX CONCURRENTLY idx_name ON table(filter_col)
     INCLUDE (select_col1, select_col2);

   -- For range + equality combination:
   CREATE INDEX CONCURRENTLY idx_name ON table(equality_col, range_col);
```

4. Rewrite the query if the structure is inefficient:
   - Replace correlated subqueries with JOINs or CTEs
   - Replace `IN (SELECT ...)` with `EXISTS` for large subquery results
   - Replace `DISTINCT` with `GROUP BY` when aggregation is the intent
   - Use `LIMIT` with `OFFSET` only for small offsets — use keyset
     pagination for large datasets:
```sql
   -- Keyset pagination (efficient at any offset)
   WHERE id > :last_seen_id ORDER BY id LIMIT 20;
```

5. Verify improvement:
```sql
   EXPLAIN (ANALYZE, BUFFERS) <optimized_query>;
```
   Compare execution time and buffer reads to baseline.

6. Document the optimization: original query, problem identified,
   change made, before/after execution times.

## Do not

- Never add an index without verifying it is used by EXPLAIN
- Never optimize without a baseline measurement
- Never use OFFSET pagination on tables > 100,000 rows
- Never force a join order or index with hints without understanding
  why the planner chose differently