import { readdir, copyFile, mkdir, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { writeOutputFile } from "./scaffold.ts";

const require = createRequire(import.meta.url);

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

    const dest = join(outputDir, "docs", "skills", skill);
    await copyDir(src, dest);
  }
}

export async function writeSkillRules(
  outputDir: string,
  skills: SkillName[],
  cursorEnabled: boolean,
): Promise<void> {
  if (skills.length === 0 || !cursorEnabled) return;

  for (const skill of skills) {
    const skillMeta = AVAILABLE_SKILLS.find(s => s.value === skill);
    if (!skillMeta) continue;

    const content = `---
description: ${skillMeta.label} skill rules and knowledge for this project
globs: ["**/*"]
alwaysApply: false
---

# ${skillMeta.label} Skill

This project has the ${skillMeta.label} skill package installed.

Before working on ${skillMeta.label.toLowerCase()}-related tasks:

1. Read \`docs/skills/${skill}/knowledge/\` — domain knowledge and patterns
2. Use commands from \`docs/skills/${skill}/commands/\` — never invent procedures
3. Follow the non-negotiables in \`docs/skills/${skill}/rules/${skill}.mdc\`
`;

    await writeOutputFile(
      join(outputDir, ".cursor", "rules", `${skill}.mdc`),
      content
    );
  }
}