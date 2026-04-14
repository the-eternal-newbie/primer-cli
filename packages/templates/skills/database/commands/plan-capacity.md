# /plan-capacity

Estimate storage requirements, connection limits, and growth trajectory
before provisioning or scaling database infrastructure.

## Before executing

Read `knowledge/performance.md` section on connection pool sizing.

## Steps

1. Gather current baseline metrics:
```sql
   -- Table sizes
   SELECT schemaname, tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

   -- Row counts and growth rate (requires pg_stat_user_tables history)
   SELECT relname, n_live_tup, n_dead_tup, last_analyze, last_autovacuum
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC;
```

2. Calculate storage projection:
   - Measure average row size per table (total size ÷ row count)
   - Estimate monthly growth rate from historical data or business
     projections
   - Add 40% overhead for indexes, MVCC dead tuples, and TOAST storage
   - Add 20% headroom for unexpected growth spikes
   - Formula: `projected_size = current_size + (monthly_growth * months * 1.4) * 1.2`

3. Calculate connection requirements:
   - Identify all services connecting to the database
   - Per service: `pool_size = num_instances * connections_per_instance`
   - Total: sum all service pools + 10 reserved for admin and monitoring
   - Verify total does not exceed `max_connections` in postgresql.conf
   - Recommended: total application connections ≤ 80% of max_connections

4. Identify read/write ratio:
```sql
   SELECT sum(tup_fetched) AS reads, sum(tup_inserted + tup_updated + tup_deleted) AS writes
   FROM pg_stat_user_tables;
```
   - If reads > 80% of total: evaluate read replica for query offload
   - If writes > 50% of total: evaluate write sharding or partitioning

5. Document findings in a capacity plan with:
   - Current utilization
   - 6-month and 12-month projections
   - Scaling trigger thresholds (e.g., scale when storage > 70%)
   - Recommended instance size and configuration

## Do not

- Never provision based on current usage without growth projection
- Never ignore connection count limits — exhausting connections
  causes complete application unavailability
- Never skip the index overhead calculation — indexes frequently
  double the storage requirement of the raw data