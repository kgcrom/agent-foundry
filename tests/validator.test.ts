import { describe, expect, test } from "bun:test";
import { validateAgent, validateSkill } from "../src/lib/validator.js";
import type { AgentFrontmatter, SkillFrontmatter } from "../src/types.js";

describe("validateSkill", () => {
  const validSkill: SkillFrontmatter = {
    name: "commit",
    description: "Create well-structured git commits",
    license: "MIT",
    metadata: { author: "kgcrom", version: "1.0" },
  };

  test("passes for valid skill", () => {
    const result = validateSkill(validSkill, "commit");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("fails when name is missing", () => {
    const result = validateSkill({ ...validSkill, name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  test("fails when name has invalid characters", () => {
    const result = validateSkill({ ...validSkill, name: "My_Skill" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  test("fails when name starts with hyphen", () => {
    const result = validateSkill({ ...validSkill, name: "-bad-name" });
    expect(result.valid).toBe(false);
  });

  test("fails when name has consecutive hyphens", () => {
    const result = validateSkill({ ...validSkill, name: "bad--name" });
    expect(result.valid).toBe(false);
  });

  test("fails when name exceeds max length", () => {
    const result = validateSkill({ ...validSkill, name: "a".repeat(65) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("64 characters"))).toBe(true);
  });

  test("fails when name doesn't match directory", () => {
    const result = validateSkill(validSkill, "different-name");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("must match directory"))).toBe(true);
  });

  test("fails when description is missing", () => {
    const result = validateSkill({ ...validSkill, description: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "description")).toBe(true);
  });

  test("fails when description exceeds max length", () => {
    const result = validateSkill({ ...validSkill, description: "x".repeat(1025) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("1024 characters"))).toBe(true);
  });

  test("fails when compatibility exceeds max length", () => {
    const result = validateSkill({ ...validSkill, compatibility: "x".repeat(501) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes("500 characters"))).toBe(true);
  });

  test("warns when license is missing", () => {
    const { license: _, ...noLicense } = validSkill;
    const result = validateSkill(noLicense as SkillFrontmatter);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("license"))).toBe(true);
  });

  test("passes without directory name check", () => {
    const result = validateSkill(validSkill);
    expect(result.valid).toBe(true);
  });
});

describe("validateAgent", () => {
  const validAgent: AgentFrontmatter = {
    name: "code-reviewer",
    description: "Reviews code changes",
    tools: "Read, Grep, Glob, Bash",
    model: "sonnet",
  };

  test("passes for valid agent", () => {
    const result = validateAgent(validAgent);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("fails when name is missing", () => {
    const result = validateAgent({ ...validAgent, name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  test("fails when name has invalid format", () => {
    const result = validateAgent({ ...validAgent, name: "Code_Reviewer" });
    expect(result.valid).toBe(false);
  });

  test("fails when description is missing", () => {
    const result = validateAgent({ ...validAgent, description: "" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "description")).toBe(true);
  });

  test("warns when model is missing", () => {
    const { model: _, ...noModel } = validAgent;
    const result = validateAgent(noModel as AgentFrontmatter);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("model"))).toBe(true);
  });
});
