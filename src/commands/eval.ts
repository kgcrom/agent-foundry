import { resolve } from "node:path";
import {
  decideGate,
  readBaseline,
  toBaselineSnapshot,
  writeBaseline,
} from "../lib/eval/baseline.js";
import {
  listEvalTargets,
  loadEvalDefinition,
  resolveEvalTargetByName,
} from "../lib/eval/loader.js";
import { printTerminalReport, writeEvalReport } from "../lib/eval/reporter.js";
import { runEvaluation } from "../lib/eval/runner.js";
import type { EvalJudgeMode } from "../types.js";

interface EvalOptions {
  name?: string;
  all?: boolean;
  updateBaseline?: boolean;
  json?: boolean;
  judge?: EvalJudgeMode;
  root?: string;
}

export async function runEval(opts: EvalOptions): Promise<boolean> {
  const root = resolve(opts.root ?? ".");
  const judgeMode = opts.judge ?? "off";
  let allPassed = true;

  const targets = opts.all
    ? await listEvalTargets(root)
    : opts.name
      ? [await resolveEvalTargetByName(root, opts.name)].filter((v) => v !== null)
      : [];

  if (!opts.all && !opts.name) {
    console.error(
      "Usage: eval <name> | eval --all [--update-baseline] [--json] [--judge off|local-llm]",
    );
    return false;
  }

  if (targets.length === 0) {
    if (opts.name) {
      console.error(`No eval definition found for \"${opts.name}\"`);
    } else {
      console.error("No eval definitions found.");
    }
    return false;
  }

  const entries: Array<{
    run: Awaited<ReturnType<typeof runEvaluation>>;
    gate: ReturnType<typeof decideGate>;
    baseline: Awaited<ReturnType<typeof readBaseline>>;
    baselineUpdated: boolean;
  }> = [];

  for (const targetRef of targets) {
    if (!targetRef) continue;

    try {
      const definition = await loadEvalDefinition(root, targetRef.target, targetRef.name);
      const run = await runEvaluation({ root, definition, judgeMode });
      const baseline = await readBaseline(root, targetRef.target, targetRef.name);
      const gate = decideGate(run, baseline);

      let baselineUpdated = false;
      if (opts.updateBaseline && gate.status !== "fail" && run.errors.length === 0) {
        await writeBaseline(root, toBaselineSnapshot(run));
        baselineUpdated = true;
      }

      if (gate.status === "fail") {
        allPassed = false;
      }

      entries.push({ run, gate, baseline, baselineUpdated });
    } catch (err) {
      allPassed = false;
      console.error(
        `Eval failed for ${targetRef.target}:${targetRef.name} - ${(err as Error).message}`,
      );
    }
  }

  const suffix = opts.all
    ? "all"
    : `${entries[0]?.run.target ?? "target"}-${entries[0]?.run.name ?? "unknown"}`;
  const report = {
    generatedAt: new Date().toISOString(),
    judgeMode,
    entries,
  };
  const reportPath = await writeEvalReport(root, report, suffix);

  if (opts.json) {
    console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  } else {
    printTerminalReport(entries, reportPath);
  }

  return allPassed;
}
