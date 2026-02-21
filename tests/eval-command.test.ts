import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEval } from "../src/commands/eval.js";

async function withTempRepo(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "agent-foundry-eval-command-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("runEval", () => {
  test("evaluates one target and updates baseline when requested", async () => {
    await withTempRepo(async (root) => {
      const skillDir = join(root, "skills", "commit");
      const evalDir = join(root, "evals", "skills");
      await mkdir(skillDir, { recursive: true });
      await mkdir(evalDir, { recursive: true });

      await Bun.write(
        join(skillDir, "SKILL.md"),
        "---\nname: commit\ndescription: test\n---\n\nStage files selectively.",
      );

      await Bun.write(
        join(evalDir, "commit.eval.yaml"),
        `target: skill
name: commit
version: "1"
cases:
  - id: stage-rule
    tags: [workflow]
    assertions:
      - type: contains
        target: document
        value: Stage files selectively.
`,
      );

      const ok = await runEval({
        name: "commit",
        updateBaseline: true,
        json: true,
        judge: "off",
        root,
      });

      expect(ok).toBe(true);
      expect(
        await Bun.file(join(root, "evals", "baselines", "skill", "commit.baseline.json")).exists(),
      ).toBe(true);
    });
  });

  test("returns false when target is not found", async () => {
    await withTempRepo(async (root) => {
      const ok = await runEval({ name: "missing", root });
      expect(ok).toBe(false);
    });
  });
});
