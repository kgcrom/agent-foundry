# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Bun CLI implementation:
  - `src/cli.ts` entry point
  - `src/commands/` command handlers (`validate`, `list`, `install`)
  - `src/lib/` shared parser/validator/constants logic
- `skills/` stores reusable Agent Skills in `skills/<name>/SKILL.md` (optional `scripts/`).
- `agents/` stores agent personas as single-source Markdown files (`agents/<name>.md`).
- `tests/` contains Bun test files aligned to modules (`parser.test.ts`, `validator.test.ts`).

## Build, Test, and Development Commands
- `bun install` installs dependencies.
- `bun run list` lists all registered skills and agents.
- `bun run validate <name>` validates one skill or agent.
- `bun run validate --all` validates the full repository.
- `bun run install-skills` runs interactive TUI installation for selected kinds/scopes/tools (`claude|codex|gemini|copilot|antigravity`); non-interactive environments are not supported.
- `bun test` runs the test suite.
- `bun run typecheck` runs `tsc --noEmit`.
- `bun run check` runs Biome lint/format checks.
- `bun run format` applies Biome formatting.

## Coding Style & Naming Conventions
- Runtime is Bun-native TypeScript (ESM). Prefer Bun APIs over Node-specific alternatives.
- Biome is the source of truth for style:
  - 2-space indentation, double quotes, semicolons, 100-char line width.
- Names for skills/agents must match:
  - regex `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`
  - max length 64 characters.
- Keep agent Markdown as the single source of truth; installation generates tool-specific formats.

## Testing Guidelines
- Framework: `bun:test` (`describe`, `test`, `expect`).
- Place tests in `tests/` and name files as `<module>.test.ts`.
- Add/adjust tests whenever parser, validator, or CLI behavior changes.
- Run `bun test` plus `bun run typecheck` before opening a PR.

## Commit & Pull Request Guidelines
- Current `main` branch has no commit history yet, so no project-specific commit pattern is established.
- Until a convention is formalized, use clear Conventional Commit-style subjects (for example: `feat: add codex install validation`).
- PRs should include:
  - concise summary of behavior changes,
  - related issue/context,
  - verification output (`bun test`, `bun run check`, `bun run typecheck`),
  - sample CLI output when commands or validation messages change.
