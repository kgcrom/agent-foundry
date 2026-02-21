import { mkdir, readlink, stat, symlink, unlink } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
  AGENTS_DIR,
  AGENT_INSTALL_PATHS,
  SKILLS_DIR,
  SKILL_INSTALL_PATHS,
} from "../lib/constants.js";
import { parseAgent } from "../lib/parser.js";
import type { ToolTarget } from "../types.js";

interface InstallOptions {
  tool: ToolTarget;
}

export async function install(opts: InstallOptions): Promise<void> {
  const root = resolve(".");
  const { tool } = opts;

  await installSkills(root, tool);
  await installAgents(root, tool);
}

async function listDir(dir: string): Promise<string[]> {
  try {
    const glob = new Bun.Glob("*");
    const entries: string[] = [];
    for await (const entry of glob.scan({ cwd: dir, onlyFiles: false })) {
      entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function installSkills(root: string, tool: ToolTarget): Promise<void> {
  const skillsDir = join(root, SKILLS_DIR);
  const targetBase = join(root, SKILL_INSTALL_PATHS[tool]);

  const entries = await listDir(skillsDir);
  if (entries.length === 0) {
    console.log("No skills/ directory found. Skipping skill installation.");
    return;
  }

  for (const name of entries) {
    const skillSource = join(skillsDir, name);
    if (!(await isDirectory(skillSource))) continue;

    const targetPath = join(targetBase, name);
    await mkdir(targetBase, { recursive: true });
    await forceSymlink(skillSource, targetPath);
    console.log(`  Skill "${name}" -> ${relative(root, targetPath)}`);
  }
}

async function installAgents(root: string, tool: ToolTarget): Promise<void> {
  if (tool !== "claude-code" && tool !== "codex") {
    return;
  }

  const agentsDir = join(root, AGENTS_DIR);
  const entries = await listDir(agentsDir);
  const mdFiles = entries.filter((name) => name.endsWith(".md"));

  if (mdFiles.length === 0) {
    console.log("No agents/ directory found. Skipping agent installation.");
    return;
  }

  if (tool === "claude-code") {
    await installAgentsClaudeCode(root, agentsDir, mdFiles);
  } else {
    await installAgentsCodex(root, agentsDir, mdFiles);
  }
}

async function installAgentsClaudeCode(
  root: string,
  agentsDir: string,
  mdFiles: string[],
): Promise<void> {
  const targetBase = join(root, AGENT_INSTALL_PATHS["claude-code"]);
  await mkdir(targetBase, { recursive: true });

  for (const fileName of mdFiles) {
    const source = join(agentsDir, fileName);
    const targetPath = join(targetBase, fileName);

    await forceSymlink(source, targetPath);
    console.log(`  Agent "${fileName}" -> ${relative(root, targetPath)}`);
  }
}

async function installAgentsCodex(
  root: string,
  agentsDir: string,
  mdFiles: string[],
): Promise<void> {
  const targetBase = join(root, AGENT_INSTALL_PATHS.codex);
  await mkdir(targetBase, { recursive: true });

  const configEntries: Record<string, { description: string; config_file: string }> = {};

  for (const fileName of mdFiles) {
    const source = join(agentsDir, fileName);
    const content = await Bun.file(source).text();
    const parsed = parseAgent(content);
    const name = parsed.frontmatter.name;
    const codexConfig = parsed.frontmatter.codex ?? {};

    // Build TOML content
    const tomlLines: string[] = [];
    if (codexConfig.model) {
      tomlLines.push(`model = "${codexConfig.model}"`);
    }
    if (codexConfig.model_reasoning_effort) {
      tomlLines.push(`model_reasoning_effort = "${codexConfig.model_reasoning_effort}"`);
    }
    if (codexConfig.sandbox_mode) {
      tomlLines.push(`sandbox_mode = "${codexConfig.sandbox_mode}"`);
    }

    // Escape body for TOML multi-line string
    const body = parsed.body.replace(/\\/g, "\\\\").replace(/"""/g, '"\\""');
    tomlLines.push(`developer_instructions = """\n${body}\n"""`);

    const tomlContent = tomlLines.join("\n");
    const tomlPath = join(targetBase, `${name}.toml`);
    await Bun.write(tomlPath, tomlContent);
    console.log(`  Agent "${name}" -> ${relative(root, tomlPath)}`);

    configEntries[name] = {
      description: parsed.frontmatter.description,
      config_file: `agents/${name}.toml`,
    };
  }

  // Write/update .codex/config.toml with agents section
  const codexConfigPath = join(root, ".codex", "config.toml");
  await mkdir(join(root, ".codex"), { recursive: true });

  let existingContent = "";
  try {
    existingContent = await Bun.file(codexConfigPath).text();
  } catch {
    // File doesn't exist yet
  }

  // Remove existing [agents.*] sections
  const lines = existingContent.split("\n");
  const filtered: string[] = [];
  let inAgentSection = false;
  for (const line of lines) {
    if (/^\[agents\./.test(line)) {
      inAgentSection = true;
      continue;
    }
    if (inAgentSection && /^\[/.test(line)) {
      inAgentSection = false;
    }
    if (!inAgentSection) {
      filtered.push(line);
    }
  }

  // Append new agent sections
  const agentSections: string[] = [];
  for (const [name, config] of Object.entries(configEntries)) {
    agentSections.push(
      `[agents.${name}]`,
      `description = "${config.description.replace(/"/g, '\\"')}"`,
      `config_file = "${config.config_file}"`,
      "",
    );
  }

  const finalContent = [
    ...filtered.filter((l) => l.trim() !== "" || filtered.indexOf(l) === 0),
    "",
    ...agentSections,
  ]
    .join("\n")
    .trim()
    .concat("\n");

  await Bun.write(codexConfigPath, finalContent);
  console.log(`  Updated ${relative(root, codexConfigPath)}`);
}

async function forceSymlink(target: string, linkPath: string): Promise<void> {
  try {
    const existing = await readlink(linkPath);
    if (existing === target) return;
    await unlink(linkPath);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      try {
        await unlink(linkPath);
      } catch {
        // ignore
      }
    }
  }
  await symlink(target, linkPath);
}
