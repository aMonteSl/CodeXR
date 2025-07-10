import * as path from 'path';

/**
 * Shared utilities for directory analysis progress reporting
 * Provides consistent progress display across all directory analysis modes
 */

/**
 * Progress callback type for directory analysis
 */
export type DirectoryAnalysisProgressCallback = (current: number, total: number, currentFile: string) => void;

/**
 * Options for progress display
 */
export interface ProgressDisplayOptions {
  /** Whether this is an initial analysis (vs incremental re-analysis) */
  isInitialAnalysis: boolean;
  
  /** Analysis mode for logging prefix */
  mode: 'static' | 'xr' | 'deep' | 'project';
  
  /** Custom message prefix (optional) */
  messagePrefix?: string;
}

/**
 * Creates a standardized progress callback for directory analysis
 * Used across all directory analysis modes (Static, Deep, Project, XR)
 * 
 * @param progressReporter VS Code progress reporter
 * @param options Progress display options
 * @returns Standardized progress callback function
 */
export function createDirectoryAnalysisProgressCallback(
  progressReporter: { report: (value: { message?: string; increment?: number }) => void },
  options: ProgressDisplayOptions
): DirectoryAnalysisProgressCallback {
  
  const { isInitialAnalysis, mode, messagePrefix } = options;
  
  return (current: number, total: number, currentFile: string) => {
    const fileName = path.basename(currentFile);
    const percentage = Math.round((current / total) * 100);
    
    // Different message format for initial vs incremental analysis
    let message: string;
    
    if (isInitialAnalysis) {
      // For initial analysis: show detailed progress with file count and percentage
      const prefix = messagePrefix || 'Analyzing';
      message = `${prefix}: ${fileName} [${current}/${total} files] (${percentage}%)`;
    } else {
      // For incremental analysis: simpler message
      message = `Re-analyzing changes: ${fileName}`;
    }
    
    // Log progress for debugging
    if (current === 1 || current === total || current % 10 === 0) {
      console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} progress: ${current}/${total} (${percentage}%) - ${fileName}`);
    }
    
    progressReporter.report({
      message,
      increment: (1 / total) * 100
    });
  };
}

/**
 * Creates a progress callback for VS Code notification progress
 * Standardized format for all directory analysis types
 * 
 * @param progress VS Code progress object
 * @param mode Analysis mode
 * @param isInitial Whether this is initial analysis
 * @returns Progress callback function
 */
export function createNotificationProgressCallback(
  progress: { report: (value: { message?: string; increment?: number }) => void },
  mode: 'static' | 'xr' | 'deep' | 'project',
  isInitial: boolean = true
): DirectoryAnalysisProgressCallback {
  
  return createDirectoryAnalysisProgressCallback(progress, {
    isInitialAnalysis: isInitial,
    mode,
    messagePrefix: isInitial ? 'Analyzing' : 'Re-analyzing'
  });
}

/**
 * Logs analysis start with consistent formatting
 */
export function logAnalysisStart(mode: string, directoryPath: string, isInitial: boolean): void {
  const analysisType = isInitial ? 'Initial' : 'Incremental';
  console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} ${analysisType} analysis started for: ${directoryPath}`);
}

/**
 * Logs analysis completion with consistent formatting
 */
export function logAnalysisComplete(
  mode: string, 
  directoryPath: string, 
  filesAnalyzed: number, 
  totalFiles: number,
  isInitial: boolean,
  duration?: number
): void {
  const analysisType = isInitial ? 'Initial' : 'Incremental';
  const durationText = duration ? ` in ${duration}ms` : '';
  console.log(`DIRECTORY-ANALYSIS: ${mode.toUpperCase()} ${analysisType} analysis completed: ${filesAnalyzed}/${totalFiles} files${durationText} - ${directoryPath}`);
}

/**
 * Determines if this is an initial analysis based on previous result
 */
export function isInitialAnalysis(previousResult?: any): boolean {
  return !previousResult;
}
