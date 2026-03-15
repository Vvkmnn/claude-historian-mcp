---
name: claude-historian
description: Use before WebSearch to check if you already have the answer, when stuck on an error to find past fixes, or when entering a familiar project to recall past sessions and file changes.
---

# Claude Historian

Search conversation history before starting fresh. You may already have the answer.

## When to Use

**Before WebSearch** → `search(query: "...", scope: "similar")` or `search(query: "...", scope: "conversations")`. Past solutions beat web results.

**Stuck on an error** → `search(query: "<error message>", scope: "errors")`. Finds past fixes with code.

**Entering a familiar project** → `search(scope: "sessions")` for recent work. `search(query: "...", scope: "plans")` for past decisions.

**Working on a familiar file** → `search(scope: "files", filepath: "src/index.ts")`. Shows past changes with context.

## Quick Reference

| Situation | Tool Call |
|-----------|----------|
| Error with no obvious cause | `search(query: "<error>", scope: "errors")` |
| "Have I done this before?" | `search(query: "...", scope: "similar")` |
| Working on familiar file | `search(scope: "files", filepath: "...")` |
| Need past design reasoning | `search(query: "...", scope: "plans")` |
| What did I do last session? | `search(scope: "sessions")` |
| Successful tool workflows | `search(scope: "tools")` |
| General search | `search(query: "...", scope: "conversations")` |
| Deep-dive into session | `inspect(session_id: "...")` |
| Rules, skills, CLAUDE.md | `search(query: "...", scope: "config")` |
| Task management history | `search(query: "...", scope: "tasks")` |
| Memories across sessions | `search(query: "...", scope: "memories")` |

## Key Parameters

- **`scope`**: Target your search — `conversations`, `errors`, `files`, `plans`, `config`, `tasks`, `similar`, `sessions`, `tools`, `memories`, or `all` (default)
- **`limit`**: Number of results (default 10)
- **`project`**: Filter by project name substring (works with conversations, sessions)
- **`timeframe`**: `today`, `yesterday`, `week`, `month`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Going straight to WebSearch | Check historian first — past solutions are more relevant |
| Vague queries | Use specific terms: error messages, file paths, tool names |
| Using `scope: "all"` for errors | Use `scope: "errors"` — it has dedicated fix extraction |
| Long keyword-dump queries | Keep to 3-5 specific terms, not 10+ generic ones |
