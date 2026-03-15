import { readdir, stat, access, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { constants } from 'fs';
import { ClaudeMessage, MessageContentBlock } from './types.js';

// Directory listing caches — MCP server is long-lived, 30s TTL avoids
// ~6,700 stat calls per query while staying fresh enough for search.
const DIR_CACHE_TTL = 30_000;
const projectDirCache: { dirs: string[]; ts: number } = { dirs: [], ts: 0 };
const jsonlFileCache = new Map<string, { files: string[]; ts: number }>();

export function getClaudeProjectsPath(): string {
  return join(homedir(), '.claude', 'projects');
}

export function getClaudePlansPath(): string {
  return join(homedir(), '.claude', 'plans');
}

export function getClaudeTasksPath(): string {
  return join(homedir(), '.claude', 'tasks');
}

export async function findPlanFiles(): Promise<string[]> {
  try {
    const plansPath = getClaudePlansPath();
    const entries = await readdir(plansPath);
    return entries.filter((file) => file.endsWith('.md'));
  } catch (error) {
    console.error('Error finding plan files:', error);
    return [];
  }
}

export async function walkDirectory(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          const subFiles = await walkDirectory(fullPath);
          results.push(...subFiles);
        } else if (stats.isFile()) {
          results.push(fullPath);
        }
      } catch {
        // Skip files/dirs we can't access
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }

  return results;
}

export async function findClaudeMarkdownFiles(): Promise<{ path: string; category: string }[]> {
  try {
    const results: { path: string; category: string }[] = [];
    const claudeDir = join(homedir(), '.claude');

    // Search global ~/.claude/ directory
    const globalCategories = ['rules', 'skills', 'agents', 'plans'];
    for (const category of globalCategories) {
      const categoryPath = join(claudeDir, category);
      try {
        await access(categoryPath, constants.F_OK);
        const files = await walkDirectory(categoryPath);
        for (const file of files) {
          if (file.endsWith('.md')) {
            results.push({ path: file, category: `global-${category}` });
          }
        }
      } catch {
        // Category doesn't exist, skip
      }
    }

    // Check for CLAUDE.md in ~/.claude/
    const globalClaudeMd = join(claudeDir, 'CLAUDE.md');
    try {
      await access(globalClaudeMd, constants.F_OK);
      results.push({ path: globalClaudeMd, category: 'global-claude-md' });
    } catch {
      // CLAUDE.md doesn't exist
    }

    // Search project .claude/ directories
    const projectDirs = await findProjectDirectories();
    for (const projectDir of projectDirs) {
      const decodedPath = decodeProjectPath(projectDir);
      const projectClaudeDir = join(decodedPath, '.claude');

      try {
        await access(projectClaudeDir, constants.F_OK);

        // Search project categories
        for (const category of globalCategories) {
          const categoryPath = join(projectClaudeDir, category);
          try {
            await access(categoryPath, constants.F_OK);
            const files = await walkDirectory(categoryPath);
            for (const file of files) {
              if (file.endsWith('.md')) {
                results.push({ path: file, category: `project-${category}` });
              }
            }
          } catch {
            // Category doesn't exist in this project
          }
        }

        // Check for CLAUDE.md in project
        const projectClaudeMd = join(projectClaudeDir, 'CLAUDE.md');
        try {
          await access(projectClaudeMd, constants.F_OK);
          results.push({ path: projectClaudeMd, category: 'project-claude-md' });
        } catch {
          // Project CLAUDE.md doesn't exist
        }
      } catch {
        // Project doesn't have .claude directory
      }
    }

    return results;
  } catch (error) {
    console.error('Error finding Claude markdown files:', error);
    return [];
  }
}

export async function findTaskFiles(): Promise<string[]> {
  try {
    const tasksPath = getClaudeTasksPath();
    const files = await walkDirectory(tasksPath);
    return files.filter((file) => file.endsWith('.json'));
  } catch (error) {
    console.error('Error finding task files:', error);
    return [];
  }
}

export function decodeProjectPath(encodedPath: string): string {
  // Claude encodes paths by replacing '/' with '-'
  return encodedPath.replace(/-/g, '/');
}

