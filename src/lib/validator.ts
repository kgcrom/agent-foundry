import type { AgentFrontmatter, SkillFrontmatter, ValidationResult } from "../types.js";
import {
  COMPATIBILITY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  NAME_REGEX,
} from "./constants.js";

export function validateSkill(frontmatter: SkillFrontmatter, dirName?: string): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  // name: required
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    errors.push({ field: "name", message: "name is required and must be a string" });
  } else {
    if (frontmatter.name.length > NAME_MAX_LENGTH) {
      errors.push({
        field: "name",
        message: `name must be ${NAME_MAX_LENGTH} characters or fewer (got ${frontmatter.name.length})`,
      });
    }
    if (!NAME_REGEX.test(frontmatter.name)) {
      errors.push({
        field: "name",
        message:
          "name must be lowercase letters, numbers, and hyphens only; must not start/end with hyphen or contain consecutive hyphens",
      });
    }
    if (dirName && frontmatter.name !== dirName) {
      errors.push({
        field: "name",
        message: `name "${frontmatter.name}" must match directory name "${dirName}"`,
      });
    }
  }

  // description: required
  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    errors.push({ field: "description", message: "description is required and must be a string" });
  } else if (frontmatter.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.push({
      field: "description",
      message: `description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer (got ${frontmatter.description.length})`,
    });
  }

  // compatibility: optional
  if (frontmatter.compatibility !== undefined) {
    if (typeof frontmatter.compatibility !== "string") {
      errors.push({ field: "compatibility", message: "compatibility must be a string" });
    } else if (frontmatter.compatibility.length > COMPATIBILITY_MAX_LENGTH) {
      errors.push({
        field: "compatibility",
        message: `compatibility must be ${COMPATIBILITY_MAX_LENGTH} characters or fewer (got ${frontmatter.compatibility.length})`,
      });
    }
  }

  // metadata: optional
  if (frontmatter.metadata !== undefined) {
    if (typeof frontmatter.metadata !== "object" || Array.isArray(frontmatter.metadata)) {
      errors.push({ field: "metadata", message: "metadata must be a key-value mapping" });
    } else {
      for (const [key, value] of Object.entries(frontmatter.metadata)) {
        if (typeof value !== "string") {
          warnings.push(`metadata.${key} value should be a string (got ${typeof value})`);
        }
      }
    }
  }

  // license: optional but recommended
  if (!frontmatter.license) {
    warnings.push("license field is recommended");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAgent(frontmatter: AgentFrontmatter): ValidationResult {
  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  // name: required
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    errors.push({ field: "name", message: "name is required and must be a string" });
  } else if (!NAME_REGEX.test(frontmatter.name)) {
    errors.push({
      field: "name",
      message:
        "name must be lowercase letters, numbers, and hyphens only; must not start/end with hyphen or contain consecutive hyphens",
    });
  }

  // description: required
  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    errors.push({ field: "description", message: "description is required and must be a string" });
  }

  // model: optional but recommended
  if (!frontmatter.model) {
    warnings.push("model field is recommended for Claude Code agents");
  }

  return { valid: errors.length === 0, errors, warnings };
}
