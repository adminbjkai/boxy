---
description: Pre-commit quality checklist for Boxy
globs: "**/*"
alwaysApply: false
---

# Quality Checklist

Run through this before committing changes.

## TLDR-First (Code Review/Refactor)
```bash
tldr extract src/main.rs       # Signatures + call graph
tldr impact <function>         # Find all callers (reverse call graph)
tldr calls .                   # Project-level call graph
# Only read specific line ranges after identifying targets
```
**WARNING:** Never run `tldr extract static/index.html` — output exceeds 6000 lines.

## Build Verification
- [ ] `cargo build` passes without warnings
- [ ] `cargo clippy` shows no issues
- [ ] `npm run test:e2e` passes (if UI changed)

## Backend (src/main.rs)

### Security
- [ ] All user paths go through `clean_relative_path()`
- [ ] No `unwrap()` on user input - use proper error handling
- [ ] File operations use `resolve_path()` for full paths
- [ ] No hardcoded secrets or paths

### Code Quality
- [ ] New handlers broadcast mutations via WebSocket
- [ ] Error responses use appropriate HTTP status codes
- [ ] Async operations properly awaited
- [ ] No unnecessary clones

## Frontend (static/index.html)

### Security
- [ ] User content escaped with `escapeHtml()`
- [ ] Attributes escaped with `escapeAttr()`
- [ ] No innerHTML with unescaped user data

### UX
- [ ] Loading states shown during async operations
- [ ] Error messages user-friendly
- [ ] WebSocket reconnects on disconnect
- [ ] Animations don't cause layout shift

## Tests

### E2E Coverage
- [ ] New features have Playwright tests
- [ ] Tests use proper selectors (role, text, testid)
- [ ] Tests clean up created files/folders

## Documentation

### If API Changed
- [ ] docs/ARCHITECTURE.md updated
- [ ] README.md endpoints current

### If UI Changed
- [ ] Screenshots in docs/ updated (optional)

## Git Hygiene
- [ ] Commit message describes the "why"
- [ ] No debug console.log or println! left
- [ ] No commented-out code blocks
- [ ] .gitignore covers new generated files

## Quick Checks
```bash
# Rust
cargo build
cargo clippy

# Tests
npm run test:e2e

# Check for debug statements
grep -r "console.log" static/ --include="*.html"
grep -r "println!" src/ --include="*.rs"
grep -r "dbg!" src/ --include="*.rs"
```
