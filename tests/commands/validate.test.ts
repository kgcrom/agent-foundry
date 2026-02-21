import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { validate } from "../../src/commands/validate.js";
import { captureConsole } from "../helpers/console-capture.js";
import { createTempRepo, withCwd, writeAgent, writeSkill } from "../helpers/fs-fixture.js";

describe("commands/validate", () => {
  test("returns false and prints usage when called without name or --all", async () => {
    await withTempRepo(async (root) => {
      const result = await runValidate(root, {});

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toContain("Usage: validate <name> or validate --all");
    });
  });

  test("returns true for --all when both skills and agents directories are missing", async () => {
    await withTempRepo(async (root) => {
      const result = await runValidate(root, { all: true });

      expect(result.ok).toBe(true);
      expect(result.logs.join("\n")).toContain("No skills/ directory found.");
      expect(result.logs.join("\n")).toContain("No agents/ directory found.");
    });
  });

  test("passes for a valid single skill", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit Skill",
      );

      const result = await runValidate(root, { name: "commit" });
      expect(result.ok).toBe(true);
      expect(result.logs.join("\n")).toContain("[PASS] Skill: commit");
    });
  });

  test("fails for a single skill with invalid frontmatter", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "wrong-name", description: "Create commits", license: "MIT" },
        "# Commit Skill",
      );

      const result = await runValidate(root, { name: "commit" });
      const output = result.logs.join("\n");

      expect(result.ok).toBe(false);
      expect(output).toContain("[FAIL] Skill: commit");
      expect(output).toContain("ERROR");
    });
  });

  test("passes for a valid single agent", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      const result = await runValidate(root, { name: "code-reviewer" });
      expect(result.ok).toBe(true);
      expect(result.logs.join("\n")).toContain("[PASS] Agent: code-reviewer");
    });
  });

  test("fails for a single agent with invalid frontmatter", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "", model: "sonnet" },
        "# Reviewer",
      );

      const result = await runValidate(root, { name: "code-reviewer" });
      const output = result.logs.join("\n");

      expect(result.ok).toBe(false);
      expect(output).toContain("[FAIL] Agent: code-reviewer");
      expect(output).toContain("ERROR");
    });
  });

  test("prioritizes skill validation when both skill and agent share the same name", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "shared",
        { name: "shared", description: "Valid shared skill", license: "MIT" },
        "# Shared Skill",
      );
      await writeAgent(
        root,
        "shared",
        { name: "shared", description: "", model: "sonnet" },
        "# Agent",
      );

      const result = await runValidate(root, { name: "shared" });
      const output = result.logs.join("\n");

      expect(result.ok).toBe(true);
      expect(output).toContain("[PASS] Skill: shared");
      expect(output).not.toContain("Agent: shared");
    });
  });

  test("returns false with not found message when name does not match skill or agent", async () => {
    await withTempRepo(async (root) => {
      const result = await runValidate(root, { name: "missing" });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toContain('Not found: skill "missing" or agent "missing"');
    });
  });

  test("fails --all when a skill directory exists but SKILL.md is missing", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills", "orphan"), { recursive: true });

      const result = await runValidate(root, { all: true });

      expect(result.ok).toBe(false);
      expect(result.errors.join("\n")).toContain('Skill "orphan": SKILL.md not found');
    });
  });

  test("keeps result valid when warnings are emitted", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits" },
        "# Commit Skill",
      );

      const result = await runValidate(root, { name: "commit" });
      const output = result.logs.join("\n");

      expect(result.ok).toBe(true);
      expect(output).toContain("[PASS] Skill: commit");
      expect(output).toContain("WARN");
    });
  });
});

async function runValidate(
  root: string,
  opts: { name?: string; all?: boolean },
): Promise<{ ok: boolean; logs: string[]; errors: string[] }> {
  const capture = captureConsole();
  try {
    const ok = await withCwd(root, async () => validate(opts));
    return { ok, logs: capture.logs, errors: capture.errors };
  } finally {
    capture.restore();
  }
}

async function withTempRepo(run: (root: string) => Promise<void>): Promise<void> {
  const tempRepo = await createTempRepo();
  try {
    await run(tempRepo.root);
  } finally {
    await tempRepo.cleanup();
  }
}
