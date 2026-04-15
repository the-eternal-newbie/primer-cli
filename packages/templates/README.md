# @monomit/primer-templates

> skill packages and project templates for [@monomit/primer](https://www.npmjs.com/package/@monomit/primer)

[![npm](https://img.shields.io/npm/v/@monomit/primer-templates?color=FF8A00)](https://www.npmjs.com/package/@monomit/primer-templates)

This package contains the template files and domain skill packages used by the primer CLI. It is not intended to be installed directly — install `@monomit/primer` instead.

---

## Contents

### Project templates

`templates/cli-tool/` — the base project template rendered during `primer init`:

```
cli-tool/
├── AGENTS.md.hbs
├── GETTING_STARTED.md.hbs
├── .cursor/
│   ├── rules/core.mdc.hbs
│   ├── rules/git-discipline.mdc.hbs
│   └── commands/git-*.md.hbs
├── .claude/
│   ├── CLAUDE.md.hbs
│   └── commands/git-*.md.hbs
├── src/index.ts.hbs
├── package.json.hbs
├── tsconfig.json.hbs
├── tsup.config.ts.hbs
├── eslint.config.js.hbs
├── gitignore
└── npmrc
```

Templates use [Mustache](https://mustache.github.io/) (`.hbs` extension). The scaffold context provides: `projectName`, `packageManager`, `packageManagerRun`, `cursorEnabled`, `claudeEnabled`, `hasSkills`, `installedSkillsList`, `nextStep`, `finalStep`.

### AI prompt templates

`templates/prompts/generate-agents.hbs` — the prompt sent to the LLM during `primer init` to generate tailored agent role docs. Override in your project by creating `.primer/prompt.hbs`.

### Skill packages

Five domain skill packages are available. Each skill contains:

```
<skill>/
├── README.md          — when to load this skill
├── rules/<skill>.mdc  — non-negotiable rules (Cursor MDC format)
├── knowledge/         — domain knowledge documents
└── commands/          — step-by-step agent command procedures
```

---

#### `skills/database`

Knowledge: schema design, migrations, performance, security
Commands: `design-schema`, `create-migration`, `optimize-query`, `diagnose-performance`, `audit-schema`, `audit-security`, `setup-connection`, `execute-rollback`, `analyze-fragmentation`, `plan-capacity`, `mask-pii`
Rules: strict tenant isolation, zero unsafe migrations, parameterized queries only, encryption at rest

---

#### `skills/auth`

Knowledge: authentication patterns, authorization models, secrets management, incident response
Commands: `setup-auth-provider`, `configure-access-policy`, `rotate-secrets`, `audit-access-control`, `audit-dependencies`, `lockdown-auth`, `revoke-sessions`
Rules: secrets never in code, MFA for privileged access, short-lived tokens only, auth events always logged

---

#### `skills/backend`

Knowledge: API contracts, resilience patterns, traffic control, observability, agentic backends
Commands: `design-api-contract`, `implement-circuit-breaker`, `configure-rate-limiting`, `setup-observability`, `audit-api`, `scaffold-agentic-backend`
Rules: validate at boundaries, never swallow errors, all external calls timeout-bounded, structured logging only

---

#### `skills/frontend`

Knowledge: RSC boundary, hydration, FSD architecture, performance
Commands: `scaffold-architecture`, `audit-hydration`, `audit-accessibility`, `optimize-vitals`
Rules: strict serialization at RSC boundary, zero randomness during SSR, strict CSP, accessibility as baseline

---

#### `skills/testing`

Knowledge: AI code failure modes, test strategy, mutation testing, contract testing
Commands: `seed-test-data`, `generate-mutations`, `heal-test`, `diagnose-flakiness`
Rules: absolute data isolation, no static pauses, quarantine don't ignore, strict pipeline speed limits

---

## Versioning

This package is versioned and released in lockstep with `@monomit/primer`. The CLI declares a `workspace:*` dependency on this package — pnpm replaces it with the exact published version during release.

---

## Contributing

To add a new skill package:

1. Create `packages/templates/skills/<name>/` with `README.md`, `rules/<name>.mdc`, `knowledge/`, and `commands/`
2. Add the skill to `AVAILABLE_SKILLS` in `packages/cli/src/lib/skills.ts`
3. Add glob patterns to `SKILL_GLOBS` in `packages/cli/src/lib/skills.ts`
4. Add installation tests to `packages/cli/src/lib/skills.test.ts`
5. Open a PR — Copilot will review content accuracy

See the [primer monorepo](https://github.com/the-eternal-newbie/primer-cli) for full development setup.