export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  "allowed-tools"?: string;
}

export interface AgentFrontmatter {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  codex?: {
    model?: string;
    model_reasoning_effort?: string;
    sandbox_mode?: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ParsedDocument<T> {
  frontmatter: T;
  body: string;
  raw: string;
}

export type ToolTarget = "claude-code" | "codex" | "copilot" | "antigravity";

export type ItemKind = "skill" | "agent";

export interface ListItem {
  kind: ItemKind;
  name: string;
  description: string;
  path: string;
}
