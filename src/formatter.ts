// Cool robot face formatter for Claude Historian MCP
import {
  CompactMessage,
  SearchResult,
  FileContext,
  ErrorSolution,
  ToolPattern,
  PlanResult,
  PlanSearchResult,
} from './types.js';

// Robot faces for each MCP tool operation - these are the signature of Claude Historian!
const robots = {
  search: '[⌐■_■]', // search_conversations
  similar: '[⌐◆_◆]', // find_similar_queries
  fileContext: '[⌐□_□]', // find_file_context
  errorSolutions: '[⌐×_×]', // get_error_solutions
  toolPatterns: '[⌐⎚_⎚]', // find_tool_patterns
  sessions: '[⌐○_○]', // list_recent_sessions
  summary: '[⌐◉_◉]', // extract_compact_summary
  plans: '[⌐▣_▣]', // search_plans
};

export class BeautifulFormatter {
  constructor() {
    // Robot face formatter with maximum information density
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
        errorType.index + errorType[0].length + remaining
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

  private extractHighValueContent(text: string): string {
    // REVOLUTIONARY: Maximum information density extraction for Claude Code
    const contentType = this.detectContentType(text);

    if (contentType === 'code' || contentType === 'error' || contentType === 'technical') {
      // Extract core technical elements while preserving completeness
      return this.extractTechnicalEssence(text);
    }

    // For conversational: extract only actionable intelligence
    return this.extractActionableIntelligence(text);
  }

  private extractTechnicalEssence(text: string): string {
    // Extract function signatures, file paths, error messages, key variables
    const technical = [];

    // Function/class/interface declarations
    const declarations = text.match(/(function|class|interface|const|let|var)\s+\w+[^{;]*[{;]/g);
    if (declarations) technical.push(...declarations.slice(0, 2));

    // File paths and imports
    const paths = text.match(/[\w\-./]+\.(ts|js|json|md|py|java|cpp|rs|go|yml|yaml|tsx|jsx)/g);
    if (paths) technical.push(...[...new Set(paths)].slice(0, 3));

    // Error messages (preserve completely)
    const errors = text.match(/(Error|Exception|Failed|Cannot|Unable)[\s\S]*?(?=\n|$)/gi);
    if (errors) technical.push(...errors.slice(0, 1));

    // Key technical terms
    const keyTerms = text.match(
      /(npm|git|build|deploy|test|fix|update|install|configure)\s+[\w-]+/gi
    );
    if (keyTerms) technical.push(...[...new Set(keyTerms)].slice(0, 2));

    if (technical.length > 0) {
      return technical.join(' | ');
    }

    // Fallback: preserve complete technical content
    return text.length > 500 ? text.substring(0, 500) + '...' : text;
  }

  private extractActionableIntelligence(text: string): string {
    // Extract only decisions, solutions, and actions - eliminate noise
    const intelligence = [];

    // Solutions and fixes
    const solutions = text.match(/(fixed|resolved|solution|approach):\s*([^.!?\n]+)/gi);
    if (solutions) intelligence.push(...solutions.slice(0, 2));

    // Concrete actions
    const actions = text.match(
      /(will|should|need to|going to|implemented|added|updated)\s+([^.!?\n]+)/gi
    );
    if (actions) intelligence.push(...actions.slice(0, 2));

    // Key outcomes
    const outcomes = text.match(
      /(success|completed|working|deployed|built|tested)[\s\S]*?(?=[.!?\n]|$)/gi
    );
    if (outcomes) intelligence.push(...outcomes.slice(0, 1));

    if (intelligence.length > 0) {
      return intelligence.join('; ');
    }

    // Last resort: extract first meaningful sentence
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    return (
      sentences[0]?.trim() + (sentences.length > 1 ? '...' : '') || text.substring(0, 100) + '...'
    );
  }

  public getDynamicDisplayLength(content: string): number {
    const contentType = this.detectContentType(content);

    switch (contentType) {
      case 'code':
        return 600; // Increased for complete code context
      case 'error':
        return 700; // Increased for full error context
      case 'technical':
        return 500; // Increased for complete technical context
      default:
        return 400; // Increased for better conversational context
    }
  }

  // MCP Tool Operation Formatters

  formatSearchConversations(result: SearchResult, _detailLevel: string = 'summary'): string {
    const header = `${robots.search} "${result.searchQuery}" | ${result.messages.length} results`;

    if (result.messages.length === 0) {
      return `${header}\n\n{"results":[]}`;
    }

    const rankedMessages = this.rankAndDeduplicateMessages(result.messages);
    const topMessages = rankedMessages.slice(0, 8);

    const structured = {
      results: topMessages.map((msg) => ({
        type: msg.type,
        ts: this.formatTimestamp(msg.timestamp),
        content: msg.content,
        project: msg.projectPath?.split('/').pop() || null,
        score: msg.relevanceScore || msg.score || null,
        ctx: msg.context || null,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
  }

  private rankAndDeduplicateMessages(messages: any[]): any[] {
    // Score messages by information density and uniqueness
    const scored = messages.map((msg) => {
      let score = 0;
      const content = msg.content.toLowerCase();

      // Higher score for technical content
      if (this.detectContentType(msg.content) === 'technical') score += 50;
      if (this.detectContentType(msg.content) === 'code') score += 60;
      if (this.detectContentType(msg.content) === 'error') score += 70;

      // Boost for actionable content
      if (/(fix|solution|implement|deploy|build)/i.test(content)) score += 30;
      if (/(error|fail|issue|problem)/i.test(content)) score += 25;
      if (/(success|complete|working|done)/i.test(content)) score += 20;

      // Penalize generic content
      if (/(hello|thanks|okay|sure|yes|no)$/.test(content.trim())) score -= 20;

      // Boost for file references
      if (msg.context?.filesReferenced?.length) score += msg.context.filesReferenced.length * 10;

      // Boost for tool usage
      if (msg.context?.toolsUsed?.length) score += msg.context.toolsUsed.length * 5;

      return { ...msg, score };
    });

    // Deduplicate similar content
    const deduplicated: any[] = [];
    for (const msg of scored) {
      const isDuplicate = deduplicated.some(
        (existing) => this.calculateSimilarity(msg.content, existing.content) > 0.8
      );
      if (!isDuplicate) {
        deduplicated.push(msg);
      }
    }

    // Sort by score descending
    return deduplicated.sort((a, b) => b.score - a.score);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private aggregateContext(message: any): string {
    const contexts = [];

    if (message.projectPath && message.projectPath !== 'unknown') {
      const projectName = message.projectPath.split('/').pop() || 'unknown';
      contexts.push(`Project: ${projectName}`);
    }

    if (message.context?.filesReferenced?.length) {
      const files = [...new Set(message.context.filesReferenced)].slice(0, 3);
      contexts.push(`Files: ${files.join(', ')}`);
    }

    if (message.context?.toolsUsed?.length) {
      const tools = [...new Set(message.context.toolsUsed)].slice(0, 3);
      contexts.push(`Tools: ${tools.join(' → ')}`);
    }

    if (message.context?.errorPatterns?.length) {
      contexts.push(`Error: ${message.context.errorPatterns[0]}`);
    }

    return contexts.join(' | ');
  }

  formatSimilarQueries(
    queries: CompactMessage[],
    originalQuery: string,
    _detailLevel: string = 'summary'
  ): string {
    const header = `${robots.similar} "${originalQuery}" | ${queries.length} similar`;

    if (queries.length === 0) {
      return `${header}\n\n{"similar":[]}`;
    }

    const clusteredQueries = this.clusterBySemantic(queries, originalQuery);
    const highValueQueries = clusteredQueries.filter(
      (q) => q.relevanceScore && q.relevanceScore > 0.1
    );

    const structured = {
      similar: highValueQueries.map((q) => ({
        question: q.content,
        answer: q.context?.claudeInsights?.[0] || null,
        ts: this.formatTimestamp(q.timestamp),
        project: q.projectPath?.split('/').pop() || null,
        score: q.relevanceScore || null,
        ctx: q.context || null,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
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
        if (this.detectContentType(query.content) === this.detectContentType(originalQuery)) {
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

  formatFileContext(
    contexts: FileContext[],
    filepath: string,
    _detailLevel: string = 'summary',
    _operationType: string = 'all'
  ): string {
    const header = `${robots.fileContext} "${filepath}" | ${contexts.length} operations`;

    if (contexts.length === 0) {
      return `${header}\n\n{"operations":[]}`;
    }

    const rankedContexts = this.rankFileContextsByImpact(contexts);
    const topContexts = rankedContexts.slice(0, 15);

    const structured = {
      filepath,
      operations: topContexts.map((ctx) => ({
        type: ctx.operationType,
        ts: this.formatTimestamp(ctx.lastModified),
        changes: this.extractFileChanges(ctx.relatedMessages, filepath),
        content: ctx.relatedMessages[0]?.content || null,
        ctx: ctx.relatedMessages[0]?.context || null,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
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
          const contentType = this.detectContentType(msg.content);
          if (contentType === 'code') score += 10;
          if (contentType === 'error') score += 15;
          if (contentType === 'technical') score += 8;
        });

        return { ...context, score };
      })
      .sort((a, b) => (b as any).score - (a as any).score);
  }

  private selectBestMessage(messages: any[]): any {
    // Select the message with highest information value
    return messages.reduce((best, current) => {
      const currentType = this.detectContentType(current.content);
      const bestType = this.detectContentType(best.content);

      // Prioritize technical content
      if (currentType === 'code' && bestType !== 'code') return current;
      if (currentType === 'error' && bestType !== 'error' && bestType !== 'code') return current;
      if (currentType === 'technical' && bestType === 'conversational') return current;

      // Prioritize longer, more detailed content
      if (current.content.length > best.content.length * 1.5) return current;

      return best;
    });
  }

  // Extract actual file changes from Edit tool usage
  private extractFileChanges(messages: any[], filepath: string): string[] {
    const changes: string[] = [];
    const filename = filepath.split('/').pop() || filepath;

    for (const msg of messages) {
      const content = msg.content;

      // Look for Edit tool old_string → new_string patterns
      const editMatch = content.match(
        /old_string.*?["']([^"']{10,100})["'].*?new_string.*?["']([^"']{10,100})["']/s
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
        /(?:added|removed|updated|created|deleted|renamed|fixed)\s+([^.!?\n]{5,60})/i
      );
      if (actionMatch && content.toLowerCase().includes(filename.toLowerCase())) {
        changes.push(actionMatch[0].trim());
      }
    }

    return [...new Set(changes)].slice(0, 5);
  }

  // Extract a concise action summary from message content
  private extractActionSummary(content: string, filepath: string): string {
    const filename = filepath.split('/').pop() || filepath;

    // Try to find the most relevant sentence about this file
    const sentences = content.split(/[.!?\n]/).filter((s) => s.trim().length > 10);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(filename.toLowerCase())) {
        const clean = sentence.trim().substring(0, 120);
        if (clean.length > 20) return clean;
      }
    }

    // Fallback: first substantive sentence
    const first = sentences.find((s) => s.trim().length > 20);
    return first ? first.trim().substring(0, 120) : 'File referenced in conversation';
  }

  formatErrorSolutions(
    solutions: ErrorSolution[],
    errorPattern: string,
    _detailLevel: string = 'summary'
  ): string {
    const header = `${robots.errorSolutions} "${errorPattern}" | ${solutions.length} solutions`;

    if (solutions.length === 0) {
      return `${header}\n\n{"solutions":[]}`;
    }

    const rankedSolutions = this.rankErrorSolutions(solutions);
    const topSolutions = rankedSolutions.slice(0, 5);

    const structured = {
      error_pattern: errorPattern,
      solutions: topSolutions.map((sol) => {
        // Include multiple fixes from all solutions, not just the first
        const fixes = sol.solution.map((s) => ({
          content: s.content,
          code: s.context?.codeSnippets || null,
          files: s.context?.filesReferenced || null,
        }));

        return {
          pattern: sol.errorPattern,
          frequency: sol.frequency,
          fixes: fixes,
          ctx: sol.solution[0]?.context || null,
        };
      }),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
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
          if (this.detectContentType(sol.content) === 'code') score += 25;
          if (this.detectContentType(sol.content) === 'technical') score += 10;
        });

        return { ...solution, score };
      })
      .sort((a, b) => (b as any).score - (a as any).score);
  }

  private selectBestSolution(solutions: any[]): any {
    return solutions.reduce((best, current) => {
      // Prioritize technical solutions over conversational
      const currentType = this.detectContentType(current.content);
      const bestType = this.detectContentType(best.content);

      if (currentType === 'code' && bestType !== 'code') return current;
      if (currentType === 'technical' && bestType === 'conversational') return current;

      // Prioritize solutions with actionable language
      if (
        /(fix|solution|resolved)/i.test(current.content) &&
        !/(fix|solution|resolved)/i.test(best.content)
      )
        return current;

      return best;
    });
  }

  formatToolPatterns(
    patterns: ToolPattern[],
    toolName?: string,
    _patternType: string = 'tools'
  ): string {
    const filter = toolName ? `"${toolName}"` : 'all';
    const header = `${robots.toolPatterns} ${filter} | ${patterns.length} patterns`;

    if (patterns.length === 0) {
      return `${header}\n\n{"patterns":[]}`;
    }

    const rankedPatterns = this.rankToolPatternsByValue(patterns);
    const topPatterns = rankedPatterns.slice(0, 8);

    const structured = {
      tool: toolName || 'all',
      patterns: topPatterns.map((p) => ({
        name: p.toolName,
        uses: p.successfulUsages.length,
        workflow: p.commonPatterns[0] || null,
        practice: p.bestPractices[0] || null,
        example: p.successfulUsages[0]?.content || null,
        ctx: p.successfulUsages[0]?.context || null,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
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
      .sort((a, b) => (b as any).score - (a as any).score);
  }

  private calculateToolEfficiency(pattern: ToolPattern): number {
    // Simple efficiency metric based on usage frequency
    const usageCount = pattern.successfulUsages.length;
    return Math.min(100, Math.round((usageCount / 100) * 100));
  }

  private selectBestPattern(patterns: string[]): string {
    // Prioritize workflow patterns with tool chains
    const workflowPattern = patterns.find((p) => /→/.test(p));
    if (workflowPattern) return workflowPattern;

    // Prioritize technical patterns
    const technicalPattern = patterns.find((p) => /(file|search|edit|build|deploy)/i.test(p));
    if (technicalPattern) return technicalPattern;

    return patterns[0] || '';
  }

  private selectBestPractice(practices: string[]): string {
    // Prioritize actionable practices
    const actionablePractice = practices.find((p) => /(use|avoid|ensure|prefer)/i.test(p));
    if (actionablePractice) return actionablePractice;

    // Prioritize detailed practices
    const detailedPractice = practices.find((p) => p.length > 50);
    if (detailedPractice) return detailedPractice;

    return practices[0] || '';
  }

  formatRecentSessions(sessions: any[], project?: string): string {
    const filter = project ? `"${project}"` : 'all';
    const header = `${robots.sessions} ${filter} | ${sessions.length} sessions`;

    if (sessions.length === 0) {
      return `${header}\n\n{"sessions":[]}`;
    }

    const rankedSessions = this.rankSessionsByProductivity(sessions);
    const topSessions = rankedSessions.slice(0, 10);

    const structured = {
      sessions: topSessions.map((s) => ({
        id: s.session_id?.substring(0, 8) || null,
        ts: this.formatTimestamp(s.end_time || s.start_time),
        duration: s.duration_minutes || 0,
        messages: s.message_count || 0,
        project: s.project_path?.split('/').pop() || null,
        tools: s.tools_used || null,
        accomplishments: s.accomplishments || null,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
  }

  private rankSessionsByProductivity(sessions: any[]): any[] {
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
      .sort((a, b) => (b as any).score - (a as any).score);
  }

  private calculateProductivityScore(session: any): number {
    const duration = session.duration_minutes || 1;
    const messageCount = session.message_count || 0;
    const density = messageCount / duration;

    // Normalize to 0-100 scale
    return Math.min(100, Math.round(density * 5));
  }

  private extractSessionTools(session: any): string[] {
    // Extract tools from session metadata if available
    const tools = [];
    if (session.tools_used) {
      tools.push(...session.tools_used.slice(0, 3));
    }
    return tools;
  }

  formatCompactSummary(sessions: any[], sessionId?: string): string {
    if (sessions.length === 0) {
      const filter = sessionId ? `"${sessionId}"` : 'latest';
      return `${robots.summary} ${filter}\n\n{"session":null}`;
    }

    const s = sessions[0];
    // Create a useful header with project name and session info
    const projectName = s.project_path?.split('/').pop() || 'unknown';
    const shortId = s.session_id?.substring(0, 8) || sessionId?.substring(0, 8) || 'latest';
    const header = `${robots.summary} extracting summary from ${projectName} (${shortId})`;
    const structured = {
      session: {
        id: s.session_id?.substring(0, 8) || null,
        ts: this.formatTimestamp(s.end_time || s.start_time),
        duration: s.duration_minutes || 0,
        messages: s.message_count || 0,
        project: s.project_path?.split('/').pop() || null,
        tools: s.tools_used || null,
        files: s.files_modified || null,
        accomplishments: s.accomplishments || null,
        decisions: s.key_decisions || null,
      },
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
  }

  formatPlanSearch(result: PlanSearchResult, _detailLevel: string = 'summary'): string {
    const header = `${robots.plans} "${result.searchQuery}" | ${result.plans.length} plans`;

    if (result.plans.length === 0) {
      return `${header}\n\n{"plans":[]}`;
    }

    const topPlans = result.plans.slice(0, 10);

    const structured = {
      plans: topPlans.map((plan) => ({
        name: plan.name,
        ts: this.formatTimestamp(plan.timestamp),
        title: plan.title,
        goal: this.extractPlanGoal(plan.content),
        key_insight: this.extractKeyInsight(plan.content),
        sections: plan.sections.slice(0, 6),
        files: plan.filesMentioned.slice(0, 8),
        score: plan.relevanceScore,
      })),
    };

    return `${header}\n\n${JSON.stringify(structured, null, 2)}`;
  }

  private extractPlanGoal(content: string): string | null {
    // Try to extract meaningful goal/summary from plan content

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
    // Extract the actionable insight - what was decided/fixed/implemented
    // Priority: Fix/Solution > Approach > Implementation > Steps > Goal fallback

    // Pattern 1: ## Fix or ## Solution section - get first line/bullet
    const fixMatch = content.match(
      /##\s*(?:Fix|Solution|Resolution)\s*\n+(?:[-*]\s*)?([^\n]{15,200})/i
    );
    if (fixMatch) {
      const insight = this.cleanInsight(fixMatch[1]);
      if (insight) return insight;
    }

    // Pattern 2: ## Approach section - first sentence
    const approachMatch = content.match(
      /##\s*(?:Approach|Strategy|Method)\s*\n+(?:[-*]\s*)?([^\n]{15,200})/i
    );
    if (approachMatch) {
      const insight = this.cleanInsight(approachMatch[1]);
      if (insight) return insight;
    }

    // Pattern 3: First bullet after ## Implementation that starts with capital
    const implMatch = content.match(
      /##\s*Implementation[^\n]*\n+(?:[-*]\s*)?([A-Z][^\n]{15,200})/i
    );
    if (implMatch) {
      const insight = this.cleanInsight(implMatch[1]);
      if (insight) return insight;
    }

    // Pattern 4: Inline **Goal:** format (common in some plans)
    const inlineGoalMatch = content.match(/\*\*Goal:\*\*\s*([^\n]{15,200})/i);
    if (inlineGoalMatch) {
      const insight = this.cleanInsight(inlineGoalMatch[1]);
      if (insight) return insight;
    }

    // Pattern 5: "The fix is" or "Solution:" inline
    const inlineMatch = content.match(
      /(?:the fix is|solution:|approach:|key change:|key decision:)\s*([^\n]{15,200})/i
    );
    if (inlineMatch) {
      const insight = this.cleanInsight(inlineMatch[1]);
      if (insight) return insight;
    }

    // Pattern 6: First numbered step (1. Do X) - often more specific than goal
    const numberedMatch = content.match(/\n1\.\s+\*?\*?([A-Z][^\n]{20,150})/);
    if (numberedMatch) {
      const insight = this.cleanInsight(numberedMatch[1]);
      if (insight) return insight;
    }

    // Pattern 7: First substantive bullet that describes an action
    const actionBulletMatch = content.match(
      /\n[-*]\s+(?:Add|Create|Build|Implement|Fix|Update|Change|Remove|Enable|Configure|Use|Set)\s+([^\n]{15,150})/i
    );
    if (actionBulletMatch) {
      const insight = this.cleanInsight(actionBulletMatch[0].replace(/^[\n\-\*\s]+/, ''));
      if (insight) return insight;
    }

    // Pattern 8: Any bullet point with ** emphasis (key items)
    const emphasisBulletMatch = content.match(/\n[-*\d.]+\s+\*\*([^*]{10,100})\*\*/);
    if (emphasisBulletMatch) {
      const insight = this.cleanInsight(emphasisBulletMatch[1]);
      if (insight) return insight;
    }

    // Fallback: Skip goal-derived insight (goal field already has this)
    return null;
  }

  private cleanInsight(text: string): string | null {
    // Clean up the insight text
    let cleaned = text
      .replace(/^\*\*|\*\*$/g, '') // Remove bold markers
      .replace(/^`|`$/g, '') // Remove inline code markers
      .replace(/\*\*/g, '') // Remove remaining bold markers
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Reject patterns that are just file references or metadata
    if (cleaned.match(/^\*?File:|^Location:|^Path:|^Line[s]?:/i)) {
      return null;
    }

    // Cap at 150 chars
    if (cleaned.length > 150) {
      cleaned = cleaned.substring(0, 147) + '...';
    }

    return cleaned.length >= 15 ? cleaned : null;
  }
}
