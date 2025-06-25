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
        complexityCategory: getCategoryFromComplexity(func.complexity),
        complexityColor: getColorFromComplexity(func.complexity), // Add color based on complexity
        cyclomaticDensity: func.cyclomaticDensity
    }));
    // Sort by complexity (descending) for better visualization
    functionData.sort((a, b) => b.complexity - a.complexity);
    // Create metadata for additional information
    const metadata = {
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
/**
 * Maps complexity value to a color
 * @param complexity The complexity value
 * @returns Hex color code
 */
function getColorFromComplexity(complexity) {
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
//# sourceMappingURL=xrDataTransformer.js.map