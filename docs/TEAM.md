# Contributor and review guide

The active assistant or developer owns integration, verification, documentation, and release.
Project agent templates under `.claude/agents/` are optional aids for clients supporting them;
follow the current runtime's delegation rules and available models.

| Template | Focus |
|----------|-------|
| boxy-frontend | Embedded markup/CSS/JS, accessibility, responsive behavior |
| boxy-backend | Actix handlers, file safety, bounded I/O, resource limits |
| boxy-chores | Read-only issue triage and documentation drafts |
| code-reviewer | Correctness, security, regressions, and accurate release claims |
| refactor-helper | Focused cleanup and duplication removal |
| ui-improver | Layout, interactions, visual hierarchy, and usable existing features |

Read `.claude/skills/project-guide/SKILL.md`, `ui-patterns/SKILL.md`, and
`quality-checklist/SKILL.md` for project conventions. They describe embedded assets in
`static/index.html`, `static/app.css`, `static/app.js` and focused Rust modules.

Before releasing: review the diff against the changelog, run Rust format/lint/tests and
isolated browser/API tests, validate Fern documentation, regenerate screenshots for visual
changes, and use `scripts/deploy.sh`. Verify local/public health, asset versions, and the
production browser before marking work complete. Production files must never be test fixtures.

See `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, and
`docs/VERSIONING.md` for the current reference; `PROGRESS.md` preserves historical work.
