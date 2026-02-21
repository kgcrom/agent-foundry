import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AGENTS_DIR, SKILLS_DIR } from "../lib/constants.js";
import { parseAgent, parseSkill } from "../lib/parser.js";
import type { ListItem } from "../types.js";

export async function list(): Promise<void> {
  const root = resolve(".");
  const items: ListItem[] = [];

  // Collect skills
  const skillsDir = join(root, SKILLS_DIR);
  try {
    const entries = await readdir(skillsDir);
    for (const name of entries) {
      const entryPath = join(skillsDir, name);
      if (!(await stat(entryPath)).isDirectory()) continue;

      const skillFile = join(skillsDir, name, "SKILL.md");
      const file = Bun.file(skillFile);
      if (!(await file.exists())) continue;

      try {
        const parsed = parseSkill(await file.text());
        items.push({
          kind: "skill",
          name: parsed.frontmatter.name,
          description: parsed.frontmatter.description,
          path: `skills/${name}/SKILL.md`,
        });
      } catch {
        items.push({
          kind: "skill",
          name,
          description: "(parse error)",
          path: `skills/${name}/SKILL.md`,
        });
      }
    }
  } catch {
    // No skills directory
  }

  // Collect agents
  const agentsDir = join(root, AGENTS_DIR);
  try {
    const entries = await readdir(agentsDir);
    for (const name of entries) {
      if (!name.endsWith(".md")) continue;
      const agentFile = join(agentsDir, name);

      try {
        const parsed = parseAgent(await Bun.file(agentFile).text());
        items.push({
          kind: "agent",
          name: parsed.frontmatter.name,
          description: parsed.frontmatter.description,
          path: `agents/${name}`,
        });
      } catch {
        items.push({
          kind: "agent",
          name: name.replace(/\.md$/, ""),
          description: "(parse error)",
          path: `agents/${name}`,
        });
      }
    }
  } catch {
    // No agents directory
  }

  if (items.length === 0) {
    console.log("No skills or agents found.");
    return;
  }

  // Print skills
  const skills = items.filter((i) => i.kind === "skill");
  const agents = items.filter((i) => i.kind === "agent");

  if (skills.length > 0) {
    console.log("Skills:");
    for (const s of skills) {
      const desc = truncate(s.description, 80);
      console.log(`  ${s.name.padEnd(20)} ${desc}`);
    }
  }

  if (agents.length > 0) {
    if (skills.length > 0) console.log();
    console.log("Agents:");
    for (const a of agents) {
      const desc = truncate(a.description, 80);
      console.log(`  ${a.name.padEnd(20)} ${desc}`);
    }
  }
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 3)}...`;
}
