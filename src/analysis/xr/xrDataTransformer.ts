import { FileAnalysisResult, FunctionInfo } from '../model';

/**
 * Interface for transformed XR analysis data
 */
export interface XRAnalysisData {
  data: XRFunctionData[];
  metadata: XRMetadata;
}

/**
 * Interface for function data ready for XR visualization
 */
export interface XRFunctionData {
  functionName: string;
  complexity: number;
  lineCount: number;
  parameters: number;
  maxNestingDepth?: number;
  lineStart: number;
  lineEnd: number;
  complexityCategory: string;
}

/**
 * Interface for analysis metadata
 */
export interface XRMetadata {
  fileName: string;
  filePath: string;
  language: string;
  totalLines: number;
  functionCount: number;
  averageComplexity: number;
  maxComplexity: number;
  timestamp: number;
}

/**
 * Transforms analysis data into format suitable for XR visualization
 * @param analysisResult Analysis result to transform
 * @returns Data formatted for XR visualization
 */
export function transformAnalysisDataForXR(analysisResult: FileAnalysisResult): XRAnalysisData {
  // Transform each function into a format suitable for BabiaXR
  const functionData: XRFunctionData[] = analysisResult.functions.map(func => ({
    functionName: func.name,
    complexity: func.complexity,
    lineCount: func.lineCount,
    parameters: func.parameters,
    maxNestingDepth: func.maxNestingDepth,
    lineStart: func.lineStart,
    lineEnd: func.lineEnd,
    // Add a complexity category for color coding
    complexityCategory: getCategoryFromComplexity(func.complexity)
  }));

  // Sort by complexity (descending) for better visualization
  functionData.sort((a, b) => b.complexity - a.complexity);

  // Create metadata for additional information
  const metadata: XRMetadata = {
    fileName: analysisResult.fileName,
    filePath: analysisResult.filePath,
    language: analysisResult.language,
    totalLines: analysisResult.lineCount.total,
    functionCount: analysisResult.functions.length,
    averageComplexity: analysisResult.complexity.averageComplexity,
    maxComplexity: analysisResult.complexity.maxComplexity,
    timestamp: analysisResult.timestamp
  };

  return {
    data: functionData,
    metadata: metadata
  };
}

/**
 * Maps complexity value to a category
 * @param complexity The complexity value
 * @returns Category string
 */
function getCategoryFromComplexity(complexity: number): string {
  if (complexity <= 5) {
    return 'low';
  }
  if (complexity <= 10) {
    return 'medium';
  }
  if (complexity <= 20) {
    return 'high';
  }
  return 'critical';
}