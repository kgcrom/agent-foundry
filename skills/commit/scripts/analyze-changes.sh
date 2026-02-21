#!/usr/bin/env bash
# Analyze git working tree state and output JSON summary.
# Usage: bash analyze-changes.sh

set -euo pipefail

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo '{"error": "not a git repository"}' >&2
  exit 1
fi

branch=$(git branch --show-current 2>/dev/null || echo "HEAD")
staged=$(git diff --cached --name-only | jq -R -s 'split("\n") | map(select(. != ""))')
unstaged=$(git diff --name-only | jq -R -s 'split("\n") | map(select(. != ""))')
untracked=$(git ls-files --others --exclude-standard | jq -R -s 'split("\n") | map(select(. != ""))')

staged_count=$(echo "$staged" | jq 'length')
unstaged_count=$(echo "$unstaged" | jq 'length')
untracked_count=$(echo "$untracked" | jq 'length')

has_conflicts=false
if git diff --name-only --diff-filter=U 2>/dev/null | grep -q .; then
  has_conflicts=true
fi

recent_commits=$(git log --oneline -5 2>/dev/null | jq -R -s 'split("\n") | map(select(. != ""))')

jq -n \
  --arg branch "$branch" \
  --argjson staged "$staged" \
  --argjson unstaged "$unstaged" \
  --argjson untracked "$untracked" \
  --argjson staged_count "$staged_count" \
  --argjson unstaged_count "$unstaged_count" \
  --argjson untracked_count "$untracked_count" \
  --argjson has_conflicts "$has_conflicts" \
  --argjson recent_commits "$recent_commits" \
  '{
    branch: $branch,
    staged: { count: $staged_count, files: $staged },
    unstaged: { count: $unstaged_count, files: $unstaged },
    untracked: { count: $untracked_count, files: $untracked },
    has_conflicts: $has_conflicts,
    recent_commits: $recent_commits
  }'
