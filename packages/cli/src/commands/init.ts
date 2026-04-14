import * as p from "@clack/prompts";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../lib/config.ts";
import { getTemplatesRoot } from "../lib/resolve.ts";
import {
  scaffoldDir,
  resolvePackageManagerVersion,
  resolvePackageManagerRun,
} from "../lib/scaffold.ts";
import type { ScaffoldContext, AiTool, PackageManager } from "../lib/scaffold.ts";
import {
  PROVIDERS,
  resolveApiKey,
  buildPrompt,
  parseGenerationResult,
  writeAgentFiles,
} from "../lib/ai/index.ts";
import type { ProviderKey, TechStack } from "../lib/ai/index.ts";

const OFFLINE_FLAG = process.argv.includes("--offline");

export async function runInit(): Promise<void> {
  p.intro("primer — scaffold an AI-ready project");

  const config = await loadConfig();

  if (OFFLINE_FLAG) {
    p.log.warn("Running in offline mode — skipping AI agent generation.");
  }

  // --- Base questions (always asked) ---
  const base = await p.group(
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

  // --- AI questions (skipped in offline mode) ---
  let aiProvider: ProviderKey | null = null;
  let techStack: TechStack | null = null;
  let projectDescription = "";
  let projectConstraints = "";

  if (!OFFLINE_FLAG) {
    const aiAnswers = await p.group(
      {
        provider: () =>
          p.select({
            message: "AI provider for agent generation",
            options: [
              {
                value: "claude",
                label: "Claude (Anthropic)",
                hint: `uses ANTHROPIC_MODEL env or claude-sonnet-4-5`,
              },
              {
                value: "chatgpt",
                label: "ChatGPT (OpenAI)",
                hint: `uses OPENAI_MODEL env or gpt-4o`,
              },
              {
                value: "gemini",
                label: "Gemini (Google)",
                hint: `uses GEMINI_MODEL env or gemini-2.0-flash`,
              },
            ],
          }),

        description: () =>
          p.text({
            message: "What does this project do?",
            placeholder: "A fintech app for personal expense tracking",
            validate: (v) =>
              v.trim().length > 0 ? undefined : "Please describe your project",
          }),

        language: () =>
          p.text({
            message: "Primary language",
            placeholder: "TypeScript",
            validate: (v) =>
              v.trim().length > 0 ? undefined : "Please specify a language",
          }),

        frameworks: () =>
          p.text({
            message: "Key frameworks and libraries",
            placeholder: "Next.js, Prisma, tRPC",
          }),

        infrastructure: () =>
          p.text({
            message: "Infrastructure / hosting",
            placeholder: "Vercel, PlanetScale",
          }),

        constraints: () =>
          p.text({
            message: "Any domain constraints or requirements? (optional)",
            placeholder: "PCI-DSS compliance, HIPAA, multi-tenant",
          }),
      },
      {
        onCancel: () => {
          p.cancel("Cancelled.");
          process.exit(0);
        },
      }
    );

    aiProvider = aiAnswers.provider as ProviderKey;
    projectDescription = aiAnswers.description as string;
    projectConstraints = aiAnswers.constraints as string ?? "";
    techStack = {
      language: aiAnswers.language as string,
      frameworks: aiAnswers.frameworks as string ?? "",
      infrastructure: aiAnswers.infrastructure as string ?? "",
    };
  }

  // --- Build scaffold context ---
  const pm = base.packageManager as PackageManager;
  const aiTools = base.aiTools as AiTool[];

  const context: ScaffoldContext = {
    projectName: base.projectName as string,
    packageManager: pm,
    packageManagerVersion: resolvePackageManagerVersion(pm),
    packageManagerRun: resolvePackageManagerRun(pm),
    aiTools,
    cursorEnabled: aiTools.includes("cursor"),
    claudeEnabled: aiTools.includes("claude-code"),
    initGit: base.initGit as boolean,
  };

  const outputDir = join(process.cwd(), context.projectName);

  if (existsSync(outputDir)) {
    p.cancel(`Directory "${context.projectName}" already exists.`);
    process.exit(1);
  }

  // --- Scaffold static files ---
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

  // --- AI agent generation ---
  if (!OFFLINE_FLAG && aiProvider && techStack) {
    const provider = PROVIDERS[aiProvider];

    let apiKey: string;
    try {
      apiKey = await resolveApiKey(provider);
    } catch (err) {
      p.log.warn(`Could not resolve API key: ${String(err)}`);
      p.log.warn("Skipping AI agent generation — project scaffolded without agents.");
      apiKey = "";
    }

    if (apiKey) {
      const as = p.spinner();
      as.start("Generating tailored agent roles");

      try {
        const prompt = await buildPrompt(
          {
            projectName: context.projectName,
            projectType: "cli-tool",
            description: projectDescription,
            constraints: projectConstraints,
            packageManager: pm,
            stack: techStack,
          },
          config.ai
        );

        const raw = await provider.generate(prompt, apiKey, config.ai.maxTokens);
        const result = parseGenerationResult(raw);
        await writeAgentFiles(
          outputDir,
          result,
          context.projectName,
          context.cursorEnabled,
          context.claudeEnabled,
        );

        as.stop(
          `Generated ${result.agents.length} agent roles in docs/agents/`
        );

        p.log.info("Agents created:");
        for (const agent of result.agents) {
          p.log.step(`${agent.name} → docs/agents/${agent.slug}.md`);
        }
      } catch (err) {
        as.stop("Agent generation failed");
        p.log.warn(String(err));
        p.log.warn("Project scaffolded without AI agents — you can add them manually.");
      }
    }
  }

  // --- Git init ---
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

  p.outro(
    OFFLINE_FLAG
      ? `Done! cd ${context.projectName} and open it in your editor.`
      : `Done! cd ${context.projectName} — agent roles are in docs/agents/.`
  );
}