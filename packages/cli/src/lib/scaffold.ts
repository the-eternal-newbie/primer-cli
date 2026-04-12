import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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