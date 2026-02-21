import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { AGENTS_DIR, SKILLS_DIR } from "../lib/constants.js";
import { parseAgent, parseSkill } from "../lib/parser.js";
import type { ListItem } from "../types.js";

const DEFAULT_TERMINAL_WIDTH = 80;
const MIN_TERMINAL_WIDTH = 40;
const INDENT = 2;
const GAP = 2;
const MIN_NAME_COL = 12;
const MAX_NAME_COL = 24;
const MIN_DESC_COL = 20;

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

  const terminalWidth = resolveTerminalWidth(process.stdout.columns, process.env.COLUMNS);
  console.log(formatListOutput(items, { terminalWidth }));
}

export function resolveTerminalWidth(stdoutColumns?: number, envColumns?: string): number {
  if (isPositiveInteger(stdoutColumns)) {
    return Math.max(stdoutColumns, MIN_TERMINAL_WIDTH);
  }

  if (envColumns) {
    const parsed = Number.parseInt(envColumns, 10);
    if (isPositiveInteger(parsed)) {
      return Math.max(parsed, MIN_TERMINAL_WIDTH);
    }
  }

  return DEFAULT_TERMINAL_WIDTH;
}

export function formatListOutput(
  items: ListItem[],
  options: { terminalWidth?: number } = {},
): string {
  if (items.length === 0) {
    return "No skills or agents found.";
  }

  const terminalWidth =
    options.terminalWidth && Number.isInteger(options.terminalWidth) && options.terminalWidth > 0
      ? options.terminalWidth
      : DEFAULT_TERMINAL_WIDTH;

  const skills = items.filter((item) => item.kind === "skill");
  const agents = items.filter((item) => item.kind === "agent");
  const lines: string[] = [];

  if (skills.length > 0) {
    lines.push("Skills:");
    lines.push(...formatSection(skills, terminalWidth));
  }

  if (agents.length > 0) {
    if (skills.length > 0) lines.push("");
    lines.push("Agents:");
    lines.push(...formatSection(agents, terminalWidth));
  }

  return lines.join("\n");
}

function formatSection(items: ListItem[], terminalWidth: number): string[] {
  const lines: string[] = [];
  const indent = " ".repeat(INDENT);
  const gap = " ".repeat(GAP);

  const maxNameWidth = Math.max(...items.map((item) => getDisplayWidth(item.name)));
  let nameCol = clamp(maxNameWidth, MIN_NAME_COL, MAX_NAME_COL);
  let descCol = terminalWidth - INDENT - nameCol - GAP;

  if (descCol < MIN_DESC_COL) {
    const maxAllowedNameCol = terminalWidth - INDENT - GAP - MIN_DESC_COL;
    nameCol = Math.max(MIN_NAME_COL, Math.min(nameCol, maxAllowedNameCol));
    descCol = terminalWidth - INDENT - nameCol - GAP;
  }

  const useBlockFallback = descCol < MIN_DESC_COL || terminalWidth <= MIN_TERMINAL_WIDTH;

  if (useBlockFallback) {
    const descIndent = " ".repeat(INDENT * 2);
    const descWidth = Math.max(1, terminalWidth - INDENT * 2);
    for (const item of items) {
      lines.push(`${indent}${item.name}`);
      const wrappedDesc = wrapText(normalizeText(item.description), descWidth);
      for (const line of wrappedDesc) {
        lines.push(`${descIndent}${line}`);
      }
    }
    return lines;
  }

  const continuationIndent = " ".repeat(INDENT + nameCol + GAP);
  for (const item of items) {
    const normalizedDesc = normalizeText(item.description);
    const wrappedDesc = wrapText(normalizedDesc, descCol);
    const [firstLine, ...restLines] = wrappedDesc;
    const nameCell = padEndDisplay(truncateDisplay(item.name, nameCol), nameCol);
    lines.push(`${indent}${nameCell}${gap}${firstLine ?? ""}`);
    for (const line of restLines) {
      lines.push(`${continuationIndent}${line}`);
    }
  }

  return lines;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(value: string, maxWidth: number): string[] {
  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return [""];
  }

  const safeMaxWidth = Math.max(1, maxWidth);
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const word of words) {
    const wordWidth = getDisplayWidth(word);

    if (currentWidth === 0) {
      if (wordWidth <= safeMaxWidth) {
        current = word;
        currentWidth = wordWidth;
        continue;
      }

      const chunks = hardWrapWord(word, safeMaxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] ?? "";
      currentWidth = getDisplayWidth(current);
      continue;
    }

    const candidateWidth = currentWidth + 1 + wordWidth;
    if (candidateWidth <= safeMaxWidth) {
      current = `${current} ${word}`;
      currentWidth = candidateWidth;
      continue;
    }

    lines.push(current);
    if (wordWidth <= safeMaxWidth) {
      current = word;
      currentWidth = wordWidth;
      continue;
    }

    const chunks = hardWrapWord(word, safeMaxWidth);
    lines.push(...chunks.slice(0, -1));
    current = chunks[chunks.length - 1] ?? "";
    currentWidth = getDisplayWidth(current);
  }

  if (current.length > 0 || lines.length === 0) {
    lines.push(current);
  }

  return lines;
}

function hardWrapWord(value: string, maxWidth: number): string[] {
  const safeMaxWidth = Math.max(1, maxWidth);
  const chunks: string[] = [];
  let current = "";
  let currentWidth = 0;

  for (const char of value) {
    const charWidth = getCharDisplayWidth(char);
    if (currentWidth > 0 && currentWidth + charWidth > safeMaxWidth) {
      chunks.push(current);
      current = char;
      currentWidth = charWidth;
      continue;
    }

    if (currentWidth === 0 && charWidth > safeMaxWidth) {
      chunks.push(char);
      continue;
    }

    current += char;
    currentWidth += charWidth;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [""];
}

function truncateDisplay(value: string, maxWidth: number): string {
  if (getDisplayWidth(value) <= maxWidth) {
    return value;
  }

  const ellipsis = "...";
  const ellipsisWidth = getDisplayWidth(ellipsis);
  if (maxWidth <= ellipsisWidth) {
    return ellipsis.slice(0, Math.max(0, maxWidth));
  }

  let out = "";
  let outWidth = 0;
  const limit = maxWidth - ellipsisWidth;
  for (const char of value) {
    const charWidth = getCharDisplayWidth(char);
    if (outWidth + charWidth > limit) {
      break;
    }
    out += char;
    outWidth += charWidth;
  }

  return `${out}${ellipsis}`;
}

function padEndDisplay(value: string, width: number): string {
  const padding = Math.max(0, width - getDisplayWidth(value));
  return `${value}${" ".repeat(padding)}`;
}

function getDisplayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += getCharDisplayWidth(char);
  }
  return width;
}

function getCharDisplayWidth(char: string): number {
  const codePoint = char.codePointAt(0) ?? 0;

  if (codePoint === 0) return 0;
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  if (isCombiningMark(codePoint)) return 0;
  if (isFullWidthCodePoint(codePoint)) return 2;

  return 1;
}

function isCombiningMark(codePoint: number): boolean {
  return (
    (codePoint >= 0x0300 && codePoint <= 0x036f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff) ||
    (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
  );
}

function isFullWidthCodePoint(codePoint: number): boolean {
  if (codePoint >= 0x1f300 && codePoint <= 0x1faff) return true;

  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0x3247 && codePoint !== 0x303f) ||
      (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
      (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
      (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1b000 && codePoint <= 0x1b001) ||
      (codePoint >= 0x1f200 && codePoint <= 0x1f251) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
