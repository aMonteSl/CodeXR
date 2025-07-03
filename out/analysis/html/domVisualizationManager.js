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
exports.getActiveDOMVisualizationServer = getActiveDOMVisualizationServer;
exports.closeExistingDOMVisualizationServer = closeExistingDOMVisualizationServer;
exports.createDOMVisualization = createDOMVisualization;
exports.cleanupDOMVisualizations = cleanupDOMVisualizations;
exports.getDOMVisualizationFolder = getDOMVisualizationFolder;
exports.showDOMVisualization = showDOMVisualization;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const htmlDomParser_1 = require("./htmlDomParser");
const serverManager_1 = require("../../server/serverManager");
const serverModel_1 = require("../../server/models/serverModel");
// ✅ NEW: Import FileWatchManager and AnalysisMode for DOM live-reload
const fileWatchManager_1 = require("../watchers/fileWatchManager");
const model_1 = require("../model");
const analysisSessionManager_1 = require("../analysisSessionManager");
// ✅ ADD: Track DOM visualization folders by filename (similar to XR analysis)
const domVisualizationFolders = new Map();
/**
 * ✅ NEW: Get active DOM visualization server for a specific file
 * @param fileName HTML file name
 * @returns ServerInfo if found, undefined otherwise
 */
function getActiveDOMVisualizationServer(fileName) {
    const activeServers = (0, serverManager_1.getActiveServers)();
    return activeServers.find(server => {
        return server.analysisFileName === fileName &&
            server.displayUrl?.includes('XR DOM Visualization');
    });
}
/**
 * ✅ NEW: Close existing DOM visualization server for a specific file
 * @param fileName HTML file name
 * @returns true if server was found and closed, false otherwise
 */
function closeExistingDOMVisualizationServer(fileName) {
    const existingServer = getActiveDOMVisualizationServer(fileName);
    if (existingServer) {
        console.log(`🛑 Closing existing DOM visualization server for ${fileName}: ${existingServer.url}`);
        (0, serverManager_1.stopServer)(existingServer.id);
        return true;
    }
    return false;
}
/**
 * Creates a DOM visualization for an HTML file
 * @param filePath Path to the HTML file
 * @param context Extension context
 * @returns Path to the created visualization or undefined on error
 */
