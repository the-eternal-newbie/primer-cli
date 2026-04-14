# Frontend Skill Package

This skill package equips an AI agent with production-grade knowledge
covering React Server Components, hydration mechanics, frontend
architecture, and performance optimization for Next.js applications.

## When to load this skill

Load this skill when working on any task involving:
- React Server Component design or refactoring
- Hydration error diagnosis and resolution
- Frontend architecture organization (FSD)
- Core Web Vitals optimization
- Accessibility auditing or remediation
- Component scaffolding or design system integration

## Knowledge base

Read all relevant knowledge documents before executing any command.

| Document | When to read |
|---|---|
| `knowledge/rsc-boundary.md` | Before any RSC or client component work |
| `knowledge/hydration.md` | Before diagnosing or preventing hydration errors |
| `knowledge/architecture.md` | Before scaffolding or reorganizing frontend code |
| `knowledge/performance.md` | Before any performance optimization task |

## Commands

| Command | Category | Purpose |
|---|---|---|
| `/scaffold-architecture` | Setup | Initialize FSD directory structure with layer boundaries |
| `/audit-hydration` | Auditing | Scan for SSR/hydration mismatches and invalid DOM nesting |
| `/optimize-vitals` | Performance | Identify and fix Core Web Vitals bottlenecks |
| `/audit-accessibility` | Accessibility | Verify semantic HTML, focus, ARIA, and keyboard navigation |

## Non-negotiables

See `rules/frontend.mdc` for the four rules that apply to every
frontend operation regardless of deadline pressure.