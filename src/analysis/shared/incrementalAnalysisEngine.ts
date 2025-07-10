/**
 * Shared incremental analysis engine for hash-based change detection and analysis
 * Used by both static directory analysis and XR directory analysis
 */

import * as path from 'path';
import { DirectoryAnalysisResult, FileMetrics, FunctionMetrics, FileChangeInfo } from '../static/directory/directoryAnalysisModel';
import { HashBasedChangeDetector, FileWithHash } from './hashBasedChangeDetector';
import { scanDirectoryWithCounts, FileInfo } from '../static/utils/scanUtils';
import { DirectoryAnalysisFilters, DEFAULT_DEEP_FILTERS } from '../static/directory/common/directoryAnalysisConfig';
import { analyzeFileStatic } from '../static/file/fileAnalysisManager';

/**
 * Configuration for incremental analysis
 */
export interface IncrementalAnalysisConfig {
  /** Directory path to analyze */
  directoryPath: string;
  
  /** Analysis filters */
  filters: DirectoryAnalysisFilters;
  
  /** Previous analysis result for change detection */
  previousResult?: DirectoryAnalysisResult;
  
  /** Progress callback */
  progressCallback?: (current: number, total: number, currentFile: string) => void;
  
  /** Output channel for logging */
  outputChannel?: {
    appendLine: (message: string) => void;
  };
}

/**
 * Result of incremental analysis
 */
export interface IncrementalAnalysisResult {
  /** All file metrics (analyzed + preserved) */
  allFileMetrics: FileMetrics[];
  
  /** All function metrics (analyzed + preserved) */
  allFunctions: FunctionMetrics[];
  
  /** Scan result with file counts */
  scanResult: {
    totalFiles: number;
    totalAnalyzableFiles: number;
    totalNonAnalyzableFiles: number;
    analyzableFiles: FileInfo[];
  };
  
  /** Number of files actually analyzed in this session */
  filesAnalyzedThisSession: number;
  
  /** Total files considered for analysis */
  totalFilesConsidered: number;
  
  /** Whether this was an incremental analysis */
  isIncremental: boolean;
  
  /** Changes detected */
  changes: FileChangeInfo[];
}

/**
 * Shared incremental analysis engine
 */
export class IncrementalAnalysisEngine {
  
  constructor() {
    // No need for Lizard executor, using analyzeFileStatic
  }
  
  /**
   * Performs hash-based incremental analysis
   * @param config Analysis configuration
   * @returns Incremental analysis result
   */
  async performIncrementalAnalysis(config: IncrementalAnalysisConfig): Promise<IncrementalAnalysisResult> {
    const { directoryPath, filters, previousResult, progressCallback, outputChannel } = config;
    
    const log = (message: string) => {
      if (outputChannel) {
        outputChannel.appendLine(message);
      }
      console.log(`INCREMENTAL-ANALYSIS: ${message}`);
    };
    
    // Scan directory for supported files with counts
    const scanResult = await scanDirectoryWithCounts(directoryPath, filters);
    log(`Found ${scanResult.totalFiles} total files, ${scanResult.totalAnalyzableFiles} analyzable`);
    
    // Detect changes if previous result exists
    const changes = previousResult ? this.detectChanges(scanResult.analyzableFiles, previousResult) : [];
    const isIncremental = !!previousResult;
    
    if (isIncremental) {
      const addedCount = changes.filter(c => c.changeType === 'added').length;
      const modifiedCount = changes.filter(c => c.changeType === 'modified').length;
      const deletedCount = changes.filter(c => c.changeType === 'deleted').length;
      const unchangedCount = changes.filter(c => c.changeType === 'unchanged').length;
      
      log(`📊 Hash-based change detection for ${directoryPath}:`);
      log(`   ➕ Added: ${addedCount} files`);
      log(`   📝 Modified: ${modifiedCount} files`);
      log(`   ➖ Deleted: ${deletedCount} files`);
      log(`   ✅ Unchanged: ${unchangedCount} files`);
    }
    
    // Analyze only changed or new files
    const filesToAnalyze = this.getFilesToAnalyze(scanResult.analyzableFiles, changes, previousResult);
    const filesAnalyzedThisSession = filesToAnalyze.length;
    
    log(`Analyzing ${filesAnalyzedThisSession} files (${scanResult.analyzableFiles.length - filesAnalyzedThisSession} unchanged)`);
    
    // Analyze files with progress reporting
    const analysisResults = await this.analyzeFiles(filesToAnalyze, directoryPath, progressCallback, log);
    
    // Merge with unchanged files from previous analysis
    const allFileMetrics = this.mergeFileMetrics(analysisResults.fileMetrics, scanResult.analyzableFiles, previousResult);
    
    // Merge function data with previous results if any
    const allFunctions = this.mergeFunctionData(analysisResults.functions, previousResult);
    
    return {
      allFileMetrics,
      allFunctions,
      scanResult,
      filesAnalyzedThisSession,
      totalFilesConsidered: scanResult.analyzableFiles.length,
      isIncremental,
      changes
    };
  }
  
