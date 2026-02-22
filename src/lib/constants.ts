import type { EvalAssertionType, ToolTarget } from "../types.js";

export const NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const NAME_MAX_LENGTH = 64;
export const DESCRIPTION_MAX_LENGTH = 1024;
export const COMPATIBILITY_MAX_LENGTH = 500;

export const SKILLS_DIR = "skills";
export const AGENTS_DIR = "agents";
export const EVALS_DIR = "evals";
export const EVAL_MANIFEST_PATH = `${EVALS_DIR}/manifest.json`;
export const EVAL_SKILLS_DIR = `${EVALS_DIR}/skills`;
export const EVAL_AGENTS_DIR = `${EVALS_DIR}/agents`;
export const EVAL_BASELINES_DIR = `${EVALS_DIR}/baselines`;
export const EVAL_REPORTS_DIR = `${EVALS_DIR}/reports`;
export const MINOR_REGRESSION_TOLERANCE = 0.02;
export const EVAL_ASSERTION_TYPES: EvalAssertionType[] = [
  "contains",
  "not_contains",
  "regex",
  "json_schema",
  "llm_rubric",
];

export const SKILL_INSTALL_PATHS: Record<ToolTarget, string> = {
  "claude-code": ".claude/skills",
  codex: ".agents/skills",
  gemini: ".agents/skills",
  copilot: ".github/skills",
  antigravity: ".agent/skills",
};

export const AGENT_INSTALL_PATHS: Record<Extract<ToolTarget, "claude-code" | "codex">, string> = {
  "claude-code": ".claude/agents",
  codex: ".codex/agents",
};

export const TOOL_TARGETS: ToolTarget[] = [
  "claude-code",
  "codex",
  "gemini",
  "copilot",
  "antigravity",
];
