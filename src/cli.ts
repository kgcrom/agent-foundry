import { install } from "./commands/install.js";
import { list } from "./commands/list.js";
import { validate } from "./commands/validate.js";
import { TOOL_TARGETS } from "./lib/constants.js";
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

    default:
      console.log("agent-foundry CLI\n");
      console.log("Commands:");
      console.log("  validate <name>      Validate a skill or agent");
      console.log("  validate --all       Validate all skills and agents");
      console.log("  list                 List all skills and agents");
      console.log("  install --tool <t>   Install to tool-specific paths");
      console.log(`                       Tools: ${TOOL_TARGETS.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
