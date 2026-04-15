import * as p from "@clack/prompts";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { readProjectConfig } from "../lib/project.ts";
import { PROVIDERS } from "../lib/ai/index.ts";
import { resolveApiKey } from "../lib/ai/key.ts";
import type { ProviderKey } from "../lib/ai/index.ts";

const VALID_DOMAINS = ["backend", "database", "auth", "frontend", "testing"] as const;
export type Domain = typeof VALID_DOMAINS[number];

const DOMAIN_FLAG = (() => {
    const idx = process.argv.indexOf("--domain");
    if (idx !== -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1] as Domain;
    }
    return null;
})();

const OFFLINE = process.argv.includes("--offline");

function readIfExists(filePath: string): string | null {
    if (!existsSync(filePath)) return null;
    try {
        return readFileSync(filePath, "utf-8");
    } catch {
        return null;
    }
}

function resolveProvider(aiProvider: string | null): ProviderKey | null {
    const priority: ProviderKey[] = ["claude", "chatgpt", "gemini"];

    // Use stored provider if available and key exists
    if (aiProvider) {
        const key = aiProvider as ProviderKey;
        if (key in PROVIDERS) {
            const envKey = {
                claude: "ANTHROPIC_API_KEY",
                chatgpt: "OPENAI_API_KEY",
                gemini: "GEMINI_API_KEY",
            }[key];
            if (envKey && process.env[envKey]) return key;
        }
    }

    // Fall back to first available key
    for (const provider of priority) {
        const envKey = {
            claude: "ANTHROPIC_API_KEY",
            chatgpt: "OPENAI_API_KEY",
            gemini: "GEMINI_API_KEY",
        }[provider];
        if (envKey && process.env[envKey]) return provider;
    }

    return null;
}

export async function collectDocsAndAgents(
    cwd: string,
    domain: Domain | null
): Promise<{ docs: string; agents: string[] }> {
    const sections: string[] = [];
    const agents: string[] = [];

    // Always include canonical docs
    const arch = readIfExists(join(cwd, "docs", "CANONICAL_ARCHITECTURE.md"));
    const patterns = readIfExists(join(cwd, "docs", "CANONICAL_PATTERNS.md"));
    if (arch) sections.push(`## Architecture\n\n${arch}`);
    if (patterns) sections.push(`## Patterns\n\n${patterns}`);

    // Include agent docs and extract names
    const agentsDir = join(cwd, "docs", "agents");
    if (existsSync(agentsDir)) {
        try {
            const files = await readdir(agentsDir);
            for (const file of files) {
                if (!file.endsWith(".md")) continue;
                const content = readIfExists(join(agentsDir, file));
                if (content) {
                    agents.push(file.replace(".md", ""));
                    sections.push(`## Agent: ${file.replace(".md", "")}\n\n${content}`);
                }
            }
        } catch {
            // no agents dir
        }
    }

    // Include skill knowledge docs
    const skillsDir = join(cwd, "docs", "skills");
    if (existsSync(skillsDir)) {
        const domains = domain
            ? [domain]
            : VALID_DOMAINS.filter(d => existsSync(join(skillsDir, d)));

        for (const d of domains) {
            const knowledgeDir = join(skillsDir, d, "knowledge");
            if (!existsSync(knowledgeDir)) continue;
            try {
                const files = await readdir(knowledgeDir);
                for (const file of files) {
                    if (!file.endsWith(".md")) continue;
                    const content = readIfExists(join(knowledgeDir, file));
                    if (content) {
                        sections.push(`## ${d} / ${file.replace(".md", "")}\n\n${content}`);
                    }
                }
            } catch {
                // skip
            }
        }
    }

    return { docs: sections.join("\n\n---\n\n"), agents };
}

export function buildBriefPrompt(
    projectName: string,
    domain: Domain | null,
    docs: string,
    agents: string[]
): string {
    const scope = domain
        ? `the ${domain} domain of the project`
        : "the full project";

    const agentList = agents.length > 0
        ? `Available agents: ${agents.join(", ")}`
        : "No agents defined yet.";

    return `You are a senior software architect reviewing project documentation.
  
  Based on the following documentation, produce a concise technical brief for ${scope} called "${projectName}".
  
  The brief must include these sections in order:
  
  1. **Project Overview** — what this project does and who it is for (2-3 sentences)
  2. **Architecture Summary** — key technical decisions, stack, and rationale
  3. **Domain Breakdown** — what each major domain handles and how they interact
  4. **Key Patterns** — the most important coding and architectural patterns in use
  5. **Agent Roles** — what each AI agent role is responsible for (if agents are defined)
  6. **Critical Constraints** — non-negotiables, compliance requirements, or hard technical limits
  7. **Next Steps** — the most important things to build or decide first, grouped by week
  
  8. **Start Building** — THIS IS THE MOST IMPORTANT SECTION. Give the developer the exact sequence of steps to begin working RIGHT NOW using the available agents and commands. Be specific:
     - Which agent to open first and what to tell it (exact prompt or instruction)
     - Which skill command to run first (e.g. /design-schema, /setup-connection)
     - What files to fill in before running any commands (e.g. CANONICAL_ARCHITECTURE.md)
     - The exact order: step 1 → step 2 → step 3, no ambiguity
     - What "done" looks like for the first session of work
     - What to tackle in the second session
  
  ${agentList}
  
  Be specific and technical. Avoid generic advice. Every sentence should reflect the actual documentation provided.
  Reference actual agent names, actual command names from the skill packages, and actual file paths.
  
  ---
  
  ${docs}`;
}

