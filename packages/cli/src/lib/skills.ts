import { readdir, copyFile, mkdir, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const AVAILABLE_SKILLS = [
  { value: "database", label: "Database", hint: "Schema design, migrations, performance, security" },
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

    // Validate source exists before attempting copy
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