#!/usr/bin/env node
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

EXAMPLES
  primer init
  primer --version
`);
}

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
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
  try {
    await runInit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  console.error(`Run "primer --help" for usage.`);
  process.exit(1);
}