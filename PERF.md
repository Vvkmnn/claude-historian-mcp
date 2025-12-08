# Performance Tracking

## v1.0.1 (2025-12-08)

### Summary

| Tool | Avg Score | Queries Tested | What's Missing |
|------|-----------|----------------|----------------|
| find_file_context | 3.2/5 | 3 | Actual diffs/changes to files |
| find_tool_patterns | 2.9/5 | 3 | Actual usage examples; returns same results for all tools |
| list_recent_sessions | 2.7/5 | 1 | Actual session accomplishments |
| search_conversations | 2.2/5 | 3 | Actual code/solutions from messages |
| extract_compact_summary | 1.8/5 | 2 | Support for "latest" keyword; richer summaries |
| find_similar_queries | 1.6/5 | 3 | Actual answers to similar queries |
| get_error_solutions | 1.3/5 | 3 | Any solutions at all; better fallback |

**Overall Average**: 2.2/5 | **Range**: 1.3-3.2

### Findings

#### Pattern 1: Metadata Over Content
All tools prioritize **metadata** (file names, timestamps, scores, statistics) over **actionable content** (code, diffs, solutions, examples). This makes results useful for navigation but not for decision-making.

#### Pattern 2: Verbosity Without Value
- `find_file_context` returns very long conversational excerpts but omits the actual file changes
- `search_conversations` shows message snippets but excludes code blocks and solutions

#### Pattern 3: Empty Results
- `get_error_solutions` found zero solutions across all 3 queries
- `find_similar_queries` returned empty for 1/3 queries
- No graceful fallback or alternative suggestions

#### Pattern 4: Tool-Specific Issues
- `find_tool_patterns` returns identical results regardless of which tool is queried
- `extract_compact_summary` doesn't support "latest" keyword, making it harder to use
- `extract_compact_summary` summaries are extremely brief (just tools + files list)

### Recommendations

#### High Priority (Biggest Impact)
1. **Extract code blocks from messages** (`search_conversations`)
   - Parse markdown code fences from conversation content
   - Include actual solution code, not just snippets

2. **Include actual file changes** (`find_file_context`)
   - Extract content from EDIT tool calls
   - Show before/after or diff format

3. **Return answers with similar queries** (`find_similar_queries`)
   - Include the assistant's response to the similar query
   - Show why queries are similar (semantic connection)

4. **Implement fallback for empty results** (`get_error_solutions`)
   - When no exact match, show related error solutions
   - Or fall back to general troubleshooting conversation search

#### Medium Priority
5. **Add usage examples to tool patterns** (`find_tool_patterns`)
   - Extract actual tool call examples from conversations
   - Fix bug where all tools return identical results

6. **Support "latest" keyword** (`extract_compact_summary`)
   - Map "latest" to most recent session ID
   - Make tool more user-friendly

7. **Richer summaries** (`extract_compact_summary`, `list_recent_sessions`)
   - Include what was accomplished, not just metrics
   - Brief outcome or key deliverables

#### Low Priority (Nice to Have)
8. **Reduce verbosity** (`find_file_context`)
   - Trim long conversational excerpts
   - Focus on technical content only

---

### Tool Evaluations

#### 1. search_conversations (Avg: 2.2/5)

**Queries Tested**: 3

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "fix typescript error" | 2.3/5 | Found related messages but no actual error fixes |
| "implement feature" | 2.1/5 | Metadata only, no implementation details |
| "debug build" | 2.3/5 | Found relevant matches but no debugging steps |

**Sample Output** (Query: "fix typescript error"):
```
[⌐■_■] Searching: Claude Code
Query: "fix typescript error" | Action: Conversation search
Found 5 messages, showing 3 highest-value:

1. ASSISTANT 11/27/2025
   /.claude/settings.js | .claude/settings.js | .claude/commands/commit.md | git add | git commit
   Project: historian | Files: /.claude/settings.json, .claude/settings.json, .claude/commands/commit.md

2. ASSISTANT 11/25/2025
   Unfortunately, ccusage statusline is in beta and doesn't have `--hide/--show` flags yet...

3. ASSISTANT 11/25/2025
   I see a duplicate `ruff` server config and missing `lua_ls` configuration...
```

