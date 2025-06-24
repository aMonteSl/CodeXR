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
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const htmlDomParser_1 = require("./htmlDomParser");
const serverManager_1 = require("../../server/serverManager");
const serverModel_1 = require("../../server/models/serverModel");
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
//# sourceMappingURL=domVisualizationManager.js.map