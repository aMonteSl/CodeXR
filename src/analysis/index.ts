/**
 * Main analysis module index
 * This is the primary entry point for all analysis functionality in CodeXR
 */

// Core analysis functionality
export * from './analysisManager';

// Data models
export * from './model';

// Analysis modules - selective exports to avoid naming conflicts
export { analyzeFileStatic, analyzeLizard, analyzeComments, analyzeClassCount } from './static';
export * from './xr';
export * from './html';

// Tree components
export * from './tree';

// File watchers
export * from './watchers';

// Utilities
export * from './utils';
