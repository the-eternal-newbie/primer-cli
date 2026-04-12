import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import Mustache from "mustache";

export interface ScaffoldContext {
  projectName: string;
  packageManager: "pnpm" | "npm" | "yarn";
  packageManagerVersion: string;
  aiTools: Array<"cursor" | "claude-code">;
  initGit: boolean;
}

// Directories gated behind AI tool selection.
// A directory is skipped if the required tool was not selected.
export const AI_TOOL_GATES: Record<string, string> = {
  ".cursor": "cursor",
  ".claude": "claude-code",
};

// Files (without .hbs extension) gated behind package manager selection.
// A file is skipped if the current package manager doesn't match.
export const PACKAGE_MANAGER_GATES: Record<string, string> = {
  ".npmrc": "pnpm",
};

export function resolvePackageManagerVersion(pm: string): string {
  try {
    const result = execSync(`${pm} --version`, { stdio: "pipe" });
    return result.toString().trim();
  } catch {
    return "latest";
  }
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