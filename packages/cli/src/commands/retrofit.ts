import * as p from "@clack/prompts";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
const { renderTemplate, copyStaticFile } = await import("../lib/scaffold.ts");
import { installSkills, writeSkillsToTools, AVAILABLE_SKILLS } from "../lib/skills.ts";
import {
    resolvePackageManagerRun,
    writeOutputFile,
} from "../lib/scaffold.ts";
import type { ScaffoldContext, PackageManager, AiTool, SkillEntry } from "../lib/scaffold.ts";
import { getTemplatesRoot } from "../lib/resolve.ts";
import type { SkillName } from "../lib/skills.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

export interface DetectedConfig {
    projectName: string;
    packageManager: PackageManager;
    cursorEnabled: boolean;
    claudeEnabled: boolean;
    existingSkills: SkillName[];
    hasAgentsMd: boolean;
}

export async function detectConfig(cwd: string): Promise<DetectedConfig> {
    let projectName = "unknown";
    let packageManager: PackageManager = "npm";

    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as {
                name?: string;
                packageManager?: string;
            };
            if (pkg.name) projectName = pkg.name;
            if (pkg.packageManager) {
                if (pkg.packageManager.startsWith("pnpm")) packageManager = "pnpm";
                else if (pkg.packageManager.startsWith("yarn")) packageManager = "yarn";
                else packageManager = "npm";
            }
        } catch {
            // keep defaults
        }
    }

    const cursorEnabled = existsSync(join(cwd, ".cursor"));
    const claudeEnabled = existsSync(join(cwd, ".claude"));

    const existingSkills: SkillName[] = [];
    const skillsDir = join(cwd, "docs", "skills");
    if (existsSync(skillsDir)) {
        try {
            const entries = await readdir(skillsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (
                    entry.isDirectory() &&
                    AVAILABLE_SKILLS.some(s => s.value === entry.name)
                ) {
                    existingSkills.push(entry.name as SkillName);
                }
            }
        } catch {
            // skills dir unreadable
        }
    }

    const hasAgentsMd = existsSync(join(cwd, "AGENTS.md"));

    return {
        projectName,
        packageManager,
        cursorEnabled,
        claudeEnabled,
        existingSkills,
        hasAgentsMd,
    };
}

function logDryRun(message: string): void {
    p.log.info(`[dry-run] ${message}`);
}

async function safeWrite(
    filePath: string,
    content: string,
    label: string
): Promise<"written" | "skipped" | "dry-run"> {
    if (DRY_RUN) {
        logDryRun(`would write ${label}`);
        return "dry-run";
    }

    if (existsSync(filePath) && !FORCE) {
        p.log.warn(`Skipping ${label} — already exists. Use --force to overwrite.`);
        return "skipped";
    }

    await writeOutputFile(filePath, content);
    return "written";
}

