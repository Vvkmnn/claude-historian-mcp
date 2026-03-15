export interface MessageContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | MessageContentBlock[];
}

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
  slug?: string;
}

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

export interface CompactMessage {
  uuid: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  sessionId: string;
  projectPath?: string;
  relevanceScore?: number;
  finalScore?: number; // For enhanced scoring calculations
  sessionSlug?: string; // Human-readable session name (e.g., "curried-zooming-charm")
  _contentLower?: string; // Lazy-cached content.toLowerCase() — avoid recomputing in hot loops
  _contentType?: 'code' | 'error' | 'technical' | 'conversational'; // Lazy-cached detectContentType()
  context?: {
    filesReferenced?: string[];
    toolsUsed?: string[];
    errorPatterns?: string[];
    bashCommands?: string[]; // Extracted bash commands from tool_use
    editDiffs?: string[]; // "old → new" summaries from Edit tool_use inputs
    claudeInsights?: string[]; // Solutions, explanations from Claude
    codeSnippets?: string[]; // Code blocks and snippets
    actionItems?: string[]; // Next steps and actions
    progressInfo?: string[]; // Progress lines: "Progress: X/Y done", task status
  };
}

export interface SearchResult {
  messages: CompactMessage[];
  totalResults: number;
  searchQuery: string;
  executionTime: number;
}

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

export interface ErrorSolution {
  errorPattern: string;
  solution: CompactMessage[];
  context: string;
  frequency: number;
  successRate?: number;
  averageResolutionTime?: number;
  rootCauses?: string[];
  preventionStrategies?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  intelligentInsights?: string[];
}

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

export interface ConversationSession {
  sessionId: string;
  projectPath: string;
  startTime: string;
  endTime: string;
  messageCount: number;
  summary?: string;
}

export interface PlanResult {
  name: string;
  filepath: string;
  title: string | null;
  content: string;
  sections: string[];
  filesMentioned: string[];
  timestamp: string;
  relevanceScore: number;
}

export interface PlanSearchResult {
  searchQuery: string;
  plans: PlanResult[];
}

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
  session_quality: string;
  accomplishments: string[];
  projectPath?: string;
}

export interface QueryAnalysis {
  type: string;
  urgency: 'high' | 'medium' | 'low';
  scope: 'broad' | 'focused';
  expectsCode: boolean;
  expectsSolution: boolean;
  keywords: string[];
  semanticBoosts: Record<string, number>;
}

export interface TimelineEntry {
  timestamp: string;
  operation: string;
  message: CompactMessage;
}

export interface WorkflowStep {
  toolName: string;
  context: string;
  messages: CompactMessage[];
}
