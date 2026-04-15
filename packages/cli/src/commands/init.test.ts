import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, access, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scaffoldDir } from "../lib/scaffold.ts";
import { getTemplatesRoot } from "../lib/resolve.ts";
import type { ScaffoldContext } from "../lib/scaffold.ts";

const templatesRoot = getTemplatesRoot("cli-tool");

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

describe("scaffold integration", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "primer-test-"));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("generates correct file tree for cursor-only pnpm project", async () => {
    const outDir = join(tmpDir, "test-cursor");
    const context: ScaffoldContext = {
      projectName: "test-cursor",
      packageManager: "pnpm",
      packageManagerVersion: "10.0.0",
      packageManagerRun: "pnpm",
      aiTools: ["cursor"],
      cursorEnabled: true,
      claudeEnabled: false,
      initGit: false,
      hasSkills: false,
      installedSkillsList: [],
      nextStep: 3,
      finalStep: 4,
    };

    await scaffoldDir(templatesRoot, outDir, context);

    assert.ok(await exists(join(outDir, ".cursor/rules/core.mdc")));
    assert.ok(await exists(join(outDir, ".cursor/rules/git-discipline.mdc")));
    assert.ok(await exists(join(outDir, ".cursor/commands/git-start-work.md")));
    assert.ok(!await exists(join(outDir, ".claude")));
    assert.ok(await exists(join(outDir, ".gitignore")));
    assert.ok(await exists(join(outDir, ".npmrc")));
    assert.ok(await exists(join(outDir, "AGENTS.md")));
    assert.ok(await exists(join(outDir, "package.json")));
    assert.ok(await exists(join(outDir, "src/index.ts")));
  });

  it("generates correct file tree for claude-only npm project", async () => {
    const outDir = join(tmpDir, "test-claude");
    const context: ScaffoldContext = {
      projectName: "test-claude",
      packageManager: "npm",
      packageManagerVersion: "10.0.0",
      packageManagerRun: "npm run",
      aiTools: ["claude-code"],
      cursorEnabled: false,
      claudeEnabled: true,
      initGit: false,
      hasSkills: false,
      installedSkillsList: [],
      nextStep: 3,
      finalStep: 4,
    };

    await scaffoldDir(templatesRoot, outDir, context);

    assert.ok(await exists(join(outDir, ".claude/CLAUDE.md")));
    assert.ok(await exists(join(outDir, ".claude/commands/git-start-work.md")));
    assert.ok(!await exists(join(outDir, ".cursor")));
    assert.ok(!await exists(join(outDir, ".npmrc")));

    const commitProgress = await readFile(
      join(outDir, ".claude/commands/git-commit-progress.md"),
      "utf-8"
    );
    assert.ok(commitProgress.includes("npm run typecheck"));
    assert.ok(commitProgress.includes("npm run lint"));
  });

  it("generates both tool directories when both selected", async () => {
    const outDir = join(tmpDir, "test-both");
    const context: ScaffoldContext = {
      projectName: "test-both",
      packageManager: "pnpm",
      packageManagerVersion: "10.0.0",
      packageManagerRun: "pnpm",
      aiTools: ["cursor", "claude-code"],
      cursorEnabled: true,
      claudeEnabled: true,
      initGit: false,
      hasSkills: false,
      installedSkillsList: [],
      nextStep: 3,
      finalStep: 4,
    };

    await scaffoldDir(templatesRoot, outDir, context);

    assert.ok(await exists(join(outDir, ".cursor/rules/core.mdc")));
    assert.ok(await exists(join(outDir, ".claude/CLAUDE.md")));
  });

  it("substitutes projectName in rendered templates", async () => {
    const outDir = join(tmpDir, "test-render");
    const context: ScaffoldContext = {
      projectName: "my-special-project",
      packageManager: "pnpm",
      packageManagerVersion: "10.0.0",
      packageManagerRun: "pnpm",
      aiTools: ["cursor"],
      cursorEnabled: true,
      claudeEnabled: false,
      initGit: false,
      hasSkills: false,
      installedSkillsList: [],
      nextStep: 3,
      finalStep: 4,
    };

    await scaffoldDir(templatesRoot, outDir, context);

    const agentsMd = await readFile(join(outDir, "AGENTS.md"), "utf-8");
    assert.ok(agentsMd.includes("my-special-project"));
    assert.ok(!agentsMd.includes("{{projectName}}"));

    const packageJson = await readFile(join(outDir, "package.json"), "utf-8");
    assert.ok(packageJson.includes('"name": "my-special-project"'));
  });

  it("generates GETTING_STARTED.md during scaffold", async () => {
    const dir = await mkdtemp(join(tmpdir(), "primer-gs-test-"));
    try {
      const context: ScaffoldContext = {
        projectName: "test-gs",
        packageManager: "pnpm",
        packageManagerVersion: "10.0.0",
        packageManagerRun: "pnpm",
        aiTools: ["cursor"],
        cursorEnabled: true,
        claudeEnabled: false,
        initGit: false,
        hasSkills: false,
        installedSkillsList: [],
        nextStep: 3,
        finalStep: 4,
      };
      const templatesRoot = getTemplatesRoot("cli-tool");
      await scaffoldDir(templatesRoot, dir, context);

      const gsPath = join(dir, "GETTING_STARTED.md");
      assert.ok(await exists(gsPath), "GETTING_STARTED.md should exist");

      const content = await readFile(gsPath, "utf-8");
      assert.ok(content.includes("## Step 3 — Start your first branch"));
      assert.ok(content.includes("## Step 4 — Install dependencies"));
      assert.ok(!content.includes("## Step 3 — Use your skill packages"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("generates GETTING_STARTED.md with correct step numbers when skills installed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "primer-gs-skills-test-"));
    try {
      const context: ScaffoldContext = {
        projectName: "test-gs-skills",
        packageManager: "pnpm",
        packageManagerVersion: "10.0.0",
        packageManagerRun: "pnpm",
        aiTools: ["cursor"],
        cursorEnabled: true,
        claudeEnabled: false,
        initGit: false,
        hasSkills: true,
        installedSkillsList: [
          { slug: "database", name: "Database" },
          { slug: "auth", name: "Auth" },
        ],
        nextStep: 4,
        finalStep: 5,
      };
      const templatesRoot = getTemplatesRoot("cli-tool");
      await scaffoldDir(templatesRoot, dir, context);

      const content = await readFile(join(dir, "GETTING_STARTED.md"), "utf-8");
      assert.ok(content.includes("## Step 3 — Use your skill packages"));
      assert.ok(content.includes("## Step 4 — Start your first branch"));
      assert.ok(content.includes("## Step 5 — Install dependencies"));
      assert.ok(content.includes("| Database |"));
      assert.ok(content.includes("| Auth |"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});