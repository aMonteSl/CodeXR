"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveAnalysisFactory = void 0;
/**
 * Factory for creating active analysis objects
 */
class ActiveAnalysisFactory {
    /**
     * Create a new active analysis for a file
     */
    static createFileAnalysis(filePath, mode, language) {
        return {
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: filePath,
            mode,
            timestamp: new Date(),
            status: 'running',
            language,
            progress: 0
        };
    }
    /**
     * Create a new active analysis for a directory
     */
    static createDirectoryAnalysis(directoryPath, mode) {
        return {
            id: `dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: directoryPath,
            mode,
            timestamp: new Date(),
            status: 'running',
            progress: 0
        };
    }
    /**
     * Update the status of an existing analysis
     */
    static updateAnalysisStatus(analysis, status, progress, error, metadata) {
        return {
            ...analysis,
            status,
            progress,
            error,
            metadata: metadata || analysis.metadata
        };
    }
}
exports.ActiveAnalysisFactory = ActiveAnalysisFactory;
//# sourceMappingURL=activeAnalysisModel.js.map