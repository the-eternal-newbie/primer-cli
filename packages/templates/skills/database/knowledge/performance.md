# Advanced Performance Optimization and Internal Mechanics

Understanding how databases execute queries is the prerequisite for
optimizing them. An agent must reason from mechanics, not intuition.

## How PostgreSQL Executes a Query

1. **Parser** — converts SQL text to a parse tree
2. **Rewriter** — applies view definitions and rule transformations
3. **Planner/Optimizer** — generates candidate execution plans, estimates
   costs using table statistics, selects the lowest-cost plan
4. **Executor** — runs the selected plan against actual data

The planner's cost estimates depend entirely on statistics maintained by
`ANALYZE`. Stale statistics cause the planner to select suboptimal plans.
Always run `ANALYZE` after bulk data operations.

---

## Index Types and Selection

### B-Tree (default)
Supports equality (`=`), range (`<`, `>`, `BETWEEN`), and sort operations.
Correct for the vast majority of use cases.

### Hash
Supports only equality comparisons. Slightly faster than B-Tree for pure
equality lookups but not WAL-logged before PostgreSQL 10 and rarely
worth the tradeoff.

### GIN (Generalized Inverted Index)
Optimal for multi-valued columns: JSONB, arrays, full-text search vectors.
Use for `@>`, `<@`, `&&` operators on JSONB and array columns.

### GiST
Geometric data, full-text search, range types. Use `pg_trgm` with GiST
for LIKE/ILIKE pattern matching on large text columns.

### BRIN (Block Range Index)
Extremely compact. Effective only for columns that are physically ordered
on disk (e.g., `created_at` on an append-only table). Useless for
randomly distributed data.

---

## Index Selectivity

An index is only useful if it is selective — it must eliminate a
significant portion of rows from consideration.

**High selectivity (good index candidate):** `user_id`, `email`, `order_id`
**Low selectivity (poor index candidate):** `status` with 3 possible values,
`is_active` boolean, `country` with 10 distinct values on a 10-million row table

For low-selectivity columns, a partial index on the minority value is
often more effective:

```sql
-- Instead of indexing all rows on is_active:
CREATE INDEX idx_users_active ON users(created_at)
WHERE is_active = true;
-- Only indexes the minority of active users, much smaller and faster
```

---

## Covering Indexes and Index-Only Scans

A covering index includes all columns required to satisfy a query,
allowing PostgreSQL to answer the query entirely from the index without
touching the heap (table data).

```sql
-- Query: SELECT email, name FROM users WHERE tenant_id = $1
-- Covering index: includes all selected columns
CREATE INDEX idx_users_tenant_covering
ON users(tenant_id) INCLUDE (email, name);
```

**PostgreSQL callout:** The `INCLUDE` clause (PostgreSQL 11+) adds columns
to the index leaf pages without affecting the sort order. Use it to add
frequently selected columns to existing indexes.

---

## Reading EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;
```

Key metrics to evaluate:

| Metric | What it means |
|---|---|
| `Seq Scan` | Full table scan — missing index or low selectivity |
| `Index Scan` | Index used, heap accessed for each row |
| `Index Only Scan` | Covering index — no heap access |
| `Bitmap Heap Scan` | Index used, rows batched before heap access |
| `actual rows` vs `rows` | Large divergence = stale statistics, run ANALYZE |
| `Buffers: hit` | Data served from shared_buffers (fast) |
| `Buffers: read` | Data read from disk (slow) |
| `loops` | How many times the node executed |

**Actual time** = `actual time=start..end` per loop × loops. This is the
real cost, not the estimated cost.

---

## N+1 Query Pattern

**Pattern:** Fetching a list of N records, then executing one additional
query per record to fetch related data.

```typescript
// Anti-pattern: 1 query for users + N queries for their orders
const users = await prisma.user.findMany();
for (const user of users) {
  const orders = await prisma.order.findMany({ where: { userId: user.id } });
}

// Correct: single query with relation included
const users = await prisma.user.findMany({
  include: { orders: true }
});
```

**When include causes problems:** For large relation sets, `include` can
fetch thousands of rows. Use pagination on relations or a separate
aggregation query instead of loading entire relation sets.

---

## Connection Pool Sizing

The optimal pool size is not "as large as possible."

**Formula (PostgreSQL):**
```
optimal_pool_size = num_cores * 2 + effective_spindle_count
```

For modern SSDs, `effective_spindle_count = 1`.
A 4-core server: `4 * 2 + 1 = 9` connections per pool.

**Why over-pooling hurts:** PostgreSQL uses one OS process per connection.
Hundreds of connections cause context switching overhead that exceeds
the cost of queuing at the pool level.

**PgBouncer callout:** Use transaction-mode pooling for stateless
application servers. Session-mode pooling is required only when using
session-level features (advisory locks, prepared statements,
`SET LOCAL`).

**Prisma Accelerate callout:** Prisma Accelerate manages the connection
pool externally. Set `connection_limit` in the Prisma schema to 1 when
using Accelerate — the pool is managed at the edge, not per-process.

---

## VACUUM and Bloat

PostgreSQL uses MVCC (Multi-Version Concurrency Control). UPDATE and
DELETE operations do not remove old row versions — they mark them dead.
VACUUM reclaims this space.

**Autovacuum triggers** (defaults):
- When 20% + 50 rows of a table are dead tuples

**When autovacuum is insufficient:**
- High-churn tables (frequent updates/deletes) accumulate bloat faster
  than autovacuum can process
- During bulk operations that create millions of dead tuples instantly

**Detection:**
```sql
SELECT schemaname, tablename,
  n_dead_tup,
  n_live_tup,
  round(n_dead_tup::numeric / nullif(n_live_tup + n_dead_tup, 0) * 100, 2) AS dead_ratio
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

**Remediation:** Manual `VACUUM ANALYZE` for routine bloat.
`VACUUM FULL` reclaims maximum space but takes an exclusive lock — use
`pg_repack` for zero-downtime bloat removal on production tables.