"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveAnalysisRegistry = void 0;
const vscode = __importStar(require("vscode"));
const activeAnalysisModel_1 = require("../model/activeAnalysisModel");
const activeServerRegistry_1 = require("../../../active_servers/registry/activeServerRegistry");
const fileToServerMap_1 = require("../../../utils/fileToServerMap");
const SSEManager_1 = require("../../../servers/runtime/sse/SSEManager");
/**
 * Registry that manages currently tracked active analyses
 * This is a singleton that maintains the state of all active analyses
 */
class ActiveAnalysisRegistry {
    static instance = null;
    activeAnalyses = new Map();
    _onDidChangeAnalyses = new vscode.EventEmitter();
    serverEventSubscription = null;
    /**
     * Event fired when the registry of active analyses changes
     */
    onDidChangeAnalyses = this._onDidChangeAnalyses.event;
    constructor() {
        console.log('[ACTIVE_ANALYSIS_REGISTRY] Initializing active analysis registry');
        this.setupServerEventIntegration();
    }
    /**
     * Set up integration with server events to auto-unregister analyses when servers stop
     */
    setupServerEventIntegration() {
        try {
            const serverRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
            // Subscribe to server registry changes
            this.serverEventSubscription = serverRegistry.onRegistryChange((event) => {
                console.log('[ACTIVE_ANALYSIS_REGISTRY] 📡 Received server registry event:', event.type);
                if (event.type === 'serverRemoved' && event.server) {
                    console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔌 Server removed: ${event.server.url} (port ${event.server.port})`);
                    // Use file-to-server mapping to find associated analysis
                    const fileUri = fileToServerMap_1.fileToServerMap.findFileByPort(event.server.port);
                    let removedAnalysis = false;
                    if (fileUri) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🎯 Found analysis file via mapping: ${fileUri}`);
                        // Find and remove the analysis for this file
                        let foundAnalysisId = null;
                        for (const [id, analysis] of this.activeAnalyses.entries()) {
                            if (analysis.path === fileUri) {
                                foundAnalysisId = id;
                                console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis: ${id}`);
                                break;
                            }
                        }
                        if (foundAnalysisId) {
                            this.unregisterAnalysis(foundAnalysisId);
                            removedAnalysis = true;
                            console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🗑️ Auto-removed analysis via file mapping: ${foundAnalysisId}`);
                        }
                        // Clean up SSE clients for this file
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🧹 Cleaning up SSE clients for: ${fileUri}`);
                        SSEManager_1.sseManager.removeAllClients(fileUri);
                        // Remove the mapping
                        fileToServerMap_1.fileToServerMap.unregisterMapping(fileUri);
                    }
                    // Fallback to the old smart matching logic if mapping didn't work
                    if (!removedAnalysis && event.server.customName) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔍 Direct path match failed, trying smart matching for server: ${event.server.customName}`);
                        // Extract filename from custom name (e.g., "Analysis Static tryCodeXr.kt" -> "tryCodeXr.kt")
                        const customNameParts = event.server.customName.split(' ');
                        const possibleFileName = customNameParts[customNameParts.length - 1]; // Last part is usually the filename
                        if (possibleFileName) {
                            console.log(`[ACTIVE_ANALYSIS_REGISTRY] � Looking for analysis with filename: ${possibleFileName}`);
                            // Find analysis by matching filename
                            let foundAnalysisId = null;
                            for (const [id, analysis] of this.activeAnalyses.entries()) {
                                const analysisFileName = analysis.path.split('/').pop() || analysis.path.split('\\').pop();
                                if (analysisFileName === possibleFileName) {
                                    foundAnalysisId = id;
                                    console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis by filename: ${id}`);
                                    break;
                                }
                            }
                            if (foundAnalysisId) {
                                this.unregisterAnalysis(foundAnalysisId);
                                removedAnalysis = true;
                                console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🗑️ Auto-removed analysis via smart matching: ${foundAnalysisId}`);
                            }
                        }
                    }
                    if (!removedAnalysis) {
                        console.log(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Could not find associated analysis for stopped server: ${event.server.url}`);
                    }
                }
            });
            console.log('[ACTIVE_ANALYSIS_REGISTRY] 🔗 Server event integration setup complete');
        }
        catch (error) {
            console.warn('[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Error setting up server integration:', error);
        }
    }
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.serverEventSubscription) {
            this.serverEventSubscription.dispose();
            this.serverEventSubscription = null;
            console.log('[ACTIVE_ANALYSIS_REGISTRY] 🧹 Disposed server event subscription');
        }
    }
    /**
     * Get the singleton instance of the registry
     */
    static getInstance() {
        if (!ActiveAnalysisRegistry.instance) {
            ActiveAnalysisRegistry.instance = new ActiveAnalysisRegistry();
        }
        return ActiveAnalysisRegistry.instance;
    }
    /**
     * Register a new analysis
     */
    registerAnalysis(analysis) {
        const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newAnalysis = {
            ...analysis,
            id: analysisId
        };
        console.log('[ACTIVE_ANALYSES_REGISTRY] 🔥 Registering new analysis:', {
            id: analysisId,
            mode: analysis.mode,
            path: analysis.path,
            status: analysis.status,
            language: analysis.language
        });
        this.activeAnalyses.set(analysisId, newAnalysis);
        console.log('[ACTIVE_ANALYSES_REGISTRY] 📊 Total analyses in registry:', this.activeAnalyses.size);
        console.log('[ACTIVE_ANALYSES_REGISTRY] 🔔 Firing onDidChangeAnalyses event');
        this._onDidChangeAnalyses.fire();
        return analysisId;
    }
    /**
     * Update an existing analysis
     */
    updateAnalysis(analysisId, status, progress, error, metadata) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (analysis) {
            console.log('[ACTIVE_ANALYSES_REGISTRY] 🔄 Updating analysis:', {
                id: analysisId,
                oldStatus: analysis.status,
                newStatus: status,
                progress: progress,
                error: error,
                metadata: metadata
            });
            const updatedAnalysis = activeAnalysisModel_1.ActiveAnalysisFactory.updateAnalysisStatus(analysis, status, progress, error, metadata);
            this.activeAnalyses.set(analysisId, updatedAnalysis);
            console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Updated analysis ${analysisId} status to ${status}`);
            console.log('[ACTIVE_ANALYSES_REGISTRY] 🔔 Firing onDidChangeAnalyses event');
            this._onDidChangeAnalyses.fire();
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ Analysis ${analysisId} not found for update`);
        }
    }
    /**
     * Remove an analysis from the registry
     */
    unregisterAnalysis(analysisId) {
        if (this.activeAnalyses.has(analysisId)) {
            this.activeAnalyses.delete(analysisId);
            console.log(`[ACTIVE_ANALYSIS_REGISTRY] Unregistered analysis: ${analysisId}`);
            this._onDidChangeAnalyses.fire();
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] Attempted to unregister non-existent analysis: ${analysisId}`);
        }
    }
    /**
     * Get all active analyses
     */
    getAllAnalyses() {
        return Array.from(this.activeAnalyses.values());
    }
    /**
     * Get a specific analysis by ID
     */
    getAnalysis(analysisId) {
        return this.activeAnalyses.get(analysisId);
    }
    /**
     * Get analyses for a specific file path
     */
    getAnalysesForPath(path) {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.path === path);
    }
    /**
     * Get count of active analyses
     */
    getActiveCount() {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.status === 'running').length;
    }
    /**
     * Get count of completed analyses
     */
    getCompletedCount() {
        return Array.from(this.activeAnalyses.values()).filter(analysis => analysis.status === 'completed').length;
    }
    /**
     * Get the current count of all active analyses (running + completed)
     */
    getActiveAnalysesCount() {
        return this.activeAnalyses.size;
    }
    /**
     * Remove an analysis by its associated file URI
     * This is used when a server is stopped or the user closes the analysis
     */
    unregisterAnalysisByUri(uri) {
        const targetPath = uri.fsPath;
        console.log(`[ACTIVE_ANALYSIS_REGISTRY] 🔍 Looking for analysis with path: ${targetPath}`);
        // Find analysis by matching file path
        let foundAnalysisId = null;
        for (const [id, analysis] of this.activeAnalyses.entries()) {
            if (analysis.path === targetPath) {
                foundAnalysisId = id;
                console.log(`[ACTIVE_ANALYSIS_REGISTRY] ✅ Found matching analysis: ${id}`);
                break;
            }
        }
        if (foundAnalysisId) {
            this.unregisterAnalysis(foundAnalysisId);
            return true;
        }
        else {
            console.warn(`[ACTIVE_ANALYSIS_REGISTRY] ⚠️ No analysis found for URI: ${targetPath}`);
            return false;
        }
    }
    /**
     * Clear all analyses (useful for cleanup)
     */
    clearAll() {
        console.log('[ACTIVE_ANALYSIS_REGISTRY] Clearing all analyses');
        this.activeAnalyses.clear();
        this._onDidChangeAnalyses.fire();
    }
    /**
     * Start tracking a file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        const analysis = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(filePath, mode, language);
        this.registerAnalysis(analysis);
        return analysis.id;
    }
    /**
     * Start tracking a directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        const analysis = activeAnalysisModel_1.ActiveAnalysisFactory.createDirectoryAnalysis(directoryPath, mode);
        this.registerAnalysis(analysis);
        return analysis.id;
    }
    /**
     * Mark analysis as completed
     */
    completeAnalysis(analysisId, metadata) {
        this.updateAnalysis(analysisId, 'completed', 100, undefined, metadata);
    }
    /**
     * Mark analysis as failed
     */
    failAnalysis(analysisId, error) {
        this.updateAnalysis(analysisId, 'failed', undefined, error);
    }
    /**
     * Get summary statistics
     */
    getSummary() {
        const all = this.getAllAnalyses();
        return {
            total: all.length,
            running: all.filter(a => a.status === 'running').length,
            completed: all.filter(a => a.status === 'completed').length,
            failed: all.filter(a => a.status === 'failed').length
        };
    }
}
exports.ActiveAnalysisRegistry = ActiveAnalysisRegistry;
//# sourceMappingURL=activeAnalysisRegistry.js.map