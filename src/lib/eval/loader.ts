import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  EvalAssertion,
  EvalAssertionType,
  EvalCase,
  EvalDefinition,
  EvalManifest,
  EvalTarget,
} from "../../types.js";
import {
  EVAL_AGENTS_DIR,
  EVAL_ASSERTION_TYPES,
  EVAL_MANIFEST_PATH,
  EVAL_SKILLS_DIR,
} from "../constants.js";

interface EvalTargetRef {
  target: EvalTarget;
  name: string;
}

function ensureObject(value: unknown, pathLabel: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${pathLabel} must be a mapping`);
  }
  return value as Record<string, unknown>;
}

function ensureString(value: unknown, field: string): string {
  if (!value || typeof value !== "string") {
    throw new Error(`${field} is required and must be a string`);
  }
  return value;
}

function ensureOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  return value;
}

function parseAssertion(
  raw: unknown,
  caseId: string,
  index: number,
  sourcePath: string,
): EvalAssertion {
  const pathLabel = `${sourcePath} cases[${caseId}] assertions[${index}]`;
  const data = ensureObject(raw, pathLabel);
  const typeRaw = ensureString(data.type, "assertion type");

  if (!EVAL_ASSERTION_TYPES.includes(typeRaw as EvalAssertionType)) {
    throw new Error(`Unsupported assertion type: ${typeRaw}`);
  }

  const targetRaw = ensureOptionalString(data.target, "assertion target");
  const target = targetRaw === undefined ? undefined : (targetRaw as EvalAssertion["target"]);

  const weightRaw = data.weight;
  let weight: number | undefined;
  if (weightRaw !== undefined) {
    if (typeof weightRaw !== "number" || Number.isNaN(weightRaw) || weightRaw < 0) {
      throw new Error(`assertion weight must be a non-negative number (${pathLabel})`);
    }
    weight = weightRaw;
  }

  const thresholdRaw = data.threshold;
  let threshold: number | undefined;
  if (thresholdRaw !== undefined) {
    if (typeof thresholdRaw !== "number" || Number.isNaN(thresholdRaw)) {
      throw new Error(`assertion threshold must be a number (${pathLabel})`);
    }
    threshold = thresholdRaw;
  }

  return {
    type: typeRaw as EvalAssertionType,
    target,
    value: ensureOptionalString(data.value, "assertion value"),
    pattern: ensureOptionalString(data.pattern, "assertion pattern"),
    flags: ensureOptionalString(data.flags, "assertion flags"),
    rubric: ensureOptionalString(data.rubric, "assertion rubric"),
    weight,
    threshold,
    schema: data.schema as EvalAssertion["schema"],
  };
}

function parseCase(raw: unknown, index: number, sourcePath: string): EvalCase {
  const caseData = ensureObject(raw, `${sourcePath} cases[${index}]`);
  const id = ensureString(caseData.id, "case id");

  if (!Array.isArray(caseData.assertions) || caseData.assertions.length === 0) {
    throw new Error(`case "${id}" assertions must be a non-empty array`);
  }

  const tagsRaw = caseData.tags;
  let tags: EvalCase["tags"];
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw) || tagsRaw.some((tag) => typeof tag !== "string")) {
      throw new Error(`case "${id}" tags must be an array of strings`);
    }
    tags = tagsRaw as EvalCase["tags"];
  }

  return {
    id,
    input: ensureOptionalString(caseData.input, `case "${id}" input`),
    expected: ensureOptionalString(caseData.expected, `case "${id}" expected`),
    output: ensureOptionalString(caseData.output, `case "${id}" output`),
    tags,
    assertions: caseData.assertions.map((assertion, assertionIndex) =>
      parseAssertion(assertion, id, assertionIndex, sourcePath),
    ),
  };
}

export function parseEvalDefinition(content: string, sourcePath = "<inline>"): EvalDefinition {
  const parsed = parseYaml(content);
  const data = ensureObject(parsed, sourcePath);

  const target = ensureString(data.target, "target") as EvalTarget;
  if (target !== "skill" && target !== "agent") {
    throw new Error(`target must be one of: skill, agent (got ${target})`);
  }

  const name = ensureString(data.name, "name");
  const version = ensureString(data.version, "version");

  if (!Array.isArray(data.cases)) {
    throw new Error("cases is required and must be an array");
  }

  const cases = data.cases.map((entry, index) => parseCase(entry, index, sourcePath));

  return {
    target,
    name,
    version,
    cases,
  };
}

export function evalDefinitionPath(root: string, target: EvalTarget, name: string): string {
  return join(root, target === "skill" ? EVAL_SKILLS_DIR : EVAL_AGENTS_DIR, `${name}.eval.yaml`);
}

export async function loadEvalDefinition(
  root: string,
  target: EvalTarget,
  name: string,
): Promise<EvalDefinition> {
  const filePath = evalDefinitionPath(root, target, name);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(`Eval file not found: ${filePath}`);
  }

  const definition = parseEvalDefinition(await file.text(), filePath);
  if (definition.target !== target) {
    throw new Error(
      `Eval target mismatch in ${filePath}: expected ${target}, got ${definition.target}`,
    );
  }
  if (definition.name !== name) {
    throw new Error(`Eval name mismatch in ${filePath}: expected ${name}, got ${definition.name}`);
  }

  return definition;
}

async function loadManifest(root: string): Promise<EvalManifest | null> {
  const manifestFile = Bun.file(join(root, EVAL_MANIFEST_PATH));
  if (!(await manifestFile.exists())) {
    return null;
  }

  const parsed = JSON.parse(await manifestFile.text()) as EvalManifest;
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid manifest at ${join(root, EVAL_MANIFEST_PATH)}`);
  }

  return parsed;
}

function isEvalFileName(name: string): boolean {
  return name.endsWith(".eval.yaml") || name.endsWith(".eval.yml");
}

function stripEvalFileName(name: string): string {
  return name.replace(/\.eval\.ya?ml$/, "");
}

async function listNamesByDirectory(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter(isEvalFileName).map(stripEvalFileName);
  } catch {
    return [];
  }
}

export async function listEvalTargets(root: string): Promise<EvalTargetRef[]> {
  const manifest = await loadManifest(root);
  if (manifest) {
    const items: EvalTargetRef[] = [];
    for (const skillName of manifest.skills ?? []) {
      items.push({ target: "skill", name: skillName });
    }
    for (const agentName of manifest.agents ?? []) {
      items.push({ target: "agent", name: agentName });
    }
    return items;
  }

  const [skillNames, agentNames] = await Promise.all([
    listNamesByDirectory(join(root, EVAL_SKILLS_DIR)),
    listNamesByDirectory(join(root, EVAL_AGENTS_DIR)),
  ]);

  const items: EvalTargetRef[] = [];
  for (const name of skillNames) {
    items.push({ target: "skill", name });
  }
  for (const name of agentNames) {
    items.push({ target: "agent", name });
  }

  return items;
}

export async function resolveEvalTargetByName(
  root: string,
  name: string,
): Promise<EvalTargetRef | null> {
  const skillPath = evalDefinitionPath(root, "skill", name);
  const agentPath = evalDefinitionPath(root, "agent", name);

  const [skillExists, agentExists] = await Promise.all([
    Bun.file(skillPath).exists(),
    Bun.file(agentPath).exists(),
  ]);

  if (skillExists && agentExists) {
    throw new Error(`Ambiguous eval target: both skill and agent evals exist for "${name}"`);
  }
  if (skillExists) return { target: "skill", name };
  if (agentExists) return { target: "agent", name };
  return null;
}
