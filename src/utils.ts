import { readdir, stat, access, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { platform } from 'os';
import { constants } from 'fs';

export function getClaudeProjectsPath(): string {
  return join(homedir(), '.claude', 'projects');
}

export function getClaudePlansPath(): string {
  return join(homedir(), '.claude', 'plans');
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

export function decodeProjectPath(encodedPath: string): string {
  // Claude encodes paths by replacing '/' with '-'
  return encodedPath.replace(/-/g, '/');
}

export function encodeProjectPath(path: string): string {
  // Encode path for Claude projects directory naming
  return path.replace(/\//g, '-');
}

export async function findProjectDirectories(): Promise<string[]> {
  try {
    const projectsPath = getClaudeProjectsPath();
    const entries = await readdir(projectsPath);

    const dirsWithMtime: { dir: string; mtime: number }[] = [];

    for (const entry of entries) {
      const fullPath = join(projectsPath, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        dirsWithMtime.push({ dir: entry, mtime: stats.mtimeMs });
      }
    }

    // Sort by mtime descending (most recent first) - fixes #70
    return dirsWithMtime.sort((a, b) => b.mtime - a.mtime).map((d) => d.dir);
  } catch (error) {
    console.error('Error finding project directories:', error);
    return [];
  }
}

export async function findJsonlFiles(projectDir: string): Promise<string[]> {
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
      })
    );

    return filesWithStats.sort((a, b) => b.mtime - a.mtime).map((f) => f.file);
  } catch (error) {
    console.error(`Error finding JSONL files in ${projectDir}:`, error);
    return [];
  }
}

export function extractContentFromMessage(message: any): string {
  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((item: any) => {
        if (item.type === 'text') return item.text;
        if (item.type === 'tool_use') return `[Tool: ${item.name}]`;
        if (item.type === 'tool_result') return `[Tool Result]`;
        return '';
      })
      .join(' ')
      .trim();
  }

  return '';
}

/**
 * Check if a tech term appears in content with normal casing
 * Allows: "react", "React", "REACT" (lowercase, uppercase, title case)
 * Rejects: "ReAct", "rEact" (mixed internal capitalization = different term)
 */
