# Agent Foundry

Personal collection of **Agent Skills** and **Agents** following the [Agent Skills open standard](https://agentskills.io/specification).

One source, multi-use — same skills work across Claude Code, Codex, Copilot, and Antigravity.

## Concepts

- **Skills** = Reusable "how-to" modules (Agent Skills standard, tool-agnostic)
- **Agents** = AI assistant personas with specific roles (single markdown source → tool-specific format on install)

## Requirements

- [Bun](https://bun.sh/) runtime

## Installation

```bash
git clone https://github.com/kgcrom/agent-foundry.git
cd agent-foundry
bun install
```

## Usage

### list

List all registered skills and agents.

```bash
bun run list
```

### validate

Validate a specific skill or agent by name, or validate everything at once.

```bash
# Validate a single skill/agent
bun run validate <name>

# Validate all skills and agents
bun run validate --all
```

### install

Install skills and agents to tool-specific locations in your project.

```bash
bun run install-skills --tool <claude-code|codex|copilot|antigravity>
```

## Adding Skills

Create a new directory under `skills/` with a `SKILL.md` file:

```
skills/{name}/
  SKILL.md
  scripts/       # optional helper scripts
```

`SKILL.md` uses YAML frontmatter:

```yaml
---
name: my-skill              # required
description: >-             # required
  What this skill does.
license: MIT                # optional
metadata:                   # optional
  author: your-name
  version: "0.1.0"
allowed-tools: Bash Read    # optional — tools the skill needs
---
```

The body of `SKILL.md` contains the skill instructions in Markdown.

## Adding Agents

Create a Markdown file under `agents/`:

```
agents/{name}.md
```

Agent frontmatter:

```yaml
---
name: my-agent              # required
description: >-             # required
  What this agent does.
tools: Read, Grep, Glob     # optional — tools the agent can use
model: sonnet               # optional — preferred model
codex:                      # optional — Codex-specific overrides
  model: o3
  model_reasoning_effort: high
  sandbox_mode: read-only
---
```

The body contains the agent's system prompt in Markdown.

## Install Targets

### Skills

| Tool | Install Path |
|------|-------------|
| Claude Code | `.claude/skills/{name}/` |
| Codex | `.agents/skills/{name}/` |
| Copilot | `.github/skills/{name}/` |
| Antigravity | `.agent/skills/{name}/` |

### Agents

| Tool | Format | Install Path |
|------|--------|-------------|
| Claude Code | `.md` (symlink) | `.claude/agents/{name}.md` |
| Codex | `.toml` (generated) | `.codex/agents/{name}.toml` + `config.toml` |

## Project Structure

```
skills/           # Agent Skills standard modules
  commit/
    SKILL.md
    scripts/

agents/           # Agent personas (source markdown)
  code-reviewer.md

src/              # CLI tooling
  cli.ts
  commands/
  lib/
```

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck

# Lint & format check
bun run check

# Auto-format
bun run format
```
