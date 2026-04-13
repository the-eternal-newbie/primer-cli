import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolvePackageManagerRun,
  resolvePackageManagerVersion,
  DOTFILE_RENAMES,
  AI_TOOL_GATES,
  PACKAGE_MANAGER_GATES,
} from "./scaffold.ts";

describe("resolvePackageManagerRun", () => {
  it("returns pm name for pnpm", () => {
    assert.equal(resolvePackageManagerRun("pnpm"), "pnpm");
  });

  it("returns pm name for yarn", () => {
    assert.equal(resolvePackageManagerRun("yarn"), "yarn");
  });

  it("returns npm run for npm", () => {
    assert.equal(resolvePackageManagerRun("npm"), "npm run");
  });
});

describe("resolvePackageManagerVersion", () => {
  it("returns a non-empty string for pnpm", () => {
    const version = resolvePackageManagerVersion("pnpm");
    assert.ok(version.length > 0);
    assert.ok(version !== "latest");
  });

  it("returns latest for unknown package manager", () => {
    const version = resolvePackageManagerVersion("unknown-pm-xyz");
    assert.equal(version, "latest");
  });
});

describe("DOTFILE_RENAMES", () => {
  it("renames gitignore to .gitignore", () => {
    assert.equal(DOTFILE_RENAMES["gitignore"], ".gitignore");
  });

  it("renames npmrc to .npmrc", () => {
    assert.equal(DOTFILE_RENAMES["npmrc"], ".npmrc");
  });

  it("does not rename arbitrary files", () => {
    assert.equal(DOTFILE_RENAMES["package.json"], undefined);
  });
});

describe("AI_TOOL_GATES", () => {
  it("gates .cursor behind cursor tool", () => {
    assert.equal(AI_TOOL_GATES[".cursor"], "cursor");
  });

  it("gates .claude behind claude-code tool", () => {
    assert.equal(AI_TOOL_GATES[".claude"], "claude-code");
  });
});

describe("PACKAGE_MANAGER_GATES", () => {
  it("gates .npmrc behind pnpm", () => {
    assert.equal(PACKAGE_MANAGER_GATES[".npmrc"], "pnpm");
  });
});