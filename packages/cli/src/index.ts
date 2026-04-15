#!/usr/bin/env node
/* eslint-disable no-console */
// Suppress Node.js experimental fetch warning
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name === "ExperimentalWarning" && warning.message.includes("Fetch")) return;
  console.warn(warning.name, warning.message);
});

import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "./commands/init.ts";
import { runRetrofit } from "./commands/retrofit.ts";
import { showIntroAndSelectCommand } from "./lib/intro.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf-8")
  ) as { version: string };
  return pkg.version;
}

function printHelp(): void {
  console.log(`
primer — scaffold an AI-ready project

USAGE
  primer <command> [flags]

COMMANDS
  init        Scaffold a new project with agent conventions
  retrofit    Add agent conventions to an existing project

FLAGS
  --help      Show this help message
  --version   Show the current version
  --offline   Skip AI agent generation (init only)
  --dry-run   Preview changes without writing files (retrofit only)
  --force     Overwrite existing files (retrofit only)

CONFIGURATION
  Create primer.config.json or primer.config.mjs in your working directory:

  primer.config.json:
  {
    "ai": {
      "maxTokens": 8192,
      "maxAgents": 4,
      "maxCommandsPerAgent": 3,
      "maxRulesPerAgent": 2,
      "maxStepsPerCommand": 5,
      "maxDoNotPerCommand": 3,
      "maxRulesPerRuleSet": 5,
      "maxAdditionalRules": 5
    }
  }

  primer.config.mjs:
  export default {
    ai: { maxTokens: 16384, maxAgents: 6 }
  }

ENVIRONMENT VARIABLES
  ANTHROPIC_API_KEY    API key for Claude (Anthropic)
  ANTHROPIC_MODEL      Override Claude model (default: claude-sonnet-4-5)
  OPENAI_API_KEY       API key for ChatGPT (OpenAI)
  OPENAI_MODEL         Override OpenAI model (default: gpt-4o)
  GEMINI_API_KEY       API key for Gemini (Google)
  GEMINI_MODEL         Override Gemini model (default: gemini-2.0-flash)

EXAMPLES
  primer              Show intro and status
  primer init
  primer init --offline
  primer retrofit
  primer retrofit --dry-run
  primer retrofit --force
  primer --version
`);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    offline: { type: "boolean" },
    "dry-run": { type: "boolean" },
    force: { type: "boolean" },
  },
  allowPositionals: true,
  strict: false,
});

if (values.help) {
  printHelp();
  process.exit(0);
}

if (values.version) {
  console.log(getVersion());
  process.exit(0);
}

// Show intro when invoked with no arguments
(async () => {
  const command = positionals[0] as string | undefined;

  if (!command) {
    const selected = await showIntroAndSelectCommand();
    if (selected === "init") {
      await runInit();
    } else if (selected === "retrofit") {
      await runRetrofit();
    }
    return;
  }

  if (command === "init") {
    runInit().catch((err: unknown) => {
      console.error("Error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
  } else if (command === "retrofit") {
    runRetrofit().catch((err: unknown) => {
      console.error("Error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
  } else {
    console.error(`Unknown command: ${command}`);
    console.error(`Run "primer --help" for usage.`);
    process.exit(1);
  }
})().catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});