# Session Context

## User Prompts

### Prompt 1

claude code, codex, gemini, github copilot에서 범용적으로 쓸 목적의 agent, skill 저장소라는 말이 포함되게 description을 영어로 적어줘

### Prompt 2

yes, And please add a short description to github description.

### Prompt 3

Base directory for this skill: /Volumes/kgcrom-2tb/kgcrom/.claude/skills/commit

## Format

```
<type>: <short summary in Korean>

<optional body in Korean>
```

## Core Rules

**Language:**
- Type prefix in English (feat, fix, refactor, docs, test, chore, perf, style)
- Summary and body in Korean
- Use concise verb forms: "추가", "수정", "삭제" (NOT "추가하도록 함", "수정하도록 함")

**Header:**
- Under 50 characters
- Lowercase start, no period at end
- Imperative mood: descr...

