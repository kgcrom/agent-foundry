import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli.js";
import type { InstallSelection } from "../src/types.js";

describe("cli install", () => {
  test("returns error for install with extra args", async () => {
    const calls = createCalls();
    const code = await runCli(["install", "--tool", "codex"], createDeps(calls));

    expect(code).toBe(1);
    expect(calls.errors.join("\n")).toContain("Usage: install");
    expect(calls.errors.join("\n")).toContain("interactive TUI only");
    expect(calls.promptCount).toBe(0);
    expect(calls.installs.length).toBe(0);
  });

  test("returns error for install in non-interactive mode", async () => {
    const calls = createCalls();
    const code = await runCli(
      ["install"],
      createDeps(calls, {
        isInteractive: () => false,
      }),
    );

    expect(code).toBe(1);
    expect(calls.errors.join("\n")).toContain("requires an interactive TTY");
    expect(calls.promptCount).toBe(0);
    expect(calls.installs.length).toBe(0);
  });

  test("prompts selection and calls install when install has no args", async () => {
    const calls = createCalls();
    const selection: InstallSelection = {
      kinds: ["skill", "agent"],
      scopes: ["project", "user"],
      tools: ["claude", "codex"],
    };

    const code = await runCli(
      ["install"],
      createDeps(calls, {
        promptInstallSelection: async () => {
          calls.promptCount += 1;
          return selection;
        },
      }),
    );

    expect(code).toBe(0);
    expect(calls.promptCount).toBe(1);
    expect(calls.installs).toEqual([{ selection }]);
  });
});

interface CliCallState {
  promptCount: number;
  installs: Array<{ selection: InstallSelection }>;
  logs: string[];
  errors: string[];
}

function createCalls(): CliCallState {
  return { promptCount: 0, installs: [], logs: [], errors: [] };
}

function createDeps(
  calls: CliCallState,
  overrides: Partial<Parameters<typeof runCli>[1]> = {},
): Parameters<typeof runCli>[1] {
  return {
    validate: async () => true,
    list: async () => {},
    install: async (opts) => {
      calls.installs.push(opts as { selection: InstallSelection });
    },
    runEval: async () => true,
    promptInstallSelection: async () => {
      calls.promptCount += 1;
      return null;
    },
    isInteractive: () => true,
    log: (...args: unknown[]) => calls.logs.push(args.join(" ")),
    error: (...args: unknown[]) => calls.errors.push(args.join(" ")),
    ...overrides,
  };
}
