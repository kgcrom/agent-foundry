import type { ToolTarget } from "../types.js";

export const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const NAME_MAX_LENGTH = 64;
export const DESCRIPTION_MAX_LENGTH = 1024;
export const COMPATIBILITY_MAX_LENGTH = 500;

export const SKILLS_DIR = "skills";
export const AGENTS_DIR = "agents";

export const SKILL_INSTALL_PATHS: Record<ToolTarget, string> = {
  "claude-code": ".claude/skills",
  codex: ".agents/skills",
  copilot: ".github/skills",
  antigravity: ".agent/skills",
};

export const AGENT_INSTALL_PATHS: Record<Extract<ToolTarget, "claude-code" | "codex">, string> = {
  "claude-code": ".claude/agents",
  codex: ".codex/agents",
};

export const TOOL_TARGETS: ToolTarget[] = ["claude-code", "codex", "copilot", "antigravity"];
