/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Color palette — #00E5FF #FF8A00 #F50057 #0D1117
const C = {
  cyan:   "\x1b[38;2;0;229;255m",
  orange: "\x1b[38;2;255;138;0m",
  pink:   "\x1b[38;2;245;0;87m",
  dim:    "\x1b[38;2;100;120;140m",
  white:  "\x1b[38;2;220;230;240m",
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
};

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "package.json"), "utf-8")
    ) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

function checkEnvKey(key: string): boolean {
  return Boolean(process.env[key]);
}

function keyStatus(key: string): string {
  return checkEnvKey(key)
    ? `${C.cyan}✓${C.reset} ${C.white}${key}${C.reset}`
    : `${C.dim}✗ ${key}${C.reset}`;
}

function detectMode(): string {
  if (process.argv.includes("--offline")) {
    return `${C.dim}Offline mode${C.reset}`;
  }

  const providers = [
    { key: "ANTHROPIC_API_KEY", name: "Claude" },
    { key: "OPENAI_API_KEY",    name: "ChatGPT" },
    { key: "GEMINI_API_KEY",    name: "Gemini" },
  ];

  const available = providers
    .filter(pr => checkEnvKey(pr.key))
    .map(pr => pr.name);

  if (available.length === 0) {
    return `${C.dim}Offline (no API keys found)${C.reset}`;
  }

  return `${C.white}AI-assisted ${C.dim}(${available.join(", ")})${C.reset}`;
}

const LOGO: string[] = [
  `${C.cyan}${C.bold}  ██████╗ ██████╗ ██╗███╗   ███╗███████╗██████╗${C.reset}`,
  `${C.cyan}  ██╔══██╗██╔══██╗██║████╗ ████║██╔════╝██╔══██╗${C.reset}`,
  `${C.cyan}  ██████╔╝██████╔╝██║██╔████╔██║█████╗  ██████╔╝${C.reset}`,
  `${C.cyan}  ██╔═══╝ ██╔══██╗██║██║╚██╔╝██║██╔══╝  ██╔══██╗${C.reset}`,
  `${C.cyan}  ██║     ██║  ██║██║██║ ╚═╝ ██║███████╗██║  ██║${C.reset}`,
  `${C.cyan}  ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝${C.reset}`,
];

// Mascot — each line padded to exactly 9 visible chars
const MASCOT: string[] = [
  `${C.pink}   ╔══╗  ${C.reset}`,
  `${C.pink}  ╔╝ ╚╗  ${C.reset}`,
  `${C.orange}╔═══════╗${C.reset}`,
  `${C.orange}║ ${C.cyan}◉${C.reset}${C.orange}   ${C.cyan}◉${C.reset}${C.orange} ║${C.reset}`,
  `${C.orange}║  ${C.pink}▬▬▬${C.reset}${C.orange}  ║${C.reset}`,
  `${C.orange}╚══╦═╦══╝${C.reset}`,
  `${C.orange}   ║ ║   ${C.reset}`,
  `${C.orange} ══╝ ╚══   ${C.reset}`,
];

const MASCOT_W = 9;
const GAP = "     "; // 5 spaces

export type Command = "init" | "retrofit";

export async function showIntroAndSelectCommand(): Promise<Command> {
  const version = getVersion();
  const indent = "  ";
  const infoIndent = indent + " ".repeat(MASCOT_W) + GAP;

  // Logo
  console.log("");
  LOGO.forEach(l => console.log(l));
  console.log("");
  console.log(
    `${indent}${C.dim}v${version}${C.reset}  ${C.dim}·${C.reset}  ${C.orange}scaffold AI-ready projects${C.reset}`
  );
  console.log("");
  console.log(`${indent}${C.dim}${"─".repeat(52)}${C.reset}`);
  console.log("");

  // Status rows — all left-aligned at infoIndent column
  const statusRows: string[] = [
    `${C.orange}${C.bold}Mode${C.reset}`,
    detectMode(),
    "",
    `${C.orange}${C.bold}API Keys${C.reset}`,
    keyStatus("ANTHROPIC_API_KEY"),
    keyStatus("OPENAI_API_KEY"),
    keyStatus("GEMINI_API_KEY"),
  ];

  const rows = Math.max(MASCOT.length, statusRows.length);
  const emptyLine = " ".repeat(MASCOT_W);

  for (let i = 0; i < rows; i++) {
    const left  = MASCOT[i] ?? emptyLine;
    const right = statusRows[i] ?? "";
    console.log(`${indent}${left}${GAP}${right}`);
  }

  // Commands — aligned under info column, with leading blank line
  console.log("");
  console.log(`${infoIndent}${C.orange}${C.bold}Commands${C.reset}`);
  console.log(`${infoIndent}${C.white}init      ${C.dim}scaffold a new AI-ready project${C.reset}`);
  console.log(`${infoIndent}${C.white}retrofit  ${C.dim}add agent conventions to existing project${C.reset}`);
  console.log("");
  console.log(`${indent}${C.dim}${"─".repeat(52)}${C.reset}`);
  console.log("");

  // Interactive selector
  const selected = await p.select({
    message: "Select a command to run",
    options: [
      {
        value: "init",
        label: "init",
        hint: "scaffold a new project",
      },
      {
        value: "retrofit",
        label: "retrofit",
        hint: "add conventions to existing project",
      },
    ],
  });

  if (p.isCancel(selected)) {
    p.cancel("See you space cowboy!");
    process.exit(0);
  }

  console.log("");
  return selected as Command;
}