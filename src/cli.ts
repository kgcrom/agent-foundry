import { runEval } from "./commands/eval.js";
import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { validate } from "./commands/validate.js";
import { TOOL_TARGETS } from "./lib/constants.js";
import type { EvalJudgeMode } from "./types.js";
import type { ToolTarget } from "./types.js";

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case "validate": {
      const isAll = args.includes("--all");
      const name = args.find((a) => !a.startsWith("--") && a !== "validate");
      const ok = await validate({ name, all: isAll });
      if (!ok) process.exit(1);
      break;
    }

    case "list": {
      await list();
      break;
    }

    case "install": {
      const toolIdx = args.indexOf("--tool");
      const tool = toolIdx >= 0 ? args[toolIdx + 1] : undefined;
      if (!tool || !TOOL_TARGETS.includes(tool as ToolTarget)) {
        console.error(`Usage: install --tool <${TOOL_TARGETS.join("|")}>`);
        process.exit(1);
      }
      await install({ tool: tool as ToolTarget });
      break;
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
        console.error(
          "Usage: eval <name>|--all [--judge off|local-llm] [--update-baseline] [--json]",
        );
        process.exit(1);
      }

      const ok = await runEval({ name, all: isAll, updateBaseline, json, judge });
      if (!ok) process.exit(1);
      break;
    }

    default:
      console.log("agent-foundry CLI\n");
      console.log("Commands:");
      console.log("  validate <name>      Validate a skill or agent");
      console.log("  validate --all       Validate all skills and agents");
      console.log("  list                 List all skills and agents");
      console.log("  install --tool <t>   Install to tool-specific paths");
      console.log("  eval <name>          Run eval for one skill/agent");
      console.log("  eval --all           Run evals for all registered targets");
      console.log("  eval --all --update-baseline");
      console.log("                       Update baselines for non-failing eval runs");
      console.log(`                       Tools: ${TOOL_TARGETS.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
