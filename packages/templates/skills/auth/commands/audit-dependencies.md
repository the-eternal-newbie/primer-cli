# /audit-dependencies

Perform Software Composition Analysis (SCA) to identify vulnerabilities
in authentication packages and cryptographic libraries.

## Before executing

Read `docs/skills/auth/knowledge/attack-vectors.md` section on
cryptographic failures.

## Steps

1. Run the package manager's built-in audit:
```bash
   pnpm audit --audit-level moderate
   # or
   npm audit --audit-level moderate
```
   Focus on: authentication libraries, cryptographic packages,
   JWT libraries, session management packages.

2. Identify auth-critical dependencies and their versions:
```bash
   pnpm list jose next-auth @clerk/nextjs bcrypt argon2 \
     @cerbos/grpc passport jsonwebtoken
```

3. Check each auth-critical package against known vulnerability databases:
   - [NIST NVD](https://nvd.nist.gov/)
   - [GitHub Advisory Database](https://github.com/advisories)
   - [Snyk Vulnerability DB](https://security.snyk.io/)

4. Flag critical patterns that require immediate remediation:
   - `jsonwebtoken` < 9.0.0 — multiple critical CVEs, migrate to `jose`
   - Any package using deprecated crypto algorithms (MD5, SHA-1, DES)
   - Packages with no maintainer activity in > 12 months handling
     security-critical operations
   - Packages with known prototype pollution vulnerabilities

5. For each critical finding, produce a remediation plan:
   - Patch version available: update immediately
   - Breaking change required: schedule migration with compatibility testing
   - No fix available: evaluate replacement package or implement
     compensating control

6. Produce a dependency audit report with:
   - All auth-critical packages and current versions
   - Vulnerabilities found with severity classification
   - Remediation actions with priority and timeline
   - Packages flagged for proactive monitoring

## Do not

- Never ignore moderate or higher severity findings in auth packages
- Never defer remediation of critical CVEs beyond the next release cycle
- Never replace a vulnerable package with an unmaintained alternative
- Never assume `pnpm audit` coverage is complete —
  cross-reference with NVD for critical packages