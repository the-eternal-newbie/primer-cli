import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
  it("returns the runner output on success", () => {
    const version = resolvePackageManagerVersion(
      "pnpm",
      () => "10.33.0"
    );
    assert.equal(version, "10.33.0");
  });

  it("returns latest when runner throws", () => {
    const version = resolvePackageManagerVersion("pnpm", () => {
      throw new Error("not found");
    });
    assert.equal(version, "latest");
  });

  it("returns latest for unknown package manager with real runner", () => {
    const version = resolvePackageManagerVersion("unknown-pm-xyz", () => {
        throw new Error("not found");
    });
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