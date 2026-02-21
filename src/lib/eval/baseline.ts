import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BaselineSnapshot, EvalGateDecision, EvalRunResult, EvalTarget } from "../../types.js";
import { EVAL_BASELINES_DIR, MINOR_REGRESSION_TOLERANCE } from "../constants.js";

export function baselinePath(root: string, target: EvalTarget, name: string): string {
  return join(root, EVAL_BASELINES_DIR, target, `${name}.baseline.json`);
}

export async function readBaseline(
  root: string,
  target: EvalTarget,
  name: string,
): Promise<BaselineSnapshot | null> {
  const path = baselinePath(root, target, name);
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  const parsed = JSON.parse(await file.text()) as BaselineSnapshot;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid baseline file: ${path}`);
  }

  return parsed;
}

export function toBaselineSnapshot(run: EvalRunResult): BaselineSnapshot {
  return {
    target: run.target,
    name: run.name,
    version: run.version,
    overallScore: run.overallScore,
    caseScores: Object.fromEntries(run.caseResults.map((result) => [result.id, result.score])),
    generatedAt: run.finishedAt,
    judgeMode: run.judgeMode,
    metadata: {
      ...run.metadata,
    },
  };
}

export async function writeBaseline(root: string, snapshot: BaselineSnapshot): Promise<string> {
  const path = baselinePath(root, snapshot.target, snapshot.name);
  await mkdir(join(root, EVAL_BASELINES_DIR, snapshot.target), { recursive: true });
  await Bun.write(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  return path;
}

export function decideGate(
  run: EvalRunResult,
  baseline: BaselineSnapshot | null,
): EvalGateDecision {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (run.errors.length > 0) {
    reasons.push(`Execution error: ${run.errors.join("; ")}`);
    return { status: "fail", scoreDelta: null, reasons, warnings };
  }

  if (run.safetyFailures.length > 0) {
    reasons.push(`Safety assertion failed: ${run.safetyFailures.join(", ")}`);
    return { status: "fail", scoreDelta: null, reasons, warnings };
  }

  if (!baseline) {
    reasons.push("No baseline found; skipping regression gate");
    return { status: "pass", scoreDelta: null, reasons, warnings };
  }

  const delta = run.overallScore - baseline.overallScore;

  if (delta < 0) {
    const drop = Math.abs(delta);
    if (drop <= MINOR_REGRESSION_TOLERANCE) {
      reasons.push(
        `minor regression detected: ${run.overallScore.toFixed(4)} vs baseline ${baseline.overallScore.toFixed(4)}`,
      );
      warnings.push(`Score drop ${drop.toFixed(4)} is within warning tolerance`);
      return { status: "warn", scoreDelta: delta, reasons, warnings };
    }

    reasons.push(
      `score regression detected: ${run.overallScore.toFixed(4)} vs baseline ${baseline.overallScore.toFixed(4)}`,
    );
    return { status: "fail", scoreDelta: delta, reasons, warnings };
  }

  if (delta > 0) {
    reasons.push(`score improved by ${delta.toFixed(4)} from baseline`);
  } else {
    reasons.push("score unchanged from baseline");
  }

  return { status: "pass", scoreDelta: delta, reasons, warnings };
}
