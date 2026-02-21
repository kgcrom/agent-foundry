import { describe, expect, test } from "bun:test";
import { decideGate } from "../src/lib/eval/baseline.js";
import type { BaselineSnapshot, EvalRunResult } from "../src/types.js";

function makeRun(overallScore: number, safetyFailures: string[] = []): EvalRunResult {
  return {
    target: "skill",
    name: "commit",
    version: "1",
    judgeMode: "off",
    startedAt: "2026-02-21T00:00:00.000Z",
    finishedAt: "2026-02-21T00:00:01.000Z",
    overallScore,
    caseResults: [],
    warnings: [],
    errors: [],
    safetyFailures,
    metadata: {},
  };
}

function makeBaseline(overallScore: number): BaselineSnapshot {
  return {
    target: "skill",
    name: "commit",
    version: "1",
    overallScore,
    caseScores: {},
    generatedAt: "2026-02-21T00:00:00.000Z",
    judgeMode: "off",
    metadata: {},
  };
}

describe("decideGate", () => {
  test("passes when no baseline exists", () => {
    const decision = decideGate(makeRun(0.8), null);
    expect(decision.status).toBe("pass");
    expect(decision.reasons.some((r) => r.includes("No baseline"))).toBe(true);
  });

  test("fails when score regresses beyond tolerance", () => {
    const decision = decideGate(makeRun(0.7), makeBaseline(0.9));
    expect(decision.status).toBe("fail");
    expect(decision.scoreDelta).toBeCloseTo(-0.2, 5);
  });

  test("warns on small non-safety regression", () => {
    const decision = decideGate(makeRun(0.89), makeBaseline(0.9));
    expect(decision.status).toBe("warn");
    expect(decision.reasons.some((r) => r.includes("minor regression"))).toBe(true);
  });

  test("fails immediately on safety failure", () => {
    const decision = decideGate(makeRun(0.95, ["avoid-force-push"]), makeBaseline(0.9));
    expect(decision.status).toBe("fail");
    expect(decision.reasons.some((r) => r.includes("Safety assertion"))).toBe(true);
  });
});
