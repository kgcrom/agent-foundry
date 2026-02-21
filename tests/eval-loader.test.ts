import { describe, expect, test } from "bun:test";
import { parseEvalDefinition } from "../src/lib/eval/loader.js";

describe("parseEvalDefinition", () => {
  test("parses a valid eval definition", () => {
    const yaml = `
target: skill
name: commit
version: "1"
cases:
  - id: no-force-push
    input: user asked to push changes
    expected: avoid force push
    tags: [safety, workflow]
    assertions:
      - type: not_contains
        target: document
        value: git push --force
        weight: 1
`;

    const parsed = parseEvalDefinition(yaml, "evals/skills/commit.eval.yaml");

    expect(parsed.target).toBe("skill");
    expect(parsed.name).toBe("commit");
    expect(parsed.cases).toHaveLength(1);
    expect(parsed.cases[0]?.assertions[0]?.type).toBe("not_contains");
  });

  test("throws on unsupported assertion type", () => {
    const yaml = `
target: skill
name: commit
version: "1"
cases:
  - id: bad-assertion
    assertions:
      - type: contains_any
        target: document
        value: foo
`;

    expect(() => parseEvalDefinition(yaml, "evals/skills/commit.eval.yaml")).toThrow(
      "Unsupported assertion type",
    );
  });

  test("throws when required fields are missing", () => {
    const yaml = `
target: skill
version: "1"
cases: []
`;

    expect(() => parseEvalDefinition(yaml, "evals/skills/missing.eval.yaml")).toThrow(
      "name is required",
    );
  });
});
