import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface PrimerAIConfig {
    maxTokens: number;
    maxAgents: number;
    maxCommandsPerAgent: number;
    maxRulesPerAgent: number;
    maxStepsPerCommand: number;
    maxDoNotPerCommand: number;
    maxRulesPerRuleSet: number;
    maxAdditionalRules: number;
}

export interface PrimerConfig {
    ai: PrimerAIConfig;
}

export const DEFAULT_CONFIG: PrimerConfig = {
    ai: {
        maxTokens: 8192,
        maxAgents: 4,
        maxCommandsPerAgent: 3,
        maxRulesPerAgent: 2,
        maxStepsPerCommand: 5,
        maxDoNotPerCommand: 3,
        maxRulesPerRuleSet: 5,
        maxAdditionalRules: 5,
    },
};

function mergeConfig(partial: Partial<PrimerConfig>): PrimerConfig {
    return {
        ai: {
            ...DEFAULT_CONFIG.ai,
            ...(partial.ai ?? {}),
        },
    };
}

export async function loadConfig(cwd: string = process.cwd()): Promise<PrimerConfig> {
    // 1. Try primer.config.ts (dynamic import)
    const tsConfig = join(cwd, "primer.config.ts");
    if (existsSync(tsConfig)) {
        try {
            const mod = await import(pathToFileURL(tsConfig).href) as {
                default: Partial<PrimerConfig>;
            };
            return mergeConfig(mod.default);
        } catch {
            // fall through to next option
        }
    }

    // 2. Try primer.config.json
    const jsonConfig = join(cwd, "primer.config.json");
    if (existsSync(jsonConfig)) {
        try {
            const raw = await readFile(jsonConfig, "utf-8");
            return mergeConfig(JSON.parse(raw) as Partial<PrimerConfig>);
        } catch {
            // fall through to defaults
        }
    }

    // 3. Return defaults
    return DEFAULT_CONFIG;
}