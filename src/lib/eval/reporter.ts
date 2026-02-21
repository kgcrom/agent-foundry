import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  BaselineSnapshot,
  EvalGateDecision,
  EvalJudgeMode,
  EvalRunResult,
} from "../../types.js";
import { EVAL_REPORTS_DIR } from "../constants.js";

export interface EvalReportEntry {
  run: EvalRunResult;
  gate: EvalGateDecision;
  baseline: BaselineSnapshot | null;
  baselineUpdated: boolean;
}

export interface EvalReportPayload {
  generatedAt: string;
  judgeMode: EvalJudgeMode;
  entries: EvalReportEntry[];
}

function fileSafeTimestamp(value: string): string {
  return value.replace(/[:]/g, "-").replace(/\..+$/, "");
}

export async function writeEvalReport(
  root: string,
  payload: EvalReportPayload,
  suffix: string,
): Promise<string> {
  const reportsDir = join(root, EVAL_REPORTS_DIR);
  await mkdir(reportsDir, { recursive: true });

  const fileName = `${fileSafeTimestamp(payload.generatedAt)}-${suffix}.json`;
  const reportPath = join(reportsDir, fileName);
  await Bun.write(reportPath, `${JSON.stringify(payload, null, 2)}\n`);

  return reportPath;
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "n/a";
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(4)}`;
}

export function printTerminalReport(entries: EvalReportEntry[], reportPath: string): void {
  for (const entry of entries) {
    const status = entry.gate.status.toUpperCase();
    const header = `[${status}] ${entry.run.target}:${entry.run.name} score=${entry.run.overallScore.toFixed(4)} delta=${formatDelta(entry.gate.scoreDelta)}`;
    console.log(header);

    for (const reason of entry.gate.reasons) {
      console.log(`  - ${reason}`);
    }

    for (const warning of [...entry.run.warnings, ...entry.gate.warnings]) {
      console.log(`  WARN ${warning}`);
    }

    if (entry.baselineUpdated) {
      console.log("  Baseline updated");
    }
  }

  console.log(`Report: ${reportPath}`);
}
