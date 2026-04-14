import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseGenerationResult } from "./prompt.ts";

const VALID_RESULT = {
  agents: [
    {
      name: "Test Agent",
      slug: "test-agent",
      purpose: "Test purpose",
      responsibilities: ["responsibility 1"],
      constraints: ["constraint 1"],
      domainContext: "Some domain context",
      commands: [
        {
          slug: "test-command",
          title: "Test Command",
          description: "Does something",
          steps: ["Step 1"],
          doNot: ["Never do this"],
        },
      ],
      rules: [
        {
          slug: "test-rule",
          description: "Governs something",
          rules: ["Rule 1"],
        },
      ],
    },
  ],
  additionalRules: ["Additional rule 1"],
  architectureNotes: "Some architecture notes",
  patternNotes: "Some pattern notes",
};

describe("parseGenerationResult", () => {
  it("parses valid JSON", () => {
    const raw = JSON.stringify(VALID_RESULT);
    const result = parseGenerationResult(raw);
    assert.equal(result.agents.length, 1);
    assert.equal(result.agents[0]?.name, "Test Agent");
  });

  it("strips json code fences", () => {
    const raw = "```json\n" + JSON.stringify(VALID_RESULT) + "\n```";
    const result = parseGenerationResult(raw);
    assert.equal(result.agents.length, 1);
  });

  it("strips plain code fences", () => {
    const raw = "```\n" + JSON.stringify(VALID_RESULT) + "\n```";
    const result = parseGenerationResult(raw);
    assert.equal(result.agents.length, 1);
  });

  it("throws on truncated response", () => {
    const truncated = JSON.stringify(VALID_RESULT).slice(0, 100);
    assert.throws(
      () => parseGenerationResult(truncated),
      /truncated/
    );
  });

  it("throws on invalid JSON with diagnostic info", () => {
    const invalid = '{"agents": [invalid json}';
    assert.throws(
      () => parseGenerationResult(invalid),
      /Failed to parse/
    );
  });

  it("includes char count in truncation error", () => {
    const truncated = JSON.stringify(VALID_RESULT).slice(0, 50);
    assert.throws(
      () => parseGenerationResult(truncated),
      /50 chars/
    );
  });
});

describe("loadConfig fallback behavior", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "primer-config-test-"));
  });

  after(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", async () => {
    const { loadConfig, DEFAULT_CONFIG } = await import("../config.ts");
    const config = await loadConfig(tmpDir);
    assert.deepEqual(config, DEFAULT_CONFIG);
  });

  it("loads and merges primer.config.json", async () => {
    const { loadConfig } = await import("../config.ts");
    await writeFile(
      join(tmpDir, "primer.config.json"),
      JSON.stringify({ ai: { maxTokens: 4096, maxAgents: 2 } })
    );
    const config = await loadConfig(tmpDir);
    assert.equal(config.ai.maxTokens, 4096);
    assert.equal(config.ai.maxAgents, 2);
    // other fields should retain defaults
    assert.equal(config.ai.maxCommandsPerAgent, 3);
  });

  it("warns and falls back to defaults on invalid json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "primer-invalid-config-"));
    try {
      const { loadConfig, DEFAULT_CONFIG } = await import("../config.ts");
      await writeFile(join(dir, "primer.config.json"), "not valid json{{{");
      const config = await loadConfig(dir);
      assert.deepEqual(config, DEFAULT_CONFIG);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});