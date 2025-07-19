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
exports.ActiveAnalysesCommands = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const activeAnalysisRegistry_1 = require("../registry/activeAnalysisRegistry");
const serverControl_1 = require("../../../active_servers/runtime/serverControl");
const activeServerRegistry_1 = require("../../../active_servers/registry/activeServerRegistry");
/**
 * Commands for managing active analyses
 */
class ActiveAnalysesCommands {
    context;
    registry;
    constructor(context) {
        this.context = context;
        this.registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
        this.registerCommands();
    }
    /**
     * Register all active analysis commands
     */
    registerCommands() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Registering active analysis commands');
        // Open analysis command
        const openAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.openAnalysis', (analysisId) => this.openAnalysis(analysisId));
        // Reveal analysis in explorer
        const revealAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.revealAnalysis', (analysisId) => this.revealAnalysis(analysisId));
        // Remove analysis
        const removeAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.removeAnalysis', (analysisId) => this.removeAnalysis(analysisId));
        // Clear all analyses
        const clearAllCommand = vscode.commands.registerCommand('codexr.activeAnalysis.clearAll', () => this.clearAllAnalyses());
        // Refresh active analyses view
        const refreshCommand = vscode.commands.registerCommand('codexr.activeAnalysis.refresh', () => this.refreshView());
        // Re-run analysis
        const rerunAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.rerun', (analysisId) => this.rerunAnalysis(analysisId));
        // Stop analysis (stops server and removes analysis)
        const stopAnalysisCommand = vscode.commands.registerCommand('codexr.activeAnalysis.stopAnalysis', (analysisId) => this.stopAnalysis(analysisId));
        // Add all commands to context subscriptions
        this.context.subscriptions.push(openAnalysisCommand, revealAnalysisCommand, removeAnalysisCommand, clearAllCommand, refreshCommand, rerunAnalysisCommand, stopAnalysisCommand);
        console.log('[ACTIVE_ANALYSES_COMMANDS] Active analysis commands registered successfully');
    }
    /**
     * Open the analysis file or result
     */
    async openAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Opening analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            // Try to open the file/directory
            const uri = vscode.Uri.file(analysis.path);
            if (analysis.id.startsWith('dir-')) {
                // For directory analysis, try to show the results or open the directory
                await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
            }
            else {
                // For file analysis, open the file
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            }
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error opening analysis:', error);
            vscode.window.showErrorMessage(`Failed to open analysis: ${error}`);
        }
    }
    /**
     * Reveal analysis file in the explorer
     */
    async revealAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Revealing analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            const uri = vscode.Uri.file(analysis.path);
            await vscode.commands.executeCommand('revealInExplorer', uri);
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error revealing analysis:', error);
            vscode.window.showErrorMessage(`Failed to reveal analysis: ${error}`);
        }
    }
    /**
     * Remove an analysis from the active list
     */
    async removeAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Removing analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        const result = await vscode.window.showWarningMessage(`Remove analysis for ${analysis.path}?`, { modal: true }, 'Remove');
        if (result === 'Remove') {
            this.registry.unregisterAnalysis(analysisId);
            vscode.window.showInformationMessage('Analysis removed from active list');
        }
    }
    /**
     * Clear all analyses with confirmation
     */
    async clearAllAnalyses() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Clearing all analyses');
        const analyses = this.registry.getAllAnalyses();
        if (analyses.length === 0) {
            vscode.window.showInformationMessage('No active analyses to clear');
            return;
        }
        const result = await vscode.window.showWarningMessage(`Clear all ${analyses.length} active analyses?`, { modal: true }, 'Clear All');
        if (result === 'Clear All') {
            this.registry.clearAll();
            vscode.window.showInformationMessage('All active analyses cleared');
        }
    }
    /**
     * Refresh the active analyses view
     */
    refreshView() {
        console.log('[ACTIVE_ANALYSES_COMMANDS] Refreshing active analyses view');
        // The registry will automatically fire events to refresh the view
        // We could add manual refresh logic here if needed
        vscode.window.showInformationMessage('Active analyses view refreshed');
    }
    /**
     * Re-run an analysis
     */
    async rerunAnalysis(analysisId) {
        console.log(`[ACTIVE_ANALYSES_COMMANDS] Re-running analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            // For now, just show a placeholder message
            // In the future, this will trigger the actual analysis
            vscode.window.showInformationMessage(`TODO: Re-run ${analysis.mode} analysis for ${analysis.path}`);
            // Reset the analysis status to running
            this.registry.updateAnalysis(analysisId, 'running', 0);
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error re-running analysis:', error);
            vscode.window.showErrorMessage(`Failed to re-run analysis: ${error}`);
        }
    }
    /**
     * Stop an analysis (stops associated server and removes from registry)
     */
    async stopAnalysis(analysisIdOrTreeItem) {
        console.log('[ACTIVE_ANALYSES_COMMANDS] 🔍 stopAnalysis called with:', {
            type: typeof analysisIdOrTreeItem,
            isString: typeof analysisIdOrTreeItem === 'string',
            value: analysisIdOrTreeItem,
            hasAnalysis: analysisIdOrTreeItem?.analysis,
            hasLabel: analysisIdOrTreeItem?.label,
            contextValue: analysisIdOrTreeItem?.contextValue,
            itemType: analysisIdOrTreeItem?.itemType,
            sectionType: analysisIdOrTreeItem?.sectionType
        });
        // Handle both string ID and tree item object
        let analysisId;
        if (typeof analysisIdOrTreeItem === 'string') {
            analysisId = analysisIdOrTreeItem;
        }
        else if (analysisIdOrTreeItem && analysisIdOrTreeItem.analysis && analysisIdOrTreeItem.analysis.id) {
            // Tree item object with analysis property (from Active Analyses tree)
            analysisId = analysisIdOrTreeItem.analysis.id;
        }
        else if (analysisIdOrTreeItem && analysisIdOrTreeItem.label) {
            // Tree item from main code analysis tree - try to find analysis by file name
            const fileName = analysisIdOrTreeItem.label;
            console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔍 Looking for analysis by filename: ${fileName}`);
            const allAnalyses = this.registry.getAllAnalyses();
            const matchingAnalysis = allAnalyses.find(analysis => {
                const analysisFileName = analysis.path.split('/').pop() || analysis.path.split('\\').pop();
                return analysisFileName === fileName;
            });
            if (matchingAnalysis) {
                analysisId = matchingAnalysis.id;
                console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found analysis by filename: ${analysisId}`);
            }
            else {
                console.warn(`[ACTIVE_ANALYSES_COMMANDS] ⚠️ No analysis found for filename: ${fileName}`);
                vscode.window.showWarningMessage(`No active analysis found for file: ${fileName}`);
                return;
            }
        }
        else {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Invalid argument for stopAnalysis:', analysisIdOrTreeItem);
            vscode.window.showErrorMessage('Unable to identify analysis to stop');
            return;
        }
        if (!analysisId) {
            vscode.window.showErrorMessage('Unable to identify analysis to stop');
            return;
        }
        console.log(`[ACTIVE_ANALYSES_COMMANDS] 🛑 Stopping analysis: ${analysisId}`);
        const analysis = this.registry.getAnalysis(analysisId);
        if (!analysis) {
            vscode.window.showWarningMessage(`Analysis ${analysisId} not found`);
            return;
        }
        try {
            const serverRegistry = (0, activeServerRegistry_1.getActiveServerRegistry)();
            const servers = serverRegistry.getAllServers();
            // Find server associated with this analysis
            // Strategy 1: Match by HTML file path (exact match)
            let associatedServer = servers.find((server) => server.htmlFile && server.htmlFile === analysis.path);
            // Strategy 2: If no exact match, look for servers with similar filenames
            if (!associatedServer) {
                const analysisFileName = path.basename(analysis.path);
                const analysisBaseName = path.parse(analysisFileName).name; // Remove extension
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔍 Looking for server matching filename: ${analysisFileName} (base: ${analysisBaseName})`);
                // Look for servers whose custom name or HTML file path contains the analysis filename
                associatedServer = servers.find((server) => {
                    // Check custom name (e.g., "Analysis Static tryCodeXr.kt")
                    if (server.customName && server.customName.includes(analysisFileName)) {
                        console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found server by customName: ${server.customName}`);
                        return true;
                    }
                    // Check if HTML file path contains the base filename
                    if (server.htmlFile) {
                        const serverBaseName = path.parse(path.basename(server.htmlFile)).name;
                        const serverDirName = path.basename(path.dirname(server.htmlFile));
                        // Check if the server directory or HTML file contains the analysis base name
                        if (serverDirName.includes(analysisBaseName) || serverBaseName.includes(analysisBaseName)) {
                            console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Found server by HTML path: ${server.htmlFile}`);
                            return true;
                        }
                    }
                    return false;
                });
            }
            if (associatedServer) {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 🔌 Found associated server ${associatedServer.id}, stopping...`);
                const stopped = await serverControl_1.ServerControl.stopServer(associatedServer.id);
                if (stopped) {
                    console.log(`[ACTIVE_ANALYSES_COMMANDS] ✅ Server stopped successfully`);
                    // The server stop event will automatically remove the analysis via our event integration
                    vscode.window.showInformationMessage(`Analysis stopped and server terminated`);
                }
                else {
                    console.warn(`[ACTIVE_ANALYSES_COMMANDS] ⚠️ Failed to stop server, removing analysis anyway`);
                    this.registry.unregisterAnalysis(analysisId);
                    vscode.window.showWarningMessage(`Analysis removed, but server may still be running`);
                }
            }
            else {
                console.log(`[ACTIVE_ANALYSES_COMMANDS] 📝 No associated server found, just removing analysis`);
                // No server found, just remove the analysis
                this.registry.unregisterAnalysis(analysisId);
                vscode.window.showInformationMessage(`Analysis removed`);
            }
        }
        catch (error) {
            console.error('[ACTIVE_ANALYSES_COMMANDS] Error stopping analysis:', error);
            // Fallback: just remove the analysis from registry
            this.registry.unregisterAnalysis(analysisId);
            vscode.window.showErrorMessage(`Failed to stop server, but analysis was removed: ${error}`);
        }
    }
}
exports.ActiveAnalysesCommands = ActiveAnalysesCommands;
//# sourceMappingURL=activeAnalysesCommands.js.map