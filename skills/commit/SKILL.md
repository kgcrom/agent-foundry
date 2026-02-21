---
name: commit
description: >-
  Create well-structured git commits following Conventional Commits.
  Use when committing code changes, after completing a feature, fixing a bug,
  or when the user asks to commit. Analyzes staged/unstaged changes, generates
  meaningful commit messages, and ensures safe git practices.
license: MIT
metadata:
  author: kgcrom
  version: "0.1.0"
allowed-tools: Bash(git:*) Bash(jq:*) Read Grep Glob
---

# Commit Skill

Create safe, well-structured git commits following Conventional Commits convention.

## Workflow

### 1. Analyze Current State

Run the analysis script or manually check:

```bash
bash scripts/analyze-changes.sh
```

Or gather information manually:
- `git status` — see staged/unstaged/untracked files
- `git diff --cached` — review staged changes
- `git diff` — review unstaged changes
- `git log --oneline -5` — check recent commit style

### 2. Review Changes

Before committing, verify:
- No sensitive files are staged (`.env`, credentials, API keys, tokens)
- No large binary files are accidentally included
- All intended changes are staged
- No unrelated changes are mixed in

### 3. Stage Changes

Stage files selectively by name. Prefer `git add <file>...` over `git add -A` or `git add .` to avoid accidentally including sensitive or unrelated files.

### 4. Write Commit Message

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code restructuring without behavior change
- `docs` — documentation only
- `test` — adding or updating tests
- `chore` — build, tooling, dependency updates
- `style` — formatting, whitespace (no logic change)
- `perf` — performance improvement
- `ci` — CI/CD configuration

**Guidelines:**
- Description should be imperative mood, lowercase, no period at end
- Keep the first line under 72 characters
- Body explains *why*, not *what* (the diff shows what)
- Reference issue numbers in footer when applicable: `Closes #123`

### 5. Create Commit

```bash
git commit -m "<type>(<scope>): <description>"
```

For multi-line messages, use heredoc:

```bash
git commit -m "$(cat <<'EOF'
feat(auth): add OAuth2 login flow

Implement Google OAuth2 for user authentication.
Session tokens stored in httpOnly cookies.

Closes #42
EOF
)"
```

### 6. Verify

After committing:
- `git log --oneline -1` — verify commit was created
- `git status` — confirm working tree is clean (or expected state)

## Safety Rules

- **Never** force push (`git push --force`) unless explicitly asked
- **Never** amend a commit unless explicitly asked — create a new commit instead
- **Never** skip hooks (`--no-verify`) unless explicitly asked
- **Warn** if staging files that look like secrets (`.env`, `*credentials*`, `*secret*`, `*token*`, `*.pem`, `*.key`)
- **Never** commit directly to `main`/`master` without user confirmation
- If a pre-commit hook fails, fix the issue and create a **new** commit (do not amend)

## Edge Cases

- **Empty diff**: If no changes are staged, inform the user instead of creating an empty commit
- **Merge conflicts**: Do not commit if unresolved conflicts exist (look for `<<<<<<<` markers)
- **Large changesets**: For 10+ files, suggest splitting into logical commits
- **Mixed concerns**: If staged changes span unrelated features, suggest separating them
