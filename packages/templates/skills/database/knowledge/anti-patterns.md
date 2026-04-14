# Database Anti-Patterns and Schema Design Fallacies

Every pattern documented here has caused production incidents.
An agent must recognize these immediately and refuse to implement them.

## 1. Entity-Attribute-Value (EAV) Abuse

**Pattern:** A generic table with columns `entity_id`, `attribute_name`,
`attribute_value` used to store arbitrary key-value pairs instead of
typed columns.

**Why it fails:**
- Destroys referential integrity — foreign keys cannot be enforced on
  dynamic attribute names
- Makes queries exponentially complex — fetching a single "entity" requires
  multiple joins or pivots
- Eliminates type safety — all values stored as strings, numeric operations
  require casting
- Query planner cannot optimize — no statistics on individual attributes

**Correct approach:** Use typed columns for known attributes. For genuinely
dynamic attributes, use a JSONB column (PostgreSQL) with a partial index on
frequently queried keys. If the schema truly requires runtime extensibility,
implement a proper extension table with typed columns per extension type.

**PostgreSQL callout:** JSONB with GIN indexes handles dynamic attributes
efficiently. Use `jsonb_path_query` for complex queries rather than EAV.

---

## 2. Polymorphic Associations

**Pattern:** A foreign key column paired with a `type` column to reference
multiple parent tables from a single child table.

```sql
-- Anti-pattern
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  commentable_id UUID NOT NULL,
  commentable_type VARCHAR NOT NULL, -- 'Post', 'Video', 'Product'
  body TEXT NOT NULL
);
```

**Why it fails:**
- Cannot enforce foreign key constraints — the database has no mechanism
  to validate `commentable_id` against the correct table
- Joins require dynamic SQL or application-level routing
- Cascading deletes must be handled entirely in application code
- Query planner cannot optimize cross-type queries

**Correct approach:** Use separate junction tables per parent entity
(`post_comments`, `video_comments`) or implement a shared parent table
that all commentable entities reference via inheritance.

---

## 3. Storing Enumerations as Strings

**Pattern:** Using VARCHAR columns for values that belong to a finite,
known set.

```sql
-- Anti-pattern
status VARCHAR(50) -- stores 'active', 'inactive', 'pending', 'deleted'
```

**Why it fails:**
- No database-level validation — any string value is accepted
- Case sensitivity issues cause silent bugs
- Typos in application code corrupt data without error
- Cannot enforce exhaustive handling in queries

**Correct approach:** Use native database enum types or a constrained
integer with a lookup table.

```sql
-- PostgreSQL: native enum
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending', 'deleted');

-- Or constrained integer with lookup table (more flexible for future changes)
CREATE TABLE user_statuses (
  id SMALLINT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);
```

**Prisma callout:** Use `enum` declarations in schema.prisma. Prisma generates
type-safe enum values in the client, preventing invalid values at the
application layer.

---

## 4. Missing Foreign Key Constraints

**Pattern:** Relationships between tables expressed only in application code,
with no database-level constraint enforcement.

**Why it fails:**
- Direct database operations (migrations, scripts, admin tools) can create
  orphaned records
- Cascading operations must be manually coordinated in application code
- Data integrity depends entirely on every code path being correct
- Impossible to guarantee referential integrity at scale

**Correct approach:** Always declare explicit foreign key constraints with
defined cascade behavior.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- RESTRICT prevents deleting users with orders
  -- CASCADE would delete orders when user is deleted
  -- SET NULL requires user_id to be nullable
);
```

**PlanetScale callout:** PlanetScale does not support foreign key constraints
at the database level. When using PlanetScale, enforce referential integrity
entirely in the application layer and document this explicitly in the schema.
Use Prisma's `relationMode = "prisma"` setting to emulate FK behavior.

---

## 5. God Tables

**Pattern:** A single table accumulating columns from multiple distinct
business concerns as the application grows.

**Why it fails:**
- Violates Single Responsibility — a table should model one business entity
- Sparse columns waste storage and confuse the query planner
- Locks during writes affect unrelated read operations
- Schema changes to any concern require testing the entire table

**Correct approach:** Apply normalization. Extract distinct concerns into
separate tables. A `users` table should contain only identity and
authentication data — profile data, preferences, and billing data belong
in separate tables with a foreign key to `users`.

---

## 6. NULLable Columns with Implicit Meaning

**Pattern:** Using NULL to represent a business state rather than the
absence of a value.

```sql
-- Anti-pattern: NULL means "not yet verified", populated means "verified"
verified_at TIMESTAMP -- NULL = unverified, value = verified
deleted_at TIMESTAMP  -- NULL = active, value = deleted
```

**Why it fails:**
- NULL semantics are ambiguous — NULL means "unknown", not "false" or
  "pending"
- Three-valued logic (TRUE/FALSE/NULL) causes subtle bugs in WHERE clauses
- Aggregations silently exclude NULL rows

**When it is acceptable:** Temporal pattern columns (`deleted_at`,
`verified_at`, `published_at`) are a well-understood exception where NULL
genuinely means "this event has not occurred." Document the semantics
explicitly in a column comment.

```sql
-- Acceptable with explicit documentation
deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
-- NULL = record is active. Non-NULL = soft-deleted at this timestamp.
```

---

## 7. SELECT * in Production Queries

**Pattern:** Fetching all columns from a table regardless of what the
application actually needs.

**Why it fails:**
- Fetches columns the application discards — wastes network and memory
- Breaks when columns are added or reordered in some ORM configurations
- Prevents index-only scans — the query planner cannot satisfy the query
  from an index alone
- Exposes sensitive columns (passwords, PII) to application layers that
  should not see them

**Correct approach:** Always specify explicit column lists. In Prisma, use
`select` to specify exactly the fields required.

```typescript
// Prisma: explicit field selection
const user = await prisma.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true }
  // password hash never fetched
});
```