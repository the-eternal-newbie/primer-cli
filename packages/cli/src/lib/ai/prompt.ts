import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import Mustache from "mustache";
import type { AIGenerationResult, TechStack } from "./types.ts";
import type { PrimerAIConfig } from "../config.ts";
import type { SkillName } from "../skills.ts";

export interface ProjectContext {
  projectName: string;
  projectType: string;
  description: string;
  constraints: string;
  packageManager: string;
  stack: TechStack;
  skills: SkillName[];
}

async function loadPromptTemplate(): Promise<string> {
  // 1. Check for local user override
  const localOverride = join(process.cwd(), ".primer", "prompt.hbs");
  if (existsSync(localOverride)) {
    return readFile(localOverride, "utf-8");
  }

  // 2. Fall back to bundled default
  const require = createRequire(import.meta.url);
  const templatesRoot = join(
    require.resolve("@monomit/primer-templates"),
    ".."
  );
  const defaultPrompt = join(templatesRoot, "prompts", "generate-agents.hbs");
  return readFile(defaultPrompt, "utf-8");
}

export async function buildPrompt(
  ctx: ProjectContext,
  aiConfig: PrimerAIConfig
): Promise<string> {
  const template = await loadPromptTemplate();
  return Mustache.render(template, {
    projectName: ctx.projectName,
    projectType: ctx.projectType,
    description: ctx.description,
    constraints: ctx.constraints || "none specified",
    packageManager: ctx.packageManager,
    stackLanguage: ctx.stack.language,
    stackFrameworks: ctx.stack.frameworks || "none specified",
    stackInfrastructure: ctx.stack.infrastructure || "none specified",
    maxAgents: aiConfig.maxAgents,
    maxCommandsPerAgent: aiConfig.maxCommandsPerAgent,
    maxRulesPerAgent: aiConfig.maxRulesPerAgent,
    maxStepsPerCommand: aiConfig.maxStepsPerCommand,
    maxDoNotPerCommand: aiConfig.maxDoNotPerCommand,
    maxRulesPerRuleSet: aiConfig.maxRulesPerRuleSet,
    maxAdditionalRules: aiConfig.maxAdditionalRules,
    hasSkills: ctx.skills.length > 0,
    skillsList: ctx.skills.join(", "),
  });
}

export function parseGenerationResult(raw: string): AIGenerationResult {
  const cleaned = raw
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();

  if (!cleaned.endsWith("}")) {
    throw new Error(
      `AI response appears truncated (${raw.length} chars). ` +
      `Try increasing maxTokens in primer.config.json or reducing agent limits.`
    );
  }

  try {
    return JSON.parse(cleaned) as AIGenerationResult;
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON (${raw.length} chars).\n` +
      `First 500 chars: ${cleaned.slice(0, 500)}`
    );
  }
}