async function createDOMVisualization(filePath, context) {
    try {
        // Parse the HTML file
        const domAnalysis = await (0, htmlDomParser_1.parseHTMLFile)(filePath);
        // Prepare HTML content for template
        const templateHTML = (0, htmlDomParser_1.prepareHTMLForTemplate)(domAnalysis);
        // Create the visualization folder
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        try {
            await fs.promises.access(visualizationsDir);
        }
        catch (e) {
            await fs.promises.mkdir(visualizationsDir, { recursive: true });
        }
        // ✅ UPDATED: Check for existing visualization folder (similar to XR analysis)
        const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
        const existingFolder = domVisualizationFolders.get(fileNameWithoutExt);
        let visualizationDir;
        if (existingFolder && await fs.promises.access(existingFolder).then(() => true).catch(() => false)) {
            // Reuse existing folder
            visualizationDir = existingFolder;
            console.log(`♻️ Reusing existing DOM visualization folder: ${visualizationDir}`);
        }
        else {
            // Create new folder
            const timestamp = Date.now();
            visualizationDir = path.join(visualizationsDir, `dom-${fileNameWithoutExt}-${timestamp}`);
            await fs.promises.mkdir(visualizationDir, { recursive: true });
            // Track this folder
            domVisualizationFolders.set(fileNameWithoutExt, visualizationDir);
            console.log(`📁 Created new DOM visualization folder: ${visualizationDir}`);
        }
        // Process the template with the HTML content
        const htmlContent = await processDOMVisualizationTemplate(domAnalysis, templateHTML, context);
        // Save the HTML file
        const htmlFilePath = path.join(visualizationDir, 'index.html');
        await fs.promises.writeFile(htmlFilePath, htmlContent);
        // Get server mode from user configuration
        const userServerMode = context.globalState.get('serverMode') || serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Create and start server
        const serverInfo = await (0, serverManager_1.createServer)(visualizationDir, userServerMode, context);
        if (serverInfo) {
            // ✅ Register the DOM analysis session
            const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
            sessionManager.addSession(filePath, analysisSessionManager_1.AnalysisType.DOM, serverInfo);
            // Update server display info for DOM visualization
            const originalFileName = path.basename(filePath);
            const updated = (0, serverManager_1.updateServerDisplayInfo)(serverInfo.id, {
                analysisFileName: originalFileName,
                displayUrl: `${originalFileName}: ${serverInfo.port} - XR DOM Visualization`
            });
            if (updated) {
                console.log(`✅ Updated server display info for DOM visualization: ${originalFileName}`);
                // Refresh tree view to show updated server info
                vscode.commands.executeCommand('codexr.refreshTreeView');
            }
            // Automatically open browser
            console.log(`🌐 Opening DOM visualization in browser: ${serverInfo.url}`);
            await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            // ✅ NEW: Set up file watching for DOM live-reload
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                // Set the DOM HTML path for this file
                fileWatchManager.setDOMHtmlPath(filePath, htmlFilePath);
                // Start watching the original HTML file in DOM mode
                fileWatchManager.startWatching(filePath, model_1.AnalysisMode.DOM);
                console.log(`🔍 Started file watching for DOM live-reload: ${originalFileName}`);
            }
            else {
                console.warn('⚠️ FileWatchManager not available, DOM live-reload not enabled');
            }
            // Show simple success message
            vscode.window.showInformationMessage(`DOM visualization server started for ${originalFileName}`, { modal: false });
            return htmlFilePath;
        }
        else {
            vscode.window.showErrorMessage('Failed to start DOM visualization server');
            return undefined;
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating DOM visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * ✅ NEW: Cleanup DOM visualization folders
 */
function cleanupDOMVisualizations() {
    domVisualizationFolders.clear();
}
/**
 * ✅ NEW: Get DOM visualization folder for a specific file name
 * @param fileName File name without extension
 * @returns Visualization directory path or undefined if not found
 */
function getDOMVisualizationFolder(fileName) {
    return domVisualizationFolders.get(fileName);
}
/**
 * Processes the DOM visualization template with all placeholders
 * @param domAnalysis DOM analysis result
 * @param templateHTML Single-line HTML content
 * @param context Extension context
 * @returns Processed HTML content
 */
async function processDOMVisualizationTemplate(domAnalysis, templateHTML, context) {
    // Load the DOM visualization template
    const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'dom-visualization-template.html');
    let template = await fs.promises.readFile(templatePath, 'utf-8');
    // Get environment settings from context with proper defaults
    const backgroundColor = context.globalState.get('babiaBackgroundColor') || '#FFFFFF';
    const environmentPreset = context.globalState.get('babiaEnvironmentPreset') || 'forest';
    const groundColor = context.globalState.get('babiaGroundColor') || '#85144b';
    // Create title
    const title = `DOM Visualization - ${domAnalysis.fileName}`;
    // Replace all placeholders including HTML_CONTENT
    template = template
        .replace(/\$\{TITLE\}/g, title)
        .replace(/\$\{FILE_NAME\}/g, domAnalysis.fileName)
        .replace(/\$\{BACKGROUND_COLOR\}/g, backgroundColor)
        .replace(/\$\{ENVIRONMENT_PRESET\}/g, environmentPreset)
        .replace(/\$\{GROUND_COLOR\}/g, groundColor)
        .replace(/\$\{HTML_CONTENT\}/g, templateHTML);
    return template;
}
/**
 * Shows DOM visualization for an HTML file analysis result
 * @param analysisResult The analysis result containing DOM data
 * @param context Extension context
 */
async function showDOMVisualization(analysisResult, context) {
    try {
        const filePath = analysisResult.filePath;
        const fileName = path.basename(filePath);
        console.log(`🌐 Starting DOM visualization for: ${fileName}`);
        // Parse the HTML file if it's an HTML file
        let domResult;
        if (fileName.toLowerCase().endsWith('.html')) {
            domResult = await (0, htmlDomParser_1.parseHTMLFile)(filePath);
        }
        else {
            throw new Error('DOM visualization is only available for HTML files');
        }
        // Create the visualization
        const visualizationPath = await createDOMVisualization(filePath, context);
        if (visualizationPath) {
            // Start a server for the visualization using the createServer function
            const serverInfo = await (0, serverManager_1.createServer)(path.dirname(visualizationPath), serverModel_1.ServerMode.HTTP, context);
            if (serverInfo) {
                // Update server info to show the HTML file
                (0, serverManager_1.updateServerDisplayInfo)(serverInfo.id, {
                    analysisFileName: fileName
                });
                // Show success message
                vscode.window.showInformationMessage(`DOM visualization created for ${fileName}. Server running at: http://localhost:${serverInfo.port}`);
            }
            else {
                vscode.window.showErrorMessage('Failed to start server for DOM visualization');
            }
        }
    }
    catch (error) {
        console.error('❌ Failed to show DOM visualization:', error);
        throw error;
    }
}
//# sourceMappingURL=domVisualizationManager.js.map