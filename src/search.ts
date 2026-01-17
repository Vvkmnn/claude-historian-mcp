import { ConversationParser } from './parser.js';
import {
  CompactMessage,
  SearchResult,
  FileContext,
  ErrorSolution,
  ToolPattern,
  PlanResult,
} from './types.js';
import {
  findProjectDirectories,
  findJsonlFiles,
  getTimeRangeFilter,
  extractContentFromMessage,
  findPlanFiles,
  getClaudePlansPath,
  expandWorktreeProjects,
} from './utils.js';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { SearchHelpers } from './search-helpers.js';

export class HistorySearchEngine {
  private parser: ConversationParser;
  private messageCache: Map<string, CompactMessage[]> = new Map();

  constructor() {
    this.parser = new ConversationParser();
  }

  // Optimized search for maximum relevance with minimal tokens

  async searchConversations(
    query: string,
    projectFilter?: string,
    timeframe?: string,
    limit: number = 15 // Default to 15 for better coverage
  ): Promise<SearchResult> {
    const startTime = Date.now();

    // Intelligent query analysis and classification
    const queryAnalysis = this.analyzeQueryIntent(query);
    const requestedLimit = limit; // Use exactly what user requested

    try {
      // Multi-stage optimized search
      return await this.performOptimizedSearch(
        query,
        queryAnalysis,
        requestedLimit,
        startTime,
        projectFilter,
        timeframe
      );
    } catch (error) {
      console.error('Search error:', error);
      return {
        messages: [],
        totalResults: 0,
        searchQuery: query,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private analyzeQueryIntent(query: string): any {
    const lowerQuery = query.toLowerCase();

    return {
      type: this.classifyQueryType(query),
      urgency: lowerQuery.includes('error') || lowerQuery.includes('failed') ? 'high' : 'medium',
      scope: lowerQuery.includes('project') || lowerQuery.includes('all') ? 'broad' : 'focused',
      expectsCode:
        lowerQuery.includes('function') ||
        lowerQuery.includes('implement') ||
        lowerQuery.includes('code'),
      expectsSolution:
        lowerQuery.includes('how') || lowerQuery.includes('fix') || lowerQuery.includes('solve'),
      keywords: lowerQuery.split(/\s+/).filter((w) => w.length > 2),
      semanticBoosts: this.getSemanticBoosts(lowerQuery),
    };
  }

  private getSemanticBoosts(query: string): Record<string, number> {
    const boosts: Record<string, number> = {};

    // Technical content gets massive boosts
    if (query.includes('error')) boosts.errorResolution = 3.0;
    if (query.includes('implement')) boosts.implementation = 2.5;
    if (query.includes('optimize')) boosts.optimization = 2.0;
    if (query.includes('fix')) boosts.solutions = 2.8;
    if (query.includes('file')) boosts.fileOperations = 2.0;
    if (query.includes('tool')) boosts.toolUsage = 2.2;

    return boosts;
  }

  private async performOptimizedSearch(
    query: string,
    analysis: any,
    limit: number,
    startTime: number,
    projectFilter?: string,
    timeframe?: string
  ): Promise<SearchResult> {
    const timeFilter = getTimeRangeFilter(timeframe);

    try {
      const projectDirs = await findProjectDirectories();

      // Expand worktrees to include parent projects for comprehensive search
      const expandedDirs = await expandWorktreeProjects(projectDirs);

      // Pre-validate: Don't waste time on queries that won't return value
      if (query.length < 3) {
        return {
          messages: [],
          totalResults: 0,
          searchQuery: query,
          executionTime: Date.now() - startTime,
        };
      }

      // Smart project selection - focus on most relevant projects first
      const maxProjects = Math.min(expandedDirs.length, Math.max(8, Math.ceil(limit / 2)));
      const targetDirs = projectFilter
        ? expandedDirs.filter((dir) => dir.includes(projectFilter))
        : expandedDirs.slice(0, maxProjects);

      // Parallel processing with quality threshold
      const candidates = await this.gatherRelevantCandidates(
        targetDirs,
        query,
        analysis,
        timeFilter,
        limit * 2 // Gather 2x but with higher quality threshold
      );

      // Intelligent relevance scoring and selection with quality guarantee
      const topRelevant = this.selectTopRelevantResults(candidates, query, analysis, limit);

      // Quality gate: Only return results that meet minimum value threshold
      const qualityResults = topRelevant.filter(
        (msg) =>
          (msg.finalScore || msg.relevanceScore || 0) >= 1.5 && // Must be reasonably relevant (use finalScore with query boosting)
          msg.content.length >= 40 && // Must have substantial content
          !this.isLowValueContent(msg.content) // Must not be filler
      );

      return {
        messages: qualityResults,
        totalResults: candidates.length,
        searchQuery: query,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Optimized search error:', error);
      throw error;
    }
  }

  private async gatherRelevantCandidates(
    projectDirs: string[],
    query: string,
    analysis: any,
    timeFilter: ((timestamp: string) => boolean) | undefined,
    targetCount: number
  ): Promise<CompactMessage[]> {
    const candidates: CompactMessage[] = [];

    // Process projects in parallel with intelligent early stopping
    const projectResults = await Promise.allSettled(
      projectDirs.map(async (projectDir) => {
        const dirCandidates = await this.processProjectFocused(
          projectDir,
          query,
          analysis,
          timeFilter,
          Math.ceil(targetCount / projectDirs.length)
        );
        return dirCandidates;
      })
    );

    // Aggregate with aggressive noise filtering
    for (const result of projectResults) {
      if (result.status === 'fulfilled') {
        const dirMessages = result.value.filter((msg) =>
          this.isHighlyRelevant(msg, query, analysis)
        );
        candidates.push(...dirMessages);

        // Early termination if we have enough high-quality candidates
        if (candidates.length >= targetCount) break;
      }
    }

    return candidates;
  }

  private async processProjectFocused(
    projectDir: string,
    query: string,
    analysis: any,
    timeFilter: ((timestamp: string) => boolean) | undefined,
    targetPerProject: number
  ): Promise<CompactMessage[]> {
    const messages: CompactMessage[] = [];

    try {
      const jsonlFiles = await findJsonlFiles(projectDir);

      // Process only most relevant files (max 4 per project)
      const priorityFiles = jsonlFiles.slice(0, Math.min(4, jsonlFiles.length));

      for (const file of priorityFiles) {
        const fileMessages = await this.processJsonlFile(projectDir, file, query, timeFilter);

        // Balanced filtering per file
        const relevant = fileMessages
          .filter((msg) => (msg.relevanceScore || 0) >= 1) // Lower threshold for usefulness
          .filter((msg) => this.matchesQueryIntent(msg, analysis))
          .slice(0, Math.ceil(targetPerProject / priorityFiles.length));

        messages.push(...relevant);

        if (messages.length >= targetPerProject) break;
      }
    } catch (error) {
      console.error(`Focused processing error for ${projectDir}:`, error);
    }

    return messages;
  }

  private isHighlyRelevant(message: CompactMessage, query: string, analysis: any): boolean {
    const content = message.content.toLowerCase();

    // Eliminate all noise patterns aggressively - expanded to catch Claude system messages
    const noisePatterns = [
      'this session is being continued',
      'caveat:',
      'command-name>',
      'local-command-stdout',
      'system-reminder',
      'command-message>',
      'much better! now i can see',
      'package.js',
      'export interface',
      // Claude system/intro messages that shouldn't match searches
      'you are claude code',
      'read-only mode',
      'i cannot make changes',
      "i'm in plan mode",
      "hello! i'm claude",
      'i am claude',
      'ready to help you',
      'what would you like me to',
      'how can i assist',
      "i understand that i'm",
    ];

    if (noisePatterns.some((pattern) => content.includes(pattern)) || content.length < 40) {
      return false;
    }

    // Must have reasonable relevance score - lowered from 1 to 0.3 to allow more candidates through
    if ((message.relevanceScore || 0) < 0.3) return false;

    // Must match query intent
    return this.matchesQueryIntent(message, analysis);
  }

  private matchesQueryIntent(message: CompactMessage, analysis: any): boolean {
    const content = message.content.toLowerCase();

    // Intent-based matching
    switch (analysis.type) {
      case 'error':
        return (
          content.includes('error') ||
          content.includes('fix') ||
          content.includes('solution') ||
          (message.context?.errorPatterns?.length || 0) > 0
        );

      case 'implementation':
        return (
          content.includes('implement') ||
          content.includes('create') ||
          content.includes('function') ||
          (message.context?.codeSnippets?.length || 0) > 0
        );

      case 'analysis':
        return (
          content.includes('analyze') ||
          content.includes('understand') ||
          content.includes('explain') ||
          (message.type === 'assistant' && content.length > 100)
        );

      default:
        // General: must have tool usage or be substantial assistant response
        return (
          (message.context?.toolsUsed?.length || 0) > 0 ||
          (message.type === 'assistant' && content.length > 80)
        );
    }
  }

  private selectTopRelevantResults(
    candidates: CompactMessage[],
    query: string,
    analysis: any,
    limit: number
  ): CompactMessage[] {
    // Enhanced scoring with semantic boosts
    const scoredCandidates = candidates.map((msg) => {
      let score = msg.relevanceScore || 0;

      // If relevanceScore is 0 for multi-word query, skip this message entirely
      // (it failed the multi-word matching requirement)
      const queryWords = query.split(/\s+/).filter((w) => w.length > 2);
      if (queryWords.length >= 2 && score === 0) {
        return { ...msg, finalScore: 0 };
      }

      const contentLower = msg.content.toLowerCase();
      const queryTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2);

      // Query coverage: penalize partial matches
      const matchCount = queryTerms.filter((term) => contentLower.includes(term)).length;
      const coverageRatio = queryTerms.length > 0 ? matchCount / queryTerms.length : 1;

      // Apply boost based on coverage ratio
      if (coverageRatio >= 0.5) {
        // Good coverage (≥50%): apply multiplicative boost for each match
        for (const term of queryTerms) {
          if (contentLower.includes(term)) {
            score *= 2.0; // Each matching term doubles relevance
          }
        }
      } else if (matchCount > 0) {
        // Partial match (<50%): modest boost but apply coverage penalty
        score *= (1 + matchCount * 0.5) * coverageRatio;
      } else {
        // No matches: heavy penalty
        score *= 0.1;
      }

      // Apply semantic boosts from analysis
      Object.entries(analysis.semanticBoosts).forEach(([type, boost]) => {
        if (this.messageMatchesSemanticType(msg, type)) {
          score *= boost as number;
        }
      });

      // Recency boost for time-sensitive queries
      if (analysis.urgency === 'high') {
        const timestamp = new Date(msg.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
        if (hoursDiff < 24) score *= 1.5;
      }

      return { ...msg, finalScore: score };
    });

    // Sort by final score and deduplicate
    const sorted = scoredCandidates.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    const deduped = this.intelligentDeduplicate(sorted);

    return deduped.slice(0, limit);
  }

  private messageMatchesSemanticType(message: CompactMessage, type: string): boolean {
    const content = message.content.toLowerCase();

    switch (type) {
      case 'errorResolution':
        return (
          content.includes('error') ||
          content.includes('exception') ||
          (message.context?.errorPatterns?.length || 0) > 0
        );
      case 'implementation':
        return (
          content.includes('function') ||
          content.includes('implement') ||
          (message.context?.codeSnippets?.length || 0) > 0
        );
      case 'optimization':
        return (
          content.includes('optimize') ||
          content.includes('performance') ||
          content.includes('faster')
        );
      case 'solutions':
        return (
          content.includes('solution') || content.includes('fix') || content.includes('resolve')
        );
      case 'fileOperations':
        return (message.context?.filesReferenced?.length || 0) > 0;
      case 'toolUsage':
        return (message.context?.toolsUsed?.length || 0) > 0;
      default:
        return false;
    }
  }

  private intelligentDeduplicate(messages: any[]): CompactMessage[] {
    const seen = new Map<string, CompactMessage>();

    for (const message of messages) {
      // Intelligent deduplication using content signature
      const signature = this.createIntelligentSignature(message);

      if (!seen.has(signature)) {
        seen.set(signature, message);
      } else {
        // Keep the one with higher final score
        const existing = seen.get(signature)!;
        if ((message.finalScore || 0) > (existing.finalScore || 0)) {
          seen.set(signature, message);
        }
      }
    }

    return Array.from(seen.values());
  }

  private createIntelligentSignature(message: CompactMessage): string {
    // Create an intelligent signature for deduplication
    const contentHash = message.content
      .toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/["']/g, '')
      .replace(/\s+/g, ' ')
      .substring(0, 80);

    const tools = (message.context?.toolsUsed || []).sort().join('|');
    const files = (message.context?.filesReferenced || []).length > 0 ? 'files' : 'nofiles';

    return `${message.type}:${tools}:${files}:${contentHash}`;
  }

  private async processProjectDirectory(
    projectDir: string,
    query: string,
    timeFilter: ((timestamp: string) => boolean) | undefined,
    targetLimit: number
  ): Promise<{ summary: CompactMessage[]; regular: CompactMessage[] }> {
    const summaryMessages: CompactMessage[] = [];
    const regularMessages: CompactMessage[] = [];

    try {
      const jsonlFiles = await findJsonlFiles(projectDir);

      // Parallel processing of files within the project
      const fileResults = await Promise.allSettled(
        jsonlFiles
          .slice(0, Math.min(jsonlFiles.length, 8))
          .map((file) => this.processJsonlFile(projectDir, file, query, timeFilter))
      );

      // Aggregate results from all files
      for (const result of fileResults) {
        if (result.status === 'fulfilled') {
          const messages = result.value;

          // Fast pre-filter: only process messages with minimum relevance
          const qualifyingMessages = messages.filter((msg) => (msg.relevanceScore || 0) >= 1);

          // Intelligent message categorization for Claude Code
          qualifyingMessages.forEach((msg) => {
            if (this.isSummaryMessage(msg)) {
              summaryMessages.push(msg);
            } else if (this.isHighValueMessage(msg)) {
              regularMessages.push(msg);
            }
          });

          // Early exit if we have enough results
          if (summaryMessages.length + regularMessages.length >= targetLimit) {
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing project ${projectDir}:`, error);
    }

    return { summary: summaryMessages, regular: regularMessages };
  }

  private async processJsonlFile(
    projectDir: string,
    file: string,
    query: string,
    timeFilter: ((timestamp: string) => boolean) | undefined
  ): Promise<CompactMessage[]> {
    const cacheKey = `${projectDir}/${file}`;

    // Check cache first
    if (this.messageCache.has(cacheKey)) {
      return this.messageCache.get(cacheKey)!;
    }

    // Parse file
    const messages = await this.parser.parseJsonlFile(projectDir, file, query, timeFilter);

    // Enhanced caching with increased size limit
    if (this.messageCache.size < 500) {
      // Increased from 100
      this.messageCache.set(cacheKey, messages);
    } else if (messages.some((m) => (m.relevanceScore || 0) > 8)) {
      // Replace least valuable cache entry with high-value content
      const cacheEntries = Array.from(this.messageCache.entries());
      const leastValuable = cacheEntries.reduce(
        (min, [key, msgs]) => {
          const avgScore = msgs.reduce((sum, m) => sum + (m.relevanceScore || 0), 0) / msgs.length;
          return avgScore < (min.avgScore || Infinity) ? { key, avgScore } : min;
        },
        { key: '', avgScore: Infinity }
      );

      if (leastValuable.key) {
        this.messageCache.delete(leastValuable.key);
        this.messageCache.set(cacheKey, messages);
      }
    }

    return messages;
  }

  private prioritizeResultsForClaudeCode(
    summaryMessages: CompactMessage[],
    allMessages: CompactMessage[],
    query: string,
    limit: number
  ): CompactMessage[] {
    // Sort by relevance and recency
    const sortedSummaries = summaryMessages
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, Math.ceil(limit * 0.3)); // 30% summaries

    const sortedRegular = allMessages
      .sort((a, b) => {
        const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
        if (Math.abs(relevanceDiff) > 1) return relevanceDiff;

        // Secondary sort by recency for similar relevance
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, limit - sortedSummaries.length);

    // Combine and deduplicate
    const combined = [...sortedSummaries, ...sortedRegular];
    const deduped = this.deduplicateMessages(combined);

    return deduped.slice(0, limit);
  }

  private deduplicateMessages(messages: CompactMessage[]): CompactMessage[] {
    const seen = new Set<string>();
    const unique: CompactMessage[] = [];

    for (const message of messages) {
      // Create a simple content hash for deduplication
      const contentHash = message.content.substring(0, 100).toLowerCase().replace(/\s+/g, '');

      if (!seen.has(contentHash)) {
        seen.add(contentHash);
        unique.push(message);
      }
    }

    return unique;
  }

  private isSummaryMessage(message: CompactMessage): boolean {
    const content = message.content.toLowerCase();
    const summaryIndicators = [
      'summary:',
      'in summary',
      'to recap',
      "here's what we accomplished",
      'let me summarize',
      'to sum up',
      'overview:',
      'in conclusion',
      'final summary',
      'session summary',
    ];

    return (
      summaryIndicators.some((indicator) => content.includes(indicator)) ||
      (message.type === 'assistant' && content.includes('summary') && content.length > 100)
    );
  }

  private isHighValueMessage(message: CompactMessage): boolean {
    const relevanceScore = message.relevanceScore || 0;
    const content = message.content.toLowerCase();

    // Always include high relevance scores
    if (relevanceScore >= 5) return true;

    // Include tool usage messages - crucial for Claude Code
    if (message.context?.toolsUsed && (message.context.toolsUsed.length || 0) > 0) return true;

    // Include error resolution messages
    if (message.context?.errorPatterns && (message.context.errorPatterns.length || 0) > 0)
      return true;

    // Include file operation messages
    if (message.context?.filesReferenced && (message.context.filesReferenced.length || 0) > 0)
      return true;

    // Include assistant messages with substantial solutions
    if (message.type === 'assistant' && content.length > 200 && relevanceScore > 0) return true;

    // Include user messages that are substantial queries
    if (
      message.type === 'user' &&
      content.length > 50 &&
      content.length < 500 &&
      relevanceScore > 0
    )
      return true;

    return false;
  }

  private classifyQueryType(query: string): 'error' | 'implementation' | 'analysis' | 'general' {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes('error') ||
      lowerQuery.includes('bug') ||
      lowerQuery.includes('fix') ||
      lowerQuery.includes('issue')
    ) {
      return 'error';
    }
    if (
      lowerQuery.includes('implement') ||
      lowerQuery.includes('create') ||
      lowerQuery.includes('build') ||
      lowerQuery.includes('add')
    ) {
      return 'implementation';
    }
    if (
      lowerQuery.includes('how') ||
      lowerQuery.includes('why') ||
      lowerQuery.includes('analyze') ||
      lowerQuery.includes('understand')
    ) {
      return 'analysis';
    }
    return 'general';
  }

  private getOptimalLimit(queryType: string, requestedLimit: number): number {
    // Return exactly what the user requested - no artificial caps
    return requestedLimit;
  }

  private enhanceQueryIntelligently(query: string): string {
    const lowerQuery = query.toLowerCase();

    // Add contextual terms for Claude Code-specific patterns
    if (lowerQuery.includes('error') || lowerQuery.includes('bug')) {
      return `${query} solution fix resolve tool_result`;
    }
    if (lowerQuery.includes('implement') || lowerQuery.includes('create')) {
      return `${query} solution approach code example`;
    }
    if (lowerQuery.includes('optimize') || lowerQuery.includes('performance')) {
      return `${query} improvement solution approach`;
    }
    if (lowerQuery.includes('file') || lowerQuery.includes('read') || lowerQuery.includes('edit')) {
      return `${query} tool_use Read Edit Write`;
    }

    return query;
  }

  private calculateRelevanceScore(message: any, query: string): number {
    try {
      const content = extractContentFromMessage(message.message || {});
      if (!content) return 0;

      const lowerQuery = query.toLowerCase();
      const lowerContent = content.toLowerCase();

      let score = 0;

      // Exact phrase match - high value for Claude Code
      if (lowerContent.includes(lowerQuery)) score += 15;

      // Enhanced word matching with case-aware technology name matching
      // Create word pairs: {original, lower, normalized}
      const normalizeWord = (w: string) => w.replace(/[^\w-]/g, '').trim();
      const queryWordPairs = query
        .split(/\s+/)
        .map((w) => ({ original: w, lower: w.toLowerCase(), norm: normalizeWord(w.toLowerCase()) }))
        .filter((p) => p.norm.length > 2);
      const contentWordPairs = content
        .split(/\s+/)
        .map((w) => ({ original: w, lower: w.toLowerCase(), norm: normalizeWord(w.toLowerCase()) }))
        .filter((p) => p.norm.length > 0);

      const matches = queryWordPairs.filter((qPair) => {
        const matched = contentWordPairs.some((cPair) => {
          // Check if normalized lowercase words match
          const normMatch =
            cPair.norm === qPair.norm ||
            cPair.norm.startsWith(qPair.norm + '-') ||
            cPair.norm.endsWith('-' + qPair.norm);
          if (!normMatch) return false;

          // If query word is all lowercase, reject matches where content word has mixed case
          // (e.g., lowercase "react" query shouldn't match "ReAct" content)
          // Strip punctuation but preserve case for comparison
          const queryClean = qPair.original.replace(/[^\w-]/g, '');
          const contentClean = cPair.original.replace(/[^\w-]/g, '');
          if (queryClean === queryClean.toLowerCase() && queryClean.length > 0) {
            // Reject if content word has uppercase letters (indicates acronym/proper noun)
            if (contentClean !== contentClean.toLowerCase()) {
              return false;
            }
          }

          return true;
        });
        return matched;
      });

      // For multi-word queries, require at least 2 words to match to avoid false positives
      // If insufficient matches, return score of 0 immediately (no other bonuses apply)
      if (queryWordPairs.length >= 2 && matches.length < 2) {
        return 0; // Multi-word queries MUST match multiple words - reject false positives
      }

      // Add points for word matches
      score += matches.length * 3;

      // High bonus for tool usage - essential for Claude Code queries
      if (message.type === 'tool_use' || message.type === 'tool_result') score += 8;
      if (lowerContent.includes('tool_use') || lowerContent.includes('called the')) score += 6;

      // Code file references - crucial for development queries
      if (content.includes('.ts') || content.includes('.js') || content.includes('src/'))
        score += 4;
      if (content.includes('package.json') || content.includes('.md')) score += 3;

      // Error resolution context
      if (lowerContent.includes('error') || lowerContent.includes('fix')) score += 4;
      if (lowerContent.includes('solution') || lowerContent.includes('resolved')) score += 3;

      // Assistant messages with substantial content get bonus
      if (message.type === 'assistant' && content.length > 200) score += 2;

      // Recent conversations are more valuable
      const timestamp = message.timestamp || '';
      const isRecent = new Date(timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (isRecent) score += 1;

      return score;
    } catch {
      return 0;
    }
  }

  private matchesTimeframe(timestamp: string, timeframe: string): boolean {
    try {
      const filter = getTimeRangeFilter(timeframe);
      return filter(timestamp);
    } catch {
      return true;
    }
  }

  async findFileContext(filePath: string, limit: number = 25): Promise<FileContext[]> {
    const fileContexts: FileContext[] = [];

    try {
      const projectDirs = await findProjectDirectories();
      const expandedDirs = await expandWorktreeProjects(projectDirs);

      // COMPREHENSIVE: Process more projects to match GLOBAL's reach
      const limitedDirs = expandedDirs.slice(0, 15); // Increased significantly to match GLOBAL scope

      // PARALLEL PROCESSING: Process all projects concurrently
      const projectResults = await Promise.allSettled(
        limitedDirs.map(async (projectDir) => {
          const jsonlFiles = await findJsonlFiles(projectDir);

          // COMPREHENSIVE: Process more files to match GLOBAL's reach
          const limitedFiles = jsonlFiles.slice(0, 10); // Increased to match GLOBAL scope

          const fileResults = await Promise.allSettled(
            limitedFiles.map(async (file) => {
              const messages = await this.parser.parseJsonlFile(projectDir, file);

              const fileMessages = messages.filter((msg) => {
                // ENHANCED file matching logic like GLOBAL with more patterns
                const hasFileRef = msg.context?.filesReferenced?.some((ref) => {
                  const refLower = ref.toLowerCase();
                  const pathLower = filePath.toLowerCase();
                  // More comprehensive matching patterns
                  return (
                    refLower.includes(pathLower) ||
                    pathLower.includes(refLower) ||
                    refLower.endsWith('/' + pathLower) ||
                    pathLower.endsWith('/' + refLower) ||
                    refLower.split('/').pop() === pathLower ||
                    pathLower.split('/').pop() === refLower ||
                    refLower === pathLower ||
                    refLower.includes(pathLower.replace(/\\/g, '/')) ||
                    refLower.includes(pathLower.replace(/\//g, '\\'))
                  );
                });

                // Enhanced content matching with case variations and path separators
                const contentLower = msg.content.toLowerCase();
                const pathVariations = [
                  filePath.toLowerCase(),
                  filePath.toLowerCase().replace(/\\/g, '/'),
                  filePath.toLowerCase().replace(/\//g, '\\'),
                  filePath.toLowerCase().split('/').pop() || '',
                  filePath.toLowerCase().split('\\').pop() || '',
                ];

                const hasContentRef = pathVariations.some(
                  (variation) => variation.length > 0 && contentLower.includes(variation)
                );

                // Enhanced git pattern matching
                const hasGitRef =
                  /(?:modified|added|deleted|new file|renamed|M\s+|A\s+|D\s+)[\s:]*[^\n]*/.test(
                    msg.content
                  ) &&
                  pathVariations.some(
                    (variation) => variation.length > 0 && contentLower.includes(variation)
                  );

                return hasFileRef || hasContentRef || hasGitRef;
              });

              if (fileMessages.length > 0) {
                // Claude-optimized filtering - preserve valuable context
                const cleanFileMessages = fileMessages.filter((msg) => {
                  return msg.content.length > 15 && !this.isLowValueContent(msg.content);
                });

                const dedupedMessages = SearchHelpers.deduplicateByContent(cleanFileMessages);

                if (dedupedMessages.length > 0) {
                  // Group by operation type (heuristic)
                  const operationType = SearchHelpers.inferOperationType(dedupedMessages);

                  return {
                    filePath,
                    lastModified: dedupedMessages[0]?.timestamp || '',
                    relatedMessages: dedupedMessages.slice(0, Math.min(limit, 10)), // More context for Claude
                    operationType,
                  };
                }
              }
              return null;
            })
          );

          // Collect successful file results
          const validContexts: FileContext[] = [];
          for (const result of fileResults) {
            if (result.status === 'fulfilled' && result.value) {
              validContexts.push(result.value);
            }
          }

          return validContexts;
        })
      );

      // Aggregate all results from parallel processing
      for (const result of projectResults) {
        if (result.status === 'fulfilled') {
          fileContexts.push(...result.value);
        }
      }

      return fileContexts.sort(
        (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
    } catch (error) {
      console.error('File context search error:', error);
      return [];
    }
  }

  async findSimilarQueries(targetQuery: string, limit: number = 10): Promise<CompactMessage[]> {
    const allMessages: CompactMessage[] = [];

    try {
      const projectDirs = await findProjectDirectories();
      const expandedDirs = await expandWorktreeProjects(projectDirs);

      // BALANCED: More projects for better coverage, early termination for speed
      const limitedDirs = expandedDirs.slice(0, 8);

      for (const projectDir of limitedDirs) {
        const jsonlFiles = await findJsonlFiles(projectDir);

        // BALANCED: More files per project for better context
        const limitedFiles = jsonlFiles.slice(0, 5);

        for (const file of limitedFiles) {
          const messages = await this.parser.parseJsonlFile(projectDir, file);

          // Find user messages (queries) that are similar and valuable
          const userQueries = messages.filter(
            (msg) =>
              msg.type === 'user' &&
              msg.content.length > 15 &&
              msg.content.length < 800 &&
              !this.isLowValueContent(msg.content) // Only quality queries
          );

          for (let i = 0; i < userQueries.length; i++) {
            const query = userQueries[i];
            const similarity = SearchHelpers.calculateQuerySimilarity(targetQuery, query.content);
            // Raised threshold to 0.4 and REMOVED partial keyword fallback (causes false positives)
            if (similarity > 0.4) {
              query.relevanceScore = similarity;

              // Find the answer - look for next assistant message in original array
              const queryIndex = messages.findIndex((m) => m.uuid === query.uuid);
              if (queryIndex >= 0) {
                // Look ahead for assistant response (may not be immediately next)
                for (let j = queryIndex + 1; j < Math.min(queryIndex + 5, messages.length); j++) {
                  const nextMsg = messages[j];
                  if (nextMsg.type === 'assistant' && nextMsg.content.length > 50) {
                    query.context = query.context || {};
                    query.context.claudeInsights = [nextMsg.content.substring(0, 400)];
                    break;
                  }
                }
              }

              allMessages.push(query);
            }
          }

          // SPEED FIX: Early termination when we have enough candidates
          if (allMessages.length >= limit * 4) break;
        }

        if (allMessages.length >= limit * 4) break;
      }

      // Quality filter and return only if we have valuable results
      const qualityResults = allMessages
        .filter((msg) => !this.isLowValueContent(msg.content))
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, limit);

      return qualityResults;
    } catch (error) {
      console.error('Similar query search error:', error);
      return [];
    }
  }

  async getErrorSolutions(errorPattern: string, limit: number = 10): Promise<ErrorSolution[]> {
    const solutions: ErrorSolution[] = [];
    const errorMap = new Map<string, CompactMessage[]>();

    try {
      const projectDirs = await findProjectDirectories();
      const expandedDirs = await expandWorktreeProjects(projectDirs);

      // BALANCED: More projects for better coverage, still much faster than sequential
      const limitedDirs = expandedDirs.slice(0, 12); // Increased for better coverage

      // PARALLEL PROCESSING: Process all projects concurrently
      const projectResults = await Promise.allSettled(
        limitedDirs.map(async (projectDir) => {
          const jsonlFiles = await findJsonlFiles(projectDir);

          // BALANCED: More files for better coverage
          const limitedFiles = jsonlFiles.slice(0, 6);

          const projectErrorMap = new Map<string, CompactMessage[]>();

          // PARALLEL: Process files within project simultaneously
          const fileResults = await Promise.allSettled(
            limitedFiles.map(async (file) => {
              const messages = await this.parser.parseJsonlFile(projectDir, file);

              // Find error patterns and their solutions
              for (let i = 0; i < messages.length - 1; i++) {
                const current = messages[i];

                // More precise error matching - require significant overlap
                const lowerPattern = errorPattern.toLowerCase();
                const patternWords = lowerPattern.split(/\s+/).filter((w) => w.length > 2);

                // Extract error type if present (TypeError, SyntaxError, etc.)
                const errorType = lowerPattern.match(
                  /(typeerror|syntaxerror|referenceerror|rangeerror|error)/
                )?.[0];

                const hasMatchingError = current.context?.errorPatterns?.some((err) => {
                  const lowerErr = err.toLowerCase();

                  // Require error type to match if specified
                  if (errorType && !lowerErr.includes(errorType)) {
                    return false;
                  }

                  // Require at least 3 pattern words to match, or full phrase match (stricter)
                  if (lowerErr.includes(lowerPattern)) return true;
                  const matchCount = patternWords.filter((w) => lowerErr.includes(w)).length;
                  return matchCount >= Math.min(3, patternWords.length);
                });

                // Only include if it's an actual error (not meta-discussion about errors)
                const isActualErrorContent = this.isActualError(current.content);

                // Filter out meta-content (plans, benchmarks, discussions)
                if (
                  (hasMatchingError ||
                    SearchHelpers.hasErrorInContent(current.content, errorPattern)) &&
                  isActualErrorContent &&
                  !this.isMetaErrorContent(current.content)
                ) {
                  // Use the most relevant error pattern as key
                  const matchedError =
                    current.context?.errorPatterns?.find((err) =>
                      err.toLowerCase().includes(lowerPattern)
                    ) ||
                    current.context?.errorPatterns?.[0] ||
                    errorPattern;
                  const errorKey = matchedError;

                  if (!projectErrorMap.has(errorKey)) {
                    projectErrorMap.set(errorKey, []);
                  }

                  // Include the error message and the next few messages as potential solutions
                  const solutionMessages = messages
                    .slice(i, i + 8) // Get more context for better solutions (increased from 5 to 8)
                    .filter(
                      (msg) =>
                        msg.type === 'assistant' ||
                        msg.type === 'tool_result' ||
                        (msg.type === 'user' && msg.content.length < 200) // Include short user clarifications
                    );

                  projectErrorMap.get(errorKey)!.push(...solutionMessages);
                }
              }
            })
          );

          return projectErrorMap;
        })
      );

      // Aggregate results from parallel processing
      for (const result of projectResults) {
        if (result.status === 'fulfilled') {
          const projectErrorMap = result.value;
          for (const [pattern, msgs] of projectErrorMap.entries()) {
            if (!errorMap.has(pattern)) {
              errorMap.set(pattern, []);
            }
            errorMap.get(pattern)!.push(...msgs);
          }
        }
      }

      // Convert to ErrorSolution format
      for (const [pattern, msgs] of errorMap.entries()) {
        // Assistant responses following errors are solutions by context
        // Lower threshold from 50 to 20 chars for actionable short solutions
        const qualitySolutions = msgs.filter(
          (msg) =>
            msg.type === 'assistant' &&
            !this.isLowValueContent(msg.content) &&
            msg.content.length >= 20
        );

        if (qualitySolutions.length > 0) {
          solutions.push({
            errorPattern: pattern,
            solution: qualitySolutions.slice(0, 5), // Include up to 5 solutions (increased from 3)
            context: SearchHelpers.extractSolutionContext(qualitySolutions),
            frequency: msgs.length,
          });
        }
      }

      return solutions.sort((a, b) => b.frequency - a.frequency).slice(0, limit);
    } catch (error) {
      console.error('Error solution search error:', error);
      return [];
    }
  }

  async getToolPatterns(toolName?: string, limit: number = 20): Promise<ToolPattern[]> {
    const toolMap = new Map<string, CompactMessage[]>();
    const workflowMap = new Map<string, CompactMessage[]>();

    try {
      const projectDirs = await findProjectDirectories();
      const expandedDirs = await expandWorktreeProjects(projectDirs);
      const limitedDirs = expandedDirs.slice(0, 15);

      // Focus on core Claude Code tools that GLOBAL would recognize
      const coreTools = new Set([
        'Edit',
        'Read',
        'Bash',
        'Grep',
        'Glob',
        'Write',
        'Task',
        'MultiEdit',
        'Notebook',
      ]);

      // PARALLEL PROCESSING: Process all projects concurrently
      const projectResults = await Promise.allSettled(
        limitedDirs.map(async (projectDir) => {
          const jsonlFiles = await findJsonlFiles(projectDir);
          const limitedFiles = jsonlFiles.slice(0, 8);

          const projectToolMap = new Map<string, CompactMessage[]>();
          const projectWorkflowMap = new Map<string, CompactMessage[]>();

          // PARALLEL: Process files within project simultaneously
          const fileResults = await Promise.allSettled(
            limitedFiles.map(async (file) => {
              const messages = await this.parser.parseJsonlFile(projectDir, file);

              // Extract individual tool usage patterns
              for (const msg of messages) {
                if (msg.context?.toolsUsed?.length) {
                  for (const tool of msg.context.toolsUsed) {
                    // If toolName specified, only track that tool
                    // Otherwise, track all core tools
                    const shouldTrack = toolName ? tool === toolName : coreTools.has(tool);

                    if (shouldTrack) {
                      if (!projectToolMap.has(tool)) {
                        projectToolMap.set(tool, []);
                      }
                      projectToolMap.get(tool)!.push(msg);
                    }
                  }
                }
              }

              // Extract workflow patterns (tool sequences)
              for (let i = 0; i < messages.length - 1; i++) {
                const current = messages[i];
                const next = messages[i + 1];

                if (current.context?.toolsUsed?.length && next.context?.toolsUsed?.length) {
                  // Create focused workflow patterns
                  for (const currentTool of current.context.toolsUsed) {
                    for (const nextTool of next.context.toolsUsed) {
                      // If toolName specified, workflow must involve that tool
                      // Otherwise, workflows between core tools
                      const shouldTrack = toolName
                        ? currentTool === toolName || nextTool === toolName
                        : coreTools.has(currentTool) && coreTools.has(nextTool);

                      if (shouldTrack) {
                        const workflowKey = `${currentTool} → ${nextTool}`;
                        if (!projectWorkflowMap.has(workflowKey)) {
                          projectWorkflowMap.set(workflowKey, []);
                        }
                        projectWorkflowMap.get(workflowKey)!.push(current, next);
                      }
                    }
                  }
                }
              }

              // Also create longer sequences for complex workflows
              for (let i = 0; i < messages.length - 2; i++) {
                const first = messages[i];
                const second = messages[i + 1];
                const third = messages[i + 2];

                if (
                  first.context?.toolsUsed?.length &&
                  second.context?.toolsUsed?.length &&
                  third.context?.toolsUsed?.length
                ) {
                  for (const firstTool of first.context.toolsUsed) {
                    for (const secondTool of second.context.toolsUsed) {
                      for (const thirdTool of third.context.toolsUsed) {
                        // If toolName specified, 3-step workflow must involve that tool
                        const shouldTrack = toolName
                          ? firstTool === toolName ||
                            secondTool === toolName ||
                            thirdTool === toolName
                          : coreTools.has(firstTool) &&
                            coreTools.has(secondTool) &&
                            coreTools.has(thirdTool);

                        if (shouldTrack) {
                          const workflowKey = `${firstTool} → ${secondTool} → ${thirdTool}`;
                          if (!projectWorkflowMap.has(workflowKey)) {
                            projectWorkflowMap.set(workflowKey, []);
                          }
                          projectWorkflowMap.get(workflowKey)!.push(first, second, third);
                        }
                      }
                    }
                  }
                }
              }
            })
          );

          return { tools: projectToolMap, workflows: projectWorkflowMap };
        })
      );

      // Aggregate results from parallel processing
      for (const result of projectResults) {
        if (result.status === 'fulfilled') {
          // Aggregate individual tools
          for (const [tool, messages] of result.value.tools.entries()) {
            if (!toolMap.has(tool)) {
              toolMap.set(tool, []);
            }
            toolMap.get(tool)!.push(...messages);
          }

          // Aggregate workflows
          for (const [workflow, messages] of result.value.workflows.entries()) {
            if (!workflowMap.has(workflow)) {
              workflowMap.set(workflow, []);
            }
            workflowMap.get(workflow)!.push(...messages);
          }
        }
      }

      const patterns: ToolPattern[] = [];

      // ENHANCED: Create diverse patterns like GLOBAL showing related tools with workflows
      const toolFrequency = new Map<string, number>();

      // First pass: Calculate tool frequencies for prioritization
      for (const [tool, messages] of toolMap.entries()) {
        toolFrequency.set(tool, messages.length);
      }

      // Add diverse individual tool patterns (different tools, not just highest frequency)
      const usedTools = new Set<string>();
      for (const [tool, messages] of Array.from(toolMap.entries()).sort(
        (a, b) => b[1].length - a[1].length
      )) {
        if (messages.length >= 1 && !usedTools.has(tool) && patterns.length < limit) {
          const uniqueMessages = SearchHelpers.deduplicateByContent(messages);

          // Extract actual patterns and practices instead of generic text
          const actualPatterns = this.extractActualToolPatterns(tool, uniqueMessages);
          const actualPractices = this.extractActualBestPractices(tool, uniqueMessages);

          patterns.push({
            toolName: tool,
            successfulUsages: uniqueMessages.slice(0, 10),
            commonPatterns: actualPatterns.length > 0 ? actualPatterns : [`${tool} usage pattern`],
            bestPractices:
              actualPractices.length > 0
                ? actualPractices
                : [`${tool} used ${uniqueMessages.length}x successfully`],
          });
          usedTools.add(tool);
        }
      }

      // Add related workflow patterns for each tool (like GLOBAL's approach)
      for (const tool of usedTools) {
        // Find workflows involving this tool
        for (const [workflow, messages] of workflowMap.entries()) {
          if (workflow.includes(tool) && workflow.includes('→') && messages.length >= 1) {
            const uniqueMessages = SearchHelpers.deduplicateByContent(messages);
            // Only add if not already added and we have space
            if (!patterns.some((p) => p.toolName === workflow) && patterns.length < limit) {
              patterns.push({
                toolName: workflow,
                successfulUsages: uniqueMessages.slice(0, 10),
                commonPatterns: [workflow],
                bestPractices: [`${workflow} workflow (${uniqueMessages.length}x successful)`],
              });
            }
          }
        }
      }

      // If we still have space, add any remaining high-frequency workflows
      for (const [workflow, messages] of Array.from(workflowMap.entries()).sort(
        (a, b) => b[1].length - a[1].length
      )) {
        if (workflow.includes('→') && messages.length >= 1 && patterns.length < limit) {
          if (!patterns.some((p) => p.toolName === workflow)) {
            const uniqueMessages = SearchHelpers.deduplicateByContent(messages);
            patterns.push({
              toolName: workflow,
              successfulUsages: uniqueMessages.slice(0, 10),
              commonPatterns: [workflow],
              bestPractices: [`${workflow} workflow (${uniqueMessages.length}x successful)`],
            });
          }
        }
      }

      // Sort to prioritize individual tools, then their related workflows
      return patterns
        .sort((a, b) => {
          const aIsWorkflow = a.toolName.includes('→');
          const bIsWorkflow = b.toolName.includes('→');

          // Individual tools first, then workflows, then by usage frequency
          if (aIsWorkflow !== bIsWorkflow) {
            return aIsWorkflow ? 1 : -1;
          }

          return b.successfulUsages.length - a.successfulUsages.length;
        })
        .slice(0, limit);
    } catch (error) {
      console.error('Tool pattern search error:', error);
      return [];
    }
  }

  async getRecentSessions(limit: number = 10): Promise<any[]> {
    try {
      // OPTIMIZED: Fast session discovery with parallel processing and early termination
      const projectDirs = await findProjectDirectories();
      const expandedDirs = await expandWorktreeProjects(projectDirs);

      // PERFORMANCE: Limit projects and use parallel processing like GLOBAL
      const limitedDirs = expandedDirs.slice(0, 10); // Limit projects for speed

      // PARALLEL PROCESSING: Process projects concurrently
      const projectResults = await Promise.allSettled(
        limitedDirs.map(async (projectDir) => {
          const jsonlFiles = await findJsonlFiles(projectDir);
          const decodedPath = projectDir.replace(/-/g, '/');
          const projectName = decodedPath.split('/').pop() || 'unknown';

          // PERFORMANCE: Limit files per project and process in parallel
          const limitedFiles = jsonlFiles.slice(0, 5); // Limit files for speed

          const sessionResults = await Promise.allSettled(
            limitedFiles.map(async (file) => {
              const messages = await this.parser.parseJsonlFile(projectDir, file);

              if (messages.length === 0) return null;

              // Fast extraction of session data
              const toolsUsed = [...new Set(messages.flatMap((m) => m.context?.toolsUsed || []))];
              const startTime = messages[0]?.timestamp;
              const endTime = messages[messages.length - 1]?.timestamp;

              // Quick duration calculation
              let realDuration = 0;
              if (startTime && endTime) {
                realDuration = Math.round(
                  (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
                );
              }

              // Extract accomplishments - what was actually done
              const accomplishments = this.extractSessionAccomplishments(messages);

              return {
                session_id: file.replace('.jsonl', ''),
                project_path: decodedPath,
                project_dir: projectDir,
                project_name: projectName,
                message_count: messages.length,
                duration_minutes: realDuration,
                end_time: endTime,
                start_time: startTime,
                tools_used: toolsUsed.slice(0, 5), // Limit tools for speed
                assistant_count: messages.filter((m) => m.type === 'assistant').length,
                error_count: messages.filter((m) => m.context?.errorPatterns?.length).length,
                session_quality: this.calculateSessionQuality(messages, toolsUsed, []),
                accomplishments: accomplishments.slice(0, 3), // Top 3 accomplishments
              };
            })
          );

          // Collect successful session results
          return sessionResults
            .filter((result) => result.status === 'fulfilled' && result.value)
            .map((result) => (result as PromiseFulfilledResult<any>).value);
        })
      );

      // Flatten and collect all sessions
      const realSessions: any[] = [];
      for (const result of projectResults) {
        if (result.status === 'fulfilled') {
          realSessions.push(...result.value);
        }
      }

      // Sort by real end time
      return realSessions
        .filter((s) => s.end_time) // Only sessions with real timestamps
        .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Recent sessions error:', error);
      return [];
    }
  }

  private calculateSessionQuality(
    messages: any[],
    toolsUsed: string[],
    errorMessages: any[]
  ): string {
    const score = toolsUsed.length * 10 + messages.length * 0.5 - errorMessages.length * 5;
    if (score > 50) return 'excellent';
    if (score > 25) return 'good';
    if (score > 10) return 'average';
    return 'poor';
  }

  // Extract accomplishments from session messages - what was actually done
  private extractSessionAccomplishments(messages: CompactMessage[]): string[] {
    const accomplishments: string[] = [];

    for (const msg of messages) {
      if (msg.type !== 'assistant') continue;
      const content = msg.content;

      // Git commits - multiple formats
      const commitMatch1 = content.match(/git commit -m\s*["']([^"']{10,80})["']/i);
      if (commitMatch1) {
        accomplishments.push(`Committed: ${commitMatch1[1]}`);
        continue;
      }

      const commitMatch2 = content.match(/committed:?\s*["']?([^"'\n]{10,60})["']?/i);
      if (commitMatch2) {
        accomplishments.push(`Committed: ${commitMatch2[1]}`);
        continue;
      }

      // Test outcomes - expanded patterns
      const testCountMatch = content.match(/(\d+)\s*tests?\s*passed/i);
      if (testCountMatch) {
        accomplishments.push(`${testCountMatch[1]} tests passed`);
        continue;
      }

      const allTestsMatch = content.match(/all\s*tests?\s*(?:passed|succeeded)/i);
      if (allTestsMatch) {
        accomplishments.push('All tests passed');
        continue;
      }

      // Build outcomes - expanded patterns
      const buildSuccessMatch = content.match(/build\s*(?:succeeded|completed)/i);
      if (buildSuccessMatch) {
        accomplishments.push('Build succeeded');
        continue;
      }

      const compileSuccessMatch = content.match(/(?:compiled|built)\s*successfully/i);
      if (compileSuccessMatch) {
        accomplishments.push('Built successfully');
        continue;
      }

      // Explicit accomplishments - expanded patterns
      const accomplishMatch = content.match(
        /(?:completed|implemented|fixed|created|built|added):?\s*([^.\n]{10,80})/i
      );
      if (accomplishMatch) {
        accomplishments.push(accomplishMatch[1].trim());
        continue;
      }

      const summaryMatch = content.match(
        /(?:here's what we accomplished|accomplishments):?\s*([^.\n]{10,100})/i
      );
      if (summaryMatch) {
        accomplishments.push(summaryMatch[1].trim());
        continue;
      }

      // Look for tool usage - Edit tool with file paths
      const editMatch = content.match(/Edit.*?file_path.*?["']([^"']+\.\w{1,5})["']/);
      if (editMatch) {
        const filename = editMatch[1].split('/').pop() || editMatch[1];
        accomplishments.push(`Edited: ${filename}`);
        continue;
      }

      // Look for Write tool usage
      const writeMatch = content.match(/Write.*?file_path.*?["']([^"']+\.\w{1,5})["']/);
      if (writeMatch) {
        const filename = writeMatch[1].split('/').pop() || writeMatch[1];
        accomplishments.push(`Created: ${filename}`);
        continue;
      }
    }

    // Deduplicate and return top 3
    return [...new Set(accomplishments)].slice(0, 3);
  }

  async getSessionMessages(encodedProjectDir: string, sessionId: string): Promise<any[]> {
    try {
      // Direct access to specific session file
      const jsonlFile = `${sessionId}.jsonl`;

      const messages = await this.parser.parseJsonlFile(encodedProjectDir, jsonlFile);
      return messages;
    } catch (error) {
      console.error(
        `Error getting session messages for ${sessionId} in ${encodedProjectDir}:`,
        error
      );
      return [];
    }
  }

  private isLowValueContent(content: string): boolean {
    const lowerContent = content.toLowerCase();

    // Filter out only genuinely useless content - be conservative
    const lowValuePatterns = [
      'local-command-stdout>(no content)',
      'command-name>/doctor',
      'system-reminder>',
      'much better! now i can see',
      /^(ok|yes|no|sure|thanks)\.?$/,
      /^error:\s*$/,
      /^warning:\s*$/,
    ];

    return (
      lowValuePatterns.some((pattern) =>
        typeof pattern === 'string' ? lowerContent.includes(pattern) : pattern.test(lowerContent)
      ) || content.trim().length < 20
    );
  }

  // Helper to detect if content contains actual error (not just meta-discussion about errors)
  private isActualError(content: string): boolean {
    const errorIndicators = [
      /error[:\s]/i, // "error:" or "error "
      /exception[:\s]/i, // "exception:" or "exception "
      /failed/i, // any "failed" message
      /\w+Error/i, // TypeError, SyntaxError, etc.
      /cannot\s+/i, // "cannot read", "cannot find"
      /undefined\s+is\s+not/i, // common JS error
      /not\s+found/i, // module not found, file not found
      /invalid/i, // invalid argument, invalid syntax
      /stack trace/i, // stack trace
      /at\s+\w+\s+\([^)]+:\d+:\d+\)/, // Stack trace line
    ];
    return errorIndicators.some((pattern) => pattern.test(content));
  }

  // Filter meta-content about errors (detects plans/discussions vs actual solutions)
  private isMetaErrorContent(content: string): boolean {
    const metaIndicators = [
      /\d+\/\d+.*(?:pass|fail|queries|results)/i, // Score patterns like "2/3 pass"
      /(?:test|benchmark|verify).*(?:error|solution)/i, // Testing discussions
      /(?:plan|design|implement).*(?:error handling|solution)/i, // Planning discussions
      /root\s+cause.*:/i, // Analysis text
      /(?:⚠️|✅|❌|🔴|🟢)/, // Status emojis (any documentation/planning)
      /\|\s*(?:tool|status|issue)/i, // Markdown tables about tools/status
    ];
    return metaIndicators.some((p) => p.test(content));
  }

  // Extract actual tool patterns from message content
  private extractActualToolPatterns(toolName: string, messages: CompactMessage[]): string[] {
    const patterns: string[] = [];

    for (const msg of messages.slice(0, 25)) {
      // PRIMARY: Extract from context (set by parser from tool_use structure)
      if (msg.context?.filesReferenced?.length) {
        for (const file of msg.context.filesReferenced.slice(0, 3)) {
          const filename = file.split('/').pop() || file;
          if (toolName === 'Edit' || toolName === 'Write' || toolName === 'Read') {
            patterns.push(`${toolName}: ${filename}`);
          }
        }
      }

      const content = msg.content;

      // SECONDARY: Look for tool usage descriptions in content
      const toolMentionMatch = content.match(
        new RegExp(
          `(?:use|using|called?)\\s+(?:the\\s+)?${toolName}(?:\\s+tool)?\\s+(?:to|on|for)\\s+([^.\\n]{10,60})`,
          'i'
        )
      );
      if (toolMentionMatch) {
        patterns.push(`${toolName}: ${toolMentionMatch[1].trim()}`);
      }

      // BASH-specific: Extract actual commands from code blocks
      if (toolName === 'Bash') {
        const bashCodeMatch = content.match(/```(?:bash|sh|shell|)\n(.{5,80})\n/);
        if (bashCodeMatch) {
          patterns.push(`$ ${bashCodeMatch[1].substring(0, 60)}`);
        }
      }
    }

    // Return unique patterns, limit to 10
    return [...new Set(patterns)].slice(0, 10);
  }

  // Extract actual best practices from usage patterns for Issue #47
  private extractActualBestPractices(toolName: string, messages: CompactMessage[]): string[] {
    const practices: string[] = [];
    const fileTypes = new Set<string>();
    let successCount = 0;

    for (const msg of messages) {
      // Count successes (no error patterns)
      if (!msg.context?.errorPatterns?.length) {
        successCount++;
      }

      // Extract file types
      msg.context?.filesReferenced?.forEach((file) => {
        const ext = file.match(/\.(\w+)$/)?.[1];
        if (ext) fileTypes.add(ext);
      });
    }

    // Generate practices based on actual usage
    if (fileTypes.size > 0) {
      const types = Array.from(fileTypes).slice(0, 5).join(', ');
      practices.push(`Used with: ${types} files`);
    }

    if (successCount > 0) {
      const successRate = Math.round((successCount / messages.length) * 100);
      practices.push(`${successRate}% success rate (${successCount}/${messages.length} uses)`);
    }

    // Tool-specific practices
    if (toolName === 'Edit' && messages.length > 5) {
      practices.push('Frequent file modifications - consider atomic changes');
    } else if (toolName === 'Bash' && messages.length > 3) {
      practices.push('Multiple command executions - verify error handling');
    } else if (toolName === 'Read' && messages.length > 10) {
      practices.push('Heavy file reading - consider caching');
    }

    return practices.slice(0, 5);
  }

  async searchPlans(query: string, limit: number = 10): Promise<PlanResult[]> {
    try {
      const planFiles = await findPlanFiles();
      const plansPath = getClaudePlansPath();

      // Process all plan files in parallel
      const planResults = await Promise.allSettled(
        planFiles.map(async (filename) => {
          const filepath = join(plansPath, filename);
          const content = await readFile(filepath, 'utf-8');
          const stats = await stat(filepath);

          // Parse markdown structure
          const title = this.extractPlanTitle(content);
          const sections = this.extractPlanSections(content);
          const filesMentioned = this.extractFileReferences(content);

          // Calculate relevance score
          const relevanceScore = this.calculatePlanRelevance(query, title, sections, content);

          return {
            name: filename.replace('.md', ''),
            filepath,
            title,
            content: content.substring(0, 2000), // Limit content size
            sections,
            filesMentioned,
            timestamp: stats.mtime.toISOString(),
            relevanceScore,
          };
        })
      );

      // Collect successful results
      const plans: PlanResult[] = [];
      for (const result of planResults) {
        if (result.status === 'fulfilled') {
          plans.push(result.value);
        }
      }

      // Filter by relevance and sort
      return plans
        .filter((p) => p.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Plan search error:', error);
      return [];
    }
  }

  private extractPlanTitle(content: string): string | null {
    // Extract first H1 heading
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }

  private extractPlanSections(content: string): string[] {
    // Extract H2 headings
    const matches = content.matchAll(/^##\s+(.+)$/gm);
    return Array.from(matches, (m) => m[1].trim());
  }

  private extractFileReferences(content: string): string[] {
    const filePatterns = [
      /[\w\-./]+\.(ts|js|json|md|py|tsx|jsx|css|scss|html|yml|yaml|toml|sh)/g,
      /`([^`]+\.\w{1,5})`/g,
      /src\/[\w\-./]+/g,
    ];

    const files = new Set<string>();
    for (const pattern of filePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const file = match[1] || match[0];
        if (file && file.length > 2 && file.length < 100) {
          files.add(file);
        }
      }
    }

    return Array.from(files).slice(0, 20);
  }

  private calculatePlanRelevance(
    query: string,
    title: string | null,
    sections: string[],
    content: string
  ): number {
    const lowerQuery = query.toLowerCase();
    const queryTerms = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

    let score = 0;

    // Title match (high weight)
    if (title) {
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes(lowerQuery)) score += 20;
      for (const term of queryTerms) {
        if (lowerTitle.includes(term)) score += 5;
      }
    }

    // Section match (medium weight)
    for (const section of sections) {
      const lowerSection = section.toLowerCase();
      if (lowerSection.includes(lowerQuery)) score += 10;
      for (const term of queryTerms) {
        if (lowerSection.includes(term)) score += 3;
      }
    }

    // Content match (lower weight, but catches everything)
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes(lowerQuery)) score += 8;
    for (const term of queryTerms) {
      const occurrences = (lowerContent.match(new RegExp(term, 'g')) || []).length;
      score += Math.min(occurrences, 5); // Cap per-term contribution
    }

    return score;
  }
}
