# Test Fixtures Guide

This directory documents fixture conventions for command tests.

## Principles

- Use isolated temporary repositories per test via `tests/helpers/fs-fixture.ts`.
- Prefer creating only the minimum files needed for a scenario.
- Keep fixture content explicit in each test to make failures easy to read.

## Typical Layout

```text
<temp-root>/
  skills/<name>/SKILL.md
  agents/<name>.md
  .codex/config.toml
```

## Notes

- Invalid fixtures should be written directly as raw markdown to test parse failure paths.
- Output assertions should verify key tokens (`PASS`, `FAIL`, `ERROR`, `WARN`, `Usage`) instead of exact full-line snapshots.
