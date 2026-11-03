/**
 * Universal search engine facade for the Historian MCP server.
 *
 * Wraps `HistorySearchEngine` (Claude Code JSONL search) and was
 * originally designed to also search Claude Desktop local storage.
 * Desktop support is disabled since issue #70 (conversations moved
 * server-side). Dead Desktop code is preserved at the bottom of this
 * file for potential future reuse.
 */
import { HistorySearchEngine } from './search.js';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

import {
  SearchResult,
  FileContext,
  ErrorSolution,
  CompactMessage,
  ClaudeMessage,
  PlanResult,
  SessionInfo,
  ToolPattern,
  CompactSummaryData,
  TranscriptEntry,
  TranscriptResult,
} from './types.js';
import { findProjectDirectories, getClaudeProjectsPath } from './utils.js';

/* DEAD: Desktop imports — claudeDesktopAvailable hardcoded false (issue #70)
import {
  detectClaudeDesktop,
  getClaudeDesktopStoragePath,
  getClaudeDesktopIndexedDBPath,
} from './utils.js';
import { readdir, readFile, mkdtemp, copyFile, rm, chmod } from 'fs/promises';
import { readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
*/

// ── Types ──────────────────────────────────────────────────────────

/** Search result wrapper indicating data source and enhancement status. */
export interface UniversalSearchResult {
  source: 'claude-code' | 'claude-desktop';
  results: SearchResult;
  enhanced: boolean;
}

// ── Engine ─────────────────────────────────────────────────────────

/**
 * Facade that delegates to `HistorySearchEngine` for Claude Code data.
 *
 * @remarks
 * Desktop search branches were removed in issue #70. All methods now
 * pass through directly to the Claude Code engine.
 */
export class UniversalHistorySearchEngine {
  private claudeCodeEngine: HistorySearchEngine;

  /* DEAD: Desktop fields — claudeDesktopAvailable hardcoded false (issue #70)
  private claudeDesktopAvailable: boolean | null = null;
  private desktopStoragePath: string | null = null;
  private desktopIndexedDBPath: string | null = null;
  private levelDB: any = null;
  private sqlite3: any = null;
  private enhancedMode: boolean = false;
  */

  constructor() {
    this.claudeCodeEngine = new HistorySearchEngine();
  }

  async initialize(): Promise<void> {
    // Desktop support disabled until server-side storage issue is resolved
    // See: https://github.com/Vvkmnn/claude-historian-mcp/issues/70
  }

  // ── Pass-through methods ──────────────────────────────────────────

  /**
   * Search conversation history.
   *
   * @param query - Free-text search query.
   * @param project - Optional project filter.
   * @param timeframe - Optional time window.
   * @param limit - Maximum results.
   * @returns Wrapped search results with source metadata.
   */
  async searchConversations(
    query: string,
    project?: string,
    timeframe?: string,
    limit?: number,
  ): Promise<UniversalSearchResult> {
    await this.initialize();

    const claudeCodeResults = await this.claudeCodeEngine.searchConversations(
      query,
      project,
      timeframe,
      limit,
    );

    return {
      source: 'claude-code',
      results: claudeCodeResults,
      enhanced: false,
    };
  }

