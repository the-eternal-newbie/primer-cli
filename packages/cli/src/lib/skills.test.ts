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

    it("copies auth skill files into docs/skills/auth/", async () => {
        const authDir = await mkdtemp(join(tmpdir(), "primer-auth-skills-test-"));
        try {
            await installSkills(authDir, ["auth"]);

            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "README.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "rules", "auth.mdc")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "knowledge", "attack-vectors.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "knowledge", "authorization-models.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "knowledge", "authorization-decoupling.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "knowledge", "machine-identity.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "knowledge", "frontend-security.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "setup-auth-provider.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "configure-access-policy.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "rotate-secrets.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "audit-dependencies.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "audit-access-control.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "revoke-sessions.md")));
            assert.ok(await exists(join(authDir, "docs", "skills", "auth", "commands", "lockdown-auth.md")));
        } finally {
            await rm(authDir, { recursive: true, force: true });
        }
    });

    it("copies both database and auth skills together", async () => {
        const bothDir = await mkdtemp(join(tmpdir(), "primer-both-skills-test-"));
        try {
            await installSkills(bothDir, ["database", "auth"]);
            assert.ok(await exists(join(bothDir, "docs", "skills", "database", "README.md")));
            assert.ok(await exists(join(bothDir, "docs", "skills", "auth", "README.md")));
        } finally {
            await rm(bothDir, { recursive: true, force: true });
        }
    });

    it("copies backend skill files into docs/skills/backend/", async () => {
        const backendDir = await mkdtemp(join(tmpdir(), "primer-backend-skills-test-"));
        try {
            await installSkills(backendDir, ["backend"]);

            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "README.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "rules", "backend.mdc")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "knowledge", "idempotency.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "knowledge", "traffic-control.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "knowledge", "distributed-resilience.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "knowledge", "api-contracts.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "knowledge", "agentic-backends.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "scaffold-service.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "setup-observability.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "validate-contract.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "generate-e2e-tests.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "diagnose-incident.md")));
            assert.ok(await exists(join(backendDir, "docs", "skills", "backend", "commands", "draft-postmortem.md")));
        } finally {
            await rm(backendDir, { recursive: true, force: true });
        }
    });

    it("copies frontend skill files into docs/skills/frontend/", async () => {
        const frontendDir = await mkdtemp(join(tmpdir(), "primer-frontend-skills-test-"));
        try {
            await installSkills(frontendDir, ["frontend"]);

            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "README.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "rules", "frontend.mdc")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "knowledge", "rsc-boundary.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "knowledge", "hydration.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "knowledge", "architecture.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "knowledge", "performance.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "commands", "scaffold-architecture.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "commands", "audit-hydration.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "commands", "optimize-vitals.md")));
            assert.ok(await exists(join(frontendDir, "docs", "skills", "frontend", "commands", "audit-accessibility.md")));
        } finally {
            await rm(frontendDir, { recursive: true, force: true });
        }
    });

    it("copies testing skill files into docs/skills/testing/", async () => {
        const testingDir = await mkdtemp(join(tmpdir(), "primer-testing-skills-test-"));
        try {
            await installSkills(testingDir, ["testing"]);

            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "README.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "rules", "testing.mdc")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "knowledge", "ai-code-failures.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "knowledge", "test-strategy.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "knowledge", "mutation-testing.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "knowledge", "contract-testing.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "commands", "seed-test-data.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "commands", "generate-mutations.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "commands", "heal-test.md")));
            assert.ok(await exists(join(testingDir, "docs", "skills", "testing", "commands", "diagnose-flakiness.md")));
        } finally {
            await rm(testingDir, { recursive: true, force: true });
        }
    });
});