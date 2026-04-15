# @monomit/primer

> scaffold AI-ready projects

[![npm](https://img.shields.io/npm/v/@monomit/primer?color=00E5FF)](https://www.npmjs.com/package/@monomit/primer)

The CLI for [primer](https://github.com/the-eternal-newbie/primer-cli) — a tool that scaffolds new projects with pre-configured AI agent conventions for Cursor and Claude Code.

---

## Install

```bash
npm install -g @monomit/primer
# or
pnpm add -g @monomit/primer
```

---

## Commands

### `primer init`

Scaffold a new AI-ready project interactively.

```bash
primer init           # AI-assisted (generates tailored agent roles)
primer init --offline # static scaffold only, no API call
```

Prompts for: project name, package manager, AI tools (Cursor / Claude Code), skill packages, git init, AI provider, project description, stack, and constraints.

Generates:
- `AGENTS.md` — mandatory agent entry point
- `GETTING_STARTED.md` — exact first steps
- `.primer/project.json` — persisted config
- Canonical docs (`CANONICAL_ARCHITECTURE.md`, `CANONICAL_PATTERNS.md`)
- AI tool configs (`.cursor/rules/`, `.claude/commands/`)
- Selected skill packages
- AI-generated agent role docs in `docs/agents/`

---

### `primer retrofit`

Add primer conventions to an existing project.

```bash
primer retrofit            # interactive, detects existing config
primer retrofit --dry-run  # preview changes without writing
primer retrofit --force    # overwrite existing files
```

Detects your package manager, AI tools, and existing skills from the project. Only adds what is missing.

---

### `primer brief-me`

Generate a technical brief from your project documentation.

```bash
primer brief-me                    # full project brief → docs/BRIEF.md
primer brief-me --domain database  # scoped brief → docs/briefs/database.md
primer brief-me --offline          # raw doc summary, no API call
```

Reads `docs/CANONICAL_ARCHITECTURE.md`, `docs/CANONICAL_PATTERNS.md`, `docs/agents/`, and relevant skill knowledge docs. Produces a brief with architecture summary, domain breakdown, key patterns, agent roles, critical constraints, next steps, and an exact "Start Building" sequence.

Valid domains: `backend`, `database`, `auth`, `frontend`, `testing`.

---

## Skill packages

Select skill packages during `primer init` or `primer retrofit`:

| Skill | Domain |
|---|---|
| **database** | Schema design, migrations, performance, security |
| **auth** | Authentication, authorization, secrets, incident response |
| **backend** | API contracts, resilience, traffic control, observability |
| **frontend** | RSC boundary, hydration, FSD architecture, Core Web Vitals |
| **testing** | AI code failures, mutation testing, contract testing, flakiness |

---

## AI providers

Set one or more API keys and primer will use the available provider:

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # Claude (default preference)
export OPENAI_API_KEY=sk-...          # ChatGPT
export GEMINI_API_KEY=...             # Gemini
```

Override the model:

```bash
export ANTHROPIC_MODEL=claude-opus-4-6
export OPENAI_MODEL=gpt-4o-mini
export GEMINI_MODEL=gemini-2.0-pro
```

---

## Configuration

`primer.config.json` in your working directory:

```json
{
  "ai": {
    "maxTokens": 8192,
    "maxAgents": 4,
    "maxCommandsPerAgent": 3
  }
}
```

Or `primer.config.mjs` for dynamic config:

```js
export default {
  ai: { maxTokens: 16384, maxAgents: 6 }
};
```

---

## Full documentation

See the [primer monorepo](https://github.com/the-eternal-newbie/primer-cli) for full documentation, development setup, and release process.