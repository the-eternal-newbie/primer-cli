```
  ██████╗ ██████╗ ██╗███╗   ███╗███████╗██████╗
  ██╔══██╗██╔══██╗██║████╗ ████║██╔════╝██╔══██╗
  ██████╔╝██████╔╝██║██╔████╔██║█████╗  ██████╔╝
  ██╔═══╝ ██╔══██╗██║██║╚██╔╝██║██╔══╝  ██╔══██╗
  ██║     ██║  ██║██║██║ ╚═╝ ██║███████╗██║  ██║
  ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
```

**scaffold AI-ready projects**

[![npm](https://img.shields.io/npm/v/@monomit/primer?color=00E5FF&label=%40monomit%2Fprimer)](https://www.npmjs.com/package/@monomit/primer)
[![npm](https://img.shields.io/npm/v/@monomit/primer-templates?color=FF8A00&label=%40monomit%2Fprimer-templates)](https://www.npmjs.com/package/@monomit/primer-templates)
[![license](https://img.shields.io/github/license/the-eternal-newbie/primer-cli?color=F50057)](./LICENSE)

---

## What is primer?

primer is a CLI tool that scaffolds new projects with pre-configured AI agent conventions — the kind of setup that normally takes a day of trial and error.

It encodes hard-won patterns for Cursor rules, AGENTS.md files, canonical architecture docs, git discipline, domain skill packages, and monorepo conventions into a single command. The result is a project where AI agents know what to read, what commands to use, and what rules to follow — from the first commit.

```
primer init
```

That's it. Your project is ready for AI-assisted development.

---

## Features

**`primer init`** — scaffold a new project

- Generates `AGENTS.md`, `CLAUDE.md`, `core.mdc`, and `git-discipline.mdc`
- Configures slash commands for Cursor and Claude Code
- Installs domain skill packages (database, auth, backend, frontend, testing)
- Generates tailored AI agent roles via Claude, ChatGPT, or Gemini
- Produces a `GETTING_STARTED.md` with exact first steps
- Initializes git with an initial commit

**`primer retrofit`** — add conventions to an existing project

- Detects your package manager, AI tools, and existing skills
- Adds missing conventions without touching existing files
- `--dry-run` to preview changes, `--force` to overwrite

**`primer brief-me`** — generate a technical brief

- Reads your canonical docs, agent definitions, and skill knowledge
- Produces a `docs/BRIEF.md` with architecture summary, domain breakdown, key patterns, and an exact "Start Building" sequence
- `--domain` to scope to a single domain (backend, database, auth, frontend, testing)

---

## Install

```bash
npm install -g @monomit/primer
# or
pnpm add -g @monomit/primer
```

---

## Quick start

```bash
# Scaffold a new project
primer init

# Add conventions to an existing project
primer retrofit

# Generate a technical brief for your project
primer brief-me

# Preview what retrofit would change
primer retrofit --dry-run

# Scope a brief to a specific domain
primer brief-me --domain database
```

Run `primer` with no arguments to open the interactive intro:

```
  ██████╗ ██████╗ ██╗███╗   ███╗███████╗██████╗
  ...

  v1.1.0  ·  scaffold AI-ready projects
  ──────────────────────────────────────────────

  ╔═══════╗     Mode
  ║ ◉   ◉ ║     AI-assisted (Claude)
  ║  ▬▬▬ ║
  ╚══╦═╦══╝     API Keys
     ║ ║        ✓ ANTHROPIC_API_KEY
    ═╩ ╩═       ✗ OPENAI_API_KEY
                ✗ GEMINI_API_KEY

                Commands
                init      scaffold a new AI-ready project
                retrofit  add agent conventions to existing project
                brief-me  generate a technical brief from project docs

  ──────────────────────────────────────────────

◆  Select a command to run
│  ● init
│  ○ retrofit
│  ○ brief-me
└
```

---

## Skill packages

primer includes five domain skill packages that give AI agents structured knowledge, step-by-step commands, and non-negotiable rules for each domain.

| Skill | Knowledge | Commands |
|---|---|---|
| **Database** | Schema design, migrations, performance, security | `design-schema`, `create-migration`, `optimize-query`, `audit-security`, +7 more |
| **Auth** | Authentication, authorization, secrets, incident response | `setup-auth-provider`, `configure-access-policy`, `rotate-secrets`, +4 more |
| **Backend** | API contracts, resilience, traffic control, observability | `design-api-contract`, `implement-circuit-breaker`, `audit-api`, +3 more |
| **Frontend** | RSC boundary, hydration, FSD architecture, Core Web Vitals | `scaffold-architecture`, `audit-hydration`, `optimize-vitals`, +1 more |
| **Testing** | AI code failures, mutation testing, contract testing | `seed-test-data`, `generate-mutations`, `heal-test`, `diagnose-flakiness` |

Skill files are installed in two places:

- `docs/skills/<domain>/` — human-readable reference
- `.cursor/rules/<domain>.mdc` and `.cursor/commands/agents/<domain>/` — auto-loaded by Cursor
- `.claude/commands/agents/<domain>/` — available in Claude Code

---

## AI providers

primer supports three AI providers for agent generation and `brief-me`:

| Provider | Environment variable | Default model |
|---|---|---|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| ChatGPT (OpenAI) | `OPENAI_API_KEY` | `gpt-4o` |
| Gemini (Google) | `GEMINI_API_KEY` | `gemini-2.0-flash` |

Override the model with `ANTHROPIC_MODEL`, `OPENAI_MODEL`, or `GEMINI_MODEL`.

Run without any API key using `--offline`:

```bash
primer init --offline
primer brief-me --offline
```

---

## Configuration

Create `primer.config.json` or `primer.config.mjs` in your project root:

```json
{
  "ai": {
    "maxTokens": 8192,
    "maxAgents": 4,
    "maxCommandsPerAgent": 3,
    "maxRulesPerAgent": 2,
    "maxStepsPerCommand": 5,
    "maxDoNotPerCommand": 3,
    "maxRulesPerRuleSet": 5,
    "maxAdditionalRules": 5
  }
}
```

---

## Project config

primer writes `.primer/project.json` to every scaffolded project to persist your choices:

```json
{
  "projectName": "my-app",
  "packageManager": "pnpm",
  "aiProvider": "claude",
  "aiTools": ["cursor", "claude-code"],
  "skills": ["database", "auth", "backend"],
  "createdAt": "2026-04-15T00:00:00.000Z",
  "primerVersion": "1.1.0"
}
```

This file is committed to git. Subsequent primer commands (`brief-me`, `retrofit`) read it to stay consistent with your original choices.

---

## What gets generated

```
my-project/
├── AGENTS.md                      ← mandatory agent entry point
├── GETTING_STARTED.md             ← exact first steps for your project
├── .primer/
│   └── project.json               ← persisted primer config
├── docs/
│   ├── CANONICAL_ARCHITECTURE.md  ← fill in your stack decisions
│   ├── CANONICAL_PATTERNS.md      ← fill in your coding patterns
│   ├── agents/                    ← AI-generated agent role docs
│   └── skills/                    ← domain knowledge packages
├── .cursor/
│   ├── rules/                     ← auto-loaded by Cursor
│   └── commands/                  ← slash commands
├── .claude/
│   ├── CLAUDE.md                  ← auto-loaded by Claude Code
│   └── commands/                  ← slash commands
└── src/
    └── index.ts
```

---

## Monorepo structure

```
primer-cli/
├── packages/
│   ├── cli/          — @monomit/primer (the CLI)
│   └── templates/    — @monomit/primer-templates (skill packages and templates)
├── scripts/
│   └── release.sh    — version bump, tag, and publish
└── turbo.json
```

---

## Development

```bash
# Clone and install
git clone https://github.com/the-eternal-newbie/primer-cli
cd primer-cli
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run the CLI locally
node packages/cli/dist/index.js init
```

### Releasing

```bash
./scripts/release.sh 1.2.0
```

This bumps versions in both packages, commits, tags, and pushes. CI publishes both packages to npm in the correct order.

---

## Git discipline

primer enforces a strict git workflow in every scaffolded project:

- Never commit directly to the default branch
- Branch naming: `<type>/<scope>-<description>` (e.g., `feat/auth-jwt-rotation`)
- Conventional commits with scope: `feat(auth): add JWT refresh rotation`
- Pre-commit checks: typecheck → lint → test before every commit
- PR-based workflow: push branch → open PR → squash merge → delete branch

The `/git-start-work`, `/git-commit-progress`, and `/git-finish-work` commands enforce this automatically.

---

## License

MIT — [the-eternal-newbie](https://github.com/the-eternal-newbie)