**What's Missing**:
- Actual error messages from conversations
- Code that fixed the errors
- Commands or steps taken to resolve
- Before/after code examples

---

#### 2. find_file_context (Avg: 3.2/5)

**Queries Tested**: 3

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "package.json" | 3.2/5 | Very verbose context, missing actual changes |
| "tsconfig.json" | 3.1/5 | Found operation, but limited context |
| "index.ts" | 3.2/5 | Good conversational context, no diffs |

**Sample Output** (Query: "package.json", truncated):
```
[⌐□_□] Searching: Claude Code
Target: "package.json" | Action: File change history
Found 7 operations, showing 7 with complete context:

1. EDIT 20m ago | File: package.json
   Message 1: Now let me evaluate each output using Claude's evaluation criteria...
   Files: PERF.md, package.json

2. READ 35m ago | File: package.json
   Message 1: I've created a comprehensive plan for renaming the project...
```

**What's Missing**:
- Actual file diffs (what lines changed)
- Before/after code comparison
- Structured summary of modifications (what was added/removed/changed)

---

#### 3. find_similar_queries (Avg: 1.6/5)

**Queries Tested**: 3

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "how to debug" | 1.3/5 | Empty results |
| "add new tool" | 1.6/5 | Found matches but only scores, no answers |
| "fix error" | 1.8/5 | Found matches with scores, missing answers |

**Sample Output** (Query: "fix error"):
```
[⌐◆_◆] Searching: Claude Code
Query: "fix error" | Action: Similar queries & patterns
1. 11/26/2025 (0.3): Lets fix a big with claude as a test
   Project: nvim

2. 11/25/2025 (0.3): Try again, made errors
   Project: nvim

3. 11/27/2025 (0.2): 6419 is failing, can you fix: [Image #1]
   Project: eval
```

**What's Missing**:
- The actual answers/solutions from those conversations
- Why these queries are similar (semantic connection)
- Whether the issues were resolved

---

#### 4. get_error_solutions (Avg: 1.3/5)

**Queries Tested**: 3

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "Cannot find module" | 1.3/5 | No solutions found |
| "Type error" | 1.3/5 | No solutions found |
| "npm ERR" | 1.3/5 | No solutions found |

**Sample Output** (all queries):
```
[⌐×_×] Searching: Claude Code
Error: "undefined" | Action: Solution lookup
No error solutions found.
```

**What's Missing**:
- Any error solutions from history
- Fallback to general search when no exact match
- Related error patterns or troubleshooting steps

---

#### 5. find_tool_patterns (Avg: 2.9/5)

**Queries Tested**: 3

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "Edit" | 2.9/5 | Shows stats but same results for all tools (!)|
| "Bash" | 2.9/5 | Identical output to Edit query |
| "Read" | 2.9/5 | Identical output to Edit query |

**Sample Output** (all 3 queries returned identical results):
```
[⌐⎚_⎚] Searching: Claude Code + Desktop
Tool: "Edit" | Action: Pattern analysis | Type: tools
Found 3 patterns, showing 3 highest-value (100% success rate):

1. Edit (2 uses, 2% efficiency)
   Pattern: Edit usage pattern
   Best Practice: Edit used 2x successfully

2. Read (2 uses, 2% efficiency)
   Pattern: Read usage pattern
   Best Practice: Read used 2x successfully

3. Bash (1 uses, 1% efficiency)
   Pattern: Bash usage pattern
   Best Practice: Bash used 1x successfully
```

**What's Missing**:
- Actual code examples of successful tool usage
- Context of what was being done
- Tool-specific results (currently returns same data regardless of query)
- Common patterns or anti-patterns

---

#### 6. list_recent_sessions (Avg: 2.7/5)

**Queries Tested**: 1

| Query | Score | Key Observation |
|-------|-------|-----------------|
| limit=5 | 2.7/5 | Metrics without accomplishments |