  /**
   * Find file operation context.
   *
   * @param filepath - File path to search for.
   * @param limit - Maximum results.
   */
  async findFileContext(
    filepath: string,
    limit?: number,
  ): Promise<{ source: string; results: FileContext[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeResults = await this.claudeCodeEngine.findFileContext(filepath, limit);

    return {
      source: 'claude-code',
      results: claudeCodeResults,
      enhanced: false,
    };
  }

  /**
   * Find semantically similar past queries.
   *
   * @param query - Query to find similar matches for.
   * @param limit - Maximum results.
   */
  async findSimilarQueries(
    query: string,
    limit?: number,
  ): Promise<{ source: string; results: CompactMessage[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeResults = await this.claudeCodeEngine.findSimilarQueries(query, limit);

    return {
      source: 'claude-code',
      results: claudeCodeResults,
      enhanced: false,
    };
  }

  /**
   * Find past solutions for an error pattern.
   *
   * @param errorPattern - Error message or pattern.
   * @param limit - Maximum solutions.
   * @param project - Optional project filter.
   * @param timeframe - Optional time window.
   */
  async getErrorSolutions(
    errorPattern: string,
    limit?: number,
    project?: string,
    timeframe?: string,
  ): Promise<{ source: string; results: ErrorSolution[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeResults = await this.claudeCodeEngine.getErrorSolutions(
      errorPattern,
      limit,
      project,
      timeframe,
    );

    return {
      source: 'claude-code',
      results: claudeCodeResults,
      enhanced: false,
    };
  }

  /**
   * List recent sessions with metadata.
   *
   * @param limit - Maximum sessions.
   * @param project - Optional project filter.
   * @param timeframe - Optional time window.
   */
  async getRecentSessions(
    limit?: number,
    project?: string,
    timeframe?: string,
  ): Promise<{ source: string; results: SessionInfo[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeSessions = await this.claudeCodeEngine.getRecentSessions(
      limit || 10,
      project,
      timeframe,
    );

    return {
      source: 'claude-code',
      results: claudeCodeSessions,
      enhanced: false,
    };
  }

  /**
   * Discover tool usage patterns.
   *
   * @param toolName - Optional tool name filter.
   * @param limit - Maximum patterns.
   * @param project - Optional project filter.
   * @param timeframe - Optional time window.
   */
  async getToolPatterns(
    toolName?: string,
    limit?: number,
    project?: string,
    timeframe?: string,
  ): Promise<{ source: string; results: ToolPattern[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodePatterns = await this.claudeCodeEngine.getToolPatterns(
      toolName,
      limit || 12,
      project,
      timeframe,
    );

    return {
      source: 'claude-code',
      results: claudeCodePatterns,
      enhanced: false,
    };
  }

  // ── Substantive methods ───────────────────────────────────────────

  /**
   * Generate a compact summary for a specific session.
   *
   * Supports the "latest" keyword to auto-resolve the most recent session.
   * Scans all project directories to find the session file directly.
   *
   * @param sessionId - Session UUID or "latest".
   * @param maxMessages - Maximum messages to include (default 100).
   * @param focus - Optional focus filter ("tools", "files", "solutions", "all").
   * @returns Compact summary with tools, files, accomplishments, and decisions.
   */
  async generateCompactSummary(
    sessionId: string,
    maxMessages?: number,
    focus?: string,
  ): Promise<{ source: string; results: CompactSummaryData; enhanced: boolean }> {
    await this.initialize();

    const emptySummary: CompactSummaryData = {
      session_id: sessionId,
      end_time: null,
      start_time: null,
      duration_minutes: 0,
      message_count: 0,
      project_path: null,
      tools_used: [],
      files_modified: [],
      accomplishments: [],
      key_decisions: [],
    };

    // Support "latest" keyword — still needs getRecentSessions(1)
    let resolvedSessionId = sessionId;
    if (sessionId.toLowerCase() === 'latest') {
      const recent = await this.claudeCodeEngine.getRecentSessions(1);
      if (recent.length > 0) {
        resolvedSessionId = recent[0].session_id;
      } else {
        return { source: 'claude-code', results: emptySummary, enhanced: false };
      }
    }

    // Direct lookup: scan project directories for ${sessionId}.jsonl
    // instead of only searching the 20 most recent sessions (old bug).
    const projectDirs = await findProjectDirectories();
    let foundMessages: CompactMessage[] = [];
    let foundProjectDir = '';

    for (const projectDir of projectDirs) {
      try {
        const messages = await this.claudeCodeEngine.getSessionMessages(
          projectDir,
          resolvedSessionId,
        );
        if (messages.length > 0) {
          foundMessages = messages;
          foundProjectDir = projectDir;
          break;
        }
      } catch {
        // Session file not in this project dir, continue
      }
    }

    if (foundMessages.length === 0) {
      return {
        source: 'claude-code',
        results: { ...emptySummary, session_id: resolvedSessionId },
        enhanced: false,
      };
    }

    const decodedPath = foundProjectDir.replace(/-/g, '/');
    const sessionMessages = foundMessages.slice(0, maxMessages || 100);

    const startTime = sessionMessages[0]?.timestamp;
    const endTime = sessionMessages[sessionMessages.length - 1]?.timestamp;
    let durationMinutes = 0;
    if (startTime && endTime) {
      durationMinutes = Math.round(
        (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000,
      );
    }

    const richSummary: CompactSummaryData = {
      session_id: resolvedSessionId,
      end_time: endTime,
      start_time: startTime,
      duration_minutes: durationMinutes,
      message_count: sessionMessages.length,
      project_path: decodedPath,
      tools_used: this.extractToolsFromMessages(sessionMessages),
      files_modified: this.extractFilesFromMessages(sessionMessages),
      accomplishments: this.extractAccomplishmentsFromMessages(sessionMessages),
      key_decisions: this.extractDecisionsFromMessages(sessionMessages),
    };

    // Focus filtering: narrow output to specific aspects
    const f = focus?.toLowerCase();
    if (f && f !== 'all') {
      if (f === 'tools') {
        richSummary.accomplishments = [];
        richSummary.key_decisions = [];
        richSummary.files_modified = [];
      } else if (f === 'files') {
        richSummary.tools_used = [];
        richSummary.accomplishments = [];
        richSummary.key_decisions = [];
      } else if (f === 'solutions') {
        richSummary.tools_used = [];
        richSummary.files_modified = [];
        // Keep accomplishments + key_decisions (insights/fixes)
      }
    }

    return {
      source: 'claude-code',
      results: richSummary,
      enhanced: false,
    };
  }

  /**
   * Search plan files.
   *
   * @param query - Free-text search query.
   * @param limit - Maximum plan results.
   */
  async searchPlans(
    query: string,
    limit?: number,
  ): Promise<{ source: string; results: PlanResult[]; enhanced: boolean }> {
    const plans = await this.claudeCodeEngine.searchPlans(query, limit || 10);

    return {
      source: 'claude-code',
      results: plans,
      enhanced: false,
    };
  }

  // ── Transcript extraction ──────────────────────────────────────────

  /**
   * Extract a clean conversation transcript for a specific session.
   *
   * Returns only user and assistant text messages — no tool_use, tool_result,
   * thinking blocks, or system content. Designed for providing accurate
   * conversation context to sub-agents.
   *
   * @param sessionId - Session UUID, short prefix, or "latest".
   * @returns Clean transcript with role, text, and timestamp per message.
   */
  async getSessionTranscript(sessionId: string): Promise<TranscriptResult> {
    await this.initialize();

    const emptyResult: TranscriptResult = {
      session_id: sessionId,
      project_path: null,
      message_count: 0,
      start_time: null,
      end_time: null,
      messages: [],
    };

    // Resolve "latest" keyword
    let resolvedSessionId = sessionId;
    if (sessionId.toLowerCase() === 'latest') {
      const recent = await this.claudeCodeEngine.getRecentSessions(1);
      if (recent.length > 0) {
        resolvedSessionId = recent[0].session_id;
      } else {
        return emptyResult;
      }
    }

    // Find the session JSONL file across all project directories
    const projectDirs = await findProjectDirectories();
    let foundFilePath: string | null = null;
    let foundProjectDir = '';

    for (const projectDir of projectDirs) {
      const projectsPath = getClaudeProjectsPath();

      // Try exact match first
      const exactPath = join(projectsPath, projectDir, `${resolvedSessionId}.jsonl`);
      try {
        await stat(exactPath);
        foundFilePath = exactPath;
        foundProjectDir = projectDir;
        break;
      } catch {
        // Not found, try prefix match
      }

      // Prefix search
      try {
        const { readdir } = await import('fs/promises');
        const files = await readdir(join(projectsPath, projectDir));
        const match = files.find((f) => f.startsWith(resolvedSessionId) && f.endsWith('.jsonl'));
        if (match) {
          foundFilePath = join(projectsPath, projectDir, match);
          foundProjectDir = projectDir;
          break;
        }
      } catch {
        // Directory not readable, continue
      }
    }

    if (!foundFilePath) {
      return { ...emptyResult, session_id: resolvedSessionId };
    }

    // Parse the JSONL file, extracting only user/assistant text content
    const transcript: TranscriptEntry[] = [];
    const SMALL_FILE_THRESHOLD = 400_000;

    const processLine = (line: string): void => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line) as ClaudeMessage;

        // Only include user and assistant messages
        if (msg.type !== 'user' && msg.type !== 'assistant') return;
        if (!msg.message?.content) return;

        // Extract only text content (no tool_use, tool_result, thinking)
        let text = '';
        if (typeof msg.message.content === 'string') {
          text = msg.message.content;
        } else if (Array.isArray(msg.message.content)) {
          text = (msg.message.content as Array<{ type: string; text?: string }>)
            .filter((block) => block.type === 'text')
            .map((block) => block.text ?? '')
            .join('\n')
            .trim();
        }

        // Skip empty messages (e.g. assistant messages that were only tool calls)
        if (!text) return;

        // Skip system-reminder content injected into user messages
        if (msg.type === 'user' && text.startsWith('<tool_result')) return;

        transcript.push({
          role: msg.type,
          text,
          timestamp: msg.timestamp,
        });
      } catch {
        // Skip malformed lines
      }
    };

    try {
      const fileStats = await stat(foundFilePath);
      if (fileStats.size < SMALL_FILE_THRESHOLD) {
        const content = await readFile(foundFilePath, 'utf-8');
        for (const line of content.split('\n')) {
          processLine(line);
        }
      } else {
        const fileStream = createReadStream(foundFilePath, { encoding: 'utf8' });
        const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
        for await (const line of rl) {
          processLine(line);
        }
      }
    } catch {
      return { ...emptyResult, session_id: resolvedSessionId };
    }

    const decodedPath = foundProjectDir.replace(/-/g, '/');

    return {
      session_id: resolvedSessionId,
      project_path: decodedPath,
      message_count: transcript.length,
      start_time: transcript[0]?.timestamp ?? null,
      end_time: transcript[transcript.length - 1]?.timestamp ?? null,
      messages: transcript,
    };
  }

  // ── Extraction helpers ─────────────────────────────────────────────

  private extractToolsFromMessages(messages: CompactMessage[]): string[] {
    const tools = new Set<string>();
    messages.forEach((msg) => {
      msg.context?.toolsUsed?.forEach((tool: string) => tools.add(tool));
    });
    return Array.from(tools).slice(0, 8);
  }

  private extractFilesFromMessages(messages: CompactMessage[]): string[] {
    const files = new Set<string>();
    messages.forEach((msg) => {
      msg.context?.filesReferenced?.forEach((file: string) => {
        const filename = file.split('/').pop() ?? file;
        if (filename.length > 2) files.add(filename);
      });
    });
    return Array.from(files).slice(0, 10);
  }

  private extractAccomplishmentsFromMessages(messages: CompactMessage[]): string[] {
    const rawAccomplishments: string[] = [];

    const isValidAccomplishment = (text: string): boolean => {
      const trimmed = text.trim();
      if (trimmed.length < 15) return false;
      const words = trimmed.split(/\s+/).filter((w) => w.length > 1);
      if (words.length < 2) return false;
      if (/^[/.\w]+$/.test(trimmed)) return false;
      if (/^[*`#]+/.test(trimmed)) return false;
      return true;
    };

    for (const msg of messages) {
      if (msg.type !== 'assistant') continue;
      const content = msg.content;

      const toolCompleteMatch = content.match(
        /(?:I've|I have|Just|Successfully)\s+(?:used|called|ran|executed)\s+(?:the\s+)?(\w+)\s+tool\s+to\s+([^.]{15,100})/i,
      );
      if (toolCompleteMatch) {
        rawAccomplishments.push(`${toolCompleteMatch[1]}: ${toolCompleteMatch[2].trim()}`);
      }

      const doneMatch = content.match(/(?:Done|Complete|Finished)[:.!]\s*([^.\n]{15,100})/i);
      if (doneMatch) {
        rawAccomplishments.push(doneMatch[1].trim());
      }

      const nowIsMatch = content.match(
        /Now\s+(?:the\s+)?(\w+)\s+(?:is|are|has|have|works?)\s+([^.]{10,80})/i,
      );
      if (nowIsMatch && nowIsMatch[1].length + nowIsMatch[2].length > 12) {
        rawAccomplishments.push(`${nowIsMatch[1]} ${nowIsMatch[2].trim()}`);
      }

      const actionMatch = content.match(
        /(?:Made|Updated|Fixed|Changed|Created|Added|Removed|Refactored|Implemented|Resolved)\s+(?:the\s+)?([^.\n]{15,100})/i,
      );
      if (actionMatch) {
        rawAccomplishments.push(actionMatch[1].trim());
      }

      const theNowMatch = content.match(/The\s+(\w+)\s+now\s+([^.]{10,80})/i);
      if (theNowMatch && theNowMatch[1].length + theNowMatch[2].length > 12) {
        rawAccomplishments.push(`${theNowMatch[1]} now ${theNowMatch[2].trim()}`);
      }

      const commitMatch1 = content.match(/git commit -m\s*["']([^"']{10,80})["']/i);
      if (commitMatch1) {
        rawAccomplishments.push(`Committed: ${commitMatch1[1]}`);
      }

      const commitMatch2 = content.match(/committed:?\s*["']?([^"'\n]{10,60})["']?/i);
      if (commitMatch2 && !commitMatch1) {
        rawAccomplishments.push(`Committed: ${commitMatch2[1]}`);
      }

      const accomplishPattern1 = content.match(
        /(?:I've |I have |Successfully )(?:completed?|implemented?|fixed?|created?|added?|updated?|changed?):?\s*([^.\n]{15,100})/i,
      );
      if (accomplishPattern1) {
        rawAccomplishments.push(accomplishPattern1[1].trim());
      }

      const accomplishPattern2 = content.match(
        /(?:completed?|implemented?|fixed?|created?|built?|added?|updated?)\s+(?:the\s+)?([^.\n]{15,100})/i,
      );
      if (accomplishPattern2) {
        rawAccomplishments.push(accomplishPattern2[1].trim());
      }

      const testCountMatch = content.match(/(\d+)\s*tests?\s*passed/i);
      if (testCountMatch) {
        rawAccomplishments.push(`${testCountMatch[1]} tests passed`);
      }

      const allTestsMatch = content.match(/all\s*tests?\s*(?:passed|succeeded)/i);
      if (allTestsMatch) {
        rawAccomplishments.push('All tests passed');
      }

      const buildSuccessMatch = content.match(/build\s*(?:succeeded|completed|passed)/i);
      if (buildSuccessMatch) {
        rawAccomplishments.push('Build succeeded');
      }

      const compileSuccessMatch = content.match(/(?:compiled|built)\s*successfully/i);
      if (compileSuccessMatch) {
        rawAccomplishments.push('Built successfully');
      }

      const fileTools = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'];
      if (
        msg.context?.toolsUsed?.some((t: string) => fileTools.includes(t)) &&
        msg.context?.filesReferenced?.length
      ) {
        const file = msg.context.filesReferenced[0].split('/').pop();
        if (file && file.length > 3) {
          rawAccomplishments.push(`Modified ${file}`);
        }
      }
    }

    for (const msg of messages) {
      if (msg.type === 'tool_result' && msg.content && msg.content.length > 20) {
        if (msg.content.includes('\u2728 Done') || msg.content.includes('Successfully compiled')) {
          rawAccomplishments.push('Build completed');
        }
        if (msg.content.match(/\d+\s+passing|\d+\s+passed|All tests passed/i)) {
          rawAccomplishments.push('Tests passed');
        }
        const successMatch = msg.content.match(
          /(?:successfully|completed|done|finished)[:\s]+([^.\n]{15,80})/i,
        );
        if (successMatch) {
          rawAccomplishments.push(successMatch[1].trim());
        }
      }
    }

    const validAccomplishments = rawAccomplishments.filter(isValidAccomplishment);
    return [...new Set(validAccomplishments)].slice(0, 8);
  }

  private extractDecisionsFromMessages(messages: CompactMessage[]): string[] {
    const decisions: string[] = [];
    for (const msg of messages) {
      if (msg.type !== 'assistant') continue;
      const content = msg.content;

      const decisionPatterns = [
        /(?:decided to|chose to|will use|going with|approach is)[\s:]+([^.\n]{20,100})/gi,
        /(?:best option|recommended|should use)[\s:]+([^.\n]{20,100})/gi,
        /(?:because|the reason)[\s:]+([^.\n]{20,100})/gi,
      ];

      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) decisions.push(match[1].trim());
        }
      }
    }
    return [...new Set(decisions)].slice(0, 3);
  }
}

/* =============================================================================
 * DEAD: Desktop search code — claudeDesktopAvailable hardcoded false (issue #70)
 *
 * Claude Desktop conversations moved server-side, making local LevelDB/SQLite
 * search impossible. All Desktop methods below are preserved for potential reuse
 * if/when Desktop local storage returns or an API becomes available.
 *
 * These methods were on the UniversalHistorySearchEngine class. To revive them,
 * restore the dead imports/fields above and move these methods back into the class.
 * =============================================================================

  private async detectLevelDB(): Promise<void> {
    this.enhancedMode = false;
  }

  private async searchClaudeDesktopConversations(
    query: string, timeframe?: string, limit?: number,
  ): Promise<CompactMessage[]> {
    if (!this.shouldSearchDesktop(query)) return [];
    if (!this.desktopIndexedDBPath) return [];
    const results: CompactMessage[] = [];
    try {
      const localStorageResults = await this.searchLocalStorageData(query, timeframe, limit);
      results.push(...localStorageResults);
      if (this.sqlite3) {
        const sqliteResults = await this.searchSQLiteWebStorage(query, timeframe, limit);
        results.push(...sqliteResults);
      }
      const indexedDBResults = await this.searchIndexedDBWithMicroCopy(query, timeframe, limit);
      results.push(...indexedDBResults);
      const levelDBResults = await this.searchLocalStorageWithMicroCopy(query, timeframe, limit);
      results.push(...levelDBResults);
    } catch (error) { return []; }
    return results.slice(0, limit || 10);
  }

  private shouldSearchDesktop(query: string): boolean { return true; }

  private async searchLocalStorageData(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private getClaudeDesktopLocalStoragePath(): string | null { ... }
  private async searchSQLiteWebStorage(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private getClaudeDesktopWebStoragePath(): string | null { ... }
  private async searchIndexedDBWithMicroCopy(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private async copyLogFiles(sourcePath: string, destPath: string, logFiles: string[]): Promise<void> { ... }
  private async searchLogFiles(dbPath: string, query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private extractRelevantSnippet(content: string, query: string): string { ... }
  private async searchLocalStorageWithMicroCopy(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private async copyLocalStorageFiles(sourcePath: string, destPath: string, files: string[]): Promise<void> { ... }
  private async searchLocalStorageFiles(dbPath: string, query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private async searchLocalStorage(query: string, timeframe?: string, limit?: number): Promise<any[]> { ... }
  private async searchIndexedDB(query: string, timeframe?: string, limit?: number): Promise<any[]> { ... }
  private async extractConversationsFromFile(filePath: string): Promise<any[]> { ... }
  private async searchIndexedDBWithLevel(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private async searchLocalStorageWithLevel(query: string, timeframe?: string, limit?: number): Promise<CompactMessage[]> { ... }
  private isConversationEntry(key: string, value: string): boolean { ... }
  private isLocalStorageConversationEntry(key: string, value: string): boolean { ... }
  private async parseConversationEntry(key: string, value: string, query: string, timeframe?: string): Promise<CompactMessage | null> { ... }
  private async parseLocalStorageEntry(key: string, value: string, query: string, timeframe?: string): Promise<CompactMessage | null> { ... }
  private matchesQuery(conversation: any, query: string): boolean { ... }
  private matchesTimeframe(conversation: any, timeframe?: string): boolean { ... }
  private combineSearchResults(claudeCodeResults: SearchResult, desktopMessages: CompactMessage[]): SearchResult { ... }
  private combineFileContextResults(claudeCodeResults: FileContext[], desktopMessages: CompactMessage[]): FileContext[] { ... }
  private combineErrorSolutionResults(claudeCodeResults: ErrorSolution[], desktopMessages: CompactMessage[]): ErrorSolution[] { ... }
  isClaudeDesktopAvailable(): boolean { return this.claudeDesktopAvailable === true; }
  getAvailableSources(): string[] { ... }
  private determineMessageType(data: any): 'user' | 'assistant' | 'tool_use' | 'tool_result' { ... }
  private extractMessageContent(data: any): string { ... }
  private calculateRelevanceScore(data: any, query: string): number { ... }
  private extractFileReferences(data: any): string[] { ... }
  private extractToolUsages(data: any): string[] { ... }
  private extractErrorPatterns(data: any): string[] { ... }
  private extractClaudeInsights(data: any): string[] { ... }
  private extractCodeSnippets(data: any): string[] { ... }
  private extractActionItems(data: any): string[] { ... }
  private generateSessionSummary(messages: any[], focus: string): string { ... }
  private extractCleanDesktopContent(rawSnippet: string, query: string): string | null { ... }
  private cleanupDesktopSentence(sentence: string, query: string): string { ... }
  private calculateDesktopRelevanceScore(content: string, query: string): number { ... }

  Full implementations preserved in git history at commit prior to this cleanup.
============================================================================= */
