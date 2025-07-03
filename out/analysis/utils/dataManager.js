"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisDataManager = void 0;
/**
 * Singleton manager for storing and retrieving analysis data across different views and components
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
    // Track files that are currently being analyzed
    filesBeingAnalyzed = new Set();
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
     */
    setAnalysisResult(filePath, result) {
        this.analysisResults.set(filePath, result);
    }
    /**
     * Get the analysis result for a specific file
     */
    getAnalysisResult(filePath) {
        return this.analysisResults.get(filePath) || null;
    }
    /**
     * Get all stored analysis results
     */
    getAllAnalysisResults() {
        return this.analysisResults;
    }
    /**
     * Store reference to active file analysis panel for a specific file
     */
    setActiveFileAnalysisPanel(filePath, panel) {
        if (panel === null) {
            this.fileAnalysisPanels.delete(filePath);
        }
        else {
            this.fileAnalysisPanels.set(filePath, panel);
        }
    }
    /**
     * Get active file analysis panel for a specific file
     */
    getActiveFileAnalysisPanel(filePath) {
        return this.fileAnalysisPanels.get(filePath) || null;
    }
    /**
     * Get all active file analysis panels
     */
    getAllFileAnalysisPanels() {
        return this.fileAnalysisPanels;
    }
    /**
     * Store reference to active function analysis panel for a specific file
     */
    setActiveFunctionAnalysisPanel(filePath, panel) {
        if (panel === null) {
            this.functionAnalysisPanels.delete(filePath);
        }
        else {
            this.functionAnalysisPanels.set(filePath, panel);
        }
    }
    /**
     * Get active function analysis panel for a specific file
     */
    getActiveFunctionAnalysisPanel(filePath) {
        return this.functionAnalysisPanels.get(filePath) || null;
    }
    /**
     * Store function data for a specific file
     */
    setFunctionData(filePath, data) {
        this.functionData.set(filePath, data);
    }
    /**
     * Get function data for a specific file
     */
    getFunctionData(filePath) {
        return this.functionData.get(filePath) || null;
    }
    /**
     * Remove analysis result for a specific file
     */
    clearAnalysisResult(filePath) {
        this.analysisResults.delete(filePath);
        console.log(`🗑️ Cleared analysis result for: ${filePath}`);
    }
    /**
     * Clear function data for a specific file
     */
    clearFunctionData(filePath) {
        this.functionData.delete(filePath);
        console.log(`🗑️ Cleared function data for: ${filePath}`);
    }
    /**
     * Mark a file as being analyzed
     */
    setFileAnalyzing(filePath) {
        this.filesBeingAnalyzed.add(filePath);
        this.refreshTreeView();
    }
    /**
     * Mark a file as no longer being analyzed
     */
    setFileAnalyzed(filePath) {
        this.filesBeingAnalyzed.delete(filePath);
        this.refreshTreeView();
    }
    /**
     * Check if a file is currently being analyzed
     */
    isFileBeingAnalyzed(filePath) {
        return this.filesBeingAnalyzed.has(filePath);
    }
    /**
     * Get list of files currently being analyzed
     */
    getFilesBeingAnalyzed() {
        return Array.from(this.filesBeingAnalyzed);
    }
    /**
     * Get analysis statistics
     */
    getAnalysisStats() {
        return {
            totalAnalyzedFiles: this.analysisResults.size,
            totalAnalysisPanels: this.fileAnalysisPanels.size,
            totalFunctionPanels: this.functionAnalysisPanels.size,
            filesBeingAnalyzed: this.filesBeingAnalyzed.size
        };
    }
    /**
     * Gets the current status of the analysis data manager
     */
    getManagerStatus() {
        return {
            analysisResults: this.analysisResults.size,
            activePanels: this.fileAnalysisPanels.size,
            functionPanels: this.functionAnalysisPanels.size,
            functionData: this.functionData.size,
            filesBeingAnalyzed: this.filesBeingAnalyzed.size
        };
    }
    /**
     * Clear all stored data (for cleanup)
     */
    clearAllData() {
        this.analysisResults.clear();
        this.fileAnalysisPanels.clear();
        this.functionAnalysisPanels.clear();
        this.functionData.clear();
        this.filesBeingAnalyzed.clear();
    }
    /**
     * Refresh the tree view to show changes
     */
    refreshTreeView() {
        // Use setTimeout to avoid multiple simultaneous refreshes
        setTimeout(() => {
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
        }, 100);
    }
}
// Export the singleton instance
exports.analysisDataManager = AnalysisDataManager.getInstance();
//# sourceMappingURL=dataManager.js.map