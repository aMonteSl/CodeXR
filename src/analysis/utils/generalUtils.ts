import { generateNonce } from '../../utils/nonceUtils';
import { formatFileSize, countFileLines } from './analysisUtils';
import { getLanguageName } from '../../utils/languageUtils';

/**
 * Import and re-export global utilities for easy access within analysis modules
 */

// Re-export key utilities
export { generateNonce, formatFileSize, getLanguageName, countFileLines };

/**
 * Generate a unique identifier for analysis sessions
 */
export function generateAnalysisId(): string {
  return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get current timestamp for analysis
 */
export function getCurrentTimestamp(): string {
  return new Date().toLocaleString();
}

/**
 * Check if a path is a valid file path
 */
export function isValidFilePath(filePath: string): boolean {
  return typeof filePath === 'string' && filePath.length > 0 && !filePath.includes('\0');
}

/**
 * Create a formatted error message for analysis failures
 */
export function createAnalysisError(operation: string, error: Error | string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return `${operation} failed: ${errorMessage}`;
}
