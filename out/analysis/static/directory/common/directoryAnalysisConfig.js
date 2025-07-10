"use strict";
/**
 * Configuration and constants for directory analysis operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANALYSIS_MODES = exports.DEFAULT_DEEP_FILTERS = exports.DEFAULT_SHALLOW_FILTERS = void 0;
exports.DEFAULT_SHALLOW_FILTERS = {
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
exports.DEFAULT_DEEP_FILTERS = {
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
exports.ANALYSIS_MODES = {
    SHALLOW: 'shallow',
    DEEP: 'deep'
};
//# sourceMappingURL=directoryAnalysisConfig.js.map