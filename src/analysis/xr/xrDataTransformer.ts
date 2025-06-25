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
  complexityColor: string; // Add this property for color coding
  cyclomaticDensity: number;
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
  timestamp: string; // ✅ FIXED: Should be string, not number
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
    complexityCategory: getCategoryFromComplexity(func.complexity),
    complexityColor: getColorFromComplexity(func.complexity), // Add color based on complexity
    cyclomaticDensity: func.cyclomaticDensity
  }));

  // Sort by complexity (descending) for better visualization
  functionData.sort((a, b) => b.complexity - a.complexity);

  // Create metadata for additional information
  const metadata: XRMetadata = {
    fileName: analysisResult.fileName,
    filePath: analysisResult.filePath,
    language: analysisResult.language,
    // ✅ FIXED: Use correct property names from FileAnalysisResult
    totalLines: analysisResult.totalLines,
    functionCount: analysisResult.functions.length,
    averageComplexity: analysisResult.complexity.averageComplexity,
    maxComplexity: analysisResult.complexity.maxComplexity,
    // ✅ FIXED: timestamp is already a string in FileAnalysisResult
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

/**
 * Maps complexity value to a color
 * @param complexity The complexity value
 * @returns Hex color code
 */
function getColorFromComplexity(complexity: number): string {
  if (complexity <= 5) {
    return '#27ae60'; // Green for simple functions
  }
  if (complexity <= 10) {
    return '#f39c12'; // Yellow for moderate complexity
  }
  if (complexity <= 20) {
    return '#e67e22'; // Orange for high complexity
  }
  return '#e74c3c'; // Red for very complex/critical functions
}