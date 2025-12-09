// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Essential quality rules for MCP servers
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      'no-console': 'off', // Allow console for MCP server debugging
      'max-lines': 'off', // Disabled for complex MCP servers
      '@typescript-eslint/no-explicit-any': 'off', // Temporarily disabled for release
      'prefer-const': 'error',
      'no-var': 'error',
      'no-async-promise-executor': 'off', // Allow for MCP server patterns
      '@typescript-eslint/no-require-imports': 'off', // Allow dynamic imports
      'no-control-regex': 'off', // Allow for text processing
      'no-useless-escape': 'off' // Allow defensive escaping
    }
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js', '*.mjs', 'dxt/']
  }
);