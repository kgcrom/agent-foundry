# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                          # Install dependencies
bun test                             # Run all tests
bun test tests/parser.test.ts        # Run a single test file
bun run typecheck                    # Type check (tsc --noEmit)
bun run check                        # Biome lint + format check
bun run format                       # Auto-format with Biome

bun run list                         # List all skills and agents
bun run validate <name>              # Validate a specific skill or agent
bun run validate --all               # Validate all skills and agents
bun run install-skills --tool <t>    # Install to tool-specific paths (claude-code|codex|copilot|antigravity)
```

## Architecture

CLI tool for managing a personal collection of **Skills** and **Agents** following the [Agent Skills open standard](https://agentskills.io/specification). Skills and agents are authored once in markdown and installed into tool-specific locations (Claude Code, Codex, Copilot, Antigravity).

### Core Flow

- **Skills** live in `skills/{name}/SKILL.md` with YAML frontmatter (name, description, license, metadata, allowed-tools). On install, skill directories are symlinked to tool-specific paths.
- **Agents** live in `agents/{name}.md` with YAML frontmatter (name, description, tools, model, codex overrides). On install: symlinked for Claude Code, converted to TOML for Codex (with config.toml registration).

### Source Layout

- `src/cli.ts` — Entry point, dispatches to command handlers via `process.argv`
- `src/commands/` — `validate.ts`, `list.ts`, `install.ts` (each exports a single async function)
- `src/lib/parser.ts` — Parses YAML frontmatter from markdown files using the `yaml` package
- `src/lib/validator.ts` — Validates frontmatter fields (name format: `NAME_REGEX`, length limits, required fields)
- `src/lib/constants.ts` — Shared constants: validation limits, directory names, install path mappings per tool
- `src/types.ts` — TypeScript interfaces for frontmatter, validation results, and CLI types
- `tests/` — Bun test files (`bun:test`), co-located by module name

### Key Conventions

- Bun runtime exclusively (no Node.js — uses `Bun.file()`, `Bun.write()`, `Bun.Glob`)
- Biome for linting/formatting: 2-space indent, double quotes, semicolons, 100-char line width
- Names must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (lowercase, hyphen-separated, max 64 chars)
- Skill `name` in frontmatter must match its directory name
- Path alias: `@/*` maps to `./src/*` in tsconfig
