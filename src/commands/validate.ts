import { readdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { AGENTS_DIR, SKILLS_DIR } from "../lib/constants.js";
import { parseAgent, parseSkill } from "../lib/parser.js";
import { validateAgent, validateSkill } from "../lib/validator.js";

interface ValidateOptions {
  name?: string;
  all?: boolean;
}

export async function validate(opts: ValidateOptions): Promise<boolean> {
  const root = resolve(".");
  let allValid = true;

  if (opts.all) {
    // Validate all skills
    const skillsDir = join(root, SKILLS_DIR);
    try {
      const entries = await readdir(skillsDir);
      for (const name of entries) {
        const entryPath = join(skillsDir, name);
        if ((await stat(entryPath)).isDirectory()) {
          const ok = await validateSkillByName(root, name);
          if (!ok) allValid = false;
        }
      }
    } catch {
      console.log("No skills/ directory found.");
    }

    // Validate all agents
    const agentsDir = join(root, AGENTS_DIR);
    try {
      const entries = await readdir(agentsDir);
      for (const name of entries) {
        if (name.endsWith(".md")) {
          const ok = await validateAgentByFile(root, name);
          if (!ok) allValid = false;
        }
      }
    } catch {
      console.log("No agents/ directory found.");
    }
  } else if (opts.name) {
    // Try as skill first, then agent
    const skillPath = join(root, SKILLS_DIR, opts.name, "SKILL.md");
    const agentPath = join(root, AGENTS_DIR, `${opts.name}.md`);

    const skillExists = await Bun.file(skillPath).exists();
    const agentExists = await Bun.file(agentPath).exists();

    if (skillExists) {
      allValid = await validateSkillByName(root, opts.name);
    } else if (agentExists) {
      allValid = await validateAgentByFile(root, `${opts.name}.md`);
    } else {
      console.error(`Not found: skill "${opts.name}" or agent "${opts.name}"`);
      allValid = false;
    }
  } else {
    console.error("Usage: validate <name> or validate --all");
    return false;
  }

  return allValid;
}

async function validateSkillByName(root: string, name: string): Promise<boolean> {
  const filePath = join(root, SKILLS_DIR, name, "SKILL.md");
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    console.error(`  [FAIL] Skill "${name}": SKILL.md not found`);
    return false;
  }

  const content = await file.text();
  try {
    const parsed = parseSkill(content);
    const result = validateSkill(parsed.frontmatter, name);

    if (result.valid) {
      console.log(`  [PASS] Skill: ${name}`);
    } else {
      console.log(`  [FAIL] Skill: ${name}`);
    }
    for (const err of result.errors) {
      console.log(`    ERROR ${err.field}: ${err.message}`);
    }
    for (const warn of result.warnings) {
      console.log(`    WARN  ${warn}`);
    }
    return result.valid;
  } catch (err) {
    console.error(`  [FAIL] Skill "${name}": ${(err as Error).message}`);
    return false;
  }
}

async function validateAgentByFile(root: string, fileName: string): Promise<boolean> {
  const filePath = join(root, AGENTS_DIR, fileName);
  const name = basename(fileName, ".md");
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    console.error(`  [FAIL] Agent "${name}": file not found`);
    return false;
  }

  const content = await file.text();
  try {
    const parsed = parseAgent(content);
    const result = validateAgent(parsed.frontmatter);

    if (result.valid) {
      console.log(`  [PASS] Agent: ${name}`);
    } else {
      console.log(`  [FAIL] Agent: ${name}`);
    }
    for (const err of result.errors) {
      console.log(`    ERROR ${err.field}: ${err.message}`);
    }
    for (const warn of result.warnings) {
      console.log(`    WARN  ${warn}`);
    }
    return result.valid;
  } catch (err) {
    console.error(`  [FAIL] Agent "${name}": ${(err as Error).message}`);
    return false;
  }
}
