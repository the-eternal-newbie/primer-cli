import * as p from "@clack/prompts";
import type { AIProvider } from "./types.ts";

export async function resolveApiKey(
    provider: AIProvider
): Promise<string> {
    // Check environment first
    const envKey = process.env[provider.envKey];

    if (envKey) {
        p.log.info(
            `Using ${provider.envKey} from environment.`
        );
        return envKey;
    }

    // Fall back to secure prompt
    p.log.warn(
        `${provider.envKey} not found in environment.`
    );

    const key = await p.password({
        message: `Enter your ${provider.name} API key`,
        validate: (v) =>
            v.length > 0 ? undefined : "API key cannot be empty",
    });

    if (p.isCancel(key)) {
        p.cancel("Cancelled.");
        process.exit(0);
    }

    p.log.info(
        "API key will be used only for this session and never written to disk."
    );

    return key as string;
}