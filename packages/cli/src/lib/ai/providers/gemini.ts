import type { AIProvider } from "../types.ts";

const DEFAULT_MODEL = "gemini-2.0-flash";

export const geminiProvider: AIProvider = {
    name: "Gemini (Google)",
    envKey: "GEMINI_API_KEY",

    async generate(prompt: string, apiKey: string, maxTokens: number): Promise<string> {
        const model = process.env["GEMINI_MODEL"] ?? DEFAULT_MODEL;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { maxOutputTokens: maxTokens },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${error}`);
        }

        const data = await response.json() as {
            candidates: Array<{
                content: { parts: Array<{ text: string }> };
            }>;
        };

        return data.candidates[0]?.content.parts
            .map((p) => p.text)
            .join("") ?? "";
    },
};