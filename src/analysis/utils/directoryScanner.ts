import * as vscode from 'vscode';
import * as path from 'path';
import { 
  DirectoryAnalysisResult, 
  DirectoryAnalysisSummary, 
  FileMetrics, 
  FileChangeInfo,
  FunctionMetrics
} from '../static/directory/directoryAnalysisModel';
import { DirectoryAnalysisManager } from '../static/directory/directoryAnalysisManager';
import { 
  AnalysisFilters, 
  DEFAULT_FILTERS,
  scanDirectoryWithCounts
} from '../static/utils/scanUtils';
import { DEFAULT_SHALLOW_FILTERS } from '../static/directory/common/directoryAnalysisConfig';
import { loadPreviousDirectoryAnalysis, saveDirectoryAnalysisResult } from '../shared/directoryAnalysisDataManager';

/**
 * Shared directory scanning options
 */
export interface DirectoryScanOptions {
  /** Whether to include subdirectories (false = shallow, true = deep) */
  includeSubdirectories: boolean;
  
  /** Analysis mode - affects visualization but not data collection */
  mode: 'static' | 'xr';
  
  /** Custom analysis filters */
  filters?: AnalysisFilters;
  
  /** Extension context for accessing previous data */
  context?: vscode.ExtensionContext;
  
  /** Whether this is a project-level analysis */
  isProject?: boolean;
}

/**
 * Shared directory scanner that generates analysis data for both static and XR modes
 */
export class DirectoryDataScanner {
  private manager: DirectoryAnalysisManager;
  
  constructor() {
    this.manager = new DirectoryAnalysisManager();
  }
  
  /**
   * Sets the progress callback for reporting scanning progress
   */
  setProgressCallback(callback: (current: number, total: number, currentFile: string) => void): void {
    this.manager.setProgressCallback(callback);
  }
  
  /**
   * Scans a directory and generates analysis data
   * @param directoryPath Path to directory to analyze
   * @param options Scanning options
   * @returns Directory analysis result
   */
  async scanDirectory(
    directoryPath: string,
    options: DirectoryScanOptions
  ): Promise<DirectoryAnalysisResult> {
    console.log(`🔍 DirectoryDataScanner: Starting ${options.mode} scan of ${directoryPath}`);
    console.log(`📊 Scan options:`, options);
    
    // Load previous analysis data if available
    let previousResult: DirectoryAnalysisResult | undefined;
    let dataPath: string | undefined;
    
    if (options.context) {
      try {
        const previousData = await loadPreviousDirectoryAnalysis({
          context: options.context,
          directoryPath,
          mode: options.mode,
          isProject: options.isProject
        });
        
        previousResult = previousData.previousResult;
        dataPath = previousData.dataPath;
        
        if (previousResult) {
          console.log(`📊 Using previous analysis data for incremental scanning`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not load previous analysis data: ${error}`);
      }
    }
    
    // Determine filters based on options
    const filters: AnalysisFilters = {
      ...DEFAULT_SHALLOW_FILTERS, // Always use shallow for directory XR
      ...(options.filters || {})
    };
    
    // Force shallow scan for XR mode or if includeSubdirectories is false
    if (options.mode === 'xr' || !options.includeSubdirectories) {
      filters.maxDepth = 1;
      console.log(`📁 Using SHALLOW scan (maxDepth=1) for ${options.mode} mode`);
    }
    
    console.log(`📊 Final scan filters:`, filters);
    
    // Perform the directory analysis using existing manager logic with previous result
    const result = await this.manager.analyzeDirectory(directoryPath, filters, previousResult);
    
    // Save the result to the appropriate location if we have a data path
    if (dataPath && options.context) {
      try {
        await saveDirectoryAnalysisResult(result, dataPath, options.mode);
      } catch (error) {
        console.warn(`⚠️ Could not save analysis result: ${error}`);
      }
    }
    
    console.log(`✅ DirectoryDataScanner: Completed ${options.mode} scan`);
    console.log(`📈 Results: ${result.summary.totalFilesAnalyzed} files analyzed out of ${result.summary.totalFiles} total`);
    
    return result;
  }
  
  /**
   * Clears the progress callback
   */
  clearProgressCallback(): void {
    this.manager.clearProgressCallback();
  }
}

/**
 * Shared function to create directory analysis data
 * Used by both static and XR directory analysis
 */
export async function createDirectoryAnalysisData(
  directoryPath: string,
  options: DirectoryScanOptions,
  progressCallback?: (current: number, total: number, currentFile: string) => void
): Promise<DirectoryAnalysisResult> {
  const scanner = new DirectoryDataScanner();
  
  if (progressCallback) {
    scanner.setProgressCallback(progressCallback);
  }
  
  try {
    const result = await scanner.scanDirectory(directoryPath, options);
    return result;
  } finally {
    scanner.clearProgressCallback();
  }
}
