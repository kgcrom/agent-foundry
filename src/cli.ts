import { runEval } from "./commands/eval.js";
import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { validate } from "./commands/validate.js";
import { TOOL_TARGETS } from "./lib/constants.js";
import { promptInstallSelection } from "./lib/install-tui.js";
import type { EvalJudgeMode } from "./types.js";
import type { InstallSelection, ToolTarget } from "./types.js";

interface CliDependencies {
  validate: typeof validate;
  list: typeof list;
  install: typeof install;
  runEval: typeof runEval;
  promptInstallSelection: () => Promise<InstallSelection | null>;
  isInteractive: () => boolean;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const defaultDeps: CliDependencies = {
  validate,
  list,
  install,
  runEval,
  promptInstallSelection,
  isInteractive: () => Boolean(process.stdin.isTTY && process.stdout.isTTY),
  log: (...args: unknown[]) => console.log(...args),
  error: (...args: unknown[]) => console.error(...args),
};

export async function runCli(args: string[], deps: Partial<CliDependencies> = {}): Promise<number> {
  const d = { ...defaultDeps, ...deps };
  const command = args[0];

  switch (command) {
    case "validate": {
      const isAll = args.includes("--all");
      const name = args.find((a) => !a.startsWith("--") && a !== "validate");
      const ok = await d.validate({ name, all: isAll });
      return ok ? 0 : 1;
    }

    case "list": {
      await d.list();
      return 0;
    }

    case "install": {
      if (args.length > 1) {
        d.error("Usage: install");
        d.error("install command supports interactive TUI only.");
        return 1;
      }

      if (!d.isInteractive()) {
        d.error("install command requires an interactive TTY.");
        return 1;
      }

      const selection = await d.promptInstallSelection();
      if (!selection) {
        return 0;
      }

      await d.install({ selection });
      return 0;
    }

    case "eval": {
      const isAll = args.includes("--all");
      const updateBaseline = args.includes("--update-baseline");
      const json = args.includes("--json");
      const judgeIdx = args.indexOf("--judge");
      const judge = judgeIdx >= 0 ? (args[judgeIdx + 1] as EvalJudgeMode | undefined) : undefined;
      const name = args.find(
        (a) =>
          !a.startsWith("--") &&
          a !== "eval" &&
          a !== "off" &&
          a !== "local-llm" &&
          !TOOL_TARGETS.includes(a as ToolTarget),
      );

      if (judge && judge !== "off" && judge !== "local-llm") {
        d.error("Usage: eval <name>|--all [--judge off|local-llm] [--update-baseline] [--json]");
        return 1;
      }

      const ok = await d.runEval({ name, all: isAll, updateBaseline, json, judge });
      return ok ? 0 : 1;
    }

    default:
      d.log("agent-foundry CLI\n");
      d.log("Commands:");
      d.log("  validate <name>      Validate a skill or agent");
      d.log("  validate --all       Validate all skills and agents");
      d.log("  list                 List all skills and agents");
      d.log("  install              Interactive TUI install flow");
      d.log("  eval <name>          Run eval for one skill/agent");
      d.log("  eval --all           Run evals for all registered targets");
      d.log("  eval --all --update-baseline");
      d.log("                       Update baselines for non-failing eval runs");
      d.log(`                       Tools: ${TOOL_TARGETS.join(", ")}`);
      return 0;
  }
}

async function main(): Promise<void> {
  const code = await runCli(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
