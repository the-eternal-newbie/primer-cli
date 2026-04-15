# Contributing to primer

Thanks for your interest in contributing. primer is a small, focused tool — contributions that stay within that focus are most welcome.

## What we're looking for

- **New skill packages** — domain knowledge, commands, and rules for new areas (Vue, Svelte, mobile, infrastructure, etc.)
- **Improvements to existing skills** — better knowledge docs, more accurate commands, tighter rules
- **Bug fixes** — especially around template rendering, skill installation, or AI provider integration
- **Documentation** — corrections, clarifications, examples

## What we're not looking for right now

- New CLI commands outside the planned roadmap (init, retrofit, brief-me, plan)
- Changes to the git discipline conventions baked into templates — these are intentional
- Dependencies that significantly increase bundle size

---

## Development setup

```bash
git clone https://github.com/the-eternal-newbie/primer-cli
cd primer-cli
pnpm install
pnpm build
pnpm test
```

Node 22+ and pnpm 10+ required.

## Project structure

```
primer-cli/
├── packages/
│   ├── cli/                        — @monomit/primer
│   │   └── src/
│   │       ├── commands/           — init, retrofit, brief-me
│   │       ├── lib/                — scaffold, skills, ai, project, intro
│   │       └── index.ts            — CLI entry point
│   └── templates/                  — @monomit/primer-templates
│       ├── cli-tool/               — base project template (Mustache)
│       ├── prompts/                — AI prompt templates
│       └── skills/                 — domain skill packages
└── scripts/
    └── release.sh                  — version bump and publish
```

---

## Adding a new skill package

A skill package has four components:

```
packages/templates/skills/<name>/
├── README.md          — when to load this skill (see existing skills for format)
├── rules/<name>.mdc   — non-negotiable rules in Cursor MDC format
├── knowledge/         — 3-5 markdown documents covering domain knowledge
└── commands/          — step-by-step agent command procedures
```

### Rules for skill content

**Knowledge docs** should cover:
- What the agent must understand before writing any code in this domain
- Common failure modes and how to avoid them
- Patterns with concrete code examples
- References to the stack callouts (specific libraries and versions)

**Command docs** should follow this structure:
```markdown
# /command-name

One sentence describing what this command does.

## Before executing
Read [relevant knowledge doc] section on [topic].

## Steps
1. First step with code example
2. Second step
...

## Do not
- Hard rule the agent must never violate
```

**Rules (`.mdc`)** should:
- List 4-6 non-negotiable rules
- Be specific and enforceable — avoid vague guidance
- Use `alwaysApply: false` with domain-specific globs

### Wiring the skill into the CLI

1. Add to `AVAILABLE_SKILLS` in `packages/cli/src/lib/skills.ts`:
```ts
{
  value: "vue",
  label: "Vue",
  hint: "Vue 4, Nuxt 4, Vapor Mode, component patterns",
},
```

2. Add glob patterns to `SKILL_GLOBS`:
```ts
vue: "**/*.vue, **/composables/**, **/*store*, **/nuxt.config*",
```

3. Add installation tests to `packages/cli/src/lib/skills.test.ts` — follow the existing pattern for other skills.

---

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(primer): add Vue skill package
fix(primer): correct glob syntax in frontend rule
docs(primer): update CONTRIBUTING.md
chore(primer): bump dependencies
```

Scope is always `primer` for monorepo-wide changes, or the package short name.

## Pull request process

1. Fork the repo and create a branch: `feat/primer-vue-skill`
2. Make your changes with tests
3. Run `pnpm build && pnpm test` — both must pass
4. Open a PR against `master`
5. Describe what changed, why, and how you tested it

PRs are reviewed by Copilot automatically — address any comments before requesting human review.

## Questions

Open a [GitHub Discussion](https://github.com/the-eternal-newbie/primer-cli/discussions) for questions, ideas, or feedback. Issues are for bugs and confirmed feature requests only.