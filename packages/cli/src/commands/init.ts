import * as p from "@clack/prompts";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { getTemplatesRoot } from "../lib/resolve.ts";
import {
  renderTemplate,
  writeOutputFile,
  copyStaticFile,
  resolvePackageManagerVersion,
  AI_TOOL_GATES,
  PACKAGE_MANAGER_GATES,
} from "../lib/scaffold.ts";
import type { ScaffoldContext } from "../lib/scaffold.ts";

async function scaffoldDir(
  templateDir: string,
  outputDir: string,
  context: ScaffoldContext
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(templateDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(templateDir, entry.name);
    const outName = entry.name.endsWith(".hbs")
      ? entry.name.slice(0, -4)
      : entry.name;
    const outPath = join(outputDir, outName);

    if (entry.isDirectory()) {
      const requiredTool = AI_TOOL_GATES[entry.name];
      if (
        requiredTool &&
        !context.aiTools.includes(requiredTool as "cursor" | "claude-code")
      ) {
        continue;
      }
      await scaffoldDir(srcPath, outPath, context);
    } else {
      // Check file-level gates using the output name (without .hbs)
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

export async function runInit(): Promise<void> {
  p.intro("primer — scaffold an AI-ready project");

  const answers = await p.group(
    {
      projectName: () =>
        p.text({
          message: "Project name",
          placeholder: "my-project",
          validate: (v) =>
            /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)
              ? undefined
              : "Use kebab-case (e.g. my-project)",
        }),

      packageManager: () =>
        p.select({
          message: "Package manager",
          options: [
            { value: "pnpm", label: "pnpm (recommended)" },
            { value: "npm", label: "npm" },
            { value: "yarn", label: "yarn" },
          ],
        }),

      aiTools: () =>
        p.multiselect({
          message: "AI tools to configure",
          options: [
            { value: "cursor", label: "Cursor" },
            { value: "claude-code", label: "Claude Code" },
          ],
          required: true,
        }),

      initGit: () =>
        p.confirm({
          message: "Initialize git and make first commit?",
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Cancelled.");
        process.exit(0);
      },
    }
  );

  const context: ScaffoldContext = {
    projectName: answers.projectName as string,
    packageManager: answers.packageManager as "pnpm" | "npm" | "yarn",
    packageManagerVersion: resolvePackageManagerVersion(
      answers.packageManager as string
    ),
    aiTools: answers.aiTools as Array<"cursor" | "claude-code">,
    initGit: answers.initGit as boolean,
  };

  const outputDir = join(process.cwd(), context.projectName);

  if (existsSync(outputDir)) {
    p.cancel(`Directory "${context.projectName}" already exists.`);
    process.exit(1);
  }

  const templatesRoot = getTemplatesRoot("cli-tool");

  const s = p.spinner();
  s.start("Scaffolding project");

  try {
    await scaffoldDir(templatesRoot, outputDir, context);
    s.stop("Project scaffolded");
  } catch (err) {
    s.stop("Scaffolding failed");
    p.cancel(String(err));
    process.exit(1);
  }

  if (context.initGit) {
    const gs = p.spinner();
    gs.start("Initializing git");
    try {
      const { gitInit, gitCommit } = await import("../lib/git.ts");
      gitInit(outputDir);
      gitCommit(
        outputDir,
        `chore(${context.projectName}): initial commit from primer`
      );
      gs.stop("Git initialized");
    } catch {
      gs.stop("Git init skipped (git not found)");
    }
  }

  p.outro(`Done! Next: cd ${context.projectName} and open it in your editor.`);
}