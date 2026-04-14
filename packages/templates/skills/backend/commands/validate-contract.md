# /validate-contract

Lint API changes against the existing OpenAPI schema to detect
breaking changes before deployment reaches production.

## Before executing

Read `docs/skills/backend/knowledge/api-contracts.md` sections on
breaking changes and OpenAPI as source of truth.

## Steps

1. Install contract validation tooling:
```bash
   pnpm add -D @stoplight/spectral-cli oasdiff
   # or
   npm install -g @openapitools/openapi-diff
```

2. Extract the current production OpenAPI spec as the baseline:
```bash
   # From a running service
   curl https://api.production.example.com/openapi.json > baseline.json

   # Or from version control (tag the last release)
   git show v1.2.0:openapi.json > baseline.json
```

3. Generate the candidate spec from the current codebase:
```bash
   # NestJS
   curl http://localhost:3000/api-json > candidate.json

   # FastAPI
   curl http://localhost:8000/openapi.json > candidate.json
```

4. Run breaking change detection:
```bash
   # oasdiff (recommended — fast, detailed output)
   oasdiff breaking baseline.json candidate.json

   # openapi-diff
   openapi-diff baseline.json candidate.json --fail-on-incompatible
```

5. Evaluate each flagged change:
   - **Breaking change, no version increment:** Block the PR.
     The change must be made backward-compatible or the API
     must be versioned.
   - **Breaking change, with version increment:** Verify the old
     version continues to be served and the new version is additive.
   - **Non-breaking change:** Approve and proceed.

6. Run Spectral linting for spec quality:
```bash
   spectral lint candidate.json --ruleset .spectral.yaml
```

```yaml
   # .spectral.yaml
   extends: ['spectral:oas']
   rules:
     operation-summary: error       # all operations must have summaries
     operation-operationId: error   # all operations must have IDs
     operation-tags: error          # all operations must be tagged
     info-contact: warn
     no-eval-in-markdown: error
```

7. Integrate into CI pipeline:
```yaml
   # .github/workflows/ci.yml
   - name: Validate API contract
     run: |
       oasdiff breaking baseline.json candidate.json
       spectral lint candidate.json --fail-severity error
```

## Do not

- Never skip contract validation in CI — manual review misses
  subtle breaking changes
- Never treat deprecation warnings as non-breaking without
  checking consumer usage data
- Never allow the candidate spec to diverge from the running
  service — validate against a live instance, not a static file