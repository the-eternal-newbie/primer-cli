import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSkills } from "./skills.ts";

async function exists(p: string): Promise<boolean> {
    try {
        await access(p);
        return true;
    } catch {
        return false;
    }
}

describe("installSkills", () => {
    let tmpDir: string;

    before(async () => {
        tmpDir = await mkdtemp(join(tmpdir(), "primer-skills-test-"));
    });

    after(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it("copies database skill files into docs/skills/database/", async () => {
        await installSkills(tmpDir, ["database"]);

        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "README.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "rules", "database.mdc")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "knowledge", "anti-patterns.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "knowledge", "performance.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "knowledge", "migration-safety.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "knowledge", "governance.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "commands", "setup-connection.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "commands", "create-migration.md")));
        assert.ok(await exists(join(tmpDir, "docs", "skills", "database", "commands", "design-schema.md")));
    });

    it("does nothing when skills array is empty", async () => {
        const emptyDir = await mkdtemp(join(tmpdir(), "primer-empty-skills-"));
        try {
            await installSkills(emptyDir, []);
            assert.ok(!await exists(join(emptyDir, "docs")));
        } finally {
            await rm(emptyDir, { recursive: true, force: true });
        }
    });

    it("throws a descriptive error for unknown skill names", async () => {
        await assert.rejects(
            // @ts-expect-error testing invalid input
            () => installSkills(tmpDir, ["nonexistent-skill"]),
            /not found/
        );
    });
});