export function encodeProjectPath(path: string): string {
  // Encode path for Claude projects directory naming
  return path.replace(/\//g, '-');
}

export async function findProjectDirectories(): Promise<string[]> {
  const now = Date.now();
  if (projectDirCache.dirs.length > 0 && now - projectDirCache.ts < DIR_CACHE_TTL) {
    return projectDirCache.dirs;
  }

  try {
    const projectsPath = getClaudeProjectsPath();
    const entries = await readdir(projectsPath);

    // Parallel stat() — was sequential (70 serial syscalls for 70 projects)
    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          const fullPath = join(projectsPath, entry);
          const stats = await stat(fullPath);
          return stats.isDirectory() ? { dir: entry, mtime: stats.mtimeMs } : null;
        } catch {
          return null;
        }
      }),
    );

    const dirsWithMtime = results.filter((r): r is { dir: string; mtime: number } => r !== null);

    // Sort by mtime descending (most recent first) - fixes #70
    const dirs = dirsWithMtime.sort((a, b) => b.mtime - a.mtime).map((d) => d.dir);
    projectDirCache.dirs = dirs;
    projectDirCache.ts = now;
    return dirs;
  } catch (error) {
    console.error('Error finding project directories:', error);
    return [];
  }
}

export async function findJsonlFiles(projectDir: string): Promise<string[]> {
  const now = Date.now();
  const cached = jsonlFileCache.get(projectDir);
  if (cached && now - cached.ts < DIR_CACHE_TTL) return cached.files;

  try {
    const projectsPath = getClaudeProjectsPath();
    const fullPath = join(projectsPath, projectDir);
    const entries = await readdir(fullPath);
    const jsonlFiles = entries.filter((file) => file.endsWith('.jsonl'));

    // Get mtime for each file and sort by most recent first - fixes #70
    const filesWithStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        try {
          const filePath = join(fullPath, file);
          const stats = await stat(filePath);
          return { file, mtime: stats.mtimeMs };
        } catch {
          return { file, mtime: 0 };
        }
      }),
    );

    const files = filesWithStats.sort((a, b) => b.mtime - a.mtime).map((f) => f.file);
    jsonlFileCache.set(projectDir, { files, ts: now });
    return files;
  } catch (error) {
    console.error(`Error finding JSONL files in ${projectDir}:`, error);
    return [];
  }
}

