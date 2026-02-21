import { describe, expect, test } from "bun:test";
import { formatListOutput, resolveTerminalWidth } from "../src/commands/list.js";
import type { ListItem } from "../src/types.js";

function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (isWideCodePoint(codePoint)) {
      width += 2;
      continue;
    }
    width += 1;
  }
  return width;
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

describe("formatListOutput", () => {
  test("wraps long English descriptions and keeps continuation alignment at width 80", () => {
    const items: ListItem[] = [
      {
        kind: "skill",
        name: "commit",
        description:
          "Create well-structured git commits following Conventional Commits and include useful context for reviewers when a change is non-trivial.",
        path: "skills/commit/SKILL.md",
      },
    ];

    const output = formatListOutput(items, { terminalWidth: 80 });
    const lines = output.split("\n");

    expect(lines[0]).toBe("Skills:");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[2].startsWith(" ".repeat(16))).toBe(true);

    for (const line of lines) {
      expect(displayWidth(line)).toBeLessThanOrEqual(80);
    }
  });

  test("wraps Korean descriptions without overflowing width 80", () => {
    const items: ListItem[] = [
      {
        kind: "agent",
        name: "code-reviewer",
        description:
          "코드 변경사항을 리뷰하고 품질과 보안 이슈를 빠르게 찾은 뒤, 수정 우선순위를 명확하게 제시한다.",
        path: "agents/code-reviewer.md",
      },
    ];

    const output = formatListOutput(items, { terminalWidth: 80 });
    const lines = output.split("\n");

    expect(lines[0]).toBe("Agents:");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[2].startsWith(" ".repeat(17))).toBe(true);

    for (const line of lines) {
      expect(displayWidth(line)).toBeLessThanOrEqual(80);
    }
  });

  test("uses block fallback in width 40", () => {
    const items: ListItem[] = [
      {
        kind: "skill",
        name: "project-explore",
        description:
          "프로젝트를 빠르게 탐색한 뒤 구조와 핵심 기능을 정리하고 개선 방향을 제시한다.",
        path: "skills/project-explore/SKILL.md",
      },
    ];

    const output = formatListOutput(items, { terminalWidth: 40 });
    const lines = output.split("\n");

    expect(lines[0]).toBe("Skills:");
    expect(lines[1]).toBe("  project-explore");
    expect(lines[2].startsWith("    ")).toBe(true);
  });

  test("truncates long names with ellipsis in table layout", () => {
    const items: ListItem[] = [
      {
        kind: "skill",
        name: "this-is-a-very-very-long-skill-name",
        description: "Short description",
        path: "skills/long/SKILL.md",
      },
    ];

    const output = formatListOutput(items, { terminalWidth: 80 });
    const lines = output.split("\n");

    expect(lines[1].startsWith("  this-is-a-very-very-l...")).toBe(true);
  });
});

describe("resolveTerminalWidth", () => {
  test("prefers stdout columns over env COLUMNS", () => {
    expect(resolveTerminalWidth(96, "80")).toBe(96);
  });

  test("uses env COLUMNS when stdout columns are unavailable", () => {
    expect(resolveTerminalWidth(undefined, "80")).toBe(80);
  });

  test("falls back to default width 80", () => {
    expect(resolveTerminalWidth(undefined, undefined)).toBe(80);
  });

  test("clamps too-small widths to 40", () => {
    expect(resolveTerminalWidth(10, undefined)).toBe(40);
    expect(resolveTerminalWidth(undefined, "20")).toBe(40);
  });
});
