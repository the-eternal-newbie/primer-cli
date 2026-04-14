import type { AIProvider } from "../types.ts";

const DEFAULT_MODEL = "claude-sonnet-4-5";

export const anthropicProvider: AIProvider = {
    name: "Claude (Anthropic)",
    envKey: "ANTHROPIC_API_KEY",

    async generate(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
        const model = process.env["ANTHROPIC_MODEL"] ?? DEFAULT_MODEL;

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model,
                max_tokens: maxTokens,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Anthropic API error ${response.status}: ${error}`);
        }

        const data = await response.json() as {
            content: Array<{ type: string; text: string }>;
        };

        return data.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
    },
};