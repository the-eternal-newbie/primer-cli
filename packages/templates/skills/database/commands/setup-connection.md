# /setup-connection

Configure a database connection with correct pooling, environment
separation, and credential security.

## Before executing

Read `docs/skills/database/knowledge/anti-patterns.md` section on least privilege.
Read `docs/skills/database/knowledge/performance.md` section on connection pool sizing.

## Steps

1. Determine the connection pool strategy based on deployment target:
   - Serverless (Vercel, Lambda): use Prisma Accelerate or PgBouncer
     in transaction mode — serverless functions cannot maintain
     persistent connections
   - Long-running servers: configure PgBouncer with pool size formula:
     `num_cores * 2 + 1` per application server instance
   - Local development: direct connection is acceptable

2. Create separate database roles per environment and per service:
```sql
   CREATE ROLE app_readonly LOGIN PASSWORD '...';
   CREATE ROLE app_readwrite LOGIN PASSWORD '...';
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_readonly;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
     TO app_readwrite;
```

3. Store connection strings in environment variables only:
   - `DATABASE_URL` — pooled connection for application queries
   - `DATABASE_DIRECT_URL` — direct (non-pooled) connection for migrations
   - `DATABASE_READONLY_URL` — read replica connection (if applicable)
   - Never commit connection strings to source control

4. Validate environment variables at application startup using Zod:
```typescript
   const env = z.object({
     DATABASE_URL: z.string().url(),
     DATABASE_DIRECT_URL: z.string().url(),
     DATABASE_READONLY_URL: z.string().url().optional(),
   }).parse(process.env);
```

5. Configure Prisma connection for the target environment:
```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DATABASE_DIRECT_URL") // bypasses pooler for migrations
   }
```

6. Verify connectivity and pool behavior under load:
```bash
   prisma db pull  # confirms connection and schema sync
```

7. Document the connection architecture in `docs/CANONICAL_ARCHITECTURE.md`
   including pool size rationale and environment separation strategy.

## Do not

- Never use a single connection string for all environments
- Never store credentials in `.env` files committed to source control
- Never use a superuser role for application connections
- Never configure pool size without calculating based on server capacity
- Never skip the direct URL configuration for Prisma — migrations
  must bypass the connection pooler