export async function runBriefMe(
    domain: Domain | null = DOMAIN_FLAG,
    offline: boolean = OFFLINE
): Promise<void> {
    const cwd = process.cwd();

    p.intro(
        domain
            ? `primer brief-me --domain ${domain}`
            : "primer brief-me"
    );

    // Read project config
    const project = readProjectConfig(cwd);

    if (!project) {
        p.log.warn(
            "No .primer/project.json found. " +
            "This project may not have been scaffolded with primer, " +
            "or was created before v1.0.1. " +
            "Proceeding with auto-detection."
        );
    } else {
        p.log.info(`Project: ${project.projectName}`);
        p.log.info(`Provider: ${project.aiProvider ?? "auto-detect"}`);
    }

    // Validate domain
    if (domain && !VALID_DOMAINS.includes(domain)) {
        p.cancel(
            `Unknown domain "${domain}". ` +
            `Valid domains: ${VALID_DOMAINS.join(", ")}`
        );
        process.exit(1);
    }

    // Collect docs and agents
    const cs = p.spinner();
    cs.start("Reading project documentation");
    const { docs, agents } = await collectDocsAndAgents(cwd, domain);

    if (!docs.trim()) {
        cs.stop("No documentation found");
        p.cancel(
            "No docs found in docs/CANONICAL_ARCHITECTURE.md, " +
            "docs/CANONICAL_PATTERNS.md, docs/agents/, or docs/skills/. " +
            "Run primer init first, or fill in your canonical docs."
        );
        process.exit(1);
    }
    cs.stop(`Documentation collected — ${agents.length} agent${agents.length !== 1 ? "s" : ""} found`);

    const projectName = project?.projectName ?? "this project";
    const outputFile = domain
        ? join(cwd, "docs", "briefs", `${domain}.md`)
        : join(cwd, "docs", "BRIEF.md");

    // Offline mode — write raw doc summary without LLM
    if (offline) {
        p.log.warn("Offline mode — writing raw documentation summary without LLM synthesis.");

        const header = [
            `# ${domain ? `${domain} Brief` : "Project Brief"} — ${projectName}`,
            ``,
            `> Generated by primer brief-me${domain ? ` --domain ${domain}` : ""} (offline mode)`,
            `> ${new Date().toISOString()}`,
            ``,
            `---`,
            ``,
        ].join("\n");

        const dir = join(cwd, "docs", "briefs");
        if (domain && !existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(outputFile, header + docs, "utf-8");
        p.outro(`Brief saved to ${outputFile}`);
        return;
    }

    // Resolve provider
    const providerKey = resolveProvider(project?.aiProvider ?? null);
    if (!providerKey) {
        p.cancel(
            "No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or " +
            "GEMINI_API_KEY, or run with --offline."
        );
        process.exit(1);
    }

    const provider = PROVIDERS[providerKey as ProviderKey];
    p.log.info(`Using provider: ${provider.name}`);

    // Resolve API key
    let apiKey: string;
    try {
        apiKey = await resolveApiKey(provider);
    } catch (err) {
        p.cancel(`Could not resolve API key: ${String(err)}`);
        process.exit(1);
    }

    // Generate brief
    const gs = p.spinner();
    gs.start("Generating brief");

    try {
        const prompt = buildBriefPrompt(projectName, domain, docs, agents);
        const raw = await provider.generate(prompt, apiKey, 4096);
        const brief = [
            `# ${domain ? `${domain} Brief` : "Project Brief"} — ${projectName}`,
            ``,
            `> Generated by primer brief-me${domain ? ` --domain ${domain}` : ""}`,
            `> Provider: ${provider.name}`,
            `> ${new Date().toISOString()}`,
            ``,
            `---`,
            ``,
            raw.trim(),
        ].join("\n");

        // Write output
        if (domain) {
            const dir = join(cwd, "docs", "briefs");
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        }
        writeFileSync(outputFile, brief, "utf-8");

        gs.stop(`Brief generated`);
        p.log.info(`Saved to: ${outputFile}`);
        p.outro(`Done. Open ${outputFile} to review.`);
    } catch (err) {
        gs.stop("Generation failed");
        p.cancel(String(err));
        process.exit(1);
    }
}