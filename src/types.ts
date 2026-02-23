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

export type ToolTarget = "claude" | "codex" | "gemini" | "copilot" | "antigravity";

export type InstallKind = "skill" | "agent";
export type InstallScope = "project" | "user";

export interface InstallSelection {
  kinds: InstallKind[];
  scopes: InstallScope[];
  tools: ToolTarget[];
}

export type ItemKind = "skill" | "agent";

export interface ListItem {
  kind: ItemKind;
  name: string;
  description: string;
  path: string;
}

export type EvalTarget = ItemKind;
export type EvalJudgeMode = "off" | "local-llm";
export type EvalAssertionType =
  | "contains"
  | "not_contains"
  | "regex"
  | "json_schema"
  | "llm_rubric";
export type EvalAssertionTarget = "document" | "input" | "expected" | "output";
export type EvalTag = "safety" | "quality" | "format" | "workflow";
export type EvalGateStatus = "pass" | "warn" | "fail";
export type EvalAssertionStatus = "passed" | "failed" | "skipped";

export interface EvalAssertion {
  type: EvalAssertionType;
  target?: EvalAssertionTarget;
  value?: string;
  pattern?: string;
  flags?: string;
  weight?: number;
  threshold?: number;
  rubric?: string;
  schema?: {
    type?: "object";
    required?: string[];
    properties?: Record<string, { type?: "string" | "number" | "boolean" | "object" | "array" }>;
  };
}

export interface EvalCase {
  id: string;
  input?: string;
  expected?: string;
  output?: string;
  tags?: EvalTag[];
  assertions: EvalAssertion[];
}

export interface EvalDefinition {
  target: EvalTarget;
  name: string;
  version: string;
  cases: EvalCase[];
}

export interface EvalAssertionResult {
  type: EvalAssertionType;
  target: EvalAssertionTarget;
  status: EvalAssertionStatus;
  pass: boolean;
  score: number;
  weight: number;
  message: string;
}

export interface EvalCaseResult {
  id: string;
  tags: EvalTag[];
  score: number;
  assertionResults: EvalAssertionResult[];
}

export interface EvalRunResult {
  target: EvalTarget;
  name: string;
  version: string;
  judgeMode: EvalJudgeMode;
  startedAt: string;
  finishedAt: string;
  overallScore: number;
  caseResults: EvalCaseResult[];
  warnings: string[];
  errors: string[];
  safetyFailures: string[];
  metadata: Record<string, string>;
}

export interface EvalGateDecision {
  status: EvalGateStatus;
  scoreDelta: number | null;
  reasons: string[];
  warnings: string[];
}

export interface BaselineSnapshot {
  target: EvalTarget;
  name: string;
  version: string;
  overallScore: number;
  caseScores: Record<string, number>;
  generatedAt: string;
  judgeMode: EvalJudgeMode;
  metadata: Record<string, string>;
}

export interface EvalManifest {
  version: string;
  skills?: string[];
  agents?: string[];
}
