import { describe, expect, test } from "bun:test";
import { parseAgent, parseFrontmatter, parseSkill } from "../src/lib/parser.js";

describe("lib/parser parseFrontmatter", () => {
  test("parses valid YAML frontmatter", () => {
    const content = `---
name: test-skill
description: A test skill
---

# Body content

Some text here.`;

    const result = parseFrontmatter<{ name: string; description: string }>(content);
    expect(result.frontmatter.name).toBe("test-skill");
    expect(result.frontmatter.description).toBe("A test skill");
    expect(result.body).toBe("# Body content\n\nSome text here.");
  });

  test("throws on missing frontmatter", () => {
    expect(() => parseFrontmatter("no frontmatter here")).toThrow("No YAML frontmatter found");
  });

  test("throws on empty frontmatter", () => {
    const content = `---

---
body`;
    expect(() => parseFrontmatter(content)).toThrow("must be a YAML mapping");
  });

  test("handles multiline description", () => {
    const content = `---
name: multi
description: >-
  First line
  second line
---

Body`;

    const result = parseFrontmatter<{ name: string; description: string }>(content);
    expect(result.frontmatter.description).toBe("First line second line");
  });

  test("handles empty body", () => {
    const content = `---
name: no-body
description: test
---
`;

    const result = parseFrontmatter<{ name: string; description: string }>(content);
    expect(result.body).toBe("");
  });

  test("throws on invalid YAML syntax", () => {
    const content = `---
name: broken
description: "unterminated
---
Body`;

    expect(() => parseFrontmatter(content)).toThrow();
  });
});

describe("lib/parser parseSkill", () => {
  test("parses a valid skill", () => {
    const content = `---
name: commit
description: Create git commits
license: MIT
metadata:
  author: kgcrom
  version: "1.0"
allowed-tools: Bash(git:*) Read
---

# Commit Skill

Instructions here.`;

    const result = parseSkill(content);
    expect(result.frontmatter.name).toBe("commit");
    expect(result.frontmatter.license).toBe("MIT");
    expect(result.frontmatter.metadata?.author).toBe("kgcrom");
    expect(result.frontmatter["allowed-tools"]).toBe("Bash(git:*) Read");
  });
});

describe("lib/parser parseAgent", () => {
  test("parses a valid agent with codex config", () => {
    const content = `---
name: code-reviewer
description: Reviews code changes
tools: Read, Grep, Glob, Bash
model: sonnet
codex:
  model: o3
  model_reasoning_effort: high
  sandbox_mode: read-only
---

# Code Reviewer

Review instructions.`;

    const result = parseAgent(content);
    expect(result.frontmatter.name).toBe("code-reviewer");
    expect(result.frontmatter.tools).toBe("Read, Grep, Glob, Bash");
    expect(result.frontmatter.model).toBe("sonnet");
    expect(result.frontmatter.codex?.model).toBe("o3");
    expect(result.frontmatter.codex?.sandbox_mode).toBe("read-only");
    expect(result.body).toContain("# Code Reviewer");
  });

  test("parses agent without codex config", () => {
    const content = `---
name: simple-agent
description: A simple agent
---

Instructions.`;

    const result = parseAgent(content);
    expect(result.frontmatter.name).toBe("simple-agent");
    expect(result.frontmatter.codex).toBeUndefined();
  });
});
