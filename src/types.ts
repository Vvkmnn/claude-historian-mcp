/**
 * Shared type definitions for the Historian MCP server.
 *
 * All interfaces consumed by the parser, search engine, formatter,
 * and universal engine live here. No runtime logic — types only.
 */

// ── Raw JSONL types ────────────────────────────────────────────────

/** A single content block inside a Claude API message. */
export interface MessageContentBlock {
  type: string;
  text?: string;
  /** Tool name (present when `type === "tool_use"`). */
  name?: string;
  /** Tool input parameters (present when `type === "tool_use"`). */
  input?: Record<string, unknown>;
  /** Nested content — string for tool results, array for composite blocks. */
  content?: string | MessageContentBlock[];
}

/** Raw message record as stored in Claude Code JSONL session files. */
export interface ClaudeMessage {
  parentUuid: string | null;
  isSidechain: boolean;
  userType: string;
  cwd: string;
  sessionId: string;
  version: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  message?: {
    role: string;
    content: string | MessageContentBlock[];
    id?: string;
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
  uuid: string;
  timestamp: string;
  requestId?: string;
  /** Human-readable session name (e.g. "curried-zooming-charm"). */
  slug?: string;
}

// ── Processed / search types ───────────────────────────────────────

/** Aggregated session summary produced by `generateCompactSummary`. */
export interface CompactSummaryData {
  session_id: string;
  end_time: string | undefined | null;
  start_time: string | undefined | null;
  duration_minutes: number;
  message_count: number;
  project_path: string | null;
  tools_used: string[];
  files_modified: string[];
  accomplishments: string[];
  key_decisions: string[];
}

/**
 * Parsed and scored message used throughout search and formatting.
 *
 * Fields prefixed with `_` are lazy-computed caches — populated on
 * first access to avoid redundant work in hot scoring loops.
 */
export interface CompactMessage {
  uuid: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  sessionId: string;
  projectPath?: string;
  relevanceScore?: number;
  /** Combined score after all boost passes. */
  finalScore?: number;
  /** Human-readable session name (e.g. "curried-zooming-charm"). */
  sessionSlug?: string;
  /** @internal Lazy-cached `content.toLowerCase()`. */
  _contentLower?: string;
  /** @internal Lazy-cached content type classification. */
  _contentType?: 'code' | 'error' | 'technical' | 'conversational';
  /** Structured metadata extracted from the raw message. */
  context?: {
    filesReferenced?: string[];
    toolsUsed?: string[];
    errorPatterns?: string[];
    /** Extracted bash commands from tool_use inputs. */
    bashCommands?: string[];
    /** "old -> new" summaries from Edit tool_use inputs. */
    editDiffs?: string[];
    /** Actual skill names invoked via the Skill tool. */
    skillInvocations?: string[];
    /** Solutions and explanations from Claude assistant messages. */
    claudeInsights?: string[];
    /** Code blocks and inline snippets. */
    codeSnippets?: string[];
    /** Next steps and action items. */
    actionItems?: string[];
    /** Progress lines: "Progress: X/Y done", task status. */
    progressInfo?: string[];
  };
}

/** Paginated search result returned by `searchConversations` and friends. */
export interface SearchResult {
  messages: CompactMessage[];
  totalResults: number;
  searchQuery: string;
  /** Wall-clock search time in milliseconds. */
  executionTime: number;
}

/** File-centric view of all operations touching a given path. */
export interface FileContext {
  filePath: string;
  lastModified: string;
  relatedMessages: CompactMessage[];
  operationType: 'read' | 'write' | 'edit' | 'delete';
  changeFrequency?: number;
  impactLevel?: 'low' | 'medium' | 'high';
  affectedSystems?: string[];
  timeline?: TimelineEntry[];
  insights?: string[];
}

/** An error pattern paired with the messages that resolved it. */
export interface ErrorSolution {
  errorPattern: string;
  solution: CompactMessage[];
  context: string;
  /** How many times this error pattern was encountered. */
  frequency: number;
  successRate?: number;
  averageResolutionTime?: number;
  rootCauses?: string[];
  preventionStrategies?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  intelligentInsights?: string[];
}

/** Usage patterns and best practices for a specific tool. */
export interface ToolPattern {
  toolName: string;
  successfulUsages: CompactMessage[];
  commonPatterns: string[];
  bestPractices: string[];
  workflowSequences?: WorkflowStep[];
  successRate?: number;
  averageTime?: number;
  intelligentInsights?: string[];
}

// ── Transcript types ──────────────────────────────────────────────

/** A single entry in a conversation transcript (text only, no tool calls). */
export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

/** Full transcript result for a session. */
export interface TranscriptResult {
  session_id: string;
  project_path: string | null;
  message_count: number;
  start_time: string | null;
  end_time: string | null;
  messages: TranscriptEntry[];
}

// ── Session / plan types ───────────────────────────────────────────

/** Minimal session metadata tracked during JSONL parsing. */
export interface ConversationSession {
  sessionId: string;
  projectPath: string;
  startTime: string;
  endTime: string;
  messageCount: number;
  summary?: string;
}

/** A plan file matched by `searchPlans`. */
export interface PlanResult {
  name: string;
  filepath: string;
  title: string | null;
  content: string;
  /** Markdown heading names found in the plan. */
  sections: string[];
  /** File paths referenced inside the plan body. */
  filesMentioned: string[];
  timestamp: string;
  relevanceScore: number;
  /** Session that created/modified this plan (via findFileContext). */
  sessionId?: string;
  sessionSlug?: string;
  /** Project path where this plan was referenced. */
  project?: string;
}

/** Wrapper returned by the plan search formatter. */
export interface PlanSearchResult {
  searchQuery: string;
  plans: PlanResult[];
}

/** Rich session metadata surfaced by `getRecentSessions`. */
export interface SessionInfo {
  session_id: string;
  project_path: string;
  project_dir: string;
  project_name: string;
  message_count: number;
  duration_minutes: number;
  end_time: string | undefined;
  start_time: string | undefined;
  tools_used: string[];
  assistant_count: number;
  error_count: number;
  /** Quality label derived from message density and error rate. */
  session_quality: string;
  accomplishments: string[];
  projectPath?: string;
}

// ── Query analysis ─────────────────────────────────────────────────

/** Result of heuristic query classification for search optimization. */
export interface QueryAnalysis {
  type: string;
  urgency: 'high' | 'medium' | 'low';
  scope: 'broad' | 'focused';
  expectsCode: boolean;
  expectsSolution: boolean;
  keywords: string[];
  /** Per-keyword multiplicative boosts applied during scoring. */
  semanticBoosts: Record<string, number>;
}

// ── Supporting types ───────────────────────────────────────────────

/** A single timestamped operation in a file's change timeline. */
export interface TimelineEntry {
  timestamp: string;
  operation: string;
  message: CompactMessage;
}

/** One step in a multi-tool workflow sequence. */
export interface WorkflowStep {
  toolName: string;
  context: string;
  messages: CompactMessage[];
}