**Sample Output**:
```
[⌐○_○] Searching: Claude Code + Desktop
Action: Recent session analysis | With summaries
Found 5 sessions, showing 5 most productive (100% activity):

1. agent-12 36m ago
   14 msgs (0m) | Productivity: 70% | Project: praetorian | Tools: Glob, Read, Bash

2. 68d5323b just now
   179 msgs (57m) | Productivity: 16% | Project: historian | Tools: Task, Bash, AskUserQuestion

3. 1171d8f7 just now
   49 msgs (37m) | Productivity: 7% | Project: praetorian | Tools: WebFetch, Task, AskUserQuestion
```

**What's Missing**:
- What was accomplished in each session
- Key outcomes or deliverables
- Files modified
- Whether goals were achieved

---

#### 7. extract_compact_summary (Avg: 1.8/5)

**Queries Tested**: 2

| Query | Score | Key Observation |
|-------|-------|-----------------|
| "latest" | 1.3/5 | Not supported, returns error |
| "68d5323b" | 2.2/5 | Works but very brief summary |

**Sample Output** (Query: "latest"):
```
[⌐◉_◉] Searching: Claude Code
Session: "latest" | Action: Compact summary | Focus: all

No session found for ID: latest
```

**Sample Output** (Query: "68d5323b"):
```
[⌐◉_◉] Searching: Claude Code + Desktop
Session: "68d5323b" | Action: Compact summary | Focus: all

Smart Summary (10 msgs)

**Tools:** Task, Bash, AskUserQuestion
**Files:** PERF.md, //github.c
```

**What's Missing**:
- Support for "latest" keyword
- More than just tools + files (what was accomplished?)
- Actionable insights or workflow steps
- Important decisions or code examples

---

## Quality Scale

Each tool output is evaluated by Claude on these dimensions:

| Dimension | Weight | 5 (Best) | 1 (Worst) |
|-----------|--------|----------|-----------|
| Actionability | 40% | Can act immediately (code, commands, paths) | No actionable content |
| Relevance | 30% | Directly answers the query | Unrelated to query |
| Completeness | 20% | Full context provided | Missing critical info |
| Efficiency | 10% | Minimal tokens, max value | Verbose, redundant |

**Composite Score** = (Actionability × 0.4) + (Relevance × 0.3) + (Completeness × 0.2) + (Efficiency × 0.1)

---

## Benchmark Commands

Run these commands to reproduce the v1.0.1 measurements:

### search_conversations
```bash
# Query 1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_conversations","arguments":{"query":"fix typescript error","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_conversations","arguments":{"query":"implement feature","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 3
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_conversations","arguments":{"query":"debug build","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### find_file_context
```bash
# Query 1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_file_context","arguments":{"filepath":"package.json","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_file_context","arguments":{"filepath":"tsconfig.json","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 3
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_file_context","arguments":{"filepath":"index.ts","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### find_similar_queries
```bash
# Query 1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_similar_queries","arguments":{"query":"how to debug","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_similar_queries","arguments":{"query":"add new tool","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 3
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_similar_queries","arguments":{"query":"fix error","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### get_error_solutions
```bash
# Query 1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_error_solutions","arguments":{"error":"Cannot find module","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_error_solutions","arguments":{"error":"Type error","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 3
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_error_solutions","arguments":{"error":"npm ERR","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### find_tool_patterns
```bash
# Query 1
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_tool_patterns","arguments":{"tool_name":"Edit","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_tool_patterns","arguments":{"tool_name":"Bash","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 3
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_tool_patterns","arguments":{"tool_name":"Read","limit":3}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### list_recent_sessions
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_recent_sessions","arguments":{"limit":5}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

### extract_compact_summary
```bash
# Query 1 (test "latest" keyword)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"extract_compact_summary","arguments":{"session_id":"latest"}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'

# Query 2 (with actual session ID from list_recent_sessions)
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"perf","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"extract_compact_summary","arguments":{"session_id":"68d5323b"}}}' | timeout 5s node dist/index.js 2>/dev/null | tail -1 | jq -r '.result.content[0].text'
```

---

## History

| Version | Date | Avg Score | Key Changes |
|---------|------|-----------|-------------|
| 1.0.1 | 2025-12-08 | 2.2/5 | Baseline established with 18 multi-query benchmarks |