export function extractContentFromMessage(message: {
  content?: string | MessageContentBlock[];
}): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item: MessageContentBlock) => {
        if (item.type === 'text') return item.text ?? '';
        if (item.type === 'tool_use') {
          const parts = [`[Tool: ${item.name}]`];
          if (item.input) {
            // Extract high-value fields: file paths, commands, descriptions, queries
            for (const key of [
              'file_path',
              'command',
              'description',
              'pattern',
              'query',
              'prompt',
              'path',
            ]) {
              const val = item.input[key];
              if (typeof val === 'string') {
                parts.push(val.slice(0, 200));
              }
            }
          }
          return parts.join(' ');
        }
        if (item.type === 'tool_result') {
          if (typeof item.content === 'string') {
            return `[Tool Result] ${item.content.slice(0, 300)}`;
          }
          return '[Tool Result]';
        }
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

import {
  EXACT_MATCH_SCORE,
  SUPPORTING_TERM_SCORE,
  WORD_MATCH_SCORE,
  EXACT_PHRASE_BONUS,
  MAJORITY_MATCH_BONUS,
  TOOL_USAGE_SCORE,
  FILE_REFERENCE_SCORE,
  PROJECT_MATCH_SCORE,
  CORE_TECH_PATTERN,
  GENERIC_TERMS,
} from './scoring-constants.js';

/* matchesTechTerm removed — replaced by pre-computed contentWordSet in
 * calculateRelevanceScore. Content is now split once into a Set<string>
 * for O(1) lookups instead of O(n) linear scan per term per call.
 * The old function also re-split content on every invocation (3-5x per message).
 *
 * History: v1.0.4 had a mixed-case rejection filter that caused false negatives
 * for TypeScript, JavaScript, GraphQL, MongoDB, etc. v1.0.5 fixed to simple
 * case-insensitive matching. v1.0.6 replaced with Set-based lookup. */

export function calculateRelevanceScore(
  message: ClaudeMessage,
  query: string,
  projectPath?: string,
  preExtractedContent?: string,
  preComputedQueryWords?: string[],
): number {
  const content = preExtractedContent ?? extractContentFromMessage(message.message || {});
  if (!content) return 0;

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryWords = preComputedQueryWords ?? lowerQuery.split(/\s+/).filter((w) => w.length > 2);

  // Split content into words ONCE — matchesTechTerm was re-splitting per call
  const contentWords = content.split(/[\s.,;:!?()[\]{}'"<>]+/);
  const contentWordsLower = contentWords
    .map((w) => w.replace(/[^\w-]/g, '').toLowerCase())
    .filter(Boolean);
  const contentWordSet = new Set(contentWordsLower);

  const coreScore = scoreCoreTerms(lowerContent, queryWords, contentWordSet);

  // Core term mismatch applies a heavy penalty but does NOT reject.
  // Recall rule: filters must be soft (scoring boosts), not hard (discard).
  let score = coreScore;
  score += scoreSupportingTerms(queryWords, contentWordSet);

  // Gate metadata bonuses behind query term match.
  // Without this, scoreToolUsage(+5) and scoreFileReferences(+3) give positive
  // scores to messages with ZERO query relevance — "xyznonexistent" returns results.
  const anyTermMatched =
    queryWords.length === 0 || queryWords.some((w) => lowerContent.includes(w));

  if (anyTermMatched) {
    score += scoreToolUsage(message);
    score += scoreFileReferences(lowerContent);
    score += scoreProjectMatch(message, projectPath);

    // Slug match bonus: session slugs are human-memorable names like "curried-zooming-charm"
    if (message.slug) {
      const slugWords = message.slug.toLowerCase().replace(/-/g, ' ');
      if (queryWords.some((w) => slugWords.includes(w))) {
        score += 5;
      }
    }
  }

  return score;
}

function scoreCoreTerms(
  lowerContent: string,
  queryWords: string[],
  contentWordSet: Set<string>,
): number {
  // Strict core terms: tech names from CORE_TECH_PATTERN that MUST match
  const strictCoreTerms = queryWords.filter((w) => CORE_TECH_PATTERN.test(w));

  let strictCoreMatches = 0;
  let score = 0;

  for (const term of strictCoreTerms) {
    if (contentWordSet.has(term)) {
      strictCoreMatches++;
      score += EXACT_MATCH_SCORE;
    }
  }

  // If query has strict tech terms but NONE match, heavy penalty (not rejection).
  // Recall rule: soft filters only — never discard candidates before scoring phase.
  if (strictCoreTerms.length > 0 && strictCoreMatches === 0) {
    score -= 8;
  }

  // Individual word scoring for non-core terms
  // Two-tier matching: exact word boundary first, substring fallback second.
  // Substring fallback catches hyphenated terms ("font-size", "idle-time-limit"),
  // dotted terms ("demo.cast", "demo.gif"), and embedded terms that word-splitting misses.
  let wordMatchCount = strictCoreMatches;
  for (const word of queryWords) {
    if (!strictCoreTerms.includes(word)) {
      if (contentWordSet.has(word)) {
        wordMatchCount++;
        score += WORD_MATCH_SCORE;
      } else if (lowerContent.includes(word)) {
        wordMatchCount++;
        score += WORD_MATCH_SCORE * 0.5;
      }
    }
  }

  // Bonus for exact phrase match
  if (lowerContent.includes(queryWords.join(' '))) {
    score += EXACT_PHRASE_BONUS;
  }

  // Bonus for matching majority of query words
  if (queryWords.length > 0 && wordMatchCount >= Math.ceil(queryWords.length * 0.6)) {
    score += MAJORITY_MATCH_BONUS;
  }

  return score;
}

function scoreSupportingTerms(queryWords: string[], contentWordSet: Set<string>): number {
  // Supporting terms: 5+ char words that aren't core tech or generic
  const supportingTerms = queryWords.filter(
    (w) => !CORE_TECH_PATTERN.test(w) && !GENERIC_TERMS.has(w) && w.length >= 5,
  );

  let score = 0;
  for (const term of supportingTerms) {
    if (contentWordSet.has(term)) {
      score += SUPPORTING_TERM_SCORE;
    }
  }

  return score;
}

function scoreToolUsage(message: ClaudeMessage): number {
  return message.type === 'tool_use' || message.type === 'tool_result' ? TOOL_USAGE_SCORE : 0;
}

function scoreFileReferences(lowerContent: string): number {
  return lowerContent.includes('src/') ||
    lowerContent.includes('.ts') ||
    lowerContent.includes('.js')
    ? FILE_REFERENCE_SCORE
    : 0;
}

function scoreProjectMatch(message: ClaudeMessage, projectPath?: string): number {
  return projectPath && message.cwd && message.cwd.includes(projectPath) ? PROJECT_MATCH_SCORE : 0;
}

export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

export function getTimeRangeFilter(timeframe?: string): (timestamp: string) => boolean {
  if (!timeframe) return () => true;

  const now = new Date();
  const cutoff = new Date();

  switch (timeframe.toLowerCase()) {
    case 'today':
      cutoff.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      cutoff.setDate(now.getDate() - 1);
      cutoff.setHours(0, 0, 0, 0);
      break;
    case 'week':
    case 'last-week':
      cutoff.setDate(now.getDate() - 7);
      break;
    case 'month':
    case 'last-month':
      cutoff.setMonth(now.getMonth() - 1);
      break;
    default:
      return () => true;
  }

  return (timestamp: string) => {
    const messageDate = new Date(timestamp);
    return messageDate >= cutoff;
  };
}

/* DEAD: Desktop detection functions — claudeDesktopAvailable hardcoded false (issue #70)
export function getClaudeDesktopPath(): string | null {
  switch (platform()) {
    case 'darwin':
      return join(homedir(), 'Library/Application Support/Claude/');
    case 'win32':
      return join(process.env.APPDATA || '', 'Claude/');
    case 'linux':
      return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Claude/');
    default:
      return null;
  }
}

export async function detectClaudeDesktop(): Promise<boolean> {
  try {
    const desktopPath = getClaudeDesktopPath();
    if (!desktopPath) return false;

    const configPath = join(desktopPath, 'claude_desktop_config.json');
    await access(configPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function getClaudeDesktopStoragePath(): Promise<string | null> {
  const desktopPath = getClaudeDesktopPath();
  if (!desktopPath) return null;

  const storagePath = join(desktopPath, 'Local Storage');
  try {
    await access(storagePath, constants.F_OK);
    return storagePath;
  } catch {
    return null;
  }
}

export async function getClaudeDesktopIndexedDBPath(): Promise<string | null> {
  const desktopPath = getClaudeDesktopPath();
  if (!desktopPath) return null;

  const indexedDBPath = join(desktopPath, 'IndexedDB');
  try {
    await access(indexedDBPath, constants.F_OK);
    return indexedDBPath;
  } catch {
    return null;
  }
}
*/

// Git worktree detection and parent project discovery
export async function isGitWorktree(projectPath: string): Promise<boolean> {
  try {
    const decodedPath = decodeProjectPath(projectPath);
    const gitPath = join(decodedPath, '.git');

    // Check if .git exists and is a file (not a directory)
    const stats = await stat(gitPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function getParentProjectFromWorktree(projectPath: string): Promise<string | null> {
  try {
    const decodedPath = decodeProjectPath(projectPath);
    const gitFilePath = join(decodedPath, '.git');

    // Read the .git file which contains: gitdir: /path/to/parent/.git/worktrees/name
    const gitFileContent = await readFile(gitFilePath, 'utf-8');
    const gitdirMatch = gitFileContent.match(/gitdir:\s*(.+)/);

    if (!gitdirMatch) return null;

    const gitdir = gitdirMatch[1].trim();
    // Extract parent path: /path/to/parent/.git/worktrees/name → /path/to/parent
    const parentPath = gitdir.replace(/\.git\/worktrees\/.+$/, '').trim();

    if (!parentPath) return null;

    // Encode the parent path to match Claude's project directory naming
    return encodeProjectPath(parentPath);
  } catch {
    return null;
  }
}

export function expandWorktreeProjects(projectDirs: string[]): Promise<string[]> {
  // TEMPORARILY DISABLED FOR TESTING — async logic commented out below
  return Promise.resolve(projectDirs);

  // const expanded = new Set<string>(projectDirs);

  // for (const projectDir of projectDirs) {
  //   if (await isGitWorktree(projectDir)) {
  //     const parentProject = await getParentProjectFromWorktree(projectDir);
  //     if (parentProject && parentProject !== projectDir) {
  //       expanded.add(parentProject);
  //     }
  //   }
  // }

  // return Array.from(expanded);
}
