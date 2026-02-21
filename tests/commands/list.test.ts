import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { list } from "../../src/commands/list.js";
import { captureConsole } from "../helpers/console-capture.js";
import { createTempRepo, withCwd, writeAgent, writeSkill } from "../helpers/fs-fixture.js";

describe("commands/list", () => {
  test("prints empty message when no skills or agents are found", async () => {
    await withTempRepo(async (root) => {
      const result = await runList(root);
      expect(result.logs.join("\n")).toContain("No skills or agents found.");
    });
  });

  test("prints skills and agents sections for valid entries", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit\n\nInstructions.",
      );
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Code Reviewer\n\nReview instructions.",
      );

      const result = await runList(root);
      const output = result.logs.join("\n");

      expect(output).toContain("Skills:");
      expect(output).toContain("Agents:");
      expect(output).toContain("commit");
      expect(output).toContain("code-reviewer");
    });
  });

  test("falls back to parse error for invalid skill frontmatter", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills", "broken"), { recursive: true });
      await writeFile(join(root, "skills", "broken", "SKILL.md"), "not frontmatter", "utf8");

      const result = await runList(root);
      const output = result.logs.join("\n");

      expect(output).toContain("broken");
      expect(output).toContain("(parse error)");
    });
  });

  test("falls back to parse error for invalid agent frontmatter", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "agents"), { recursive: true });
      await writeFile(join(root, "agents", "broken.md"), "no frontmatter", "utf8");

      const result = await runList(root);
      const output = result.logs.join("\n");

      expect(output).toContain("Agents:");
      expect(output).toContain("broken");
      expect(output).toContain("(parse error)");
    });
  });

  test("wraps long descriptions to fit terminal width", async () => {
    const originalColumns = process.stdout.columns;
    const originalEnvColumns = process.env.COLUMNS;
    process.stdout.columns = 80;
    process.env.COLUMNS = "80";

    try {
      await withTempRepo(async (root) => {
        await writeSkill(
          root,
          "long-skill",
          {
            name: "long-skill",
            description:
              "This is a very long skill description that should be wrapped in list output for readability.",
          },
          "# Long Skill",
        );

        const result = await runList(root);
        const lines = result.logs.join("\n").split("\n");
        const firstLineIndex = lines.findIndex((line) => line.includes("long-skill"));

        expect(firstLineIndex).toBeGreaterThanOrEqual(0);
        expect(lines[firstLineIndex + 1]?.startsWith(" ".repeat(16))).toBe(true);

        for (const line of lines) {
          expect(line.length).toBeLessThanOrEqual(80);
        }
      });
    } finally {
      process.stdout.columns = originalColumns;
      if (originalEnvColumns === undefined) {
        delete process.env.COLUMNS;
      } else {
        process.env.COLUMNS = originalEnvColumns;
      }
    }
  });

  test("ignores non-directory entries under skills", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills"), { recursive: true });
      await writeFile(join(root, "skills", "README.txt"), "not a directory", "utf8");

      const result = await runList(root);
      expect(result.logs.join("\n")).toContain("No skills or agents found.");
    });
  });

  test("ignores skill directories missing SKILL.md", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills", "empty-skill"), { recursive: true });

      const result = await runList(root);
      expect(result.logs.join("\n")).toContain("No skills or agents found.");
    });
  });

  test("ignores non-markdown files under agents", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "agents"), { recursive: true });
      await writeFile(join(root, "agents", "notes.txt"), "not markdown", "utf8");

      const result = await runList(root);
      expect(result.logs.join("\n")).toContain("No skills or agents found.");
    });
  });
});

async function runList(root: string): Promise<{ logs: string[]; errors: string[] }> {
  const capture = captureConsole();
  try {
    await withCwd(root, async () => {
      await list();
    });
    return { logs: capture.logs, errors: capture.errors };
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
