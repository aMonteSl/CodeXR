"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisDataManager = void 0;
/**
 * Simple singleton manager to store and retrieve analysis data across views
 */
class AnalysisDataManager {
    static instance;
    latestAnalysisResult = null;
    activeFileAnalysisPanel = null;
    activeFunctionAnalysisPanel = null;
    latestFunctionData = null;
    constructor() { }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!AnalysisDataManager.instance) {
            AnalysisDataManager.instance = new AnalysisDataManager();
        }
        return AnalysisDataManager.instance;
    }
    /**
     * Store analysis result
     */
    setAnalysisResult(result) {
        this.latestAnalysisResult = result;
    }
    /**
     * Get the latest analysis result
     */
    getAnalysisResult() {
        return this.latestAnalysisResult;
    }
    /**
     * Store reference to active file analysis panel
     */
    setActiveFileAnalysisPanel(panel) {
        this.activeFileAnalysisPanel = panel;
    }
    /**
     * Get active file analysis panel
     */
    getActiveFileAnalysisPanel() {
        return this.activeFileAnalysisPanel;
    }
    /**
     * Store reference to active function analysis panel
     */
    setActiveFunctionAnalysisPanel(panel) {
        this.activeFunctionAnalysisPanel = panel;
    }
    /**
     * Get active function analysis panel
     */
    getActiveFunctionAnalysisPanel() {
        return this.activeFunctionAnalysisPanel;
    }
    /**
     * Store function data
     */
    setFunctionData(data) {
        this.latestFunctionData = data;
    }
    /**
     * Get the latest function data
     */
    getFunctionData() {
        return this.latestFunctionData;
    }
    /**
     * Clear all stored data
     */
    clear() {
        this.latestAnalysisResult = null;
        this.activeFileAnalysisPanel = null;
        this.activeFunctionAnalysisPanel = null;
        this.latestFunctionData = null;
    }
    /**
     * Clear function analysis data only
     */
    clearFunctionData() {
        this.activeFunctionAnalysisPanel = null;
        this.latestFunctionData = null;
    }
}
exports.analysisDataManager = AnalysisDataManager.getInstance();
//# sourceMappingURL=analysisDataManager.js.map