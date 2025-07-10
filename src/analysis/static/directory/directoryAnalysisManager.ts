import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { 
  DirectoryAnalysisResult, 
  DirectoryAnalysisSummary, 
  FileMetrics, 
  FileChangeInfo,
  FunctionMetrics
} from './directoryAnalysisModel';
import { 
  scanDirectory, 
  scanDirectoryWithCounts,
  DirectoryScanResult,
  FileInfo, 
  AnalysisFilters, 
  DEFAULT_FILTERS,
  createSafeDirectoryName,
  categorizeFileSize,
  categorizeComplexity
} from '../utils/scanUtils';
import { IncrementalAnalysisEngine, IncrementalAnalysisConfig, transformToDirectoryAnalysisResult } from '../../shared/incrementalAnalysisEngine';
import { analyzeFileStatic } from '../file/fileAnalysisManager';
import { generateNonce } from '../../../utils/nonceUtils';

/**
 * Directory analysis manager
 */
export class DirectoryAnalysisManager {
  private outputChannel: vscode.OutputChannel;
  private progressCallback?: (current: number, total: number, currentFile: string) => void;
  
  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('CodeXR Directory Analysis');
  }
  
  /**
   * Sets the progress callback for reporting analysis progress
   */
  setProgressCallback(callback: (current: number, total: number, currentFile: string) => void): void {
    this.progressCallback = callback;
  }
  
  /**
   * Clears the progress callback
   */
  clearProgressCallback(): void {
    this.progressCallback = undefined;
  }
  
  /**
   * Analyzes a directory and returns comprehensive metrics
   * @param directoryPath Path to directory to analyze
   * @param filters Analysis filters
   * @param previousResult Previous analysis result for change detection
   * @returns Directory analysis result
   */
  async analyzeDirectory(
    directoryPath: string,
    filters: AnalysisFilters = DEFAULT_FILTERS,
    previousResult?: DirectoryAnalysisResult
  ): Promise<DirectoryAnalysisResult> {
    const startTime = Date.now();
    this.outputChannel.appendLine(`Starting directory analysis: ${directoryPath}`);
    
    try {
      // Create incremental analysis engine
      const engine = new IncrementalAnalysisEngine();
      
      // Configure analysis
      const config: IncrementalAnalysisConfig = {
        directoryPath,
        filters: {
          maxDepth: filters.maxDepth || 50,
          excludePatterns: filters.excludePatterns || [],
          maxFileSize: filters.maxFileSize || 1024 * 1024
        },
        previousResult,
        progressCallback: this.progressCallback,
        outputChannel: this.outputChannel
      };
      
      // Perform incremental analysis
      const incrementalResult = await engine.performIncrementalAnalysis(config);
      
      // Transform to full DirectoryAnalysisResult
      const result = transformToDirectoryAnalysisResult(
        incrementalResult,
        directoryPath,
        config.filters,
        startTime
      );
      
      this.outputChannel.appendLine(`Directory analysis completed in ${Date.now() - startTime}ms`);
      return result;
      
    } catch (error) {
      this.outputChannel.appendLine(`Error during directory analysis: ${error}`);
      throw error;
    }
  }
  
  /**
   * Analyzes the workspace root as a project
   * @param filters Analysis filters
   * @param previousResult Previous analysis result for change detection
   * @returns Directory analysis result
   */
  async analyzeProject(
    filters: AnalysisFilters = DEFAULT_FILTERS,
    previousResult?: DirectoryAnalysisResult
  ): Promise<DirectoryAnalysisResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder open');
    }
    
    const result = await this.analyzeDirectory(
      workspaceFolder.uri.fsPath,
      filters,
      previousResult
    );
    
    // Update metadata to indicate project analysis
    result.metadata.mode = 'project';
    
    return result;
  }
}
