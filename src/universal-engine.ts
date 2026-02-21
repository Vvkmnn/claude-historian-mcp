/* DEAD CODE POLICY: Desktop search code commented out — claudeDesktopAvailable hardcoded false
 * since issue #70 (Claude Desktop conversations moved server-side). All Desktop methods are
 * preserved in a block comment at the bottom of this file for potential future reuse.
 * See: https://github.com/Vvkmnn/claude-historian-mcp/issues/70 */

import { HistorySearchEngine } from './search.js';
import {
  SearchResult,
  FileContext,
  ErrorSolution,
  CompactMessage,
  PlanResult,
  SessionInfo,
  ToolPattern,
  CompactSummaryData,
} from './types.js';

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

export interface UniversalSearchResult {
  source: 'claude-code' | 'claude-desktop';
  results: SearchResult;
  enhanced: boolean;
}

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

  // --- Pass-through methods (Desktop branches removed, issue #70) ---

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

  async getErrorSolutions(
    errorPattern: string,
    limit?: number,
  ): Promise<{ source: string; results: ErrorSolution[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeResults = await this.claudeCodeEngine.getErrorSolutions(errorPattern, limit);

    return {
      source: 'claude-code',
      results: claudeCodeResults,
      enhanced: false,
    };
  }

  async getRecentSessions(
    limit?: number,
    _project?: string,
  ): Promise<{ source: string; results: SessionInfo[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodeSessions = await this.claudeCodeEngine.getRecentSessions(limit || 10);

    return {
      source: 'claude-code',
      results: claudeCodeSessions,
      enhanced: false,
    };
  }

  async getToolPatterns(
    toolName?: string,
    limit?: number,
  ): Promise<{ source: string; results: ToolPattern[]; enhanced: boolean }> {
    await this.initialize();

    const claudeCodePatterns = await this.claudeCodeEngine.getToolPatterns(toolName, limit || 12);

    return {
      source: 'claude-code',
      results: claudeCodePatterns,
      enhanced: false,
    };
  }

  // --- Substantive methods ---

  async generateCompactSummary(
    sessionId: string,
    maxMessages?: number,
    _focus?: string,
  ): Promise<{ source: string; results: CompactSummaryData; enhanced: boolean }> {
    await this.initialize();

    const allSessions = await this.claudeCodeEngine.getRecentSessions(20);

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

    // Support "latest" keyword - resolve to most recent session
    let resolvedSessionId = sessionId;
    if (sessionId.toLowerCase() === 'latest') {
      if (allSessions.length > 0) {
        resolvedSessionId = allSessions[0].session_id;
      } else {
        return { source: 'claude-code', results: emptySummary, enhanced: false };
      }
    }

    const sessionData = allSessions.find(
      (s) =>
        s.session_id === resolvedSessionId ||
        s.session_id.startsWith(resolvedSessionId) ||
        resolvedSessionId.includes(s.session_id) ||
        s.session_id.includes(resolvedSessionId.replace(/^.*\//, '')),
    );

    if (!sessionData) {
      return {
        source: 'claude-code',
        results: { ...emptySummary, session_id: resolvedSessionId },
        enhanced: false,
      };
    }

    const messages = await this.claudeCodeEngine.getSessionMessages(
      sessionData.project_dir,
      sessionData.session_id,
    );
    const sessionMessages = messages.slice(0, maxMessages || 100);

    const richSummary: CompactSummaryData = {
      session_id: sessionData.session_id,
      end_time: sessionData.end_time,
      start_time: sessionData.start_time,
      duration_minutes: sessionData.duration_minutes || 0,
      message_count: sessionMessages.length,
      project_path: sessionData.project_path,
      tools_used: this.extractToolsFromMessages(sessionMessages),
      files_modified: this.extractFilesFromMessages(sessionMessages),
      accomplishments: this.extractAccomplishmentsFromMessages(sessionMessages),
      key_decisions: this.extractDecisionsFromMessages(sessionMessages),
    };

    return {
      source: 'claude-code',
      results: richSummary,
      enhanced: false,
    };
  }

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

  // --- Extraction helpers (used by generateCompactSummary) ---

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
