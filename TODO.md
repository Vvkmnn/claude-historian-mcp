# TODO: claude-historian-mcp

## Code Quality

- [ ] **Remove dead Claude Desktop code** — `universal-engine.ts` contains ~1000 lines of unused Desktop/DXT integration code (LevelDB, IndexedDB, LocalStorage search). The feature branch is dead and DXT builds are not used. Comment out or remove the Desktop-specific methods, keeping only the `UniversalHistorySearchEngine` wrapper that delegates to `HistorySearchEngine`.

- [ ] **Eliminate `any` types** — 99 instances of `any` across all files (JSON parsing, dynamic data, LevelDB). Refactor to use `unknown` with type guards, or define proper interfaces. This would allow upgrading eslint back to `recommendedTypeChecked`.

- [ ] **Re-enable `noUncheckedIndexedAccess`** — Currently disabled due to 45+ violations from pervasive array iteration patterns. Once `any` types are eliminated and array access is properly guarded, this can be re-enabled for stronger type safety.

- [ ] **Fix `console.error` misuse** — Previous `console.log` calls were mechanically replaced with `console.error`. Review each call site: some are debug logging that should be removed, others are genuine error reporting that should stay.

## Architecture

- [ ] **Extract Claude Desktop to separate package** — If Desktop support is needed in the future, extract it to a separate `claude-historian-desktop` package rather than bundling dead code in the main MCP server.

## Warnings

- [ ] **Add return types** — 2 functions missing explicit return types (`search-helpers.ts:360`, `search.ts:712`). Low priority but improves readability.
