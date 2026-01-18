---
description: TLDR-first workflow - minimize tokens by indexing before reading files
globs: "**/*"
alwaysApply: true
---

# TLDR-First Workflow

**Always run TLDR commands before reading code files.**

## Quick Start
```bash
tldr warm .                    # Index repo (run once)
tldr structure .               # Project structure
tldr arch .                    # Entry/leaf functions
tldr extract <file>            # Function signatures + call graph
tldr impact <function>         # Find all callers (reverse call graph)
tldr calls .                   # Project-level call graph
tldr cfg <file> <function>     # Control flow graph
tldr dfg <file> <function>     # Data flow graph
```

## Workflow Rules
1. **Never read full files** — use TLDR extract first
2. **Only open targeted ranges** — `sed -n 'start,endp' file` when needed
3. **Paste TLDR outputs** — helps future agents understand context
4. **Search before read** — `tldr extract` shows line numbers

## Example Flow
```bash
# Task: Fix bug in upload handler
tldr extract src/main.rs | grep -A5 upload_file   # Find signature + calls
sed -n '172,240p' src/main.rs                      # Read only that function

# Task: Find escapeHtml usage in frontend
rg 'escapeHtml|escapeAttr' static/index.html      # Discover usage patterns
sed -n '100,120p' static/index.html               # Read targeted range
```

## Frontend Note
**WARNING:** Never run `tldr extract static/index.html` — output exceeds 6000 lines and will blow up token budget. Use `rg`/`grep` to find specific patterns, then `sed -n` for targeted ranges.

## Quality Checks (Pre-Commit)
```bash
cargo build                # Must pass
cargo clippy               # No warnings
npm run test:e2e           # If UI changed
```

## Security Reminders
- Backend: `clean_relative_path()` + `resolve_path()` for all user paths
- Frontend: `escapeHtml()`/`escapeAttr()` for all user content
- Broadcast: All mutations use `broadcast_update()`
