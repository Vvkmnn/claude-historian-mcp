/**
 * Scroll-corner border formatter for MCP tool output.
 *
 * Every tool response is wrapped in a half-box border with a scroll emoji
 * as the top-left corner. The format maximizes information density while
 * remaining visually scannable in Claude Code's output pane.
 */
import {
  CompactMessage,
  SearchResult,
  FileContext,
  ErrorSolution,
  ToolPattern,
  PlanSearchResult,
  SessionInfo,
  CompactSummaryData,
} from './types.js';

/** Utility type: augment `T` with a numeric `score` field. */
type Scored<T> = T & { score: number };

// ── Layout helpers ─────────────────────────────────────────────────

/**
 * Wrap content in a scroll-corner half-box border.
 *
 * ```
 *  📜 ── search "query" ── 5 results
 *
 *   │   {line1}
 *   │   {line2}
 *   └   {lastLine}
 * ```
 *
 * @param header - The top-line summary (query, result count, token estimate).
 * @param body - Multi-line content to wrap.
 * @returns Formatted string ready for MCP tool output.
 */
function fmt(header: string, body: string): string {
  const lines = body.split('\n');
  const top = ` 📜 ── ${header}`;
  if (lines.length <= 1) return `${top}\n\n  └   ${lines[0] || ''}`;
  const mid = lines.slice(0, -1).map((l) => `  │   ${l}`);
  const bot = `  └   ${lines[lines.length - 1]}`;
  return [top, '', ...mid, bot].join('\n');
}

/**
 * Normalize raw additive scores to 0-100 range within a result set.
 *
 * @param items - Array of scored objects.
 * @returns The same array with `score` fields scaled to 0-100.
 */
function normalizeScores<T extends { score?: number | null }>(items: T[]): T[] {
  const scores = items.map((i) => i.score ?? 0).filter((s) => s > 0);
  if (scores.length === 0) return items;
  const maxScore = Math.max(...scores);
  if (maxScore === 0) return items;
  return items.map((i) => ({
    ...i,
    score: i.score ? Math.round((i.score / maxScore) * 100) : i.score,
  }));
}

/**
 * Approximate token count using a chars/4 heuristic.
 *
 * @param text - Raw text to estimate.
 * @returns Estimated token count (ceiling).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate content for summary mode.
 *
 * Strips fenced code blocks and collapses whitespace before truncating
 * to 200 characters.
 *
 * @param content - Full message content.
 * @returns Abbreviated content suitable for summary-level display.
 */
function summarizeContent(content: string): string {
  const stripped = content.replace(/```[\s\S]*?```/g, '[code]').replace(/\n{2,}/g, '\n');
  return stripped.length > 200 ? stripped.substring(0, 200) + '...' : stripped;
}

// ── Formatter class ────────────────────────────────────────────────

/**
 * Formats MCP tool results into scroll-corner bordered output.
 *
 * Each public `format*` method corresponds to one MCP tool. Results are
 * JSON-structured, score-normalized, and wrapped in the half-box border.
 */
export class BeautifulFormatter {
  constructor() {
    // Scroll-corner border formatter with maximum information density
  }

