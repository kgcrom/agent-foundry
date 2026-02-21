import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runEvaluation } from "../src/lib/eval/runner.js";
import type { EvalDefinition } from "../src/types.js";

async function withTempRepo(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "agent-foundry-eval-runner-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("runEvaluation", () => {
  test("evaluates rule assertions against source document", async () => {
    await withTempRepo(async (root) => {
      const skillDir = join(root, "skills", "commit");
      await mkdir(skillDir, { recursive: true });
      await Bun.write(
        join(skillDir, "SKILL.md"),
        "---\nname: commit\ndescription: test\n---\n\nNever use git push --force.",
      );

      const definition: EvalDefinition = {
        target: "skill",
        name: "commit",
        version: "1",
        cases: [
          {
            id: "contains-never",
            tags: ["safety"],
            assertions: [
              { type: "contains", target: "document", value: "Never use", weight: 1 },
              { type: "not_contains", target: "document", value: "rm -rf", weight: 1 },
            ],
          },
        ],
      };

      const result = await runEvaluation({ root, definition, judgeMode: "off" });

      expect(result.errors).toHaveLength(0);
      expect(result.caseResults).toHaveLength(1);
      expect(result.caseResults[0]?.score).toBe(1);
      expect(result.overallScore).toBe(1);
      expect(result.safetyFailures).toHaveLength(0);
    });
  });

  test("marks safety failures when a safety-tagged assertion fails", async () => {
    await withTempRepo(async (root) => {
      const skillDir = join(root, "skills", "commit");
      await mkdir(skillDir, { recursive: true });
      await Bun.write(
        join(skillDir, "SKILL.md"),
        "---\nname: commit\ndescription: test\n---\n\nUse git push --force to overwrite history.",
      );

      const definition: EvalDefinition = {
        target: "skill",
        name: "commit",
        version: "1",
        cases: [
          {
            id: "avoid-force-push",
            tags: ["safety"],
            assertions: [{ type: "not_contains", target: "document", value: "git push --force" }],
          },
        ],
      };

      const result = await runEvaluation({ root, definition, judgeMode: "off" });

      expect(result.overallScore).toBe(0);
      expect(result.safetyFailures).toHaveLength(1);
      expect(result.caseResults[0]?.assertionResults[0]?.pass).toBe(false);
    });
  });

  test("skips llm_rubric assertions when judge mode is off", async () => {
    await withTempRepo(async (root) => {
      const agentDir = join(root, "agents");
      await mkdir(agentDir, { recursive: true });
      await Bun.write(
        join(agentDir, "code-reviewer.md"),
        "---\nname: code-reviewer\ndescription: test\n---\n\nReview code carefully.",
      );

      const definition: EvalDefinition = {
        target: "agent",
        name: "code-reviewer",
        version: "1",
        cases: [
          {
            id: "rubric-skip",
            tags: ["quality"],
            assertions: [
              { type: "llm_rubric", target: "document", rubric: "Is it clear?", weight: 1 },
            ],
          },
        ],
      };

      const result = await runEvaluation({ root, definition, judgeMode: "off" });

      expect(result.caseResults[0]?.assertionResults[0]?.status).toBe("skipped");
      expect(result.caseResults[0]?.score).toBe(1);
      expect(result.warnings.some((w) => w.includes("llm_rubric"))).toBe(true);
    });
  });
});
