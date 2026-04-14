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

interface ConfigCandidate {
    path: string;
    load: () => Promise<PrimerConfig>;
}

export async function loadConfig(
    cwd: string = process.cwd()
): Promise<PrimerConfig> {
    const candidates: ConfigCandidate[] = [
        {
            path: join(cwd, "primer.config.mjs"),
            load: async () => {
                const mod = await import(
                    pathToFileURL(join(cwd, "primer.config.mjs")).href
                ) as { default: Partial<PrimerConfig> };
                return mergeConfig(mod.default);
            },
        },
        {
            path: join(cwd, "primer.config.json"),
            load: async () => {
                const raw = await readFile(join(cwd, "primer.config.json"), "utf-8");
                return mergeConfig(JSON.parse(raw) as Partial<PrimerConfig>);
            },
        },
    ];

    for (const candidate of candidates) {
        if (!existsSync(candidate.path)) continue;
        try {
            return await candidate.load();
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(
                `Warning: found ${candidate.path} but could not load it: ${err instanceof Error ? err.message : String(err)
                }. Using defaults.`
            );
        }
    }

    return DEFAULT_CONFIG;
}