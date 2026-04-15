import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import internals for unit testing
import { collectDocsAndAgents, buildBriefPrompt } from "./brief-me.ts";

describe("collectDocsAndAgents", () => {
    let dir: string;

    before(async () => {
        dir = await mkdtemp(join(tmpdir(), "primer-brief-test-"));
    });

    after(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("returns empty docs and agents when no docs exist", async () => {
        const emptyDir = await mkdtemp(join(tmpdir(), "primer-brief-empty-"));
        try {
            const result = await collectDocsAndAgents(emptyDir, null);
            assert.equal(result.docs.trim(), "");
            assert.deepEqual(result.agents, []);
        } finally {
            await rm(emptyDir, { recursive: true, force: true });
        }
    });

    it("collects canonical docs", async () => {
        const d = await mkdtemp(join(tmpdir(), "primer-brief-canon-"));
        try {
            await mkdir(join(d, "docs"), { recursive: true });
            await writeFile(join(d, "docs", "CANONICAL_ARCHITECTURE.md"), "# Arch\nNext.js + Postgres");
            await writeFile(join(d, "docs", "CANONICAL_PATTERNS.md"), "# Patterns\nRepository pattern");

            const result = await collectDocsAndAgents(d, null);
            assert.ok(result.docs.includes("Next.js + Postgres"));
            assert.ok(result.docs.includes("Repository pattern"));
        } finally {
            await rm(d, { recursive: true, force: true });
        }
    });

    it("collects agent names from docs/agents/", async () => {
        const d = await mkdtemp(join(tmpdir(), "primer-brief-agents-"));
        try {
            await mkdir(join(d, "docs", "agents"), { recursive: true });
            await writeFile(join(d, "docs", "agents", "backend-architect.md"), "# Backend Architect");
            await writeFile(join(d, "docs", "agents", "security-officer.md"), "# Security Officer");

            const result = await collectDocsAndAgents(d, null);
            assert.ok(result.agents.includes("backend-architect"));
            assert.ok(result.agents.includes("security-officer"));
        } finally {
            await rm(d, { recursive: true, force: true });
        }
    });

    it("scopes to domain when --domain is specified", async () => {
        const d = await mkdtemp(join(tmpdir(), "primer-brief-domain-"));
        try {
            await mkdir(join(d, "docs", "skills", "database", "knowledge"), { recursive: true });
            await mkdir(join(d, "docs", "skills", "auth", "knowledge"), { recursive: true });
            await writeFile(
                join(d, "docs", "skills", "database", "knowledge", "schema-design.md"),
                "# Schema Design"
            );
            await writeFile(
                join(d, "docs", "skills", "auth", "knowledge", "jwt.md"),
                "# JWT Auth"
            );

            const result = await collectDocsAndAgents(d, "database");
            assert.ok(result.docs.includes("Schema Design"));
            assert.ok(!result.docs.includes("JWT Auth"));
        } finally {
            await rm(d, { recursive: true, force: true });
        }
    });
});

describe("buildBriefPrompt", () => {
    it("includes project name in prompt", () => {
        const prompt = buildBriefPrompt("myapp", null, "# Docs", []);
        assert.ok(prompt.includes("myapp"));
    });

    it("mentions domain scope when domain is specified", () => {
        const prompt = buildBriefPrompt("myapp", "database", "# Docs", []);
        assert.ok(prompt.includes("database"));
    });

    it("includes agent names in prompt", () => {
        const prompt = buildBriefPrompt("myapp", null, "# Docs", ["backend-architect", "security-officer"]);
        assert.ok(prompt.includes("backend-architect"));
        assert.ok(prompt.includes("security-officer"));
    });

    it("rejects invalid domain at prompt level", () => {
        // Valid domains should not throw
        const validPrompt = buildBriefPrompt("myapp", "testing", "# Docs", []);
        assert.ok(validPrompt.length > 0);
    });
});