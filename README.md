<img align="right" src="claude-historian.svg" alt="claude-historian-mcp" width="220">

# claude-historian-mcp

An [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for searching your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) conversation history. Find past solutions, track file changes, and learn from previous work.

<br clear="right">

![claude-historian-mcp](demo/demo.gif)

[![npm version](https://img.shields.io/npm/v/claude-historian-mcp.svg)](https://www.npmjs.com/package/claude-historian-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/) [![Claude](https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=fff)](#) [![GitHub stars](https://img.shields.io/github/stars/Vvkmnn/claude-historian-mcp?style=social)](https://github.com/Vvkmnn/claude-historian-mcp) ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Vvkmnn/claude-historian-mcp?utm_source=oss&utm_medium=github&utm_campaign=Vvkmnn%2Fclaude-historian-mcp&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

---

## install

**Requirements:**

[![Claude Code](https://img.shields.io/badge/Claude_Code-555?logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOCAxMCIgc2hhcGUtcmVuZGVyaW5nPSJjcmlzcEVkZ2VzIj4KICA8IS0tIENsYXdkOiBDbGF1ZGUgQ29kZSBtYXNjb3QgLS0+CiAgPCEtLSBEZWNvZGVkIGZyb206IOKWkOKWm+KWiOKWiOKWiOKWnOKWjCAvIOKWneKWnOKWiOKWiOKWiOKWiOKWiOKWm+KWmCAvIOKWmOKWmCDilp3ilp0gLS0+CiAgPCEtLSBTdWItcGl4ZWxzIGFyZSAxIHdpZGUgeCAyIHRhbGwgdG8gbWF0Y2ggdGVybWluYWwgY2hhciBjZWxsIGFzcGVjdCByYXRpbyAtLT4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIzIiAgeT0iMCIgd2lkdGg9IjEyIiBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIzIiAgeT0iMiIgd2lkdGg9IjIiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSI2IiAgeT0iMiIgd2lkdGg9IjYiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIxMyIgeT0iMiIgd2lkdGg9IjIiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIxIiAgeT0iNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIzIiAgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSI0IiAgeT0iOCIgd2lkdGg9IjEiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSI2IiAgeT0iOCIgd2lkdGg9IjEiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIxMSIgeT0iOCIgd2lkdGg9IjEiICBoZWlnaHQ9IjIiLz4KICA8cmVjdCBmaWxsPSIjZDk3NzU3IiB4PSIxMyIgeT0iOCIgd2lkdGg9IjEiICBoZWlnaHQ9IjIiLz4KPC9zdmc+Cg==)](https://claude.ai/code)

**From shell:**

```bash
claude mcp add claude-historian-mcp -- npx claude-historian-mcp
```

**From inside Claude** (restart required):

```
Add this to our global mcp config: npx claude-historian-mcp

Install this mcp: https://github.com/Vvkmnn/claude-historian-mcp
```

**From any manually configurable `mcp.json`**: (Cursor, Windsurf, etc.)

```json
{
  "mcpServers": {
    "claude-historian-mcp": {
      "command": "npx",
      "args": ["claude-historian-mcp"],
      "env": {}
    }
  }
}
```

There is **no `npm install` required** -- no external dependencies or local databases, only search algorithms.

However, if `npx` resolves the wrong package, you can force resolution with:

```bash
npm install -g claude-historian-mcp
```

> **renamed:** This project was renamed from `claude-historian` to `claude-historian-mcp`. Existing users should update your install command and MCP config args to `claude-historian-mcp`.

## [skill](.claude/skills/claude-historian)

Optionally, install the skill to teach Claude when to proactively use historian:

```bash
npx skills add Vvkmnn/claude-historian-mcp --skill claude-historian --global
# Optional: add --yes to skip interactive prompt and install to all agents
```

This makes Claude automatically check your history before web searches, when encountering errors, or at session start. The MCP works without the skill, but the skill improves discoverability.

## [plugin](https://github.com/Vvkmnn/claude-emporium)

For automatic history search with hooks and commands, install from the [claude-emporium](https://github.com/Vvkmnn/claude-emporium) marketplace:

```bash
/plugin marketplace add Vvkmnn/claude-emporium
/plugin install claude-historian@claude-emporium
```

The **claude-historian** plugin provides:

**Hooks** (targeted, zero overhead on success):

- Before WebSearch/WebFetch → Check `find_similar_queries`
- Before EnterPlanMode → Check `search_plans`
- Before Task agents → Check `find_tool_patterns`
- After Bash errors → Check `get_error_solutions`

**Command:** `/historian-search <query>`

Requires the MCP server installed first. See the emporium for other Claude Code plugins and MCPs.

## features

[MCP server](https://modelcontextprotocol.io/) that gives Claude access to your conversation history. Fast search with smart prioritization.

Runs locally (with cool shades `[⌐■_■] 📜`):

#### `search_conversations`

Search your conversation history for past solutions, discussions, and context.

```
[⌐■_■] 📜 search_conversations query=<query>
  > "How did we fix that Redis connection pooling nightmare?"
  > "Docker container keeps crashing on Kubernetes deployment"
  > "React infinite re-render loop - useEffect dependency hell"
```

```json
[⌐■_■] 📜 "docker auth" | 2 results

{
  "results": [{
    "type": "assistant",
    "ts": "2h ago",
    "content": "Fixed Docker auth by updating registry credentials...",
    "project": "my-app",
    "score": 15,
    "ctx": { "filesReferenced": ["docker-compose.yml"], "toolsUsed": ["Edit", "Bash"] }
  }]
}
```

#### `find_file_context`

Track modifications, edits, and discussions about specific files across sessions.

```
[⌐□_□] 📜 find_file_context filepath=<filepath>
  > "package.json changes that broke everything last month"
  > "When we accidentally committed .env to main branch"
  > "Authentication service refactor - before/after comparison"
```

```json
[⌐□_□] 📜 "package.json" | 5 operations

{
  "filepath": "package.json",
  "operations": [{
    "type": "edit",
    "ts": "1d ago",
    "changes": ["added vitest dependency", "updated build script"],
    "ctx": { "filesReferenced": ["package.json", "vitest.config.ts"] }
  }]
}
```

#### `get_error_solutions`

Find how you've resolved similar errors before, with code fixes and patterns.

```
[⌐×_×] 📜 get_error_solutions error_pattern=<error>
  > "MODULE_NOT_FOUND - the classic npm/yarn version mismatch"
  > "CORS preflight failing - but only on production Fridays?"
  > "Database deadlock during Black Friday traffic spike"
```

```json
[⌐×_×] 📜 "ENOENT no such file" | 2 solutions

{
  "solutions": [{
    "pattern": "ENOENT: no such file or directory",
    "frequency": 3,
    "fixes": [{ "content": "Created missing directory", "code": ["mkdir -p ./dist"] }]
  }]
}
```

#### `find_similar_queries`

Discover related questions you've asked before and their answers.

```
[⌐◆_◆] 📜 find_similar_queries query=<query>
  > "Database queries slower than my morning coffee brewing"
  > "How to implement error boundaries without losing sanity"
  > "State management: Redux vs Zustand vs just useState"
```

```json
[⌐◆_◆] 📜 "typescript error handling" | 3 similar

{
  "similar": [{
    "query": "how to handle async errors in typescript",
    "similarity": 0.72,
    "ts": "3d ago",
    "project": "api-server"
  }]
}
```

#### `list_recent_sessions`

Browse your recent Claude sessions with project context and accomplishments.

```
[⌐○_○] 📜 list_recent_sessions
  > "Tuesday debugging marathon: 9pm-3am flaky test hunt"
  > "Performance optimization sprint - reduced bundle 40%"
  > "The great TypeScript migration of 2024"
```

```json
[⌐○_○] 📜 all | 3 sessions

{
  "sessions": [{
    "id": "68d5323b",
    "ts": "2h ago",
    "duration": 45,
    "messages": 128,
    "project": "my-app",
    "tools": ["Edit", "Bash", "Read"],
    "accomplishments": ["fixed auth bug", "added unit tests"]
  }]
}
```

#### `find_tool_patterns`

Learn from your successful tool usage workflows and common sequences.

```
[⌐⎚_⎚] 📜 find_tool_patterns tool_name=<tool>
  > "Read → Edit → Bash combo for rapid prototyping"
  > "When I use Grep vs Task for different searches"
  > "Git operations during feature branch management"
```

```json
[⌐⎚_⎚] 📜 "Edit" | 3 patterns

{
  "tool": "Edit",
  "patterns": [{
    "name": "Read → Edit → Bash",
    "uses": 7,
    "workflow": "Read → Edit → Bash",
    "practice": "Read file, edit, then run tests (7x successful)"
  }]
}
```

#### `search_plans`

Search Claude Code plan files for past implementation approaches, decisions, and patterns.

```
[⌐▣_▣] 📜 search_plans query=<query>
  > "How did we architect the authentication system?"
  > "Database migration strategy from last refactor"
  > "API versioning approach we decided on"
```

```json
[⌐▣_▣] 📜 "auth implementation" | 2 plans

{
  "plans": [{
    "file": "implement-oauth.md",
    "ts": "3d ago",
    "project": "my-app",
    "summary": "OAuth2 implementation with refresh tokens...",
    "decisions": ["chose PKCE flow", "JWT for access tokens"]
  }]
}
```

#### `search_config`

Search .claude configuration files (rules, skills, agents, CLAUDE.md) for guidance and patterns.

```
[⌐◈_◈] 📜 search_config query=<query>
  > "What are my rules about minimalism and code quality?"
  > "Find the systematic debugging skill documentation"
  > "Search for test-driven development guidelines"
```

```json
[⌐◈_◈] 📜 "verify everything" | 2 results

{
  "results": [{
    "type": "assistant",
    "ts": "1/31/2026",
    "content": "# Verify Everything\n\n## Rule\nEvery claim must be anchored to evidence...",
    "file": "/Users/v/.claude/rules/verify.md",
    "category": "global-rules",
    "score": 34
  }]
}
```

#### `search_tasks`

Search task management data for pending, completed, and in-progress tasks.

```
[⌐◇_◇] 📜 search_tasks query=<query>
  > "Find pending tasks related to documentation"
  > "What tasks mention the authentication system?"
  > "Search for in-progress refactoring tasks"
```

```json
[⌐◇_◇] 📜 "documentation" | 3 results

{
  "results": [{
    "type": "assistant",
    "ts": "4h ago",
    "content": "[PENDING] Update API documentation\nAdd missing endpoints and examples to the API docs",
    "file": "/Users/v/.claude/tasks/abc123/5.json",
    "score": 16
  }]
}
```

#### `extract_compact_summary`

Get a concise summary of what was accomplished in a specific session.

```
[⌐◉_◉] 📜 extract_compact_summary session_id=<id>
  > "What did we accomplish in last session?"
  > "Summarize the authentication refactor work"
  > "Key decisions from yesterday's debugging"
```

```json
[⌐◉_◉] 📜 extracting summary from my-app (68d5323b)

{
  "session": {
    "id": "68d5323b",
    "ts": "2h ago",
    "duration": 45,
    "messages": 128,
    "project": "my-app",
    "tools": ["Edit", "Bash", "Read"],
    "files": ["src/auth.ts", "package.json"],
    "accomplishments": ["fixed auth bug", "added unit tests"],
    "decisions": ["chose JWT over sessions"]
  }
}
```

## methodology

How [claude-historian-mcp](https://github.com/Vvkmnn/claude-historian-mcp) [works](https://github.com/Vvkmnn/claude-historian-mcp/tree/master/src):

```
"docker auth" query
      |
      ├─> Parallel Processing (search.ts:174): 15 projects × 10 files concurrently
      |   • Promise.allSettled for 6x speed improvement
      |   • Early termination when sufficient results found
      |   • Enhanced file coverage with comprehensive patterns
      |
      ├─> Enhanced Classification (search.ts:642): implementation → boost tool workflows
      |   • Workflow detection for tool sequences (Edit → Read → Bash)
      |   • Semantic boundary preservation (never truncate mid-function)
      |   • Claude-optimized formatting with rich metadata
      |
      ├─> Smart Ranking (utils.ts:267):
      |   ├─> Core Terms (scoring-constants.ts): "docker" +10, "auth" +10
      |   ├─> Supporting Terms: context words +3 each
      |   ├─> Tool Usage: Edit/Bash references +5
      |   ├─> File References: paths/extensions +3
      |   └─> Project Match: current project +5
      |
      ├─> Results sorted by composite score:
      |   • "Edit workflow (7x successful)" (2h ago) ***** [score: 45]
      |   • "Docker auth with context paths" (yesterday) **** [score: 38]
      |   • "Container debugging patterns" (last week) *** [score: 22]
      |
      └─> Return Claude Code optimized results
```

**Core optimizations:**

- [parallel processing](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L174): `Promise.allSettled` for 6x speed improvement across projects and files
- [workflow detection](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L1122): Captures tool sequences like "Edit → Read → Bash" patterns
- [enhanced file matching](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L793): Comprehensive path variations with case-insensitive matching
- [intelligent deduplication](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search-helpers.ts#L40): Content-based deduplication preserving highest-scoring results
- [intelligent truncation](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/formatter.ts#L46): Never truncates mid-function or mid-error
- [Claude-optimized formatting](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/formatter.ts#L26): Rich metadata with technical content prioritization

**Search strategies:**

- **[JSON streaming parser](https://en.wikipedia.org/wiki/JSON_streaming)** ([parseJsonlFile](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/parser.ts#L16)): Reads Claude Code conversation files on-demand without full deserialization
- **[LRU caching](<https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU)>)** ([messageCache](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L27)): In-memory cache with intelligent eviction for frequently accessed conversations
- **[TF-IDF inspired scoring](https://en.wikipedia.org/wiki/Tf%E2%80%93idf)** ([calculateRelevanceScore](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/utils.ts#L267)): Term frequency scoring with document frequency weighting for relevance
- **[Query classification](https://en.wikipedia.org/wiki/Text_classification)** ([classifyQueryType](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L642)): Naive Bayes-style classification (error/implementation/analysis/general) with adaptive limits
- **[Edit distance](https://en.wikipedia.org/wiki/Edit_distance)** ([calculateQuerySimilarity](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search-helpers.ts#L157)): Fuzzy matching for technical terms and typo tolerance
- **[Exponential time decay](https://en.wikipedia.org/wiki/Exponential_decay)** (getTimeRangeFilter): Recent messages weighted higher with configurable half-life
- **[Parallel file processing](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)** ([getErrorSolutions](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L985)): Concurrent project scanning with early termination for 0.8s response times
- **[Workflow pattern recognition](https://en.wikipedia.org/wiki/Sequential_pattern_mining)** ([getToolPatterns](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L1122)): Detects tool usage sequences and related workflows for learning
- **[Enhanced file context](<https://en.wikipedia.org/wiki/Path_(computing)>)** ([findFileContext](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L793)): Multi-project search with comprehensive path matching
- **[Content-aware truncation](https://en.wikipedia.org/wiki/Text_segmentation)** ([smartTruncation](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/formatter.ts#L46)): Intelligent content boundaries over arbitrary character limits
- **[Technical content prioritization](https://en.wikipedia.org/wiki/Information_extraction)** ([BeautifulFormatter](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/formatter.ts#L26)): Code blocks, errors, and file paths get full preservation
- **[Query similarity clustering](https://en.wikipedia.org/wiki/Cluster_analysis)** ([findSimilarQueries](https://github.com/Vvkmnn/claude-historian-mcp/blob/master/src/search.ts#L912)): Semantic expansion and pattern grouping for related questions

**Design principles:**

- **Universal engine** -- single search backend for all Claude Code conversations
- **Parallel processing** -- concurrent file scanning across session directories
- **Semantic expansion** -- query synonyms and related terms for better recall
- **Zero dependencies** -- only `@modelcontextprotocol/sdk`, no databases required
- **Offline** -- never leaves your machine, scans local JSONL files only

**File access:**

- Reads from: `~/.claude/conversations/`
- Zero persistent storage or indexing
- Never leaves your machine

**Performance:** See [PERF.md](./PERF.md) for benchmarks, optimization history, and quality scores. Current (v1.0.5): 4.7/5 average score across 10 tools. ~0.9s per query, zero regressions.

## alternatives

Every conversation history tool either loads context always (burning tokens when unused) or requires external runtimes and databases. Historian searches on-demand with zero dependencies.

| Feature                 | **historian**           | Claude Memory           | claude-mem                       | deja                | conversation-search          |
| ----------------------- | ----------------------- | ----------------------- | -------------------------------- | ------------------- | ---------------------------- |
| **Dependencies**        | **Zero**                | Built-in                | Bun + Python + SQLite + Chroma   | Python              | Rust toolchain               |
| **Background service**  | **No**                  | No                      | Yes (port 37777)                 | No                  | No                           |
| **Writes to disk**      | **Never**               | Yes (auto-memory files) | Yes (SQLite + Chroma DB)         | Yes (breadcrumbs)   | Yes (~10% index overhead)    |
| **Session startup**     | **0 tokens**            | ~200 lines loaded       | 5-8k tokens every session        | Skill prompt loaded | 0 tokens                     |
| **Token cost (idle)**   | **0**                   | 200 lines/session       | 5-8k/session                     | Skill prompt/session| 0                            |
| **Search algorithms**   | **[12](#methodology)**  | None (file read)        | Vector + keyword                 | Weighted signals    | BM25 full-text               |
| **Fuzzy matching**      | **Yes**                 | No                      | Yes (vector similarity)          | No                  | No                           |
| **Workflow detection**  | **Yes**                 | No                      | No                               | No                  | No                           |
| **Raw conversations**   | **Yes**                 | No (summaries only)     | No (compressed observations)     | Yes                 | Yes (filtered)               |
| **Maintenance**         | **Zero**                | Zero                    | Worker daemons, migrations       | Skill config        | Index rebuilds               |

**[Claude Memory](https://docs.anthropic.com/en/docs/claude-code/memory)** -- Claude's built-in memory (`CLAUDE.md` + auto-memory). Persists project rules and preferences across sessions. Forward-looking ("always use ESM imports"); not conversation search. **Complementary**: memory for rules, historian for past solutions.

**[claude-mem](https://github.com/thedotmack/claude-mem)** -- Plugin that captures observations via lifecycle hooks, compresses them into SQLite + Chroma, and loads context every session. Requires Bun, Python, and a background worker on port 37777. Real-world testing (270+ sessions): 95% of sessions never query history -- always-on tools pay 5-8k tokens per session regardless. Historian pays 0 tokens idle, 500-2k per query, saving ~475k tokens over 100 sessions. Known issues: creates stub session files that break `--continue`, worker daemon version conflicts, security hooks blocking valid edits.

**[deja](https://github.com/kateleext/deja)** -- Python skill that indexes sessions by episodes and accomplishments. Uses weighted signal ranking (todos > files > text). Requires Python and TodoWrite integration.

**[conversation-search](https://github.com/ticpu/claude-conversation-search-mcp)** -- Rust MCP server using Tantivy BM25 full-text search. Fast indexing (~1000 conversations/second) but requires Rust toolchain and persistent disk index.

## desktop

**Note:** Claude Desktop stores conversations server-side, not locally. The local LevelDB files (`~/Library/Application Support/Claude/`) contain only session tokens, UI preferences, and Intercom state - not conversation content. Claude Desktop support is also blocked by [LevelDB locks](https://github.com/Level/level#open) and [Electron sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox).

This means **local history search for Claude Desktop is not currently possible**. This project focuses on **Claude Code**, which stores full conversation history locally in `~/.claude/projects/`.

You may get some Claude Desktop from Claude Code, but **only when the Claude app is closed**. Furthermore A DXT package and build is available for future compatibility; further investigations are ongoing. Feel free to test with it.

## development

```bash
git clone https://github.com/Vvkmnn/claude-historian-mcp && cd claude-historian-mcp
npm install && npm run build
npm test
```

**Package requirements:**

- **Node.js**: >=20.0.0 (ES modules)
- **Runtime**: `@modelcontextprotocol/sdk`
- **Zero external databases** -- works with `npx`

**Development workflow:**

```bash
npm run build          # TypeScript compilation with executable permissions
npm run dev            # Watch mode with tsc --watch
npm run start          # Run the MCP server directly
npm run lint           # ESLint code quality checks
npm run lint:fix       # Auto-fix linting issues
npm run format         # Prettier formatting (src/)
npm run format:check   # Check formatting without changes
npm run typecheck      # TypeScript validation without emit
npm run test           # Lint + type check
npm run prepublishOnly # Pre-publish validation (build + lint + format:check)
```

**Git hooks (via Husky):**

- **pre-commit**: Auto-formats staged `.ts` files with Prettier and ESLint
- **pre-push**: Runs full validation (format, lint, type-check, build) before push

Contributing:

- Fork the repository and create feature branches
- Test with large conversation histories before submitting PRs
- Follow TypeScript strict mode and [MCP protocol](https://modelcontextprotocol.io/specification) standards

Learn from examples:

- [Official MCP servers](https://github.com/modelcontextprotocol/servers) for reference implementations
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) for best practices
- [Creating Node.js modules](https://docs.npmjs.com/creating-node-js-modules) for npm package development

## license

[MIT](LICENSE)

<hr>

<a href="https://en.wikipedia.org/wiki/Cesare_Maccari"><img src="logo/appius-claudius.jpg" alt="Appius Claudius Caecus in the Senate -- Cesare Maccari" width="100%"></a>

<p align="center">

_**[Appius Claudius Caecus in the Senate](https://en.wikipedia.org/wiki/Cesare_Maccari)** by **[Cesare Maccari](https://en.wikipedia.org/wiki/Cesare_Maccari)** (1888). Roman statesman and father of Latin prose._

</p>
