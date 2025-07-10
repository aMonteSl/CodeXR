/**
 * Complexity severity levels based on CCN
 */
export enum ComplexitySeverity {
  LOW = 'low',           // 1-5
  MEDIUM = 'medium',     // 6-10
  HIGH = 'high',         // 11-20
  CRITICAL = 'critical'  // > 20
}

/**
 * Get complexity severity based on CCN value
 */
export function getComplexitySeverity(ccn: number): ComplexitySeverity {
  if (ccn <= 5) {
    return ComplexitySeverity.LOW;
  }
  if (ccn <= 10) {
    return ComplexitySeverity.MEDIUM;
  }
  if (ccn <= 20) {
    return ComplexitySeverity.HIGH;
  }
  return ComplexitySeverity.CRITICAL;
}

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: ComplexitySeverity): string {
  switch (severity) {
    case ComplexitySeverity.LOW:
      return 'var(--complexity-low)';
    case ComplexitySeverity.MEDIUM:
      return 'var(--complexity-medium)';
    case ComplexitySeverity.HIGH:
      return 'var(--complexity-high)';
    case ComplexitySeverity.CRITICAL:
      return 'var(--complexity-critical)';
  }
}

/**
 * Interface for file metrics in directory analysis
 */
export interface FileMetrics {
  /** File name with extension */
  fileName: string;
  
  /** Absolute path to the file */
  filePath: string;
  
  /** Relative path from analyzed directory */
  relativePath: string;
  
  /** File extension */
  extension: string;
  
  /** Programming language detected */
  language: string;
  
  /** SHA-256 hash of file contents */
  fileHash: string;
  
  /** File size in bytes */
  fileSizeBytes: number;
  
  /** Total lines in file */
  totalLines: number;
  
  /** Total comment lines */
  commentLines: number;
  
  /** Number of functions */
  functionCount: number;
  
  /** Number of classes */
  classCount: number;
  
  /** Mean cyclomatic complexity */
  meanComplexity: number;
  
  /** Mean cyclomatic density */
  meanDensity: number;
  
  /** Mean parameters per function */
  meanParameters: number;
  
  /** Timestamp of analysis */
  analyzedAt: string;
  
  /** Analysis duration in milliseconds */
  analysisDuration: number;
}

/**
 * Interface for directory analysis summary
 */
export interface DirectoryAnalysisSummary {
  /** Directory path that was analyzed */
  directoryPath: string;
  
  /** Total number of files in directory (including non-analyzed) */
  totalFiles: number;
  
  /** Total number of files that were analyzed */
  totalFilesAnalyzed: number;
  
  /** Total number of files that were not analyzed */
  totalFilesNotAnalyzed: number;
  
  /** Total lines across all files */
  totalLines: number;
  
  /** Total comment lines across all files */
  totalCommentLines: number;
  
  /** Total functions across all files */
  totalFunctions: number;
  
  /** Total classes across all files */
  totalClasses: number;
  
  /** Average complexity across all files */
  averageComplexity: number;
  
  /** Average density across all files */
  averageDensity: number;
  
  /** Average parameters per function across all files */
  averageParameters: number;
  
  /** Languages found and their file counts */
  languageDistribution: Record<string, number>;
  
  /** File size distribution */
  fileSizeDistribution: {
    small: number;   // < 1KB
    medium: number;  // 1KB - 10KB
    large: number;   // 10KB - 100KB
    huge: number;    // > 100KB
  };
  
  /** Complexity distribution */
  complexityDistribution: {
    low: number;       // 1-5
    medium: number;    // 6-10
    high: number;      // 11-20
    critical: number;  // > 20
  };
  
  /** Analysis timestamp */
  analyzedAt: string;
  
  /** Total analysis duration in milliseconds */
  totalDuration: number;
}

/**
 * Interface for individual function metrics
 */
export interface FunctionMetrics {
  /** Function name */
  name: string;
  
  /** File path containing the function */
  filePath: string;
  
  /** Relative file path from analyzed directory */
  relativeFilePath: string;
  
  /** Start line number */
  startLine: number;
  
  /** End line number */
  endLine: number;
  
  /** Function length in lines */
  length: number;
  
  /** Number of parameters */
  parameters: number;
  
  /** Cyclomatic complexity (CCN) */
  complexity: number;
  
  /** Cyclomatic density */
  cyclomaticDensity: number;
  
  /** Programming language */
  language: string;
}

/**
 * Interface for complete directory analysis result
 */
export interface DirectoryAnalysisResult {
  /** Summary statistics */
  summary: DirectoryAnalysisSummary;
  
  /** Individual file metrics */
  files: FileMetrics[];
  
  /** All functions from all analyzed files */
  functions: FunctionMetrics[];
  
  /** Analysis metadata */
  metadata: {
    /** Version of the analyzer */
    version: string;
    
    /** Analysis mode */
    mode: 'directory' | 'project';
    
    /** Filters applied */
    filters?: {
      extensions?: string[];
      maxDepth?: number;
      excludePatterns?: string[];
    };
    
    /** Number of files actually analyzed in this session */
    filesAnalyzedThisSession?: number;
    
    /** Total files considered for analysis */
    totalFilesConsidered?: number;
    
    /** Whether this was an incremental analysis */
    isIncremental?: boolean;
  };
}

/**
 * Interface for change detection
 */
export interface FileChangeInfo {
  /** File path */
  filePath: string;
  
  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted' | 'unchanged';
  
  /** Previous hash (if exists) */
  previousHash?: string;
  
  /** Current hash */
  currentHash?: string;
}
