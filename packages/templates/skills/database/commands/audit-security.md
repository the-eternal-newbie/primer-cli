# /audit-security

Audit database privileges, connection security, and credential exposure.

## Steps

1. Audit role privileges:
```sql
   -- List all roles and their attributes
   SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolcanlogin
   FROM pg_roles
   ORDER BY rolname;

   -- List table-level privileges per role
   SELECT grantee, table_name, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
   ORDER BY grantee, table_name;
```
   Flag: any application role with SUPERUSER, CREATEDB, or unnecessary
   privileges beyond SELECT/INSERT/UPDATE/DELETE.

2. Verify SSL enforcement:
```sql
   SHOW ssl;  -- must return 'on' for production
   SELECT count(*) FROM pg_stat_ssl WHERE ssl = false AND pid != pg_backend_pid();
   -- Any non-SSL connections are a security violation
```

3. Scan for credential exposure in application code:
   - Search for hardcoded connection strings: `grep -r "postgresql://" .`
   - Search for hardcoded passwords: `grep -ri "password.*=" . --include="*.ts"`
   - Verify `.env` is in `.gitignore`
   - Check git history for accidentally committed credentials:
     `git log --all --full-history -- "*.env"`

4. Audit connection sources:
```sql
   SELECT client_addr, usename, application_name, count(*)
   FROM pg_stat_activity
   GROUP BY client_addr, usename, application_name
   ORDER BY count DESC;
```
   Flag: unexpected IP addresses, users connecting directly from
   application servers (should go through pooler).

5. Verify pg_hba.conf restricts connections to known hosts only:
   - No `trust` authentication method in production
   - No `0.0.0.0/0` or `::/0` host entries
   - `SCRAM-SHA-256` required for all non-local connections
   - If `MD5` is still present, treat it as a legacy compatibility fallback only
     and flag it for migration to `SCRAM-SHA-256`

6. Produce a security findings report with severity classification:
   - Critical: superuser application roles, cleartext credentials in code
   - High: non-SSL connections, trust authentication, unrestricted hosts
   - Medium: over-privileged application roles, missing connection limits
   - Low: missing audit logging, no connection timeout configured

## Do not

- Never store findings that contain actual credentials
- Never test remediation steps in production during the audit