  /**
   * Detects changes between current and previous files
   */
  private detectChanges(
    currentFiles: FileInfo[],
    previousResult: DirectoryAnalysisResult
  ): FileChangeInfo[] {
    // Convert FileInfo to FileWithHash format
    const currentFilesWithHash: FileWithHash[] = currentFiles.map(file => ({
      relativePath: file.relativePath,
      filePath: file.filePath,
      fileHash: file.hash
    }));
    
    // Convert previous result to FileWithHash format
    const previousFilesWithHash = HashBasedChangeDetector.convertFromFileMetrics(previousResult.files);
    
    // Use shared hash-based change detection
    return HashBasedChangeDetector.generateChangeInfo(
      previousResult.summary.directoryPath,
      currentFilesWithHash,
      previousFilesWithHash
    );
  }
  
  /**
   * Gets list of files that need to be analyzed
   */
  private getFilesToAnalyze(
    scannedFiles: FileInfo[],
    changes: FileChangeInfo[],
    previousResult?: DirectoryAnalysisResult
  ): FileInfo[] {
    if (!previousResult) {
      return scannedFiles; // Analyze all files if no previous result
    }
    
    const changedFiles = changes
      .filter(c => c.changeType === 'added' || c.changeType === 'modified')
      .map(c => c.filePath);
    
    return scannedFiles.filter(f => changedFiles.includes(f.filePath));
  }
  
  /**
   * Analyzes individual files
   */
  private async analyzeFiles(
    files: FileInfo[],
    directoryPath: string,
    progressCallback?: (current: number, total: number, currentFile: string) => void,
    log?: (message: string) => void
  ): Promise<{ fileMetrics: FileMetrics[], functions: FunctionMetrics[] }> {
    const fileMetrics: FileMetrics[] = [];
    const functions: FunctionMetrics[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, files.length, file.fileName);
      }
      
