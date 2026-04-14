# Testing Skill Package

This skill package equips an AI agent with production-grade knowledge
covering AI-specific code failure modes, test strategy, mutation testing,
and contract testing for distributed systems.

## When to load this skill

Load this skill when working on any task involving:
- Writing or reviewing tests for AI-generated code
- Setting up test infrastructure or CI pipelines
- Diagnosing flaky tests or slow CI pipelines
- Implementing contract tests between services
- Running mutation testing to verify test suite quality
- Generating or managing test data

## Knowledge base

Read all relevant knowledge documents before executing any command.

| Document | When to read |
|---|---|
| `knowledge/ai-code-failures.md` | Before testing any AI-generated code |
| `knowledge/test-strategy.md` | Before designing a test suite or CI pipeline |
| `knowledge/mutation-testing.md` | Before running or interpreting mutation tests |
| `knowledge/contract-testing.md` | Before implementing service contract tests |

## Commands

| Command | Category | Purpose |
|---|---|---|
| `/seed-test-data` | Setup | Provision isolated databases and synthetic test data |
| `/generate-mutations` | Verification | Inject faults and calculate mutation score |
| `/heal-test` | Maintenance | Update broken E2E locators after UI changes |
| `/diagnose-flakiness` | Diagnosis | Categorize intermittent CI failures by root cause |

## Non-negotiables

See `rules/testing.mdc` for the four rules that apply to every
testing operation regardless of deadline pressure.