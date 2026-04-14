# /mask-pii

Identify PII columns in the schema and implement appropriate masking
or pseudonymization strategies.

## Before executing

Read `knowledge/governance.md` sections on PII classification and
dynamic data masking.

## Steps

1. Audit the schema for PII columns:
   Scan all tables for columns matching PII patterns:
   - Names: `first_name`, `last_name`, `full_name`, `display_name`
   - Contact: `email`, `phone`, `address`, `postal_code`
   - Identity: `ssn`, `passport_number`, `national_id`, `date_of_birth`
   - Financial: `card_number`, `bank_account`, `routing_number`
   - Behavioral: `ip_address`, `device_id`, `location`

2. Classify each identified column by sensitivity tier:
   - Tier 1 (Direct identifier): encrypt at rest, never log, mask in all
     non-production environments
   - Tier 2 (Quasi-identifier): mask in non-production, aggregate for analytics
   - Tier 3 (Behavioral): pseudonymize for analytics use

3. Implement masking for non-production environments:
```sql
   -- Email masking: show first 3 chars + domain
   UPDATE users SET email = regexp_replace(email, '(^[^@]{3})[^@]*(@.*)', '\1***\2')
   WHERE environment != 'production';

   -- Name masking
   UPDATE users SET first_name = 'User', last_name = id::text
   WHERE environment != 'production';
```

4. Implement column-level encryption for Tier 1 data at rest:
   - Use application-layer encryption for fields that must be searchable
     (deterministic encryption with consistent IV)
   - Use random IV encryption for fields that are retrieved by ID only
   - Store encryption key reference alongside encrypted value, never the key

5. Create masked views for analytics and reporting roles:
```sql
   CREATE VIEW users_analytics AS
   SELECT
     id,
     date_trunc('month', created_at) AS cohort_month,
     country_code,  -- not a direct identifier
     -- no email, name, or contact information
     COUNT(*) OVER (PARTITION BY country_code) AS country_cohort_size
   FROM users;

   GRANT SELECT ON users_analytics TO analytics_role;
```

6. Document each PII column in the schema with a comment:
```sql
   COMMENT ON COLUMN users.email IS 'PII:Tier1 - Direct identifier. Encrypted at rest. Never log.';
```

## Do not

- Never log PII in application logs, error messages, or audit trails
- Never copy production data to non-production without masking
- Never store encryption keys in the database they protect
- Never implement masking only at the application layer