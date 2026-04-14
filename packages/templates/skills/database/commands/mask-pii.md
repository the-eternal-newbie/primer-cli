# /mask-pii

Identify PII columns in the schema and implement appropriate masking
or pseudonymization strategies.

## Before executing

Read `docs/skills/database/knowledge/governance.md` sections on PII classification and
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

3. Implement masking on the non-production database directly:
```sql
   -- Run these statements against your staging/dev database only.
   -- Never run against production.

   -- Email masking: show first 3 chars + domain
   UPDATE users SET email = regexp_replace(email, '(^[^@]{3})[^@]*(@.*)', '\1***\2');

   -- Name masking
   UPDATE users SET first_name = 'User', last_name = id::text;
```
   Always verify you are connected to the correct non-production database
   before executing. Use `SELECT current_database();` to confirm.

4. Implement appropriate encryption or tokenization for Tier 1 data at rest:
   - For fields that must be searchable (e.g. email for login lookup):
     use tokenization — replace the value with an opaque token and store
     the mapping in a dedicated secrets vault. Never implement searchable
     encryption with a hand-rolled IV scheme.
   - For fields retrieved only by primary key (e.g. SSN, card data):
     use AES-256-GCM with a random IV per value. Store IV alongside the
     ciphertext. Never reuse IVs — IV reuse with GCM catastrophically
     breaks confidentiality.
   - For fields used only in equality comparisons without display:
     use a keyed hash (HMAC-SHA256) with a secret key. Store the hash,
     never the plaintext. This enables lookup without decryption.
   - Store encryption keys in a dedicated secrets manager
     (AWS KMS, HashiCorp Vault, GCP Cloud KMS) — never in the database
     or application environment variables.

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