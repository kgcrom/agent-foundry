import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { install } from "../../src/commands/install.js";
import { AGENT_INSTALL_PATHS, SKILL_INSTALL_PATHS } from "../../src/lib/constants.js";
import type { ToolTarget } from "../../src/types.js";
import { captureConsole } from "../helpers/console-capture.js";
import {
  createTempRepo,
  exists,
  readFile,
  readlink,
  withCwd,
  writeAgent,
  writeSkill,
  writeText,
} from "../helpers/fs-fixture.js";

describe("commands/install", () => {
  test("installs skills as symlinks for every tool target", async () => {
    const tools: ToolTarget[] = ["claude-code", "codex", "copilot", "antigravity", "gemini"];

    for (const tool of tools) {
      await withTempRepo(async (root) => {
        await writeSkill(
          root,
          "commit",
          { name: "commit", description: "Create commits", license: "MIT" },
          "# Commit",
        );

        await runInstall(root, tool);

        const linkPath = join(root, SKILL_INSTALL_PATHS[tool], "commit");
        expect(await exists(linkPath)).toBe(true);
        expect(await readlink(linkPath)).toEndWith("/skills/commit");
      });
    }
  });

  test("prints skip message when skills directory is missing", async () => {
    await withTempRepo(async (root) => {
      const result = await runInstall(root, "copilot");
      expect(result.logs.join("\n")).toContain(
        "No skills/ directory found. Skipping skill installation.",
      );
    });
  });

  test("prints skip message when skills directory is empty", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills"), { recursive: true });
      const result = await runInstall(root, "copilot");
      expect(result.logs.join("\n")).toContain(
        "No skills/ directory found. Skipping skill installation.",
      );
    });
  });

  test("installs agents as symlinks for claude-code", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      await runInstall(root, "claude-code");

      const linkPath = join(root, AGENT_INSTALL_PATHS["claude-code"], "code-reviewer.md");
      expect(await exists(linkPath)).toBe(true);
      expect(await readlink(linkPath)).toEndWith("/agents/code-reviewer.md");
    });
  });

  test("generates codex TOML files for each agent", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );
      await writeAgent(
        root,
        "planner",
        { name: "planner", description: "Plans implementation", model: "sonnet" },
        "# Planner",
      );

      await runInstall(root, "codex");

      expect(await exists(join(root, ".codex", "agents", "code-reviewer.toml"))).toBe(true);
      expect(await exists(join(root, ".codex", "agents", "planner.toml"))).toBe(true);
    });
  });

  test("writes codex overrides and developer_instructions to TOML", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        {
          name: "code-reviewer",
          description: "Reviews code",
          model: "sonnet",
          codex: {
            model: "o3",
            model_reasoning_effort: "high",
            sandbox_mode: "read-only",
          },
        },
        "# Reviewer\n\nPath C:\\work",
      );

      await runInstall(root, "codex");

      const tomlContent = await readFile(join(root, ".codex", "agents", "code-reviewer.toml"));

      expect(tomlContent).toContain('model = "o3"');
      expect(tomlContent).toContain('model_reasoning_effort = "high"');
      expect(tomlContent).toContain('sandbox_mode = "read-only"');
      expect(tomlContent).toContain('developer_instructions = """');
      expect(tomlContent).toContain("Path C:\\\\work");
    });
  });

  test("preserves non-agent sections and replaces existing [agents.*] sections in codex config", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );
      await writeText(
        join(root, ".codex", "config.toml"),
        [
          'default_model = "o1"',
          "",
          "[profiles.fast]",
          'sandbox_mode = "read-only"',
          "",
          "[agents.legacy]",
          'description = "Legacy agent"',
          'config_file = "agents/legacy.toml"',
          "",
        ].join("\n"),
      );

      await runInstall(root, "codex");

      const configContent = await readFile(join(root, ".codex", "config.toml"));
      expect(configContent).toContain('default_model = "o1"');
      expect(configContent).toContain("[profiles.fast]");
      expect(configContent).not.toContain("[agents.legacy]");
      expect(configContent).toContain("[agents.code-reviewer]");
      expect(configContent).toContain('config_file = "agents/code-reviewer.toml"');
    });
  });

  test("skips agent installation for copilot, antigravity, and gemini", async () => {
    const tools: ToolTarget[] = ["copilot", "antigravity", "gemini"];

    for (const tool of tools) {
      await withTempRepo(async (root) => {
        await writeAgent(
          root,
          "code-reviewer",
          { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
          "# Reviewer",
        );

        const result = await runInstall(root, tool);
        const output = result.logs.join("\n");

        expect(output).not.toContain("Agent");
        expect(await exists(join(root, AGENT_INSTALL_PATHS["claude-code"]))).toBe(false);
        expect(await exists(join(root, AGENT_INSTALL_PATHS.codex))).toBe(false);
      });
    }
  });

  test("rejects install for codex when agent markdown cannot be parsed", async () => {
    await withTempRepo(async (root) => {
      await writeText(join(root, "agents", "broken.md"), "no frontmatter");

      const capture = captureConsole();
      try {
        await expect(
          withCwd(root, async () => {
            await install({ tool: "codex" });
          }),
        ).rejects.toThrow("No YAML frontmatter found");
      } finally {
        capture.restore();
      }
    });
  });
});

async function runInstall(
  root: string,
  tool: ToolTarget,
): Promise<{ logs: string[]; errors: string[] }> {
  const capture = captureConsole();
  try {
    await withCwd(root, async () => {
      await install({ tool });
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
