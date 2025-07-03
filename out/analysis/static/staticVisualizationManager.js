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
exports.createStaticVisualization = createStaticVisualization;
exports.updateStaticVisualization = updateStaticVisualization;
exports.cleanupStaticVisualizations = cleanupStaticVisualizations;
exports.getStaticVisualizationFolder = getStaticVisualizationFolder;
exports.getOpenPanel = getOpenPanel;
exports.closePanelForFile = closePanelForFile;
exports.getOpenPanelFiles = getOpenPanelFiles;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileWatchManager_1 = require("../watchers/fileWatchManager");
const model_1 = require("../model");
const sharedAnalysisUtils_1 = require("../utils/sharedAnalysisUtils");
const index_1 = require("../static/index");
const analysisSessionManager_1 = require("../analysisSessionManager");
// Track open webview panels by file path
const openPanels = new Map();
// Track visualization directories by file path
const visualizationDirs = new Map();
/**
 * Creates a static analysis visualization and opens it in a VS Code webview panel
 * @param context Extension context
 * @param filePath Path to file to analyze
 * @returns Promise with visualization folder path or undefined
 */
async function createStaticVisualization(context, filePath) {
    try {
        console.log(`🔍 Starting static analysis visualization for: ${filePath}`);
        // Close existing panel if it exists
        const existingPanel = openPanels.get(filePath);
        if (existingPanel) {
            existingPanel.dispose(); // This will trigger onDidDispose and clean up watchers
        }
        // Use shared analysis utility to create visualization directory and data.json
        const result = await (0, sharedAnalysisUtils_1.createAnalysisVisualization)(filePath, context);
        if (!result) {
            return undefined;
        }
        const { analysisResult, visualizationDir } = result;
        // Copy static analysis template and assets
        await (0, sharedAnalysisUtils_1.copyStaticAnalysisAssets)(context, visualizationDir);
        // Track visualization directory for this file
        visualizationDirs.set(filePath, visualizationDir);
        // Open the visualization in a webview panel
        await openStaticVisualizationPanel(context, visualizationDir, analysisResult.fileName, filePath);
        // Set up file watcher for auto-reanalysis (handled by FileWatchManager)
        // The FileWatchManager will call updateStaticVisualization when files change
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.startWatching(filePath, model_1.AnalysisMode.STATIC);
        }
        vscode.window.showInformationMessage(`Static analysis complete: ${path.basename(filePath)}`);
        return visualizationDir;
    }
    catch (error) {
        console.error('Error creating static visualization:', error);
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Opens the static analysis visualization in a VS Code webview panel
 * @param context Extension context
 * @param visualizationDir Path to the visualization directory
 * @param fileName Name of the analyzed file
 * @param originalFilePath Original file path for tracking
 */
async function openStaticVisualizationPanel(context, visualizationDir, fileName, originalFilePath) {
    try {
        // Create webview panel on the right side
        const panel = vscode.window.createWebviewPanel('staticAnalysisPanel', `Analysis: ${fileName}`, vscode.ViewColumn.Two, // Right side panel
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(visualizationDir), // Allow access to the visualization folder
                context.extensionUri // Allow access to extension resources
            ],
            retainContextWhenHidden: true
        });
        // Track the panel for this file
        openPanels.set(originalFilePath, panel);
        // ✅ Register the analysis session
        const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
        console.log(`🔍 [StaticViz] About to add session for: ${originalFilePath} (${analysisSessionManager_1.AnalysisType.STATIC})`);
        console.log(`🔍 [StaticViz] Panel exists: ${panel ? 'YES' : 'NO'}`);
        const sessionId = sessionManager.addSession(originalFilePath, analysisSessionManager_1.AnalysisType.STATIC, panel);
        console.log(`🔍 [StaticViz] Session added with ID: ${sessionId}`);
        // Debug session manager state after adding
        sessionManager.debugState();
        // Handle panel disposal - clean up watchers and tracking
        panel.onDidDispose(() => {
            console.log(`🗑️ [StaticViz] Panel disposed for: ${originalFilePath}`);
            // Remove from tracking
            openPanels.delete(originalFilePath);
            visualizationDirs.delete(originalFilePath);
            // ✅ Remove from session manager (will auto-trigger tree refresh)
            console.log(`🗑️ [StaticViz] Removing session for: ${originalFilePath}`);
            const sessionKey = originalFilePath + '::' + analysisSessionManager_1.AnalysisType.STATIC;
            console.log(`🗑️ [StaticViz] Session key to remove: ${sessionKey}`);
            sessionManager.removeSession(sessionKey);
            console.log(`🗑️ [StaticViz] Session removal complete`);
            // Stop file watcher for this file
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                console.log(`🛑 Stopping file watcher for: ${originalFilePath}`);
                fileWatchManager.stopWatching(originalFilePath);
            }
        });
        // Load the HTML content from the visualization directory
        await updatePanelContent(panel, visualizationDir);
        console.log(`📱 Opened static analysis panel for: ${fileName}`);
    }
    catch (error) {
        console.error('Error opening static visualization panel:', error);
        vscode.window.showErrorMessage(`Failed to open analysis panel: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Updates the webview panel content with the HTML from the visualization directory
 * @param panel Webview panel to update
 * @param visualizationDir Path to the visualization directory
 */
async function updatePanelContent(panel, visualizationDir) {
    try {
        const fs = require('fs').promises;
        const htmlPath = path.join(visualizationDir, 'index.html');
        const dataPath = path.join(visualizationDir, 'data.json');
        let htmlContent = await fs.readFile(htmlPath, 'utf-8');
        const analysisData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
        // Convert file paths to webview URIs
        const cssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'fileAnalysisstyle.css')));
        const jsUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'fileAnalysismain.js')));
        // Generate a simple nonce for security
        const nonce = Date.now().toString();
        // Replace placeholders in the HTML template
        htmlContent = htmlContent
            .replace(/\$\{webview\.cspSource\}/g, panel.webview.cspSource)
            .replace(/\$\{styleUri\}/g, cssUri.toString())
            .replace(/\$\{scriptUri\}/g, jsUri.toString())
            .replace(/\$\{nonce\}/g, nonce);
        // ✅ CRITICAL FIX: Inject analysis data directly into HTML instead of using fetch
        // Find the closing </head> tag and inject data script before it
        const dataScript = `
  <script nonce="${nonce}">
    window.analysisData = ${JSON.stringify(analysisData)};
  </script>`;
        htmlContent = htmlContent.replace('</head>', `${dataScript}\n</head>`);
        // Set the webview content
        panel.webview.html = htmlContent;
    }
    catch (error) {
        console.error('Error updating panel content:', error);
        throw error;
    }
}
/**
 * Re-analyzes a file and updates existing visualization without creating new panels or watchers
 * @param filePath Path to file to re-analyze
 * @param context Extension context
 * @returns Promise with visualization folder path or undefined
 */
async function updateStaticVisualization(filePath, context) {
    try {
        console.log(`🔄 Re-analyzing file for static visualization update: ${filePath}`);
        // Check if we have a tracked visualization directory for this file
        const visualizationDir = visualizationDirs.get(filePath);
        if (!visualizationDir) {
            console.warn(`No tracked visualization directory for: ${filePath}`);
            return undefined;
        }
        // Re-analyze the file using static analysis
        const analysisResult = await (0, index_1.analyzeFileStatic)(filePath, context);
        if (!analysisResult) {
            console.error('Failed to re-analyze file');
            return undefined;
        }
        // Update data.json in the existing visualization directory
        await (0, sharedAnalysisUtils_1.updateVisualizationData)(visualizationDir, analysisResult);
        console.log(`📊 Updated data.json for: ${path.basename(filePath)}`);
        // Update the panel content if it's still open
        const panel = openPanels.get(filePath);
        if (panel) {
            await updatePanelContent(panel, visualizationDir);
            console.log(`🔄 Panel content refreshed for: ${path.basename(filePath)}`);
        }
        return visualizationDir;
    }
    catch (error) {
        console.error('Error updating static visualization:', error);
        return undefined;
    }
}
/**
 * Cleanup static visualization panels and tracking
 */
function cleanupStaticVisualizations() {
    // Close all open panels
    for (const panel of openPanels.values()) {
        panel.dispose();
    }
    openPanels.clear();
    visualizationDirs.clear();
    console.log('🧹 Cleaned up all static visualization panels and tracking');
}
/**
 * Gets the visualization folder for a specific file
 * @param filePath Path to the analyzed file
 * @returns Visualization directory path or undefined
 */
function getStaticVisualizationFolder(filePath) {
    return visualizationDirs.get(filePath);
}
/**
 * Gets the open panel for a specific file
 * @param filePath Path to the analyzed file
 * @returns Webview panel or undefined
 */
function getOpenPanel(filePath) {
    return openPanels.get(filePath);
}
/**
 * Closes the panel for a specific file
 * @param filePath Path to the analyzed file
 */
function closePanelForFile(filePath) {
    const panel = openPanels.get(filePath);
    if (panel) {
        panel.dispose(); // This will trigger onDidDispose and clean up properly
    }
}
/**
 * Gets all files that have open panels
 * @returns Array of file paths with open panels
 */
function getOpenPanelFiles() {
    return Array.from(openPanels.keys());
}
//# sourceMappingURL=staticVisualizationManager.js.map