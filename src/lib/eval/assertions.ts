import type {
  EvalAssertion,
  EvalAssertionResult,
  EvalAssertionTarget,
  EvalJudgeMode,
} from "../../types.js";

interface EvalAssertionContext {
  document: string;
  input: string;
  expected: string;
  output: string;
}

function normalizeWeight(weight: number | undefined): number {
  if (weight === undefined) return 1;
  if (weight < 0 || Number.isNaN(weight)) return 1;
  return weight;
}

function evaluateJsonSchema(
  input: unknown,
  schema: EvalAssertion["schema"],
): { pass: boolean; message: string } {
  if (!schema) {
    return { pass: false, message: "json_schema assertion requires a schema field" };
  }

  if (schema.type && schema.type !== "object") {
    return { pass: false, message: `json_schema type \"${schema.type}\" is not supported in v1` };
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { pass: false, message: "input is not a JSON object" };
  }

  const record = input as Record<string, unknown>;

  for (const requiredKey of schema.required ?? []) {
    if (!(requiredKey in record)) {
      return { pass: false, message: `missing required key: ${requiredKey}` };
    }
  }

  for (const [key, shape] of Object.entries(schema.properties ?? {})) {
    if (!(key in record) || !shape.type) continue;
    const value = record[key];

    if (shape.type === "array" && !Array.isArray(value)) {
      return { pass: false, message: `key ${key} is not an array` };
    }

    if (
      shape.type === "object" &&
      (typeof value !== "object" || value === null || Array.isArray(value))
    ) {
      return { pass: false, message: `key ${key} is not an object` };
    }

    if (shape.type === "string" && typeof value !== "string") {
      return { pass: false, message: `key ${key} is not a string` };
    }

    if (shape.type === "number" && typeof value !== "number") {
      return { pass: false, message: `key ${key} is not a number` };
    }

    if (shape.type === "boolean" && typeof value !== "boolean") {
      return { pass: false, message: `key ${key} is not a boolean` };
    }
  }

  return { pass: true, message: "json_schema assertion passed" };
}

function buildResult(
  assertion: EvalAssertion,
  target: EvalAssertionTarget,
  status: EvalAssertionResult["status"],
  pass: boolean,
  score: number,
  message: string,
): EvalAssertionResult {
  return {
    type: assertion.type,
    target,
    status,
    pass,
    score,
    weight: normalizeWeight(assertion.weight),
    message,
  };
}

export function evaluateAssertion(
  assertion: EvalAssertion,
  context: EvalAssertionContext,
  judgeMode: EvalJudgeMode,
): EvalAssertionResult {
  const target = assertion.target ?? "document";
  const haystack = context[target] ?? "";

  switch (assertion.type) {
    case "contains": {
      const needle = assertion.value ?? "";
      const pass = needle.length > 0 && haystack.includes(needle);
      return buildResult(
        assertion,
        target,
        pass ? "passed" : "failed",
        pass,
        pass ? 1 : 0,
        pass ? `contains matched: ${needle}` : `missing required content: ${needle}`,
      );
    }

    case "not_contains": {
      const needle = assertion.value ?? "";
      const pass = needle.length > 0 ? !haystack.includes(needle) : true;
      return buildResult(
        assertion,
        target,
        pass ? "passed" : "failed",
        pass,
        pass ? 1 : 0,
        pass ? `forbidden content absent: ${needle}` : `forbidden content found: ${needle}`,
      );
    }

    case "regex": {
      const patternSource = assertion.pattern ?? assertion.value;
      if (!patternSource) {
        return buildResult(
          assertion,
          target,
          "failed",
          false,
          0,
          "regex assertion missing pattern",
        );
      }

      try {
        const regex = new RegExp(patternSource, assertion.flags);
        const pass = regex.test(haystack);
        return buildResult(
          assertion,
          target,
          pass ? "passed" : "failed",
          pass,
          pass ? 1 : 0,
          pass
            ? `regex matched: /${patternSource}/${assertion.flags ?? ""}`
            : `regex did not match: /${patternSource}/${assertion.flags ?? ""}`,
        );
      } catch (err) {
        return buildResult(
          assertion,
          target,
          "failed",
          false,
          0,
          `invalid regex: ${(err as Error).message}`,
        );
      }
    }

    case "json_schema": {
      try {
        const parsed = JSON.parse(haystack);
        const result = evaluateJsonSchema(parsed, assertion.schema);
        return buildResult(
          assertion,
          target,
          result.pass ? "passed" : "failed",
          result.pass,
          result.pass ? 1 : 0,
          result.message,
        );
      } catch {
        return buildResult(
          assertion,
          target,
          "failed",
          false,
          0,
          "target content is not valid JSON",
        );
      }
    }

    case "llm_rubric": {
      if (judgeMode === "off") {
        return buildResult(
          assertion,
          target,
          "skipped",
          true,
          1,
          "llm_rubric skipped because judge mode is off",
        );
      }

      const rubric = assertion.rubric ?? assertion.value ?? "";
      if (!rubric.trim()) {
        return buildResult(
          assertion,
          target,
          "failed",
          false,
          0,
          "llm_rubric requires rubric text",
        );
      }

      const keywords = rubric
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4);

      if (keywords.length === 0) {
        const pass = haystack.trim().length > 0;
        return buildResult(
          assertion,
          target,
          pass ? "passed" : "failed",
          pass,
          pass ? 1 : 0,
          "local-llm rubric fallback used (no rubric keywords)",
        );
      }

      const text = haystack.toLowerCase();
      const matches = keywords.filter((keyword) => text.includes(keyword)).length;
      const score = matches / keywords.length;
      const threshold = assertion.threshold ?? 0.6;
      const pass = score >= threshold;

      return buildResult(
        assertion,
        target,
        pass ? "passed" : "failed",
        pass,
        score,
        `local-llm heuristic score ${score.toFixed(3)} (threshold ${threshold.toFixed(3)})`,
      );
    }
  }
}
