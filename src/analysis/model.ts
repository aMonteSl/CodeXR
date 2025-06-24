import * as vscode from 'vscode';

/**
 * Data models for code analysis
 */

/**
 * Represents analysis mode
 */
export enum AnalysisMode {
  STATIC = 'static',
  XR = 'xr',
  WEB_VIEW = 'webview'
}

/**
 * Represents a code function/method with complexity metrics
 */
export interface FunctionInfo {
  /** Function name */
  name: string;
  /** Starting line number */
  lineStart: number;
  /** Ending line number */
  lineEnd: number;
  /** Total lines in function */
  lineCount: number;
  /** Cyclomatic complexity score */
  complexity: number;
  /** Number of parameters */
  parameters: number;
  /** Maximum nesting level */
  maxNestingDepth?: number;
}

/**
 * Line count breakdown for a file
 */
export interface LineCountInfo {
  /** Total number of lines */
  total: number;
  /** Number of code lines */
  code: number;
  /** Number of comment lines */
  comment: number; // ✅ FIXED: Use 'comment' not 'comments'
  /** Number of blank lines */
  blank: number;
}

/**
 * Overall complexity metrics for a file
 */
export interface ComplexityMetrics {
  /** Average complexity across all functions */
  averageComplexity: number;
  /** Highest complexity found in any function */
  maxComplexity: number;
  /** Total number of functions in file */
  functionCount: number;
  /** Number of functions with complexity > 10 (warning threshold) */
  highComplexityFunctions: number;
  /** Number of functions with complexity > 25 (critical threshold) */
  criticalComplexityFunctions: number;
}

/**
 * Complete analysis result for a file
 */
export interface FileAnalysisResult {
  /** File path of analyzed file */
  filePath: string;
  /** File name without path */
  fileName: string;
  /** Language of the file */
  language: string;
  /** File size in human readable format */
  fileSize: string; // ✅ FIXED: Should be string, not number
  /** Total lines in file */
  totalLines: number; // ✅ ADDED: Missing property
  /** Code lines in file */
  codeLines: number;
  /** Comment lines in file */
  commentLines: number;
  /** Blank lines in file */
  blankLines: number;
  /** Number of functions in the file */
  functionCount: number; // ✅ ADDED: Missing property
  /** Number of classes in the file */
  classCount: number;
  /** Overall complexity metrics */
  complexity: ComplexityMetrics;
  /** Detailed analysis of all functions */
  functions: FunctionInfo[];
  /** Timestamp of when analysis was performed */
  timestamp: string; // ✅ FIXED: Should be string, not number
  /** Any error that occurred during analysis */
  error?: string;
}

/**
 * Message sent from webview to extension
 */
export interface WebviewMessage {
  /** Command to execute */
  command: string;
  /** Data associated with the command */
  data?: any;
}