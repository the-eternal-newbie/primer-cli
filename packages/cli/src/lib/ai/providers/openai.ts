import type { AIProvider } from "../types.ts";

const DEFAULT_MODEL = "gpt-4o";

export const openaiProvider: AIProvider = {
    name: "ChatGPT (OpenAI)",
    envKey: "OPENAI_API_KEY",

    async generate(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
        const model = process.env["OPENAI_MODEL"] ?? DEFAULT_MODEL;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
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
            throw new Error(`OpenAI API error ${response.status}: ${error}`);
        }

        const data = await response.json() as {
            choices: Array<{ message: { content: string } }>;
        };

        return data.choices[0]?.message.content ?? "";
    },
};