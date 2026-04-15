import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import Mustache from "mustache";

export interface SkillEntry {
  name: string;
  slug: string;
}

export interface ScaffoldContext {
  projectName: string;
  packageManager: "pnpm" | "npm" | "yarn";
  packageManagerVersion: string;
  packageManagerRun: string;
  aiTools: Array<"cursor" | "claude-code">;
  cursorEnabled: boolean;
  claudeEnabled: boolean;
  initGit: boolean;
  hasSkills: boolean;
  installedSkillsList: SkillEntry[];
}

export type AiTool = ScaffoldContext["aiTools"][number];
export type PackageManager = ScaffoldContext["packageManager"];

export const AI_TOOL_GATES: Record<string, AiTool> = {
  ".cursor": "cursor",
  ".claude": "claude-code",
} as const;

export const PACKAGE_MANAGER_GATES: Record<string, PackageManager> = {
  ".npmrc": "pnpm",
} as const;

export const DOTFILE_RENAMES: Record<string, string> = {
  gitignore: ".gitignore",
  npmrc: ".npmrc",
} as const;

export function resolvePackageManagerVersion(
  pm: string,
  runner: (cmd: string) => string = (cmd) =>
    execSync(cmd, { stdio: "pipe" }).toString().trim()
): string {
  try {
    return runner(`${pm} --version`);
  } catch {
    return "latest";
  }
}

export function resolvePackageManagerRun(pm: PackageManager): string {
  return pm === "npm" ? "npm run" : pm;
}

export async function renderTemplate(
  templatePath: string,
  context: ScaffoldContext
): Promise<string> {
  const raw = await readFile(templatePath, "utf-8");
  return Mustache.render(raw, context);
}

export async function writeOutputFile(
  outputPath: string,
  content: string
): Promise<void> {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(outputPath, content, "utf-8");
}

export async function copyStaticFile(
  templatePath: string,
  outputPath: string
): Promise<void> {
  const content = await readFile(templatePath, "utf-8");
  await writeOutputFile(outputPath, content);
}

export async function scaffoldDir(
  templateDir: string,
  outputDir: string,
  context: ScaffoldContext
): Promise<void> {
  const entries = await readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(templateDir, entry.name);
    const strippedName = entry.name.endsWith(".hbs")
      ? entry.name.slice(0, -4)
      : entry.name;
    const outName = DOTFILE_RENAMES[strippedName] ?? strippedName;
    const outPath = join(outputDir, outName);

    if (entry.isDirectory()) {
      const requiredTool = AI_TOOL_GATES[entry.name];
      if (requiredTool && !context.aiTools.includes(requiredTool)) {
        continue;
      }
      await scaffoldDir(srcPath, outPath, context);
    } else {
      const requiredPm = PACKAGE_MANAGER_GATES[outName];
      if (requiredPm && context.packageManager !== requiredPm) {
        continue;
      }
      if (entry.name.endsWith(".hbs")) {
        const rendered = await renderTemplate(srcPath, context);
        await writeOutputFile(outPath, rendered);
      } else {
        await copyStaticFile(srcPath, outPath);
      }
    }
  }
}