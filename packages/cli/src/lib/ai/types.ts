export interface AIProvider {
    readonly name: string;
    readonly envKey: string;
    generate(prompt: string, apiKey: string, maxTokens: number): Promise<string>;
}

export interface AgentCommand {
    slug: string;
    title: string;
    description: string;
    steps: string[];
    doNot: string[];
}

export interface AgentRule {
    slug: string;
    description: string;
    rules: string[];
}

export interface AgentRole {
    name: string;
    slug: string;
    purpose: string;
    responsibilities: string[];
    constraints: string[];
    domainContext: string;
    commands: AgentCommand[];
    rules: AgentRule[];
}

export interface AIGenerationResult {
    agents: AgentRole[];
    additionalRules: string[];
    architectureNotes: string;
    patternNotes: string;
}

export interface TechStack {
    language: string;
    frameworks: string;
    infrastructure: string;
}