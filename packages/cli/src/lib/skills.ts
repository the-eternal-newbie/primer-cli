import { readdir, copyFile, mkdir, access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { writeOutputFile } from "./scaffold.ts";

const require = createRequire(import.meta.url);

const SKILL_GLOBS: Record<string, string> = {
  database: "**/*.prisma, **/migrations/**, **/*repository*, **/*migration*, **/*schema*",
  auth: "**/auth/**, **/*auth*, **/*session*, **/*token*, **/*middleware*",
  backend: "**/api/**, **/routes/**, **/*service*, **/*controller*, **/services/**",
  frontend: "**/*.tsx, **/*.jsx, **/components/**, **/pages/**, **/app/**",
  testing: "**/*.test.*, **/*.spec.*, **/tests/**, **/e2e/**",
};

export const AVAILABLE_SKILLS = [
  {
    value: "database",
    label: "Database",
    hint: "Schema design, migrations, performance, security",
  },
  {
    value: "auth",
    label: "Auth",
    hint: "Authentication, authorization, secrets management, incident response",
  },
  {
    value: "backend",
    label: "Backend",
    hint: "API contracts, resilience, traffic control, observability, agentic backends",
  },
  {
    value: "frontend",
    label: "Frontend",
    hint: "RSC boundary, hydration, FSD architecture, Core Web Vitals, accessibility",
  },
  {
    value: "testing",
    label: "Testing",
    hint: "AI code failures, mutation testing, contract testing, flakiness diagnosis",
  },
] as const;

export type SkillName = typeof AVAILABLE_SKILLS[number]["value"];

function getSkillsRoot(): string {
  const entry = require.resolve("@monomit/primer-templates");
  return join(entry, "..", "skills");
}

async function copyDir(src: string, dest: string): Promise<void> {
  if (!existsSync(dest)) {
    await mkdir(dest, { recursive: true });
  }
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

export async function installSkills(
  outputDir: string,
  skills: SkillName[]
): Promise<void> {
  if (skills.length === 0) return;

  const skillsRoot = getSkillsRoot();

  for (const skill of skills) {
    const src = join(skillsRoot, skill);

    try {
      await access(src);
    } catch {
      throw new Error(
        `Skill package "${skill}" not found at ${src}. ` +
        `This may indicate a version mismatch between @monomit/primer and @monomit/primer-templates.`
      );
    }

    // Copy to docs/skills/ — human-readable reference
    const docsDest = join(outputDir, "docs", "skills", skill);
    await copyDir(src, docsDest);
  }
}

export async function writeSkillsToTools(
  outputDir: string,
  skills: SkillName[],
  cursorEnabled: boolean,
  claudeEnabled: boolean,
): Promise<void> {
  if (skills.length === 0) return;

  const skillsRoot = getSkillsRoot();

  for (const skill of skills) {
    const skillMeta = AVAILABLE_SKILLS.find(s => s.value === skill);
    if (!skillMeta) continue;

    const src = join(skillsRoot, skill);

    // Copy rules into .cursor/rules/ with clean naming and scoped globs
    if (cursorEnabled) {
      const rulesDir = join(src, "rules");
      try {
        await access(rulesDir);
        const ruleFiles = await readdir(rulesDir);
        for (const file of ruleFiles) {
          // Read original content
          let content = await readFile(join(rulesDir, file), "utf-8");

          // Replace the generic glob with skill-specific globs
          const globs = SKILL_GLOBS[skill] ?? "**/*";
          content = content.replace(
            /globs:\s*\[.*?\]/,
            `globs: ${globs}`
          );

          // Use clean name: database.mdc not database-database.mdc
          await writeOutputFile(
            join(outputDir, ".cursor", "rules", file),
            content
          );
        }
      } catch {
        // no rules dir — skip
      }

      // Copy commands into .cursor/commands/agents/<skill>/
      const commandsDir = join(src, "commands");
      try {
        await access(commandsDir);
        const commandFiles = await readdir(commandsDir);
        for (const file of commandFiles) {
          const content = await readFile(join(commandsDir, file), "utf-8");
          await writeOutputFile(
            join(outputDir, ".cursor", "commands", "agents", skill, file),
            content
          );
        }
      } catch {
        // no commands dir — skip
      }
    }

    // Copy commands into .claude/commands/agents/<skill>/
    if (claudeEnabled) {
      const commandsDir = join(src, "commands");
      try {
        await access(commandsDir);
        const commandFiles = await readdir(commandsDir);
        for (const file of commandFiles) {
          const content = await readFile(join(commandsDir, file), "utf-8");
          await writeOutputFile(
            join(outputDir, ".claude", "commands", "agents", skill, file),
            content
          );
        }
      } catch {
        // no commands dir — skip
      }
    }
  }
}