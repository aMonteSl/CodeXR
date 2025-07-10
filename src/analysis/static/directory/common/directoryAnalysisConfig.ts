/**
 * Configuration and constants for directory analysis operations
 */

export interface DirectoryAnalysisOptions {
  /** Whether to analyze files recursively in subdirectories */
  recursive: boolean;
  /** Maximum depth for recursive analysis (0 = unlimited) */
  maxDepth?: number;
  /** Filters to apply during analysis */
  filters?: DirectoryAnalysisFilters;
}

export interface DirectoryAnalysisFilters {
  /** Maximum depth for directory traversal */
  maxDepth: number;
  /** Patterns to exclude from analysis */
  excludePatterns: string[];
  /** Maximum file size in bytes */
  maxFileSize: number;
}

export const DEFAULT_SHALLOW_FILTERS: DirectoryAnalysisFilters = {
  maxDepth: 1, // Only direct children
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ],
  maxFileSize: 1024 * 1024 // 1MB
};

export const DEFAULT_DEEP_FILTERS: DirectoryAnalysisFilters = {
  maxDepth: 50, // Deep but with reasonable limit
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/vendor/**',
    '**/third_party/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**'
  ],
  maxFileSize: 1024 * 1024 // 1MB
};

export const ANALYSIS_MODES = {
  SHALLOW: 'shallow',
  DEEP: 'deep'
} as const;

export type AnalysisMode = typeof ANALYSIS_MODES[keyof typeof ANALYSIS_MODES];