export async function runRetrofit(): Promise<void> {
    const cwd = process.cwd();

    p.intro(
        DRY_RUN
            ? "primer retrofit --dry-run — preview changes"
            : "primer retrofit — add agent conventions to existing project"
    );

    if (DRY_RUN) {
        p.log.warn("Dry-run mode — no files will be written.");
    }

    // --- Detect existing config ---
    const ds = p.spinner();
    ds.start("Detecting project configuration");
    const detected = await detectConfig(cwd);
    ds.stop("Project detected");

    p.log.info(`Project: ${detected.projectName}`);
    p.log.info(`Package manager: ${detected.packageManager}`);
    p.log.info(`Cursor: ${detected.cursorEnabled ? "detected" : "not found"}`);
    p.log.info(`Claude Code: ${detected.claudeEnabled ? "detected" : "not found"}`);
    p.log.info(
        `Existing skills: ${detected.existingSkills.length > 0
            ? detected.existingSkills.join(", ")
            : "none"
        }`
    );

    // --- Ask what to add ---
    const availableSkills = AVAILABLE_SKILLS.filter(
        s => !detected.existingSkills.includes(s.value)
    );

    const answers = await p.group(
        {
            aiTools: () =>
                p.multiselect({
                    message: "Which AI tools to configure (detected tools pre-selected)?",
                    options: [
                        {
                            value: "cursor",
                            label: "Cursor",
                            hint: detected.cursorEnabled ? "detected" : "not found",
                        },
                        {
                            value: "claude-code",
                            label: "Claude Code",
                            hint: detected.claudeEnabled ? "detected" : "not found",
                        },
                    ],
                    initialValues: [
                        ...(detected.cursorEnabled ? ["cursor" as const] : []),
                        ...(detected.claudeEnabled ? ["claude-code" as const] : []),
                    ],
                    required: true,
                }),

            skills: () =>
                availableSkills.length > 0
                    ? p.multiselect({
                        message: "Which skill packages to add?",
                        options: availableSkills,
                        required: false,
                    })
                    : Promise.resolve([]),
        },
        {
            onCancel: () => {
                p.cancel("Cancelled. See you space cowboy!");
                process.exit(0);
            },
        }
    );

    const aiTools = answers.aiTools as AiTool[];
    const cursorEnabled = aiTools.includes("cursor");
    const claudeEnabled = aiTools.includes("claude-code");
    const skillsToAdd = (answers.skills ?? []) as SkillName[];

    // Build context for template rendering
    const allInstalledSkills = [
        ...detected.existingSkills,
        ...skillsToAdd,
    ];

    const context: ScaffoldContext = {
        projectName: detected.projectName,
        packageManager: detected.packageManager,
        packageManagerVersion: "",
        packageManagerRun: resolvePackageManagerRun(detected.packageManager),
        aiTools,
        cursorEnabled,
        claudeEnabled,
        initGit: false,
        hasSkills: allInstalledSkills.length > 0,
        installedSkillsList: allInstalledSkills.map(
            (slug): SkillEntry => ({
                slug,
                name: AVAILABLE_SKILLS.find(s => s.value === slug)?.label ?? slug,
            })
        ),
    };

    const templatesRoot = getTemplatesRoot("cli-tool");
    let written = 0;
    let skipped = 0;

    // --- AGENTS.md ---
    if (!detected.hasAgentsMd || FORCE) {
        const agentsMdPath = join(templatesRoot, "AGENTS.md.hbs");
        if (existsSync(agentsMdPath)) {
            const content = await renderTemplate(agentsMdPath, context);
            const result = await safeWrite(
                join(cwd, "AGENTS.md"),
                content,
                "AGENTS.md"
            );
            if (result === "written") written++;
            if (result === "skipped") skipped++;
        }
    } else {
        p.log.warn("Skipping AGENTS.md — already exists. Use --force to overwrite.");
        skipped++;
    }

    // --- Cursor rules ---
    if (cursorEnabled) {
        const rulesTemplatesDir = join(templatesRoot, ".cursor", "rules");
        if (existsSync(rulesTemplatesDir)) {
            const ruleFiles = await readdir(rulesTemplatesDir);
            for (const file of ruleFiles) {
                const outName = file.endsWith(".hbs") ? file.slice(0, -4) : file;
                const destPath = join(cwd, ".cursor", "rules", outName);

                if (existsSync(destPath) && !FORCE) {
                    p.log.warn(`Skipping .cursor/rules/${outName} — already exists.`);
                    skipped++;
                    continue;
                }

                if (DRY_RUN) {
                    logDryRun(`would write .cursor/rules/${outName}`);
                    continue;
                }

                if (file.endsWith(".hbs")) {
                    const content = await renderTemplate(join(rulesTemplatesDir, file), context);
                    await writeOutputFile(destPath, content);
                } else {
                    await copyStaticFile(join(rulesTemplatesDir, file), destPath);
                }
                written++;
            }
        }

        // --- Cursor git commands ---
        const cmdTemplatesDir = join(templatesRoot, ".cursor", "commands");
        if (existsSync(cmdTemplatesDir)) {
            const cmdFiles = await readdir(cmdTemplatesDir);
            for (const file of cmdFiles) {
                const outName = file.endsWith(".hbs") ? file.slice(0, -4) : file;
                const destPath = join(cwd, ".cursor", "commands", outName);

                if (existsSync(destPath) && !FORCE) {
                    p.log.warn(`Skipping .cursor/commands/${outName} — already exists.`);
                    skipped++;
                    continue;
                }

                if (DRY_RUN) {
                    logDryRun(`would write .cursor/commands/${outName}`);
                    continue;
                }

                if (file.endsWith(".hbs")) {
                    const content = await renderTemplate(join(cmdTemplatesDir, file), context);
                    await writeOutputFile(destPath, content);
                } else {
                    await copyStaticFile(join(cmdTemplatesDir, file), destPath);
                }
                written++;
            }
        }
    }

    // --- Claude CLAUDE.md and commands ---
    if (claudeEnabled) {
        const claudeTemplatePath = join(templatesRoot, ".claude", "CLAUDE.md.hbs");
        if (existsSync(claudeTemplatePath)) {
            const content = await renderTemplate(claudeTemplatePath, context);
            const result = await safeWrite(
                join(cwd, ".claude", "CLAUDE.md"),
                content,
                ".claude/CLAUDE.md",
            );
            if (result === "written") written++;
            if (result === "skipped") skipped++;
        }

        const claudeCmdDir = join(templatesRoot, ".claude", "commands");
        if (existsSync(claudeCmdDir)) {
            const cmdFiles = await readdir(claudeCmdDir);
            for (const file of cmdFiles) {
                const outName = file.endsWith(".hbs") ? file.slice(0, -4) : file;
                const destPath = join(cwd, ".claude", "commands", outName);

                if (existsSync(destPath) && !FORCE) {
                    p.log.warn(`Skipping .claude/commands/${outName} — already exists.`);
                    skipped++;
                    continue;
                }

                if (DRY_RUN) {
                    logDryRun(`would write .claude/commands/${outName}`);
                    continue;
                }

                if (file.endsWith(".hbs")) {
                    const content = await renderTemplate(join(claudeCmdDir, file), context);
                    await writeOutputFile(destPath, content);
                } else {
                    await copyStaticFile(join(claudeCmdDir, file), destPath);
                }
                written++;
            }
        }
    }

    // --- Install new skills ---
    if (skillsToAdd.length > 0) {
        if (DRY_RUN) {
            logDryRun(`would install skills: ${skillsToAdd.join(", ")}`);
        } else {
            const ss = p.spinner();
            ss.start(`Installing ${skillsToAdd.length} skill package${skillsToAdd.length > 1 ? "s" : ""}`);
            try {
                await installSkills(cwd, skillsToAdd);
                await writeSkillsToTools(cwd, skillsToAdd, cursorEnabled, claudeEnabled);
                ss.stop(`Installed: ${skillsToAdd.join(", ")}`);
                written += skillsToAdd.length;
            } catch (err) {
                ss.stop("Skill installation failed");
                p.log.error(String(err));
            }
        }
    }

    // --- Summary ---
    if (DRY_RUN) {
        p.outro("Dry-run complete — no files were written. Run without --dry-run to apply.");
    } else {
        p.outro(
            `Done. ${written} file${written !== 1 ? "s" : ""} written, ${skipped} skipped.`
        );
    }
}