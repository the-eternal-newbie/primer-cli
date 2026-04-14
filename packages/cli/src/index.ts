#!/usr/bin/env node
/* eslint-disable no-console */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInit } from "./commands/init.ts";

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

FLAGS
  --help      Show this help message
  --version   Show the current version
  --offline   Skip AI agent generation (no API key required)

CONFIGURATION
  Create primer.config.json in your working directory to override defaults:

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

ENVIRONMENT VARIABLES
  ANTHROPIC_API_KEY    API key for Claude (Anthropic)
  ANTHROPIC_MODEL      Override Claude model (default: claude-sonnet-4-5)
  OPENAI_API_KEY       API key for ChatGPT (OpenAI)
  OPENAI_MODEL         Override OpenAI model (default: gpt-4o)
  GEMINI_API_KEY       API key for Gemini (Google)
  GEMINI_MODEL         Override Gemini model (default: gemini-2.0-flash)

EXAMPLES
  primer init
  primer init --offline
  primer --version
`);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
    offline: { type: "boolean" },
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

const command = positionals[0];

if (!command || command === "init") {
  runInit();
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run "primer --help" for usage.`);
  process.exit(1);
}