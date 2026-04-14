import { anthropicProvider } from "./anthropic.ts";
import { openaiProvider } from "./openai.ts";
import { geminiProvider } from "./gemini.ts";
import type { AIProvider } from "../types.ts";

export const PROVIDERS: Record<string, AIProvider> = {
    claude: anthropicProvider,
    chatgpt: openaiProvider,
    gemini: geminiProvider,
};

export type ProviderKey = keyof typeof PROVIDERS;