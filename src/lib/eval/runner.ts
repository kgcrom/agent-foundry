import { join } from "node:path";
import type { EvalCaseResult, EvalDefinition, EvalJudgeMode, EvalRunResult } from "../../types.js";
import { AGENTS_DIR, SKILLS_DIR } from "../constants.js";
import { evaluateAssertion } from "./assertions.js";

interface RunEvaluationOptions {
  root: string;
  definition: EvalDefinition;
  judgeMode: EvalJudgeMode;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export async function runEvaluation(opts: RunEvaluationOptions): Promise<EvalRunResult> {
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const errors: string[] = [];
  const safetyFailures: string[] = [];
  const caseResults: EvalCaseResult[] = [];
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const sourcePath = join(
    opts.root,
    opts.definition.target === "skill" ? SKILLS_DIR : AGENTS_DIR,
    opts.definition.target === "skill"
      ? join(opts.definition.name, "SKILL.md")
      : `${opts.definition.name}.md`,
  );

  const sourceFile = Bun.file(sourcePath);
  if (!(await sourceFile.exists())) {
    errors.push(`Source file not found: ${sourcePath}`);
    const finishedAt = new Date().toISOString();
    return {
      target: opts.definition.target,
      name: opts.definition.name,
      version: opts.definition.version,
      judgeMode: opts.judgeMode,
      startedAt,
      finishedAt,
      overallScore: 0,
      caseResults,
      warnings,
      errors,
      safetyFailures,
      metadata: {
        trace_id: traceId,
        runner_version: "v1",
      },
    };
  }

  const document = await sourceFile.text();

  for (const evalCase of opts.definition.cases) {
    const assertionResults = evalCase.assertions.map((assertion) =>
      evaluateAssertion(
        assertion,
        {
          document,
          input: evalCase.input ?? "",
          expected: evalCase.expected ?? "",
          output: evalCase.output ?? "",
        },
        opts.judgeMode,
      ),
    );

    let weightedScore = 0;
    let totalWeight = 0;

    for (const assertionResult of assertionResults) {
      if (assertionResult.status === "skipped") {
        warnings.push(`case ${evalCase.id}: ${assertionResult.message}`);
        continue;
      }

      weightedScore += assertionResult.score * assertionResult.weight;
      totalWeight += assertionResult.weight;

      if (!assertionResult.pass && (evalCase.tags ?? []).includes("safety")) {
        safetyFailures.push(`${evalCase.id} (${assertionResult.type})`);
      }
    }

    const caseScore = totalWeight === 0 ? 1 : weightedScore / totalWeight;
    if (totalWeight === 0) {
      warnings.push(`case ${evalCase.id}: no scored assertions; defaulting score to 1`);
    }

    caseResults.push({
      id: evalCase.id,
      tags: evalCase.tags ?? [],
      score: roundScore(caseScore),
      assertionResults,
    });
  }

  if (opts.judgeMode === "local-llm") {
    warnings.push("judge=local-llm uses heuristic rubric scoring in v1");
  }

  const overallScore = roundScore(average(caseResults.map((result) => result.score)));
  const finishedAt = new Date().toISOString();

  return {
    target: opts.definition.target,
    name: opts.definition.name,
    version: opts.definition.version,
    judgeMode: opts.judgeMode,
    startedAt,
    finishedAt,
    overallScore,
    caseResults,
    warnings,
    errors,
    safetyFailures,
    metadata: {
      trace_id: traceId,
      runner_version: "v1",
    },
  };
}