      try {
        const analysisStartTime = Date.now();
        const analysis = await analyzeFileStatic(file.filePath, undefined as any, true);
        const analysisDuration = Date.now() - analysisStartTime;
        
        if (analysis) {
          // Create file metrics
          const metrics: FileMetrics = {
            fileName: file.fileName,
            filePath: file.filePath,
            relativePath: file.relativePath,
            extension: file.extension,
            language: file.language,
            fileHash: file.hash,
            fileSizeBytes: file.sizeBytes,
            totalLines: analysis.totalLines || 0,
            commentLines: analysis.commentLines || 0,
            functionCount: analysis.functions?.length || 0,
            classCount: analysis.classCount || 0,
            meanComplexity: this.calculateMeanComplexity(analysis.functions || []),
            meanDensity: this.calculateMeanDensity(analysis.functions || []),
            meanParameters: this.calculateMeanParameters(analysis.functions || []),
            analyzedAt: new Date().toISOString(),
            analysisDuration
          };
          fileMetrics.push(metrics);
          
          // Extract function metrics
          if (analysis.functions) {
            for (const func of analysis.functions) {
              const functionMetric: FunctionMetrics = {
                name: func.name || 'unknown',
                filePath: file.filePath,
                relativeFilePath: file.relativePath,
                startLine: func.lineStart || 0,
                endLine: func.lineEnd || 0,
                length: func.lineCount || 0,
                parameters: func.parameters || 0,
                complexity: func.complexity || 0,
                cyclomaticDensity: func.cyclomaticDensity || 0,
                language: file.language
              };
              functions.push(functionMetric);
            }
          }
          
          if (log) {
            log(`✅ Analyzed: ${file.fileName} (${metrics.functionCount} functions)`);
          }
        } else {
          if (log) {
            log(`❌ Failed to analyze: ${file.fileName}`);
          }
        }
        
      } catch (error) {
        if (log) {
          log(`❌ Error analyzing ${file.fileName}: ${error}`);
        }
      }
    }
    
    return { fileMetrics, functions };
  }
  
  /**
   * Merges analyzed files with unchanged files from previous analysis
   */
  private mergeFileMetrics(
    analyzedFiles: FileMetrics[],
    allScannedFiles: FileInfo[],
    previousResult?: DirectoryAnalysisResult
  ): FileMetrics[] {
    if (!previousResult) {
      return analyzedFiles;
    }
    
    const analyzedMap = new Map(analyzedFiles.map(f => [f.filePath, f]));
    const previousMap = new Map(previousResult.files.map(f => [f.filePath, f]));
    
    const mergedFiles: FileMetrics[] = [];
    
    for (const scannedFile of allScannedFiles) {
      const analyzed = analyzedMap.get(scannedFile.filePath);
      if (analyzed) {
        mergedFiles.push(analyzed);
      } else {
        // Use previous analysis result
        const previous = previousMap.get(scannedFile.filePath);
        if (previous) {
          mergedFiles.push(previous);
        }
      }
    }
    
    return mergedFiles;
  }
  
  /**
   * Merges function data with previous results
   */
  private mergeFunctionData(
    newFunctions: FunctionMetrics[],
    previousResult?: DirectoryAnalysisResult
  ): FunctionMetrics[] {
    if (!previousResult) {
      return newFunctions;
    }
    
    // Create a map of new functions by file path
    const newFunctionsByFile = new Map<string, FunctionMetrics[]>();
    for (const func of newFunctions) {
      if (!newFunctionsByFile.has(func.filePath)) {
        newFunctionsByFile.set(func.filePath, []);
      }
      newFunctionsByFile.get(func.filePath)!.push(func);
    }
    
    // Start with functions from files that weren't re-analyzed
    const allFunctions: FunctionMetrics[] = [];
    
    // Add functions from previous result for files that weren't re-analyzed
    for (const func of previousResult.functions || []) {
      if (!newFunctionsByFile.has(func.filePath)) {
        allFunctions.push(func);
      }
    }
    
    // Add all new functions
    allFunctions.push(...newFunctions);
    
    return allFunctions;
  }
  
  /**
   * Helper methods for calculating metrics
   */
  private calculateMeanComplexity(functions: any[]): number {
    if (functions.length === 0) {
      return 0;
    }
    const total = functions.reduce((sum, f) => sum + (f.complexity || 0), 0);
    return total / functions.length;
  }
  
  private calculateMeanDensity(functions: any[]): number {
    if (functions.length === 0) {
      return 0;
    }
    const total = functions.reduce((sum, f) => sum + (f.cyclomaticDensity || 0), 0);
    return total / functions.length;
  }
  
  private calculateMeanParameters(functions: any[]): number {
    if (functions.length === 0) {
      return 0;
    }
    const total = functions.reduce((sum, f) => sum + (f.parameters || 0), 0);
    return total / functions.length;
  }
}