function matchesTechTerm(content: string, term: string): boolean {
  const words = content.split(/[\s.,;:!?()\[\]{}'"<>]+/);
  const termLower = term.toLowerCase();

  for (const word of words) {
    const cleanWord = word.replace(/[^\w-]/g, '');
    if (!cleanWord) continue;

    if (cleanWord.toLowerCase() === termLower) {
      // Check casing pattern - allow normal variations, reject mixed internal caps
      const isNormalCase =
        cleanWord === cleanWord.toLowerCase() || // "react"
        cleanWord === cleanWord.toUpperCase() || // "REACT"
        cleanWord === cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase(); // "React"

      if (isNormalCase) {
        return true;
      }
      // Mixed case like "ReAct" - skip this word, might find normal version elsewhere
    }
  }
  return false;
}

export function calculateRelevanceScore(message: any, query: string, projectPath?: string): number {
  let score = 0;
  const content = extractContentFromMessage(message.message || {});
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Identify core technical terms - specific tech names that MUST match for relevance
  // These are often the most important words in a query (frameworks, tools, protocols)
  const coreTechPatterns =
    /^(webpack|docker|react|vue|angular|node|npm|yarn|typescript|python|rust|go|java|kubernetes|aws|gcp|azure|postgres|mysql|redis|mongodb|graphql|rest|grpc|oauth|jwt|git|github|gitlab|jenkins|nginx|apache|eslint|prettier|babel|vite|rollup|esbuild|jest|mocha|cypress|playwright|nextjs|nuxt|svelte|tailwind|sass|less|vitest|pnpm|turborepo|prisma|drizzle|sequelize|sqlite|leveldb|indexeddb)$/i;
  // Generic terms that should NOT become core terms even if 5+ chars
  const genericTerms = new Set([
    // Action words
    'config',
    'configuration',
    'setup',
    'install',
    'build',
    'deploy',
    'test',
    'run',
    'start',
    'create',
    'update',
    'fix',
    'add',
    'remove',
    'change',
    'optimize',
    'optimization',
    'improve',
    'use',
    'using',
    'with',
    'for',
    'the',
    'and',
    'make',
    'write',
    'read',
    'delete',
    'check',
    // Testing-related words (appear in many contexts: A/B testing, user testing, etc.)
    'testing',
    'tests',
    'mocks',
    'mocking',
    'mock',
    'stubs',
    'stubbing',
    'specs',
    'coverage',
    // Design/architecture terms (appear across many domains)
    'design',
    'designs',
    'designing',
    'responsive',
    'architecture',
    'pattern',
    'patterns',
    // Performance/optimization terms
    'caching',
    'cache',
    'rendering',
    'render',
    'bundle',
    'bundling',
    'performance',
    // Process/strategy terms
    'strategy',
    'strategies',
    'approach',
    'implementation',
    'solution',
    'solutions',
    'feature',
    'features',
    'system',
    'systems',
    'process',
    'processing',
    'handler',
    'handling',
    'manager',
    'management',
    // Common nouns that appear in many contexts
    'files',
    'file',
    'folder',
    'directory',
    'path',
    'code',
    'data',
    'error',
    'errors',
    'function',
    'functions',
    'class',
    'classes',
    'method',
    'methods',
    'variable',
    'variables',
    'component',
    'components',
    'module',
    'modules',
    'package',
    'packages',
    'library',
    'libraries',
    // Format/display words
    'format',
    'formatting',
    'style',
    'styles',
    'layout',
    'display',
    'show',
    'hide',
    'visible',
    'rules',
    'rule',
    'options',
    'option',
    'settings',
    'setting',
    'params',
    'parameters',
    // Generic technical words
    'server',
    'client',
    'request',
    'response',
    'async',
    'await',
    'promise',
    'callback',
    'import',
    'export',
    'require',
    'include',
    'define',
    'declare',
    'return',
    'output',
    'input',
    // Database/schema generic terms (appear in many contexts)
    'database',
    'schema',
    'schemas',
    'models',
    'model',
    'table',
    'tables',
    'query',
    'queries',
    'migration',
    'migrations',
    'index',
    'indexes',
    'field',
    'fields',
    'column',
    'columns',
    // Deployment/infra generic terms
    'deployment',
    'container',
    'containers',
    'service',
    'services',
    'cluster',
    'clusters',
    'instance',
    'instances',
    'environment',
    'environments',
    'manifest',
    'resource',
    'resources',
    // Common programming terms
    'interface',
    'interfaces',
    'types',
    'typing',
    'object',
    'objects',
    'array',
    'arrays',
    'string',
    'strings',
    'number',
    'numbers',
    'boolean',
    'value',
    'values',
    'property',
    'properties',
  ]);

  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);

  // STRICT core terms: Only tech names from coreTechPatterns are "must-match"
  // These are specific frameworks/tools that MUST appear for relevance
  const strictCoreTerms = queryWords.filter((w) => coreTechPatterns.test(w));

  // Supporting terms: Other 5+ char words boost score but don't require match
  const supportingTerms = queryWords.filter(
    (w) => !coreTechPatterns.test(w) && !genericTerms.has(w) && w.length >= 5
  );

  // Check if STRICT core terms match (tech names like vue, rust, kubernetes)
  let strictCoreMatches = 0;
  for (const term of strictCoreTerms) {
    if (matchesTechTerm(content, term)) {
      strictCoreMatches++;
      score += 10; // High weight for tech name matches
    }
  }

  // If query has strict tech terms but NONE match, reject completely
  if (strictCoreTerms.length > 0 && strictCoreMatches === 0) {
    return 0; // No relevance if specific tech terms don't match
  }

  // Supporting terms boost score but don't reject if missing
  for (const term of supportingTerms) {
    if (matchesTechTerm(content, term)) {
      score += 3; // Moderate boost for supporting term matches
    }
  }

  // Individual word scoring for remaining words
  let wordMatchCount = strictCoreMatches;
  for (const word of queryWords) {
    if (
      !strictCoreTerms.includes(word) &&
      !supportingTerms.includes(word) &&
      matchesTechTerm(content, word)
    ) {
      wordMatchCount++;
      score += 2; // +2 per matching word
    }
  }

  // Bonus for exact phrase match (all words in order)
  if (lowerContent.includes(lowerQuery)) {
    score += 5; // Bonus for exact phrase, but not required
  }

  // Bonus for matching majority of query words
  if (queryWords.length > 0 && wordMatchCount >= Math.ceil(queryWords.length * 0.6)) {
    score += 4; // 60%+ word match bonus
  }

  // Tool usage bonus
  if (message.type === 'tool_use' || message.type === 'tool_result') {
    score += 5;
  }

  // File reference bonus
  if (content.includes('src/') || content.includes('.ts') || content.includes('.js')) {
    score += 3;
  }

  // Project path matching bonus
  if (projectPath && message.cwd && message.cwd.includes(projectPath)) {
    score += 5;
  }

  return score;
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

export async function expandWorktreeProjects(projectDirs: string[]): Promise<string[]> {
  // TEMPORARILY DISABLED FOR TESTING
  return projectDirs;

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
