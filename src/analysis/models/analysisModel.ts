/**
 * Basic metrics for code analysis
 */
export interface CodeMetrics {
  /** Total lines of code */
  totalLines: number;
  /** Non-empty, non-comment lines of code */
  codeLines: number;
  /** Total blank lines */
  blankLines: number;
  /** Total comment lines */
  commentLines: number;
  /** Number of function declarations */
  functionCount: number;
  /** Number of class declarations */
  classCount: number;
}

/**
 * Complete analysis results for a file
 */
export interface FileAnalysis {
  /** Path to the analyzed file */
  filePath: string;
  /** Name of the file (without path) */
  fileName: string;
  /** Basic metrics */
  metrics: CodeMetrics;
  /** Time when analysis was performed */
  analyzedAt: Date;
}

/**
 * Analysis results for an entire project or workspace
 */
export interface ProjectAnalysis {
  /** List of file analyses */
  files: FileAnalysis[];
  /** Summary metrics for the entire project */
  summary: CodeMetrics;
  /** Time when analysis was performed */
  analyzedAt: Date;
}