  private formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      const minutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;

      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return this.smartTruncation(text, maxLength);
  }

  private smartTruncation(text: string, maxLength: number): string {
    // Dynamic sizing based on content type
    const contentType = this.detectContentType(text);

    switch (contentType) {
      case 'code':
        return this.preserveCodeInSummary(text, maxLength);
      case 'error':
        return this.preserveErrorInSummary(text, maxLength);
      case 'technical':
        return this.preserveTechnicalInSummary(text, maxLength);
      default:
        return this.intelligentTextTruncation(text, maxLength);
    }
  }

  /** Cached content type for CompactMessage objects — avoids repeated regex work in loops */
  private getMessageContentType(
    msg: CompactMessage,
  ): 'code' | 'error' | 'technical' | 'conversational' {
    if (!msg._contentType) msg._contentType = this.detectContentType(msg.content);
    return msg._contentType;
  }

  private detectContentType(text: string): 'code' | 'error' | 'technical' | 'conversational' {
    // Code detection
    if (
      text.includes('```') ||
      text.includes('function ') ||
      text.includes('const ') ||
      text.includes('import ') ||
      text.includes('export ')
    ) {
      return 'code';
    }

    // Error detection
    if (text.match(/(error|exception|failed|cannot|unable to)/i)) {
      return 'error';
    }

    // Technical content detection
    if (
      text.match(/\.(ts|js|json|md|py|java|cpp|rs|go|yml|yaml)\b/) ||
      text.includes('src/') ||
      text.includes('./') ||
      text.includes('tool_use')
    ) {
      return 'technical';
    }

    return 'conversational';
  }

  private preserveCodeInSummary(text: string, maxLength: number): string {
    // Extract function names, key identifiers
    const codeElements = text.match(/(function \w+|const \w+|class \w+|export \w+)/g) || [];
    if (codeElements.length > 0) {
      const summary = codeElements.slice(0, 3).join(', ');
      if (summary.length < maxLength) {
        return summary + (codeElements.length > 3 ? '...' : '');
      }
    }
    return this.intelligentTextTruncation(text, maxLength);
  }

  private preserveErrorInSummary(text: string, maxLength: number): string {
    // Keep error type and key details
    const errorMatch = text.match(/(error|exception|failed)[\s\S]*?(\n|$)/i);
    if (errorMatch && errorMatch[0].length <= maxLength) {
      return errorMatch[0].trim();
    }

    // Extract error type at least
    const errorType = text.match(/(TypeError|ReferenceError|SyntaxError|Error):/);
    if (errorType && errorType.index !== undefined) {
      const remaining = maxLength - errorType[0].length - 3;
      const context = text.substring(
        errorType.index + errorType[0].length,
        errorType.index + errorType[0].length + remaining,
      );
      return errorType[0] + ' ' + context + '...';
    }

    return this.intelligentTextTruncation(text, maxLength);
  }

  private preserveTechnicalInSummary(text: string, maxLength: number): string {
    // Extract file references and key technical terms
    const fileRefs = text.match(/[\w\-/\\.]+\.(ts|js|json|md|py|java|cpp|rs|go|yml|yaml)/g) || [];
    const toolRefs = text.match(/tool_use.*?"name":\s*"([^"]+)"/g) || [];

    const keyElements = [...fileRefs.slice(0, 2), ...toolRefs.slice(0, 1)];
    if (keyElements.length > 0) {
      const summary = keyElements.join(' | ');
      if (summary.length <= maxLength) {
        return summary;
      }
    }

    return this.intelligentTextTruncation(text, maxLength);
  }

  private intelligentTextTruncation(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Try to truncate at sentence boundaries
    const sentences = text.split(/[.!?]+/);
    let result = '';

    for (const sentence of sentences) {
      if (result.length + sentence.length + 1 <= maxLength - 3) {
        result += sentence + '.';
      } else {
        break;
      }
    }

    if (result.length > 0) {
      return result + '..';
    }

    // Fallback to word boundaries
    const words = text.split(' ');
    result = '';
    for (const word of words) {
      if (result.length + word.length + 1 <= maxLength - 3) {
        result += word + ' ';
      } else {
        break;
      }
    }

    return result.trim() + '...';
  }

  /**
   * Return a content-type-aware character budget for display truncation.
   *
   * @param content - Raw message content to classify.
   * @returns Character limit (400-700) tuned to the detected content type.
   */
  public getDynamicDisplayLength(content: string): number {
    const contentType = this.detectContentType(content);

    switch (contentType) {
      case 'code':
        return 600;
      case 'error':
        return 700;
      case 'technical':
        return 500;
      default:
        return 400;
    }
  }

  // ── MCP tool operation formatters ───────────────────────────────────

  /**
   * Format `search_conversations` results.
   *
   * @param result - Raw search results.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatSearchConversations(
    result: SearchResult,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `search "${result.searchQuery}" ── ${result.messages.length} results`;

    if (result.messages.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            results: [],
            hint: `No matches for "${result.searchQuery}". Try: fewer/different keywords, broader scope, or scope:"sessions" to browse.`,
          },
          null,
          2,
        ),
      );
    }

    const topMessages = limit ? result.messages.slice(0, limit) : result.messages;

    if (detailLevel === 'raw') {
      return fmt(header, JSON.stringify(topMessages, null, 2));
    }

    const isSummary = detailLevel === 'summary';
    let structured = {
      results: topMessages.map((msg) => ({
        type: msg.type,
        ts: this.formatTimestamp(msg.timestamp),
        content: isSummary ? summarizeContent(msg.content) : msg.content,
        project: msg.projectPath?.split('/').pop() || null,
        score: msg.finalScore || msg.relevanceScore || null,
        ctx: isSummary ? undefined : msg.context || null,
      })),
    };

    structured = { results: normalizeScores(structured.results) };
    const text = JSON.stringify(structured, null, 2);
    const tokens = estimateTokens(text);
    return fmt(`${header} · ${tokens} tokens`, text);
  }

  /**
   * Format `search_config` results.
   *
   * @param result - Raw search results.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatConfigSearch(
    result: SearchResult,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `config "${result.searchQuery}" ── ${result.messages.length} results`;

    if (result.messages.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            results: [],
            hint: `No config matches for "${result.searchQuery}". Try: "rules", "hooks", "skills", or specific setting names.`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(result.messages, null, 2));
    const isSummary = detailLevel === 'summary';

    const structured = {
      results: normalizeScores(
        result.messages.map((msg) => ({
          type: msg.type,
          ts: this.formatTimestamp(msg.timestamp),
          content: isSummary ? summarizeContent(msg.content) : msg.content,
          file: msg.projectPath || null,
          category: msg.sessionId?.replace('config-', '') || null,
          score: msg.relevanceScore || null,
        })),
      ),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  /**
   * Format `search_tasks` results.
   *
   * @param result - Raw search results.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatTaskSearch(result: SearchResult, detailLevel: string = 'summary', limit?: number): string {
    const header = `tasks "${result.searchQuery}" ── ${result.messages.length} results`;

    if (result.messages.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            results: [],
            hint: `No task matches for "${result.searchQuery}". Try broader terms or scope:"conversations".`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(result.messages, null, 2));
    const isSummary = detailLevel === 'summary';

    const structured = {
      results: normalizeScores(
        result.messages.map((msg) => ({
          type: msg.type,
          ts: this.formatTimestamp(msg.timestamp),
          content: isSummary ? summarizeContent(msg.content) : msg.content,
          file: msg.projectPath || null,
          score: msg.relevanceScore || null,
        })),
      ),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  /**
   * Format `search_memories` results.
   *
   * @param result - Raw search results.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatMemorySearch(
    result: SearchResult,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `memories "${result.searchQuery}" ── ${result.messages.length} results`;

    if (result.messages.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            results: [],
            hint: `No memory matches for "${result.searchQuery}". Memories are in ~/.claude/projects/*/memory/.`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(result.messages, null, 2));
    const isSummary = detailLevel === 'summary';

    const structured = {
      results: normalizeScores(
        result.messages.map((msg) => ({
          ts: this.formatTimestamp(msg.timestamp),
          content: isSummary ? summarizeContent(msg.content) : msg.content,
          project: msg.projectPath?.split('/').pop() || null,
          file: msg.sessionId || null,
          score: msg.relevanceScore || null,
        })),
      ),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  /**
   * Format `find_similar_queries` results.
   *
   * @param queries - Matched similar query messages.
   * @param originalQuery - The user's original query string.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatSimilarQueries(
    queries: CompactMessage[],
    originalQuery: string,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `similar "${originalQuery}" ── ${queries.length} similar`;

    if (queries.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            similar: [],
            hint: `No similar queries found for "${originalQuery}". Try scope:"conversations" for broader search.`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(queries, null, 2));
    const isSummary = detailLevel === 'summary';

    const clusteredQueries = this.clusterBySemantic(queries, originalQuery);
    const highValueQueries = clusteredQueries.filter(
      (q) => q.relevanceScore && q.relevanceScore > 0.1,
    );
    const topQueries = limit ? highValueQueries.slice(0, limit) : highValueQueries;

    const structured = {
      similar: normalizeScores(
        topQueries.map((q) => ({
          question: isSummary ? summarizeContent(q.content) : q.content,
          answer: q.context?.claudeInsights?.[0] || null,
          ts: this.formatTimestamp(q.timestamp),
          project: q.projectPath?.split('/').pop() || null,
          score: q.relevanceScore || null,
          ctx: isSummary ? null : q.context || null,
        })),
      ),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private clusterBySemantic(queries: CompactMessage[], originalQuery: string): CompactMessage[] {
    // Boost relevance scores based on semantic similarity
    return queries
      .map((query) => {
        let boostedScore = query.relevanceScore || 0;

        // Boost for exact keyword matches
        const originalWords = originalQuery.toLowerCase().split(/\s+/);
        const queryWords = query.content.toLowerCase().split(/\s+/);
        const matchCount = originalWords.filter((word) => queryWords.includes(word)).length;
        boostedScore += matchCount * 0.1;

        // Boost for technical similarity
        if (this.getMessageContentType(query) === this.detectContentType(originalQuery)) {
          boostedScore += 0.2;
        }

        // Boost for actionable content
        if (/(fix|solve|implement|build|deploy)/.test(query.content.toLowerCase())) {
          boostedScore += 0.15;
        }

        return { ...query, relevanceScore: Math.min(boostedScore, 1.0) };
      })
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Format `find_file_context` results.
   *
   * @param contexts - File operation contexts found.
   * @param filepath - The queried file path.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @returns Scroll-bordered formatted string.
   */
  formatFileContext(
    contexts: FileContext[],
    filepath: string,
    detailLevel: string = 'summary',
  ): string {
    const header = `files "${filepath}" ── ${contexts.length} operations`;

    if (contexts.length === 0) {
      return fmt(header, '{"operations":[]}');
    }

    if (detailLevel === 'raw') return fmt(header, JSON.stringify(contexts, null, 2));
    const isSummary = detailLevel === 'summary';

    const rankedContexts = this.rankFileContextsByImpact(contexts);
    const topContexts = rankedContexts.slice(0, 15);

    const structured = {
      filepath,
      operations: topContexts.map((ctx) => ({
        type: ctx.operationType,
        ts: this.formatTimestamp(ctx.lastModified),
        changes: this.extractFileChanges(ctx.relatedMessages, filepath),
        content: isSummary
          ? summarizeContent(ctx.relatedMessages[0]?.content || '')
          : ctx.relatedMessages[0]?.content || null,
        ctx: isSummary ? null : ctx.relatedMessages[0]?.context || null,
      })),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private rankFileContextsByImpact(contexts: FileContext[]): FileContext[] {
    return contexts
      .map((context) => {
        let score = 0;

        // Higher score for more recent operations
        const daysSince =
          (Date.now() - new Date(context.lastModified).getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysSince); // Recent operations score higher

        // Boost for critical operations
        if (context.operationType.toLowerCase().includes('edit')) score += 20;
        if (context.operationType.toLowerCase().includes('create')) score += 15;
        if (context.operationType.toLowerCase().includes('read')) score += 5;

        // Boost for more messages (indicates complex operations)
        score += context.relatedMessages.length * 2;

        // Boost for technical content
        context.relatedMessages.forEach((msg) => {
          const contentType = this.getMessageContentType(msg);
          if (contentType === 'code') score += 10;
          if (contentType === 'error') score += 15;
          if (contentType === 'technical') score += 8;
        });

        return { ...context, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /** Extract actual file changes from Edit tool usage. */
  private extractFileChanges(messages: CompactMessage[], filepath: string): string[] {
    const changes: string[] = [];
    const filename = filepath.split('/').pop() || filepath;

    for (const msg of messages) {
      const content = msg.content;

      // Prefer structured editDiffs from parsed tool_use inputs
      if (msg.context?.editDiffs?.length) {
        for (const diff of msg.context.editDiffs) {
          changes.push(`Changed: ${diff}`);
        }
        continue;
      }

      // Fallback: regex extraction from content text
      const editMatch = content.match(
        /old_string.*?["']([^"']{10,100})["'].*?new_string.*?["']([^"']{10,100})["']/s,
      );
      if (editMatch) {
        const oldStr = editMatch[1].substring(0, 50).replace(/\n/g, '\\n');
        const newStr = editMatch[2].substring(0, 50).replace(/\n/g, '\\n');
        changes.push(`Changed: "${oldStr}..." → "${newStr}..."`);
        continue;
      }

      // Look for version bumps (common in package.json)
      const versionMatch = content.match(/version.*?(\d+\.\d+\.\d+).*?(\d+\.\d+\.\d+)/i);
      if (versionMatch && filepath.includes('package.json')) {
        changes.push(`Version: ${versionMatch[1]} → ${versionMatch[2]}`);
        continue;
      }

      // Look for "added X", "removed X", "updated X" patterns
      const actionMatch = content.match(
        /(?:added|removed|updated|created|deleted|renamed|fixed)\s+([^.!?\n]{5,60})/i,
      );
      if (actionMatch && content.toLowerCase().includes(filename.toLowerCase())) {
        changes.push(actionMatch[0].trim());
      }
    }

    return [...new Set(changes)].slice(0, 5);
  }

  /**
   * Format `get_error_solutions` results.
   *
   * @param solutions - Matched error/solution pairs.
   * @param errorPattern - The queried error pattern.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatErrorSolutions(
    solutions: ErrorSolution[],
    errorPattern: string,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `errors "${errorPattern}" ── ${solutions.length} solutions`;

    if (solutions.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            solutions: [],
            hint: `No error solutions for "${errorPattern}". Try: exact error text, shorter pattern, or scope:"conversations".`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(solutions, null, 2));
    const isSummary = detailLevel === 'summary';

    const rankedSolutions = this.rankErrorSolutions(solutions);
    const topSolutions = limit ? rankedSolutions.slice(0, limit) : rankedSolutions;

    const structured = {
      error_pattern: errorPattern,
      solutions: topSolutions.map((sol) => {
        const fixes = sol.solution.map((s) => ({
          content: isSummary ? summarizeContent(s.content) : s.content,
          code: isSummary ? null : s.context?.codeSnippets || null,
          files: s.context?.filesReferenced || null,
        }));

        return {
          pattern: sol.errorPattern,
          frequency: sol.frequency,
          fixes: fixes,
          ctx: isSummary ? null : sol.solution[0]?.context || null,
        };
      }),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private rankErrorSolutions(solutions: ErrorSolution[]): ErrorSolution[] {
    return solutions
      .map((solution) => {
        let score = 0;

        // Higher score for more frequent errors (more important to solve)
        score += solution.frequency * 5;

        // Boost for solutions with actionable content
        solution.solution.forEach((sol) => {
          const content = sol.content.toLowerCase();
          if (/(fix|solution|resolved|implemented|deploy)/i.test(content)) score += 20;
          if (/(npm|install|config|update|build)/i.test(content)) score += 15;
          if (this.getMessageContentType(sol) === 'code') score += 25;
          if (this.getMessageContentType(sol) === 'technical') score += 10;
        });

        return { ...solution, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Format `find_tool_patterns` results.
   *
   * @param patterns - Matched tool usage patterns.
   * @param toolName - Optional tool name filter.
   * @param limit - Maximum results to include.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @returns Scroll-bordered formatted string.
   */
  formatToolPatterns(
    patterns: ToolPattern[],
    toolName?: string,
    limit?: number,
    detailLevel: string = 'summary',
  ): string {
    const filter = toolName ? `"${toolName}"` : 'all';
    const header = `tools ${filter} ── ${patterns.length} patterns`;

    if (patterns.length === 0) {
      return fmt(header, '{"patterns":[]}');
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(patterns, null, 2));
    const isSummary = detailLevel === 'summary';

    const rankedPatterns = this.rankToolPatternsByValue(patterns);
    const topPatterns = limit ? rankedPatterns.slice(0, limit) : rankedPatterns;

    const structured = {
      tool: toolName || 'all',
      patterns: topPatterns.map((p) => ({
        name: p.toolName,
        uses: p.successfulUsages.length,
        workflow: p.commonPatterns[0] || null,
        practice: p.bestPractices[0] || null,
        example: isSummary
          ? summarizeContent(p.successfulUsages[0]?.content || '')
          : p.successfulUsages[0]?.content || null,
        ctx: isSummary ? null : p.successfulUsages[0]?.context || null,
      })),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private rankToolPatternsByValue(patterns: ToolPattern[]): ToolPattern[] {
    return patterns
      .map((pattern) => {
        let score = 0;

        // Higher score for more successful usages
        score += pattern.successfulUsages.length * 2;

        // Boost for commonly used tools
        if (/(Read|Edit|Bash|Grep|Glob)/i.test(pattern.toolName)) score += 20;

        // Boost for patterns with actionable practices
        pattern.bestPractices.forEach((practice) => {
          if (/(efficient|fast|optimal|best)/i.test(practice)) score += 10;
          if (practice.length > 50) score += 5; // Detailed practices
        });

        // Prioritize actual patterns (with file names, commands) over workflow patterns
        pattern.commonPatterns.forEach((p) => {
          // Heavy boost for actual file/command patterns (not generic fallbacks)
          if (!p.includes('usage pattern') && !p.includes('→') && p.includes(':')) {
            score += 30; // Actual file-level patterns get highest priority
          }
          // Lower boost for workflow patterns (tool chains)
          else if (/→/.test(p)) {
            score += 5; // Workflows secondary to actual patterns
          }
          // Generic content patterns
          if (/(file|search|edit|build)/i.test(p)) score += 8;
        });

        return { ...pattern, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Format `list_recent_sessions` results.
   *
   * @param sessions - Session metadata records.
   * @param project - Optional project name filter.
   * @param limit - Maximum results to include.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @returns Scroll-bordered formatted string.
   */
  formatRecentSessions(
    sessions: SessionInfo[],
    project?: string,
    limit?: number,
    detailLevel: string = 'summary',
  ): string {
    const filter = project ? `"${project}"` : 'all';
    const header = `sessions ${filter} ── ${sessions.length} sessions`;

    if (sessions.length === 0) {
      return fmt(header, '{"sessions":[]}');
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(sessions, null, 2));

    const rankedSessions = this.rankSessionsByProductivity(sessions);
    const topSessions = limit ? rankedSessions.slice(0, limit) : rankedSessions;

    const structured = {
      sessions: topSessions.map((s) => ({
        id: s.session_id?.substring(0, 8) || null,
        ts: this.formatTimestamp(s.end_time ?? s.start_time ?? ''),
        duration: s.duration_minutes || 0,
        messages: s.message_count || 0,
        project: s.project_path?.split('/').pop() || null,
        tools: s.tools_used || null,
        accomplishments: s.accomplishments || null,
      })),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private rankSessionsByProductivity(sessions: SessionInfo[]): Scored<SessionInfo>[] {
    return sessions
      .map((session) => {
        let score = 0;

        // Score based on message density (messages per minute)
        const duration = session.duration_minutes || 1;
        const messageCount = session.message_count || 0;
        const density = messageCount / duration;
        score += density * 10;

        // Boost for recent sessions
        const timestamp = session.end_time || session.start_time;
        if (timestamp) {
          const hoursAgo = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
          score += Math.max(0, 24 - hoursAgo); // Recent sessions score higher
        }

        // Boost for longer sessions (indicates focus work)
        if (duration > 30) score += 20;
        if (duration > 60) score += 30;

        // Boost for high message count (indicates activity)
        if (messageCount > 50) score += 15;
        if (messageCount > 100) score += 25;

        return { ...session, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Format `extract_compact_summary` / `inspect` results.
   *
   * @param sessions - Summary data (typically one element).
   * @param sessionId - Optional session ID used in the header.
   * @returns Scroll-bordered formatted string.
   */
  formatCompactSummary(sessions: CompactSummaryData[], sessionId?: string): string {
    if (sessions.length === 0) {
      const filter = sessionId ? `"${sessionId}"` : 'latest';
      return fmt(`inspect ${filter}`, '{"session":null}');
    }

    const s = sessions[0];
    const projectName = s.project_path?.split('/').pop() || 'unknown';
    const shortId = s.session_id?.substring(0, 8) || sessionId?.substring(0, 8) || 'latest';
    const header = `inspect ${projectName} (${shortId})`;
    const structured = {
      session: {
        id: s.session_id?.substring(0, 8) || null,
        ts: this.formatTimestamp(s.end_time ?? s.start_time ?? ''),
        duration: s.duration_minutes || 0,
        messages: s.message_count || 0,
        project: s.project_path?.split('/').pop() || null,
        tools: s.tools_used || null,
        files: s.files_modified || null,
        accomplishments: s.accomplishments || null,
        decisions: s.key_decisions || null,
      },
    };

    return fmt(header, JSON.stringify(structured, null, 2));
  }

  /**
   * Format `search_plans` results.
   *
   * @param result - Plan search results with relevance scores.
   * @param detailLevel - "summary" (default), "detailed", or "raw".
   * @param limit - Maximum results to include.
   * @returns Scroll-bordered formatted string.
   */
  formatPlanSearch(
    result: PlanSearchResult,
    detailLevel: string = 'summary',
    limit?: number,
  ): string {
    const header = `plans "${result.searchQuery}" ── ${result.plans.length} plans`;

    if (result.plans.length === 0) {
      return fmt(
        header,
        JSON.stringify(
          {
            plans: [],
            hint: `No plan matches for "${result.searchQuery}". Plans are in ~/.claude/plans/.`,
          },
          null,
          2,
        ),
      );
    }

    void limit;
    if (detailLevel === 'raw') return fmt(header, JSON.stringify(result.plans, null, 2));
    const isSummary = detailLevel === 'summary';

    const topPlans = limit ? result.plans.slice(0, limit) : result.plans;

    const structured = {
      plans: normalizeScores(
        topPlans.map((plan) => ({
          name: plan.name,
          ts: this.formatTimestamp(plan.timestamp),
          title: plan.title,
          ...(plan.sessionId ? { session: plan.sessionId } : {}),
          ...(plan.project ? { project: plan.project } : {}),
          goal: this.extractPlanGoal(plan.content),
          key_insight: isSummary ? null : this.extractKeyInsight(plan.content),
          sections: isSummary ? plan.sections.slice(0, 3) : plan.sections.slice(0, 6),
          files: isSummary ? plan.filesMentioned.slice(0, 4) : plan.filesMentioned.slice(0, 8),
          score: plan.relevanceScore,
        })),
      ),
    };

    const text = JSON.stringify(structured, null, 2);
    return fmt(`${header} · ${estimateTokens(text)} tokens`, text);
  }

  private extractPlanGoal(content: string): string | null {
    // Pattern 1: ## Goal section
    const goalMatch = content.match(/##\s*Goal\s*\n+([^\n#]{20,300})/i);
    if (goalMatch) {
      return goalMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Pattern 2: ## Problem/Overview section
    const problemMatch = content.match(/##\s*(?:Problem|Overview|Summary)\s*\n+([^\n#]{20,300})/i);
    if (problemMatch) {
      return problemMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Pattern 3: First substantive paragraph after title
    const paragraphs = content.split(/\n\n+/);
    for (const para of paragraphs.slice(1, 5)) {
      const cleaned = para.replace(/^#+\s*.*$/gm, '').trim();
      if (
        cleaned.length > 30 &&
        cleaned.length < 400 &&
        !cleaned.startsWith('|') &&
        !cleaned.startsWith('-')
      ) {
        return cleaned.replace(/\s+/g, ' ').substring(0, 300);
      }
    }

    return null;
  }

  private extractKeyInsight(content: string): string | null {
    // Priority: Fix/Solution > Approach > Implementation > Steps > Goal fallback

    // Pattern 1: ## Fix or ## Solution section
    const fixMatch = content.match(
      /##\s*(?:Fix|Solution|Resolution)\s*\n+(?:[-*]\s*)?([^\n]{15,200})/i,
    );
    if (fixMatch) {
      const insight = this.cleanInsight(fixMatch[1]);
      if (insight) return insight;
    }

    // Pattern 2: ## Approach section
    const approachMatch = content.match(
      /##\s*(?:Approach|Strategy|Method)\s*\n+(?:[-*]\s*)?([^\n]{15,200})/i,
    );
    if (approachMatch) {
      const insight = this.cleanInsight(approachMatch[1]);
      if (insight) return insight;
    }

    // Pattern 3: First bullet after ## Implementation
    const implMatch = content.match(
      /##\s*Implementation[^\n]*\n+(?:[-*]\s*)?([A-Z][^\n]{15,200})/i,
    );
    if (implMatch) {
      const insight = this.cleanInsight(implMatch[1]);
      if (insight) return insight;
    }

    // Pattern 4: Inline **Goal:** format
    const inlineGoalMatch = content.match(/\*\*Goal:\*\*\s*([^\n]{15,200})/i);
    if (inlineGoalMatch) {
      const insight = this.cleanInsight(inlineGoalMatch[1]);
      if (insight) return insight;
    }

    // Pattern 5: "The fix is" or "Solution:" inline
    const inlineMatch = content.match(
      /(?:the fix is|solution:|approach:|key change:|key decision:)\s*([^\n]{15,200})/i,
    );
    if (inlineMatch) {
      const insight = this.cleanInsight(inlineMatch[1]);
      if (insight) return insight;
    }

    // Pattern 6: First numbered step
    const numberedMatch = content.match(/\n1\.\s+\*?\*?([A-Z][^\n]{20,150})/);
    if (numberedMatch) {
      const insight = this.cleanInsight(numberedMatch[1]);
      if (insight) return insight;
    }

    // Pattern 7: First substantive bullet describing an action
    const actionBulletMatch = content.match(
      /\n[-*]\s+(?:Add|Create|Build|Implement|Fix|Update|Change|Remove|Enable|Configure|Use|Set)\s+([^\n]{15,150})/i,
    );
    if (actionBulletMatch) {
      const insight = this.cleanInsight(actionBulletMatch[0].replace(/^[\n\-*\s]+/, ''));
      if (insight) return insight;
    }

    // Pattern 8: Any bullet point with ** emphasis
    const emphasisBulletMatch = content.match(/\n[-*\d.]+\s+\*\*([^*]{10,100})\*\*/);
    if (emphasisBulletMatch) {
      const insight = this.cleanInsight(emphasisBulletMatch[1]);
      if (insight) return insight;
    }

    return null;
  }

  private cleanInsight(text: string): string | null {
    let cleaned = text
      .replace(/^\*\*|\*\*$/g, '')
      .replace(/^`|`$/g, '')
      .replace(/\*\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleaned.match(/^\*?File:|^Location:|^Path:|^Line[s]?:/i)) {
      return null;
    }

    if (cleaned.length > 150) {
      cleaned = cleaned.substring(0, 147) + '...';
    }

    return cleaned.length >= 15 ? cleaned : null;
  }
}
