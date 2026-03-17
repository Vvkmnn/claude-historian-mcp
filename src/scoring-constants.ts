/**
 * Scoring constants for conversation relevance ranking.
 *
 * Weights are tuned for Claude Code conversations where technical
 * specificity (exact framework/tool names) matters more than generic
 * keyword overlap. See `calculateRelevanceScore` in `utils.ts`.
 */

// ── Core scoring weights ───────────────────────────────────────────

/** Exact tech term match (e.g. "react" query matches "React"). */
export const EXACT_MATCH_SCORE = 10;

/** 5+ char supporting terms that are not core tech or generic. */
export const SUPPORTING_TERM_SCORE = 3;

/** General word matches (case-insensitive). */
export const WORD_MATCH_SCORE = 2;

/** Bonus when the full query phrase appears verbatim. */
export const EXACT_PHRASE_BONUS = 5;

/** Bonus when 60%+ of query words match. */
export const MAJORITY_MATCH_BONUS = 4;

// ── Context scoring weights ────────────────────────────────────────

/** Bonus for messages that use tools (tool_use / tool_result). */
export const TOOL_USAGE_SCORE = 5;

/** Bonus for messages containing file path references. */
export const FILE_REFERENCE_SCORE = 3;

/** Bonus when message CWD matches the queried project. */
export const PROJECT_MATCH_SCORE = 5;

/** Boost when a query term matches the project directory name. */
export const PROJECT_NAME_BOOST = 3;

// ── Scoring caps ───────────────────────────────────────────────────

/** Maximum multiplicative boost applied per term. */
export const MAX_MULTIPLICATIVE_BOOST = 4;

// ── Core tech pattern ──────────────────────────────────────────────

/**
 * Regex matching specific framework/tool names that act as "must-match" terms.
 *
 * @remarks
 * If a query contains one of these terms, content that lacks the term
 * receives a heavy penalty (but is not discarded — soft filter only).
 */
export const CORE_TECH_PATTERN =
  /^(webpack|docker|react|vue|angular|node|npm|yarn|typescript|python|rust|go|java|kubernetes|aws|gcp|azure|postgres|mysql|redis|mongodb|graphql|rest|grpc|oauth|jwt|git|github|gitlab|jenkins|nginx|apache|eslint|prettier|babel|vite|rollup|esbuild|jest|mocha|cypress|playwright|nextjs|nuxt|svelte|tailwind|sass|less|vitest|pnpm|turborepo|prisma|drizzle|sequelize|sqlite|leveldb|indexeddb)$/i;

// ── Generic terms ──────────────────────────────────────────────────

/**
 * Words that should never become core scoring terms even if 5+ characters.
 *
 * @remarks
 * These appear across many contexts and do not indicate specific
 * technical relevance. Filtering them prevents false-positive boosts.
 */
export const GENERIC_TERMS = new Set([
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
