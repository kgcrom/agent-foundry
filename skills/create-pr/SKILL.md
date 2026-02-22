---
name: create-pr
description: >-
  Use when the current branch is ready to open a pull request and you need a
  consistent title/body, verification evidence, and GitHub PR URL output.
license: MIT
metadata:
  author: kgcrom
  version: "0.1.0"
allowed-tools: >-
  Bash(git diff:*) Bash(git log:*) Bash(git status:*) Bash(git rev-parse:*)
  Bash(git push:*) Bash(gh pr create:*) Bash(gh pr view:*) Read Grep Glob
---

# Create PR Skill

Push the current branch and create a pull request with a complete, reproducible description.

## Workflow

### 1. Determine Base Branch

Resolve base branch in this order:

1. `origin/HEAD`:
   `git rev-parse --abbrev-ref origin/HEAD 2>/dev/null` and strip the `origin/` prefix.
2. Fallback to `main` if it exists:
   `git rev-parse --verify main`.
3. Final fallback to `master`.

If base branch cannot be resolved, stop and report the issue.

### 2. Check PR Template

Read `.github/PULL_REQUEST_TEMPLATE.md` first.

If the template file is missing, create it with this exact section structure:
- `## Summary`
- `## Related Issue / Context`
- `## What Changed`
- `## Verification`
- `## CLI Output (if commands/validation changed)`
- `## Breaking Changes / Migration Notes`
- `## Checklist`

### 3. Analyze Branch Changes

Collect enough context to write an accurate PR:

- `git status --short`
- `git diff --stat <base>...HEAD`
- `git diff <base>...HEAD`
- `git log --oneline <base>..HEAD`

Use this analysis to draft:
- clear PR title,
- implementation details,
- rationale/context,
- verification evidence.

### 4. Build PR Body from Template

Fill every required section from the template:

- `Summary`: concise behavior change summary.
- `Related Issue / Context`: issue links and rationale.
- `What Changed`: technical implementation details.
- `Verification`: include results for `bun test`, `bun run check`, `bun run typecheck`.
- `CLI Output (if commands/validation changed)`: include concrete sample output or `N/A`.
- `Breaking Changes / Migration Notes`: explicit impact or `None`.
- `Checklist`: mark items that were actually completed.

Template sections must not be omitted.

### 5. Verify PR Readiness

Before creating PR:

- Confirm there are no unresolved conflicts.
- Confirm current branch is not the base branch.
- Confirm PR body includes all template sections.

If any check fails, stop and report what is missing.

### 6. Push Branch

Push the current branch to origin:

`git push -u origin <current-branch>`

Never use `git push --force` unless explicitly asked by the user.

### 7. Create PR and Return URL

Create the PR using GitHub CLI:

`gh pr create --base <base-branch> --title "<title>" --body "<body>"`

Then return the PR URL:

`gh pr view --json url --jq '.url'`

Output must include:
- PR URL
- base branch
- title
- short summary of what was created
