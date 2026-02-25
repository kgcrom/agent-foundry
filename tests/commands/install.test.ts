import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { install } from "../../src/commands/install.js";
import { AGENT_INSTALL_PATHS, SKILL_INSTALL_PATHS } from "../../src/lib/constants.js";
import type { InstallSelection, ToolTarget } from "../../src/types.js";
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
  test("installs skills as symlinks for selected scopes and tools", async () => {
    const tools: ToolTarget[] = ["claude", "codex", "copilot", "antigravity", "gemini"];

    await withTempRepo(async (root) => {
      const home = join(root, ".test-home");
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit",
      );

      await runInstall(
        root,
        {
          kinds: ["skill"],
          scopes: ["project", "user"],
          tools,
        },
        { homeDir: home },
      );

      for (const tool of tools) {
        const projectLink = join(root, SKILL_INSTALL_PATHS[tool], "commit");
        const userLink = join(home, SKILL_INSTALL_PATHS[tool], "commit");

        expect(await exists(projectLink)).toBe(true);
        expect(await exists(userLink)).toBe(true);
        expect(await readlink(projectLink)).toEndWith("/skills/commit");
        expect(await readlink(userLink)).toEndWith("/skills/commit");
      }
    });
  });

  test("prints skip message when skills directory is missing", async () => {
    await withTempRepo(async (root) => {
      const result = await runInstall(root, {
        kinds: ["skill"],
        scopes: ["project"],
        tools: ["copilot"],
      });
      expect(result.logs.join("\n")).toContain(
        "No skills/ directory found. Skipping skill installation.",
      );
    });
  });

  test("prints skip message when skills directory is empty", async () => {
    await withTempRepo(async (root) => {
      await mkdir(join(root, "skills"), { recursive: true });
      const result = await runInstall(root, {
        kinds: ["skill"],
        scopes: ["project"],
        tools: ["copilot"],
      });
      expect(result.logs.join("\n")).toContain(
        "No skills/ directory found. Skipping skill installation.",
      );
    });
  });

  test("installs agents as symlinks for claude in project and user scopes", async () => {
    await withTempRepo(async (root) => {
      const home = join(root, ".test-home");
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      await runInstall(
        root,
        {
          kinds: ["agent"],
          scopes: ["project", "user"],
          tools: ["claude"],
        },
        { homeDir: home },
      );

      const projectLinkPath = join(root, AGENT_INSTALL_PATHS.claude, "code-reviewer.md");
      const userLinkPath = join(home, AGENT_INSTALL_PATHS.claude, "code-reviewer.md");
      expect(await exists(projectLinkPath)).toBe(true);
      expect(await exists(userLinkPath)).toBe(true);
      expect(await readlink(projectLinkPath)).toEndWith("/agents/code-reviewer.md");
      expect(await readlink(userLinkPath)).toEndWith("/agents/code-reviewer.md");
    });
  });

  test("generates codex TOML files for each agent in selected scopes", async () => {
    await withTempRepo(async (root) => {
      const home = join(root, ".test-home");
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

      await runInstall(
        root,
        {
          kinds: ["agent"],
          scopes: ["project", "user"],
          tools: ["codex"],
        },
        { homeDir: home },
      );

      expect(await exists(join(root, ".codex", "agents", "code-reviewer.toml"))).toBe(true);
      expect(await exists(join(root, ".codex", "agents", "planner.toml"))).toBe(true);
      expect(await exists(join(home, ".codex", "agents", "code-reviewer.toml"))).toBe(true);
      expect(await exists(join(home, ".codex", "agents", "planner.toml"))).toBe(true);
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

      await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools: ["codex"],
      });

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
      const home = join(root, ".test-home");
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
      await writeText(
        join(home, ".codex", "config.toml"),
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

      await runInstall(
        root,
        {
          kinds: ["agent"],
          scopes: ["project", "user"],
          tools: ["codex"],
        },
        { homeDir: home },
      );

      const configContent = await readFile(join(root, ".codex", "config.toml"));
      expect(configContent).toContain('default_model = "o1"');
      expect(configContent).toContain("[profiles.fast]");
      expect(configContent).not.toContain("[agents.legacy]");
      expect(configContent).toContain("[agents.code-reviewer]");
      expect(configContent).toContain('config_file = "agents/code-reviewer.toml"');

      const userConfigContent = await readFile(join(home, ".codex", "config.toml"));
      expect(userConfigContent).toContain('default_model = "o1"');
      expect(userConfigContent).toContain("[profiles.fast]");
      expect(userConfigContent).not.toContain("[agents.legacy]");
      expect(userConfigContent).toContain("[agents.code-reviewer]");
      expect(userConfigContent).toContain('config_file = "agents/code-reviewer.toml"');
    });
  });

  test("silently ignores unsupported tools for agent installation", async () => {
    const tools: ToolTarget[] = ["copilot", "antigravity", "gemini"];

    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      const result = await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools,
      });

      expect(result.logs.join("\n")).toBe("");
      expect(await exists(join(root, AGENT_INSTALL_PATHS.claude))).toBe(false);
      expect(await exists(join(root, AGENT_INSTALL_PATHS.codex))).toBe(false);
    });
  });

  test("re-running install keeps existing symlinks intact", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit",
      );

      const selection: InstallSelection = {
        kinds: ["skill"],
        scopes: ["project"],
        tools: ["claude"],
      };

      await runInstall(root, selection);
      await runInstall(root, selection);

      const link = join(root, SKILL_INSTALL_PATHS.claude, "commit");
      expect(await exists(link)).toBe(true);
      expect(await readlink(link)).toEndWith("/skills/commit");
    });
  });

  test("updates symlink when target path changes", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit",
      );

      await runInstall(root, {
        kinds: ["skill"],
        scopes: ["project"],
        tools: ["claude"],
      });

      const link = join(root, SKILL_INSTALL_PATHS.claude, "commit");
      const originalTarget = await readlink(link);
      expect(originalTarget).toEndWith("/skills/commit");

      // Simulate target change by manually pointing symlink elsewhere
      const { unlink, symlink } = await import("node:fs/promises");
      await unlink(link);
      await symlink("/tmp/fake-target", link);
      expect(await readlink(link)).toBe("/tmp/fake-target");

      // Re-install should update to correct target
      await runInstall(root, {
        kinds: ["skill"],
        scopes: ["project"],
        tools: ["claude"],
      });

      expect(await readlink(link)).toBe(originalTarget);
    });
  });

  test("creates codex config.toml from scratch when none exists", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools: ["codex"],
      });

      const configPath = join(root, ".codex", "config.toml");
      expect(await exists(configPath)).toBe(true);

      const content = await readFile(configPath);
      expect(content).toContain("[agents.code-reviewer]");
      expect(content).toContain('description = "Reviews code"');
      expect(content).toContain('config_file = "agents/code-reviewer.toml"');
    });
  });

  test("escapes double quotes in agent description for codex config.toml", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "quoter",
        { name: "quoter", description: 'Says "hello" world', model: "sonnet" },
        "# Quoter",
      );

      await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools: ["codex"],
      });

      const config = await readFile(join(root, ".codex", "config.toml"));
      expect(config).toContain("[agents.quoter]");
      expect(config).toContain('description = "Says \\"hello\\" world"');
    });
  });

  test("escapes triple quotes in agent body for codex TOML", async () => {
    await withTempRepo(async (root) => {
      await writeAgent(
        root,
        "quoter",
        { name: "quoter", description: "Test agent", model: "sonnet" },
        'Use """triple""" quotes here',
      );

      await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools: ["codex"],
      });

      const toml = await readFile(join(root, ".codex", "agents", "quoter.toml"));
      // Triple quotes inside the body must not form an unescaped """ that closes the TOML string
      expect(toml).toContain("developer_instructions");
      expect(toml).not.toMatch(/"""\s*"""\s*"""/);
    });
  });

  test("installs both skills and agents in a single run", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit",
      );
      await writeAgent(
        root,
        "code-reviewer",
        { name: "code-reviewer", description: "Reviews code", model: "sonnet" },
        "# Reviewer",
      );

      await runInstall(root, {
        kinds: ["skill", "agent"],
        scopes: ["project"],
        tools: ["claude"],
      });

      expect(await exists(join(root, SKILL_INSTALL_PATHS.claude, "commit"))).toBe(true);
      expect(await exists(join(root, AGENT_INSTALL_PATHS.claude, "code-reviewer.md"))).toBe(true);
    });
  });

  test("deduplicates repeated tool selections", async () => {
    await withTempRepo(async (root) => {
      await writeSkill(
        root,
        "commit",
        { name: "commit", description: "Create commits", license: "MIT" },
        "# Commit",
      );

      const result = await runInstall(root, {
        kinds: ["skill", "skill"],
        scopes: ["project", "project"],
        tools: ["claude", "claude"],
      });

      // Should only log one install line, not duplicates
      const installLines = result.logs.filter((l) => l.includes('Skill "commit"'));
      expect(installLines).toHaveLength(1);
    });
  });

  test("prints skip message when agents directory is missing", async () => {
    await withTempRepo(async (root) => {
      const result = await runInstall(root, {
        kinds: ["agent"],
        scopes: ["project"],
        tools: ["claude"],
      });
      expect(result.logs.join("\n")).toContain(
        "No agents/ directory found. Skipping agent installation.",
      );
    });
  });

  test("rejects install for codex when agent markdown cannot be parsed", async () => {
    await withTempRepo(async (root) => {
      await writeText(join(root, "agents", "broken.md"), "no frontmatter");

      const capture = captureConsole();
      try {
        await expect(
          withCwd(root, async () => {
            await install({
              selection: {
                kinds: ["agent"],
                scopes: ["project"],
                tools: ["codex"],
              },
            });
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
  selection: InstallSelection,
  options: { homeDir?: string } = {},
): Promise<{ logs: string[]; errors: string[] }> {
  const capture = captureConsole();
  try {
    await withCwd(root, async () => {
      await install({ selection, homeDir: options.homeDir });
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
