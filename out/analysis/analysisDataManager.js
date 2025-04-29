"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisDataManager = void 0;
/**
 * Simple singleton manager to store and retrieve analysis data across views
 */
class AnalysisDataManager {
    static instance;
    // Track analysis results by file path
    analysisResults = new Map();
    // Track analysis panels by file path
    fileAnalysisPanels = new Map();
    // Track function analysis panels by file path
    functionAnalysisPanels = new Map();
    // Track function data by file path
    functionData = new Map();
    constructor() { }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!this.instance) {
            this.instance = new AnalysisDataManager();
        }
        return this.instance;
    }
    /**
     * Store analysis result for a specific file
     * @param filePath Path to the analyzed file
     * @param result Analysis result
     */
    setAnalysisResult(filePath, result) {
        this.analysisResults.set(filePath, result);
    }
    /**
     * Get the analysis result for a specific file
     * @param filePath Path to the analyzed file
     * @returns Analysis result or null if not found
     */
    getAnalysisResult(filePath) {
        return this.analysisResults.get(filePath) || null;
    }
    /**
     * Get all stored analysis results
     * @returns Map of file paths to analysis results
     */
    getAllAnalysisResults() {
        return this.analysisResults;
    }
    /**
     * Store reference to active file analysis panel for a specific file
     * @param filePath Path to the analyzed file
     * @param panel WebView panel
     */
    setActiveFileAnalysisPanel(filePath, panel) {
        this.fileAnalysisPanels.set(filePath, panel);
    }
    /**
     * Get active file analysis panel for a specific file
     * @param filePath Path to the analyzed file
     * @returns Panel or null if not found
     */
    getActiveFileAnalysisPanel(filePath) {
        return this.fileAnalysisPanels.get(filePath) || null;
    }
    /**
     * Get all active file analysis panels
     * @returns Map of file paths to panels
     */
    getAllFileAnalysisPanels() {
        return this.fileAnalysisPanels;
    }
    /**
     * Store reference to active function analysis panel for a specific file
     * @param filePath Path to the analyzed file
     * @param panel WebView panel
     */
    setActiveFunctionAnalysisPanel(filePath, panel) {
        this.functionAnalysisPanels.set(filePath, panel);
    }
    /**
     * Get active function analysis panel for a specific file
     * @param filePath Path to the analyzed file
     * @returns Panel or null if not found
     */
    getActiveFunctionAnalysisPanel(filePath) {
        return this.functionAnalysisPanels.get(filePath) || null;
    }
    /**
     * Store function data for a specific file
     * @param filePath Path to the analyzed file
     * @param data Function data
     */
    setFunctionData(filePath, data) {
        this.functionData.set(filePath, data);
    }
    /**
     * Get function data for a specific file
     * @param filePath Path to the analyzed file
     * @returns Function data or null if not found
     */
    getFunctionData(filePath) {
        return this.functionData.get(filePath) || null;
    }
    /**
     * Clear function data for a specific file
     * @param filePath Path to the analyzed file
     */
    clearFunctionData(filePath) {
        this.functionData.delete(filePath);
    }
    /**
     * Remove data for a specific file
     * @param filePath Path to the file to remove
     */
    removeFile(filePath) {
        this.analysisResults.delete(filePath);
        this.fileAnalysisPanels.delete(filePath);
        this.functionAnalysisPanels.delete(filePath);
        this.functionData.delete(filePath);
    }
    /**
     * Clear all stored data
     */
    clear() {
        this.analysisResults.clear();
        this.fileAnalysisPanels.clear();
        this.functionAnalysisPanels.clear();
        this.functionData.clear();
    }
}
// Export the singleton instance
exports.analysisDataManager = AnalysisDataManager.getInstance();
//# sourceMappingURL=analysisDataManager.js.map