---
name: create-issue
description: >-
  Use when you need to create a GitHub issue with proper context. Searches
  the codebase and related issues, asks clarifying questions to refine
  scope and acceptance criteria, checks for issue templates, and creates
  a well-structured issue via GitHub CLI.
license: MIT
metadata:
  author: kgcrom
  version: "0.1.0"
allowed-tools: >-
  Bash(gh issue create:*) Bash(gh issue list:*) Bash(gh issue view:*)
  Bash(gh label list:*) Bash(gh search issues:*)
  Bash(git log:*) Bash(git diff:*) Bash(git status:*)
  Read Grep Glob
---

# Create Issue Skill

Search the codebase for context, check for duplicates, and create a well-structured GitHub issue.

## Workflow

### Step 1. Understand the User's Intent

Determine the issue category:

- **Bug**: something is broken or behaving unexpectedly.
- **Feature**: a new capability or enhancement.
- **Task**: a chore, refactor, or maintenance item.

If the intent is ambiguous, ask targeted questions per category:

- Bug → "What is the expected vs actual behavior?"
- Feature → "What problem does this solve?"
- Task → "What is the scope and acceptance criteria?"

### Step 2. Gather Codebase Context

Search for relevant code and recent changes:

- `Grep` and `Glob` to find related source files.
- `Read` to inspect relevant code sections.
- `git log --oneline -20` for recent commit history.
- `git diff HEAD~5..HEAD --stat` for recent change summary.

Use this context to write an accurate issue description that references specific files and code.

### Step 3. Search for Related Issues

Check for duplicates and related issues:

- `gh search issues "<keywords>" --repo <owner>/<repo> --limit 10`
- `gh issue list --state open --search "<keywords>" --limit 10`

If a duplicate or closely related issue is found, inform the user with the issue number, title, and URL before proceeding. Let the user decide whether to continue.

### Step 4. Check for Issue Templates

Look for issue templates in the repository:

- `Glob` for `.github/ISSUE_TEMPLATE/*.yml` and `.github/ISSUE_TEMPLATE/*.md`.

If templates exist, present the available templates and let the user choose which one to use. Use the selected template's structure to format the issue body.

If no templates exist, use the default structure from Step 6.

### Step 5. Discover Available Labels

Retrieve repository labels:

- `gh label list --limit 50`

Suggest appropriate labels based on the issue category and content. Do not apply labels without user approval.

### Step 6. Draft the Issue

Compose the issue title and body.

**Title format** (based on category):

- Bug: `[BUG] <concise description>`
- Feature: `[FEAT] <concise description>`
- Task: `[TASK] <concise description>`

**Default body structure** (when no template is selected):

```markdown
## Description
<clear description of the issue>

## Context
<relevant code references, recent changes, or background>

## Acceptance Criteria
- [ ] <criterion 1>
- [ ] <criterion 2>

## Additional Notes
<any extra context, screenshots, or references>
```

Present the full draft to the user for review before creating.

### Step 7. Refine the Draft

Incorporate user feedback:

- Adjust title, body, or labels as requested.
- Repeat until the user approves the draft.

Never create the issue without explicit user approval.

### Step 8. Create the Issue

Create the issue using GitHub CLI:

`gh issue create --title "<title>" --body "<body>" --label "<label1>,<label2>"`

Then retrieve and display the result:

`gh issue view <number> --json number,title,url --jq '"#\(.number) \(.title)\n\(.url)"'`

Output must include:

- Issue number
- Issue title
- Issue URL

## Safety Rules

- Never create an issue without showing the draft to the user first.
- Never apply labels the user has not approved.
- Always warn the user when a duplicate or closely related issue is found.
- Never modify or close existing issues — this skill only creates new ones.
- Never use `gh issue create` before the user explicitly approves the draft.

## Edge Cases

- **`gh` not authenticated**: If `gh auth status` fails, instruct the user to run `gh auth login` and stop.
- **No remote repository**: If `git remote -v` shows no remotes, stop and inform the user.
- **Body exceeds 65536 characters**: Warn the user and suggest trimming before creating.
- **Multiple topics in one request**: Suggest splitting into separate issues, one topic per issue.
