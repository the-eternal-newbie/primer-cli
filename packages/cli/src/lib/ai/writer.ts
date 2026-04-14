import { join } from "node:path";
import { writeOutputFile } from "../scaffold.ts";
import type { AgentRole, AgentCommand, AgentRule, AIGenerationResult } from "./types.ts";

function renderAgentDoc(role: AgentRole): string {
  const commandList = role.commands
    .map((c) => `| \`/${c.slug}\` | ${c.description} |`)
    .join("\n");

  const ruleList = role.rules
    .map((r) => `- ${r.description}`)
    .join("\n");

  return `# ${role.name} — Agent Role

## Purpose

${role.purpose}

## Responsibilities

${role.responsibilities.map((r) => `- ${r}`).join("\n")}

## Constraints

${role.constraints.map((c) => `- ${c}`).join("\n")}

## Domain context

${role.domainContext}

## Commands

| Command | Purpose |
|---|---|
${commandList}

## Rules

${ruleList}

## Universal rules

- Read \`AGENTS.md\` before starting any task
- Read \`docs/CANONICAL_ARCHITECTURE.md\` before generating code
- Read \`docs/CANONICAL_PATTERNS.md\` before generating code
- Never commit directly to \`master\`
- Stop and confirm with the human before any destructive operation
- End every work phase with an explicit file list and a STOP marker
`;
}

function renderCommand(command: AgentCommand): string {
  return `# /${command.slug}

${command.description}

## Steps

${command.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Do not

${command.doNot.map((d) => `- ${d}`).join("\n")}
`;
}

function renderRule(rule: AgentRule): string {
  return `---
description: ${rule.description}
globs: ["**/*"]
alwaysApply: false
---

# ${rule.slug}

${rule.rules.map((r) => `- ${r}`).join("\n")}
`;
}

function renderAgentIndex(
  result: AIGenerationResult,
  projectName: string
): string {
  const agentList = result.agents
    .map((a) => `| ${a.name} | \`docs/agents/${a.slug}.md\` | ${a.purpose} |`)
    .join("\n");

  return `# ${projectName} — Agent Registry

This file lists all specialized agent roles for this project.
Each agent reads \`AGENTS.md\` first, then its own role document.

## Roles

| Agent | Document | Purpose |
|---|---|---|
${agentList}

## Usage

When starting a task, identify which role applies and read that role's
document before writing any code. If a task spans multiple roles,
start with the most relevant one and explicitly hand off to others
when crossing boundaries.
`;
}

export async function writeAgentFiles(
  outputDir: string,
  result: AIGenerationResult,
  projectName: string,
  cursorEnabled: boolean,
  claudeEnabled: boolean,
): Promise<void> {
  for (const agent of result.agents) {
    // Write role document
    await writeOutputFile(
      join(outputDir, "docs", "agents", `${agent.slug}.md`),
      renderAgentDoc(agent)
    );

    // Write commands per tool
    for (const command of agent.commands) {
      const content = renderCommand(command);

      if (cursorEnabled) {
        await writeOutputFile(
          join(outputDir, ".cursor", "commands", "agents", agent.slug, `${command.slug}.md`),
          content
        );
      }

      if (claudeEnabled) {
        await writeOutputFile(
          join(outputDir, ".claude", "commands", "agents", agent.slug, `${command.slug}.md`),
          content
        );
      }
    }

    // Write rules per tool
    for (const rule of agent.rules) {
      const content = renderRule(rule);

      if (cursorEnabled) {
        await writeOutputFile(
          join(outputDir, ".cursor", "rules", `${agent.slug}-${rule.slug}.mdc`),
          content
        );
      }
    }
  }

  // Write agent registry
  await writeOutputFile(
    join(outputDir, "docs", "agents", "README.md"),
    renderAgentIndex(result, projectName)
  );
}