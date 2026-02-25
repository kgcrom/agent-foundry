# Install 수동 테스트 체크리스트

자동화 테스트(`bun test tests/commands/install.test.ts`)로 커버할 수 없는 항목만 정리한다.
TUI 인터랙션, TTY 감지, 실제 tool 연동 등 사람이 직접 확인해야 하는 시나리오이다.

---

## 1. TUI 인터랙션

| | 시나리오 | 실행 방법 | 예상 결과 |
|---|---------|----------|----------|
| [ ] | 정상 플로우 | `bun run install-skills` → 각 프롬프트에서 옵션 선택 | 3단계 프롬프트(kind → scope → tool) 순서대로 표시, 선택 완료 후 설치 로그 출력 |
| [ ] | kind에서 취소 | 첫 번째 프롬프트(kind)에서 Ctrl+C | "Installation cancelled." 출력, 파일 변경 없음 |
| [ ] | scope에서 취소 | 두 번째 프롬프트(scope)에서 Ctrl+C | "Installation cancelled." 출력, 파일 변경 없음 |
| [ ] | tool에서 취소 | 세 번째 프롬프트(tool)에서 Ctrl+C | "Installation cancelled." 출력, 파일 변경 없음 |
| [ ] | 비대화형 환경 | `echo "" \| bun run install-skills` | TTY가 아니므로 에러 메시지 출력 후 종료 |
| [ ] | 추가 인자 거부 | `bun run cli install --force` | 인자 에러 메시지 출력 후 종료 |

---

## 2. Skill 설치 — 실제 파일 확인

`bun run install-skills` → kind=skill, scope=project, tool=전체 선택 후 확인한다.

| | Tool | 확인 명령 | 예상 결과 |
|---|------|---------|----------|
| [ ] | Claude | `ls -la .claude/skills/` | commit, create-pr, create-issue 심링크 존재 |
| [ ] | Codex | `ls -la .agents/skills/` | commit, create-pr, create-issue 심링크 존재 |
| [ ] | Gemini | `ls -la .agents/skills/` | codex와 동일 경로, 심링크 존재 |
| [ ] | Copilot | `ls -la .github/skills/` | commit, create-pr, create-issue 심링크 존재 |
| [ ] | Antigravity | `ls -la .agent/skills/` | commit, create-pr, create-issue 심링크 존재 |
| [ ] | 심링크 타겟 | `readlink .claude/skills/commit` | 원본 `skills/commit` 절대 경로 |
| [ ] | 파일 접근 | `cat .claude/skills/commit/SKILL.md` | SKILL.md 내용 정상 출력 |

---

## 3. Agent 설치 — Claude

`bun run install-skills` → kind=agent, scope=project, tool=claude 선택 후 확인한다.

| | 확인 명령 | 예상 결과 |
|---|---------|----------|
| [ ] | `ls -la .claude/agents/` | code-reviewer.md, project-explore.md 심링크 존재 |
| [ ] | `readlink .claude/agents/code-reviewer.md` | 원본 `agents/code-reviewer.md` 절대 경로 |
| [ ] | `cat .claude/agents/code-reviewer.md` | 에이전트 마크다운 내용 정상 출력 |

---

## 4. Agent 설치 — Codex

`bun run install-skills` → kind=agent, scope=project, tool=codex 선택 후 확인한다.

| | 확인 항목 | 확인 명령 | 예상 결과 |
|---|---------|---------|----------|
| [ ] | TOML 파일 생성 | `ls .codex/agents/` | code-reviewer.toml, project-explore.toml 존재 |
| [ ] | TOML 내용 | `cat .codex/agents/code-reviewer.toml` | `developer_instructions` 필드에 에이전트 본문 포함 |
| [ ] | config.toml 등록 | `cat .codex/config.toml` | `[agents.code-reviewer]`, `[agents.project-explore]` 섹션 존재 |
| [ ] | config_file 경로 | `cat .codex/config.toml` | `config_file = "agents/code-reviewer.toml"` 형식 |

---

## 5. User scope 설치

`bun run install-skills` → kind=skill+agent, scope=user, tool=claude 선택 후 확인한다.

| | 확인 명령 | 예상 결과 |
|---|---------|----------|
| [ ] | `ls -la ~/.claude/skills/` | skill 심링크 존재 |
| [ ] | `ls -la ~/.claude/agents/` | agent 심링크 존재 |
| [ ] | `readlink ~/.claude/skills/commit` | 원본 절대 경로 |

> **주의:** user scope는 홈 디렉토리에 설치되므로 기존 설치물 주의. 테스트 후 정리 필요.

---

## 6. 실제 Tool 연동

설치된 skill/agent가 해당 tool에서 인식되는지 확인한다.

| | Tool | 검증 방법 | 예상 결과 |
|---|------|---------|----------|
| [ ] | Claude Code | Claude Code 실행 → `/commit` 입력 | skill이 인식되어 커밋 flow 시작 |
| [ ] | Claude Code | Claude Code에서 Task tool 사용 시 agent 목록 확인 | code-reviewer 등 에이전트 표시 |
| [ ] | Codex | `codex --agent code-reviewer` 실행 | 에이전트 로드 및 정상 동작 |

---

## 7. 정리

테스트 후 생성된 파일 정리:

```bash
# project scope
rm -rf .claude/skills .claude/agents
rm -rf .agents/skills
rm -rf .github/skills
rm -rf .agent/skills
rm -rf .codex/agents
# .codex/config.toml은 [agents.*] 섹션만 수동 제거

# user scope
rm -rf ~/.claude/skills ~/.claude/agents
rm -rf ~/.agents/skills
rm -rf ~/.github/skills
rm -rf ~/.agent/skills
rm -rf ~/.codex/agents
```
