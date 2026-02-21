import {
  mkdir,
  mkdtemp,
  readFile as nodeReadFile,
  readlink as nodeReadlink,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

type FrontmatterValue = string | number | boolean | null | undefined | FrontmatterMap;

interface FrontmatterMap {
  [key: string]: FrontmatterValue;
}

export interface TempRepo {
  root: string;
  cleanup: () => Promise<void>;
}

export async function createTempRepo(prefix = "agent-foundry-test-"): Promise<TempRepo> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  return {
    root,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function withCwd<T>(cwd: string, fn: () => Promise<T> | T): Promise<T> {
  const originalCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(originalCwd);
  }
}

export async function writeSkill(
  root: string,
  name: string,
  frontmatter: FrontmatterMap,
  body: string,
): Promise<string> {
  const filePath = join(root, "skills", name, "SKILL.md");
  await writeText(filePath, buildMarkdown(frontmatter, body));
  return filePath;
}

export async function writeAgent(
  root: string,
  name: string,
  frontmatter: FrontmatterMap,
  body: string,
): Promise<string> {
  const filePath = join(root, "agents", `${name}.md`);
  await writeText(filePath, buildMarkdown(frontmatter, body));
  return filePath;
}

export async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

export async function readFile(path: string): Promise<string> {
  return nodeReadFile(path, "utf8");
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function readlink(path: string): Promise<string> {
  return nodeReadlink(path);
}

function buildMarkdown(frontmatter: FrontmatterMap, body: string): string {
  return `---\n${stringifyYaml(frontmatter)}\n---\n\n${body}\n`;
}

function stringifyYaml(frontmatter: FrontmatterMap, indent = 0): string {
  const lines: string[] = [];
  const padding = " ".repeat(indent);

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) continue;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${padding}${key}:`);
      const nested = stringifyYaml(value as FrontmatterMap, indent + 2);
      lines.push(nested.length > 0 ? nested : `${" ".repeat(indent + 2)}{}`);
      continue;
    }

    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      lines.push(`${padding}${key}: ${formatScalar(value)}`);
    }
  }

  return lines.join("\n");
}

function formatScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}
