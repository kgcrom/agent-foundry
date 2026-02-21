import { parse as parseYaml } from "yaml";
import type { AgentFrontmatter, ParsedDocument, SkillFrontmatter } from "../types.js";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter<T>(content: string): ParsedDocument<T> {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error("No YAML frontmatter found. File must start with --- delimiters.");
  }

  const [, yamlStr, body] = match;
  const frontmatter = parseYaml(yamlStr) as T;

  if (frontmatter === null || typeof frontmatter !== "object") {
    throw new Error("Frontmatter must be a YAML mapping (key-value pairs).");
  }

  return {
    frontmatter,
    body: body.trim(),
    raw: content,
  };
}

export function parseSkill(content: string): ParsedDocument<SkillFrontmatter> {
  return parseFrontmatter<SkillFrontmatter>(content);
}

export function parseAgent(content: string): ParsedDocument<AgentFrontmatter> {
  return parseFrontmatter<AgentFrontmatter>(content);
}
