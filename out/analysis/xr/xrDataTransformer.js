"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformAnalysisDataForXR = transformAnalysisDataForXR;
/**
 * Transforms analysis data into format suitable for XR visualization
 * @param analysisResult Analysis result to transform
 * @returns Data formatted for XR visualization
 */
function transformAnalysisDataForXR(analysisResult) {
    // Transform each function into a format suitable for BabiaXR
    const functionData = analysisResult.functions.map(func => ({
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
    const metadata = {
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
function getCategoryFromComplexity(complexity) {
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
//# sourceMappingURL=xrDataTransformer.js.map