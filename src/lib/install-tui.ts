import * as p from "@clack/prompts";
import type { InstallKind, InstallScope, InstallSelection, ToolTarget } from "../types.js";
import { TOOL_TARGETS } from "./constants.js";

export async function promptInstallSelection(): Promise<InstallSelection | null> {
  const kinds = await p.multiselect<InstallKind>({
    message: "Select what to install",
    required: true,
    options: [
      { value: "skill", label: "Skill", hint: "Install skills from skills/" },
      { value: "agent", label: "Agent", hint: "Install agents from agents/" },
    ],
  });
  if (p.isCancel(kinds)) {
    p.cancel("Installation cancelled.");
    return null;
  }

  const scopes = await p.multiselect<InstallScope>({
    message: "Select install scope",
    required: true,
    options: [
      { value: "project", label: "Project", hint: "Install under current workspace" },
      { value: "user", label: "User", hint: "Install under home directory (~)" },
    ],
  });
  if (p.isCancel(scopes)) {
    p.cancel("Installation cancelled.");
    return null;
  }

  const tools = await p.multiselect<ToolTarget>({
    message: "Select target tools",
    required: true,
    options: TOOL_TARGETS.map((tool) => ({ value: tool, label: tool })),
  });
  if (p.isCancel(tools)) {
    p.cancel("Installation cancelled.");
    return null;
  }

  return {
    kinds: kinds as InstallKind[],
    scopes: scopes as InstallScope[],
    tools: tools as ToolTarget[],
  };
}
