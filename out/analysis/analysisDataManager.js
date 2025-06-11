"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisDataManager = void 0;
const path_1 = __importDefault(require("path"));
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
    // ✅ NUEVO: Trackear archivos que están siendo analizados
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
     * @param panel WebView panel or null to clear
     */
    setActiveFileAnalysisPanel(filePath, panel) {
        if (panel === null) {
            // Limpiar referencia
            console.log(`🗑️ Clearing panel reference for ${path_1.default.basename(filePath)}`);
            this.fileAnalysisPanels.delete(filePath);
        }
        else {
            // Establecer nueva referencia
            console.log(`📄 Storing panel reference for ${path_1.default.basename(filePath)}`);
            this.fileAnalysisPanels.set(filePath, panel);
        }
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
     * ✅ NUEVA FUNCIÓN: Marcar un archivo como "siendo analizado"
     * Mark a file as being analyzed
     * @param filePath Path to the file being analyzed
     */
    setFileAnalyzing(filePath) {
        console.log(`🔄 Marking file as being analyzed: ${path_1.default.basename(filePath)}`);
        this.filesBeingAnalyzed.add(filePath);
        // Refresh tree to show the indicator
        this.refreshTreeView();
    }
    /**
     * ✅ NUEVA FUNCIÓN: Marcar un archivo como "análisis completado"
     * Mark a file as analysis completed
     * @param filePath Path to the file
     */
    setFileAnalyzed(filePath) {
        console.log(`✅ Marking file analysis as completed: ${path_1.default.basename(filePath)}`);
        this.filesBeingAnalyzed.delete(filePath);
        // Refresh tree to remove the indicator
        this.refreshTreeView();
    }
    /**
     * ✅ NUEVA FUNCIÓN: Verificar si un archivo está siendo analizado
     * Check if a file is currently being analyzed
     * @param filePath Path to the file
     * @returns True if file is being analyzed
     */
    isFileBeingAnalyzed(filePath) {
        return this.filesBeingAnalyzed.has(filePath);
    }
    /**
     * ✅ NUEVA FUNCIÓN: Obtener lista de archivos siendo analizados
     * Get list of files currently being analyzed
     * @returns Array of file paths being analyzed
     */
    getFilesBeingAnalyzed() {
        return Array.from(this.filesBeingAnalyzed);
    }
    /**
     * ✅ HELPER: Refrescar tree view
     * Refresh the tree view to show changes
     */
    refreshTreeView() {
        // Usar setTimeout para evitar múltiples refreshes simultáneos
        setTimeout(() => {
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
        }, 100);
    }
    /**
     * Remove data for a specific file
     * @param filePath Path to the file to remove
     */
    removeFile(filePath) {
        console.log(`🗑️ Removing all data for file: ${path_1.default.basename(filePath)}`);
        // Dispose panel if it exists
        const panel = this.fileAnalysisPanels.get(filePath);
        if (panel && typeof panel.dispose === 'function') {
            try {
                panel.dispose();
            }
            catch (error) {
                console.warn(`⚠️ Error disposing panel: ${error}`);
            }
        }
        this.analysisResults.delete(filePath);
        this.fileAnalysisPanels.delete(filePath);
        this.functionAnalysisPanels.delete(filePath);
        this.functionData.delete(filePath);
        // ✅ LIMPIAR TAMBIÉN EL ESTADO DE ANÁLISIS
        this.filesBeingAnalyzed.delete(filePath);
        console.log(`✅ File data cleanup completed for ${path_1.default.basename(filePath)}`);
    }
    /**
     * Clear all stored data and dispose of all panels
     */
    clear() {
        console.log('🧹 Clearing all analysis data...');
        // Dispose all active panels
        for (const [filePath, panel] of this.fileAnalysisPanels.entries()) {
            if (panel && typeof panel.dispose === 'function') {
                try {
                    panel.dispose();
                    console.log(`🗑️ Disposed panel for ${path_1.default.basename(filePath)}`);
                }
                catch (error) {
                    console.warn(`⚠️ Error disposing panel for ${path_1.default.basename(filePath)}: ${error}`);
                }
            }
        }
        // Dispose all function panels
        for (const [filePath, panel] of this.functionAnalysisPanels.entries()) {
            if (panel && typeof panel.dispose === 'function') {
                try {
                    panel.dispose();
                    console.log(`🗑️ Disposed function panel for ${path_1.default.basename(filePath)}`);
                }
                catch (error) {
                    console.warn(`⚠️ Error disposing function panel for ${path_1.default.basename(filePath)}: ${error}`);
                }
            }
        }
        // Clear all maps and sets
        this.analysisResults.clear();
        this.fileAnalysisPanels.clear();
        this.functionAnalysisPanels.clear();
        this.functionData.clear();
        this.filesBeingAnalyzed.clear(); // ✅ LIMPIAR ARCHIVOS SIENDO ANALIZADOS
        console.log('✅ All analysis data cleared successfully');
    }
    /**
     * ✅ NUEVA FUNCIÓN: Obtener estadísticas del manager
     * Get manager statistics for debugging
     * @returns Object with current state information
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
}
// Export the singleton instance
exports.analysisDataManager = AnalysisDataManager.getInstance();
//# sourceMappingURL=analysisDataManager.js.map