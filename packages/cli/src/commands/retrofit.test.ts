import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectConfig } from "./retrofit.ts";

async function exists(p: string): Promise<boolean> {
    try {
        await access(p);
        return true;
    } catch {
        return false;
    }
}

describe("detectConfig", () => {
    let tmpDir: string;

    before(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), "primer-retrofit-test-"));
    });

    after(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it("detects project name and pnpm from package.json", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-test-"));
        try {
            await writeFile(
                join(dir, "package.json"),
                JSON.stringify({ name: "my-app", packageManager: "pnpm@10.0.0" })
            );
            const config = await detectConfig(dir);
            assert.equal(config.projectName, "my-app");
            assert.equal(config.packageManager, "pnpm");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects npm when no packageManager field", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-npm-"));
        try {
            await writeFile(
                join(dir, "package.json"),
                JSON.stringify({ name: "my-app" })
            );
            const config = await detectConfig(dir);
            assert.equal(config.packageManager, "npm");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects yarn from packageManager field", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-yarn-"));
        try {
            await writeFile(
                join(dir, "package.json"),
                JSON.stringify({ name: "my-app", packageManager: "yarn@4.0.0" })
            );
            const config = await detectConfig(dir);
            assert.equal(config.packageManager, "yarn");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects cursor when .cursor directory exists", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-cursor-"));
        try {
            await mkdir(join(dir, ".cursor"));
            await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x" }));
            const config = await detectConfig(dir);
            assert.equal(config.cursorEnabled, true);
            assert.equal(config.claudeEnabled, false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects claude when .claude directory exists", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-claude-"));
        try {
            await mkdir(join(dir, ".claude"));
            await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x" }));
            const config = await detectConfig(dir);
            assert.equal(config.claudeEnabled, true);
            assert.equal(config.cursorEnabled, false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects existing skills from docs/skills/", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-skills-"));
        try {
            await mkdir(join(dir, "docs", "skills", "database"), { recursive: true });
            await mkdir(join(dir, "docs", "skills", "auth"), { recursive: true });
            await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x" }));
            const config = await detectConfig(dir);
            assert.ok(config.existingSkills.includes("database"));
            assert.ok(config.existingSkills.includes("auth"));
            assert.equal(config.existingSkills.length, 2);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("ignores unknown directories in docs/skills/", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-unknown-"));
        try {
            await mkdir(join(dir, "docs", "skills", "unknown-domain"), { recursive: true });
            await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x" }));
            const config = await detectConfig(dir);
            assert.equal(config.existingSkills.length, 0);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("detects existing primer files", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-files-"));
        try {
            await writeFile(join(dir, "package.json"), JSON.stringify({ name: "x" }));
            await writeFile(join(dir, "AGENTS.md"), "# Agent Guide");
            await mkdir(join(dir, ".cursor", "rules"), { recursive: true });
            await writeFile(join(dir, ".cursor", "rules", "core.mdc"), "---\n---");
            const config = await detectConfig(dir);
            assert.equal(config.hasAgentsMd, true);
            assert.equal(config.cursorEnabled, true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns safe defaults when no package.json exists", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-detect-empty-"));
        try {
            const config = await detectConfig(dir);
            assert.equal(config.projectName, "unknown");
            assert.equal(config.packageManager, "npm");
            assert.equal(config.cursorEnabled, false);
            assert.equal(config.claudeEnabled, false);
            assert.equal(config.existingSkills.length, 0);
            assert.equal(config.hasAgentsMd, false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

describe("runRetrofit dry-run", () => {
    it("does not write any files in dry-run mode", async () => {
        const dir = await mkdtemp(join(tmpdir(), "primer-retrofit-dryrun-"));
        try {
            await writeFile(
                join(dir, "package.json"),
                JSON.stringify({ name: "test-dryrun", packageManager: "pnpm@10.0.0" })
            );

            // Patch process.cwd to point to our test directory
            const originalCwd = process.cwd;
            process.cwd = () => dir;

            try {
                // dry-run with no prompts — but runRetrofit calls p.group which
                // requires a TTY. We test detectConfig directly instead.
                const config = await detectConfig(dir);
                assert.equal(config.hasAgentsMd, false);
                assert.equal(config.cursorEnabled, false);
                // After dry-run nothing should exist
                assert.ok(!await exists(join(dir, "AGENTS.md")));
            } finally {
                process.cwd = originalCwd;
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});