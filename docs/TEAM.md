# Boxy Agent Team — who does what

Claude (main session) is the orchestrator: plans, delegates, integrates, verifies,
releases. Specialists below are invoked via the Agent tool (project agents live in
`.claude/agents/`, generic ones are built in). Rule of thumb: 3+ independent lanes
→ fan out in parallel; single-lane work → do it inline.

## Project specialists (`.claude/agents/`)

| Agent | Model | Specialty | Use when |
|---|---|---|---|
| `boxy-frontend` | Sonnet | static/index.html UI work, verified with node + debug server | Any UI feature/styling/motion change |
| `boxy-backend` | Sonnet | src/main.rs, actix-web, verified with cargo check/test | API, file handling, perf, unit tests |
| `boxy-chores` | Haiku | Issue triage, changelog drafts, doc audits (read-only) | Mechanical chores, no code judgment |
| `code-reviewer` | default | Boxy patterns, security, correctness | After any feature/fix, before release |
| `refactor-helper` | default | Cleanup within single-file architecture | Code getting messy, extracting patterns |
| `ui-improver` | default | Visual design, interactions, UX | Planning UI work |

Default routing: implementation → the Sonnet specialists; mechanical chores →
Haiku; only reviews/verification and hard judgment calls use the session model.

## Generic lanes (built-in agent types)

| Agent | Specialty | Use when |
|---|---|---|
| `fable-researcher` | Codebase/web investigation → sourced brief | Before planning; unfamiliar territory |
| `fable-implementer` | Builds one scoped slice end-to-end | Parallel build lanes |
| `fable-verifier` | Fresh-context PASS/FAIL vs. acceptance criteria | Stage boundaries, before "done" |
| `fable-cheap-runner` | Bulk read/extract on a cheap model | High-volume, low-judgment reading |
| `Explore` | Read-only broad search | Locating code across many files |

## Standing review roster for releases

Before any minor/major release, run in parallel:
1. `code-reviewer` on the diff since the last tag
2. `fable-verifier` against the CHANGELOG's claims
3. Infra sanity: `nginx -t`, `systemctl status boxy`, upload smoke test

## Project skills (`.claude/skills/`)

`project-guide` (dev patterns), `ui-patterns` (frontend conventions),
`quality-checklist` (pre-commit), `tldr-first` (token-efficient reading).
Read `project-guide` before touching `src/`; `ui-patterns` before `static/`.

## Key docs

- `PROGRESS.md` — live task memory for any multi-step effort
- `CHANGELOG.md` + `docs/VERSIONING.md` — release system
- `docs/MAINTENANCE.md` — deployment & ops playbook
- `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/TESTING.md` — reference