/**
 * Transforms incremental analysis result to full DirectoryAnalysisResult
 */
export function transformToDirectoryAnalysisResult(
  incrementalResult: IncrementalAnalysisResult,
  directoryPath: string,
  filters: DirectoryAnalysisFilters,
  startTime: number
): DirectoryAnalysisResult {
  const { allFileMetrics, allFunctions, scanResult, filesAnalyzedThisSession, totalFilesConsidered, isIncremental } = incrementalResult;
  
  // Calculate summary statistics
  const summary = calculateDirectorySummary(
    directoryPath,
    allFileMetrics,
    scanResult.totalFiles,
    scanResult.totalAnalyzableFiles,
    scanResult.totalNonAnalyzableFiles,
    Date.now() - startTime
  );
  
  return {
    summary,
    files: allFileMetrics,
    functions: allFunctions,
    metadata: {
      version: '0.0.9',
      mode: 'directory',
      filters,
      filesAnalyzedThisSession,
      totalFilesConsidered,
      isIncremental
    }
  };
}

/**
 * Transforms incremental analysis result to files array (for XR)
 */
export function transformToFilesArray(incrementalResult: IncrementalAnalysisResult): FileMetrics[] {
  return incrementalResult.allFileMetrics;
}

/**
 * Calculates directory summary statistics
 */
function calculateDirectorySummary(
  directoryPath: string,
  files: FileMetrics[],
  totalFiles: number,
  totalAnalyzableFiles: number,
  totalNonAnalyzableFiles: number,
  totalDuration: number
) {
  const totalLines = files.reduce((sum, f) => sum + f.totalLines, 0);
  const totalCommentLines = files.reduce((sum, f) => sum + f.commentLines, 0);
  const totalFunctions = files.reduce((sum, f) => sum + f.functionCount, 0);
  const totalClasses = files.reduce((sum, f) => sum + f.classCount, 0);
  
  // Calculate averages
  const averageComplexity = files.length > 0 
    ? files.reduce((sum, f) => sum + f.meanComplexity, 0) / files.length 
    : 0;
    
  const averageDensity = files.length > 0 
    ? files.reduce((sum, f) => sum + f.meanDensity, 0) / files.length 
    : 0;
    
  const averageParameters = files.length > 0 
    ? files.reduce((sum, f) => sum + f.meanParameters, 0) / files.length 
    : 0;
  
  // Language distribution
  const languageDistribution: Record<string, number> = {};
  for (const file of files) {
    languageDistribution[file.language] = (languageDistribution[file.language] || 0) + 1;
  }
  
  // File size distribution
  const fileSizeDistribution = {
    small: files.filter(f => f.fileSizeBytes < 1024).length,
    medium: files.filter(f => f.fileSizeBytes >= 1024 && f.fileSizeBytes < 10240).length,
    large: files.filter(f => f.fileSizeBytes >= 10240 && f.fileSizeBytes < 102400).length,
    huge: files.filter(f => f.fileSizeBytes >= 102400).length
  };
  
  // Complexity distribution
  const complexityDistribution = {
    low: files.filter(f => f.meanComplexity <= 5).length,
    medium: files.filter(f => f.meanComplexity > 5 && f.meanComplexity <= 10).length,
    high: files.filter(f => f.meanComplexity > 10 && f.meanComplexity <= 20).length,
    critical: files.filter(f => f.meanComplexity > 20).length
  };
  
  return {
    directoryPath,
    totalFiles,
    totalFilesAnalyzed: totalAnalyzableFiles,
    totalFilesNotAnalyzed: totalNonAnalyzableFiles,
    totalLines,
    totalCommentLines,
    totalFunctions,
    totalClasses,
    averageComplexity,
    averageDensity,
    averageParameters,
    languageDistribution,
    fileSizeDistribution,
    complexityDistribution,
    analyzedAt: new Date().toISOString(),
    totalDuration
  };
}
