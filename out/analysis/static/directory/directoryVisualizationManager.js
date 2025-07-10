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
exports.createDirectoryVisualization = createDirectoryVisualization;
exports.updateDirectoryVisualization = updateDirectoryVisualization;
exports.getDirectoryVisualizationFolder = getDirectoryVisualizationFolder;
exports.getOpenPanel = getOpenPanel;
exports.closePanelForDirectory = closePanelForDirectory;
exports.getOpenPanelDirectories = getOpenPanelDirectories;
exports.cleanupDirectoryVisualizations = cleanupDirectoryVisualizations;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const nonceUtils_1 = require("../../../utils/nonceUtils");
const analysisSessionManager_1 = require("../../analysisSessionManager");
// Track open webview panels by directory path
const openPanels = new Map();
// Track visualization directories by directory path
const visualizationDirs = new Map();
/**
 * Creates a directory analysis visualization and opens it in a VS Code webview panel
 * @param context Extension context
 * @param directoryPath Path to directory that was analyzed
 * @param analysisResult Analysis result data
 * @param isProject Whether this is a project-level analysis
 * @returns Promise with visualization folder path or undefined
 */
async function createDirectoryVisualization(context, directoryPath, analysisResult, isProject = false, analysisMode = 'shallow') {
    try {
        console.log(`🔍 Creating directory visualization for: ${directoryPath}`);
        // Close existing panel if it exists
        const existingPanel = openPanels.get(directoryPath);
        if (existingPanel) {
            existingPanel.dispose();
        }
        // Create visualization directory structure
        const result = await createDirectoryAnalysisVisualization(directoryPath, analysisResult, context);
        if (!result) {
            return undefined;
        }
        const { visualizationDir } = result;
        // Copy directory analysis template and assets
        await copyDirectoryAnalysisAssets(context, visualizationDir);
        // Track visualization directory for this path
        visualizationDirs.set(directoryPath, visualizationDir);
        // Open the visualization in a webview panel
        await openDirectoryVisualizationPanel(context, visualizationDir, analysisResult, directoryPath, isProject, analysisMode);
        console.log(`✅ Directory visualization created: ${visualizationDir}`);
        return visualizationDir;
    }
    catch (error) {
        console.error('Error creating directory visualization:', error);
        vscode.window.showErrorMessage(`Directory visualization error: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Creates visualization directory structure and saves analysis data
 */
async function createDirectoryAnalysisVisualization(directoryPath, analysisResult, context) {
    try {
        const dirName = path.basename(directoryPath);
        const nonce = (0, nonceUtils_1.generateNonce)();
        // Create visualization directory
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        try {
            await fs.mkdir(visualizationsDir, { recursive: true });
        }
        catch (e) {
            // Directory exists, continue
        }
        const visualizationDir = path.join(visualizationsDir, `${dirName}_${nonce}`);
        await fs.mkdir(visualizationDir, { recursive: true });
        console.log(`📁 Created visualization directory: ${visualizationDir}`);
        // Save analysis data as JSON
        const dataFilePath = path.join(visualizationDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(analysisResult, null, 2));
        console.log(`💾 Saved analysis data: ${dataFilePath}`);
        return { visualizationDir };
    }
    catch (error) {
        console.error('Error creating directory analysis visualization:', error);
        return undefined;
    }
}
/**
 * Copies directory analysis template and assets to visualization directory
 */
async function copyDirectoryAnalysisAssets(context, visualizationDir) {
    try {
        // Copy the HTML template
        const templatePath = path.join(context.extensionPath, 'templates', 'analysis', 'directoryAnalysis.html');
        const htmlPath = path.join(visualizationDir, 'index.html');
        await fs.copyFile(templatePath, htmlPath);
        console.log(`📄 Copied HTML template: ${htmlPath}`);
        // Copy CSS file
        const cssSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'directoryAnalysisstyle.css');
        const cssDestPath = path.join(visualizationDir, 'directoryAnalysisstyle.css');
        await fs.copyFile(cssSourcePath, cssDestPath);
        console.log(`🎨 Copied CSS file: ${cssDestPath}`);
        // Copy JS file
        const jsSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'directoryAnalysismain.js');
        const jsDestPath = path.join(visualizationDir, 'directoryAnalysismain.js');
        await fs.copyFile(jsSourcePath, jsDestPath);
        console.log(`⚡ Copied JS file: ${jsDestPath}`);
    }
    catch (error) {
        console.error('Error copying directory analysis assets:', error);
        throw error;
    }
}
/**
 * Opens the directory analysis visualization in a webview panel
 */
async function openDirectoryVisualizationPanel(context, visualizationDir, analysisResult, directoryPath, isProject, analysisMode = 'shallow') {
    const panel = vscode.window.createWebviewPanel('directoryAnalysis', `${isProject ? 'Project' : 'Directory'} Analysis - ${path.basename(directoryPath)}`, vscode.ViewColumn.Beside, // Open in side column like file analysis
    {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            vscode.Uri.file(visualizationDir),
            vscode.Uri.file(path.join(context.extensionPath, 'media'))
        ]
    });
    // Track the panel
    openPanels.set(directoryPath, panel);
    // ✅ NEW: Add to active analyses session manager
    const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
    sessionManager.addSession(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY, panel, { mode: analysisMode, visualizationType: 'static' });
    // Load and process HTML template
    const htmlPath = path.join(visualizationDir, 'index.html');
    let htmlContent = await fs.readFile(htmlPath, 'utf8');
    // Get webview URIs
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'directoryAnalysisstyle.css')));
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(visualizationDir, 'directoryAnalysismain.js')));
    const nonce = (0, nonceUtils_1.generateNonce)();
    // Replace template variables
    htmlContent = htmlContent
        .replace(/\${webview\.cspSource}/g, panel.webview.cspSource)
        .replace(/\${styleUri}/g, styleUri.toString())
        .replace(/\${scriptUri}/g, scriptUri.toString())
        .replace(/\${nonce}/g, nonce)
        .replace(/\${directoryPath}/g, analysisResult.summary.directoryPath)
        .replace(/\${totalFiles}/g, analysisResult.summary.totalFiles.toString())
        .replace(/\${totalFilesAnalyzed}/g, analysisResult.summary.totalFilesAnalyzed.toString())
        .replace(/\${timestamp}/g, analysisResult.summary.analyzedAt)
        .replace(/\${analysisMode}/g, analysisMode); // Add analysis mode
    // Add the analysis data as a script
    const analysisDataScript = `
    <script nonce="${nonce}">
      window.analysisData = ${JSON.stringify(analysisResult)};
      window.analysisMode = "${analysisMode}";
    </script>
  `;
    htmlContent = htmlContent.replace('</head>', `${analysisDataScript}\n</head>`);
    // ✅ Save processed HTML back to file for debugging
    await fs.writeFile(htmlPath, htmlContent, 'utf8');
    console.log(`💾 Saved processed HTML template: ${htmlPath}`);
    panel.webview.html = htmlContent;
    // ✅ NEW: Send initial data message to ensure proper loading
    // This helps in cases where the inline script might not execute properly
    setTimeout(() => {
        panel.webview.postMessage({
            command: 'updateData',
            data: analysisResult
        });
    }, 100); // Small delay to ensure HTML is loaded first
    // Handle panel disposal
    panel.onDidDispose(() => {
        openPanels.delete(directoryPath);
        visualizationDirs.delete(directoryPath);
        // ✅ NEW: Stop directory watcher when panel is closed
        const { directoryWatchManager } = require('../../watchers/directoryWatchManager');
        if (directoryWatchManager.isWatching(directoryPath)) {
            console.log(`🛑 Stopping directory watcher for closed panel: ${directoryPath}`);
            directoryWatchManager.stopWatching(directoryPath);
        }
        // Session cleanup is handled automatically by AnalysisSessionManager
        console.log(`🗑️ Directory panel disposed: ${path.basename(directoryPath)}`);
    }, null, context.subscriptions);
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'openFile':
                if (message.filePath) {
                    const uri = vscode.Uri.file(message.filePath);
                    await vscode.window.showTextDocument(uri);
                }
                break;
            case 'analyzeFile':
                if (message.filePath) {
                    // Trigger individual file analysis
                    await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(message.filePath));
                }
                break;
            case 'openFileAnalysis':
                if (message.filePath) {
                    try {
                        console.log(`🔍 Opening individual file analysis for: ${message.filePath}`);
                        // Trigger individual file analysis from directory panel
                        await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(message.filePath));
                    }
                    catch (error) {
                        console.error('Error opening file analysis:', error);
                        vscode.window.showErrorMessage(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                break;
        }
    }, undefined, context.subscriptions);
}
/**
 * Updates the content of an existing directory analysis panel without reloading
 * @param panel Webview panel to update
 * @param visualizationDir Path to the visualization directory
 * @param analysisResult New analysis result data
 */
async function updateDirectoryPanelContent(panel, visualizationDir, analysisResult) {
    try {
        const dataPath = path.join(visualizationDir, 'data.json');
        // Update data.json with new analysis result
        await fs.writeFile(dataPath, JSON.stringify(analysisResult, null, 2));
        console.log(`💾 Updated data.json: ${dataPath}`);
        // ✅ IMPROVED: Instead of replacing HTML, just send the updated data
        // This preserves scroll position and is more efficient
        console.log(`📨 Sending updateData message to webview...`);
        panel.webview.postMessage({
            command: 'updateData',
            data: analysisResult
        });
        // ✅ Also send a secondary message with just a reload command in case the first fails
        setTimeout(() => {
            console.log(`� Sending secondary refresh message to webview...`);
            panel.webview.postMessage({
                command: 'refresh'
            });
        }, 50);
        console.log(`🔄 Directory panel data updated for: ${path.basename(analysisResult.summary.directoryPath)}`);
    }
    catch (error) {
        console.error('Error updating directory panel content:', error);
        throw error;
    }
}
/**
 * Updates an existing directory visualization without recreating the panel
 * @param directoryPath Path to directory that was analyzed
 * @param analysisResult New analysis result data
 * @returns Promise with visualization folder path or undefined
 */
async function updateDirectoryVisualization(directoryPath, analysisResult) {
    try {
        console.log(`🔄 Updating directory visualization for: ${directoryPath}`);
        // Check if we have a tracked visualization directory for this path
        const visualizationDir = visualizationDirs.get(directoryPath);
        if (!visualizationDir) {
            console.warn(`No tracked visualization directory for: ${directoryPath}`);
            return undefined;
        }
        // Update the panel content if it's still open
        const panel = openPanels.get(directoryPath);
        if (panel) {
            await updateDirectoryPanelContent(panel, visualizationDir, analysisResult);
            console.log(`🔄 Directory panel content refreshed for: ${path.basename(directoryPath)}`);
        }
        return visualizationDir;
    }
    catch (error) {
        console.error('Error updating directory visualization:', error);
        return undefined;
    }
}
/**
 * Gets the visualization folder for a directory path
 */
function getDirectoryVisualizationFolder(directoryPath) {
    return visualizationDirs.get(directoryPath);
}
/**
 * Gets the open panel for a directory path
 */
function getOpenPanel(directoryPath) {
    return openPanels.get(directoryPath);
}
/**
 * Closes the panel for a specific directory
 */
function closePanelForDirectory(directoryPath) {
    const panel = openPanels.get(directoryPath);
    if (panel) {
        panel.dispose();
    }
}
/**
 * Gets all open panel directory paths
 */
function getOpenPanelDirectories() {
    return Array.from(openPanels.keys());
}
/**
 * Cleanup all visualizations
 */
function cleanupDirectoryVisualizations() {
    for (const panel of openPanels.values()) {
        panel.dispose();
    }
    openPanels.clear();
    visualizationDirs.clear();
}
//# sourceMappingURL=directoryVisualizationManager.js.map