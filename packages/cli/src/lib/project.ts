import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getPrimerVersion(): string {
    try {
        const pkg = JSON.parse(
            readFileSync(join(__dirname, "..", "package.json"), "utf-8")
        ) as { version: string };
        return pkg.version;
    } catch {
        return "0.0.0";
    }
}

export interface PrimerProject {
    projectName: string;
    packageManager: string;
    aiProvider: string | null;
    aiTools: string[];
    skills: string[];
    createdAt: string;
    primerVersion: string;
}

const PROJECT_FILE = ".primer/project.json";

export function writeProjectConfig(cwd: string, config: PrimerProject): void {
    const dir = join(cwd, ".primer");
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
        join(cwd, PROJECT_FILE),
        JSON.stringify(config, null, 2),
        "utf-8"
    );
}

export function readProjectConfig(cwd: string): PrimerProject | null {
    const filePath = join(cwd, PROJECT_FILE);
    if (!existsSync(filePath)) return null;
    try {
        return JSON.parse(readFileSync(filePath, "utf-8")) as PrimerProject;
    } catch {
        return null;
    }
}

export function updateProjectConfig(
    cwd: string,
    updates: Partial<PrimerProject>
): void {
    const existing = readProjectConfig(cwd);
    if (!existing) return;
    writeProjectConfig(cwd, { ...existing, ...updates });
}