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
exports.handleExistingServerConflict = handleExistingServerConflict;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const xrAnalysisManager_1 = require("../../analysis/xr/xrAnalysisManager");
const domVisualizationManager_1 = require("../../analysis/html/domVisualizationManager");
/**
 * Checks if there's an active server for a file and handles user choice
 * @param filePath Path to the file being analyzed
 * @param fileName File name for display
 * @returns Action to take: 'proceed', 'open', or 'cancel'
 */
async function handleExistingServerConflict(filePath, fileName) {
    const existingServer = findExistingServer(filePath, fileName);
    if (!existingServer) {
        return 'proceed'; // No existing server found
    }
    const serverType = existingServer.type === 'dom' ? 'DOM visualization' : 'XR analysis';
    console.log(`🔍 Found existing ${serverType} server for ${fileName}:`, existingServer.url);
    // ✅ FIXED: Removed the extra "❌ Cancel" button - VS Code provides default cancel
    const choice = await vscode.window.showInformationMessage(`A ${serverType} server is already running for "${fileName}" at ${existingServer.url}`, {
        modal: true,
        detail: 'What would you like to do?'
    }, '🌐 Open in Browser', '🔄 Re-analyze (Close & Restart)'
    // ✅ REMOVED: '❌ Cancel' - VS Code already provides this
    );
    return await handleUserChoice(choice, existingServer, serverType, fileName);
}
/**
 * Finds existing server for a file
 * @param filePath Path to the file
 * @param fileName Name of the file
 * @returns Server information if found, undefined otherwise
 */
function findExistingServer(filePath, fileName) {
    const fileNameWithoutExt = path.basename(fileName, path.extname(fileName));
    // Check for XR analysis server
    const xrServer = (0, xrAnalysisManager_1.getActiveAnalysisServer)(fileNameWithoutExt);
    if (xrServer) {
        console.log(`🎯 Found XR server for ${fileNameWithoutExt}:`, xrServer);
        return {
            type: 'xr',
            server: xrServer,
            url: xrServer.url,
            fileName: fileNameWithoutExt
        };
    }
    // Check for DOM visualization server (HTML files)
    const fileExtension = path.extname(filePath).toLowerCase();
    if (fileExtension === '.html' || fileExtension === '.htm') {
        const domServer = (0, domVisualizationManager_1.getActiveDOMVisualizationServer)(fileNameWithoutExt);
        if (domServer) {
            console.log(`🌐 Found DOM server for ${fileNameWithoutExt}:`, domServer);
            return {
                type: 'dom',
                server: domServer,
                url: domServer.url,
                fileName: fileNameWithoutExt
            };
        }
    }
    return undefined;
}
/**
 * Handles user choice for server conflict resolution
 * @param choice User's choice from the dialog
 * @param existingServer Information about the existing server
 * @param serverType Type of server for user feedback
 * @param fileName File name for user feedback
 * @returns Action to take
 */
async function handleUserChoice(choice, existingServer, serverType, fileName) {
    switch (choice) {
        case '🌐 Open in Browser':
            console.log(`🌐 Opening browser for ${fileName}: ${existingServer.url}`);
            await vscode.env.openExternal(vscode.Uri.parse(existingServer.url));
            return 'open';
        case '🔄 Re-analyze (Close & Restart)':
            console.log(`🔄 Re-analyzing ${fileName}, closing existing server...`);
            // ✅ CRITICAL FIX: Properly close the existing server and wait for completion
            const closeSuccess = await closeExistingServerAndWait(existingServer);
            if (closeSuccess) {
                console.log(`✅ Successfully closed existing server for ${fileName}`);
                vscode.window.showInformationMessage(`🔄 Restarting ${serverType} for ${fileName}...`, { modal: false });
                // ✅ ADD SMALL DELAY: Allow server to fully close before proceeding
                await new Promise(resolve => setTimeout(resolve, 1000));
                return 'proceed';
            }
            else {
                console.error(`❌ Failed to close existing server for ${fileName}`);
                vscode.window.showErrorMessage(`Failed to close existing ${serverType} server. Please try again.`);
                return 'cancel';
            }
        // ✅ FIXED: Handle all cancel cases (ESC, X button, or undefined)
        default:
            console.log(`❌ User cancelled re-analysis for ${fileName}`);
            return 'cancel';
    }
}
/**
 * ✅ ENHANCED: Closes an existing server and waits for completion
 * @param existingServer Server information
 * @returns Promise<boolean> indicating success
 */
async function closeExistingServerAndWait(existingServer) {
    try {
        console.log(`🛑 Closing ${existingServer.type} server:`, existingServer.server.id || existingServer.server.port);
        if (existingServer.type === 'xr') {
            // ✅ XR Analysis server cleanup
            const success = (0, xrAnalysisManager_1.closeExistingAnalysisServer)(existingServer.fileName);
            if (success) {
                console.log(`✅ XR server closed successfully for ${existingServer.fileName}`);
                return true;
            }
            else {
                console.error(`❌ Failed to close XR server for ${existingServer.fileName}`);
                return false;
            }
        }
        else if (existingServer.type === 'dom') {
            // ✅ DOM visualization server cleanup
            const success = (0, domVisualizationManager_1.closeExistingDOMVisualizationServer)(existingServer.fileName);
            if (success) {
                console.log(`✅ DOM server closed successfully for ${existingServer.fileName}`);
                return true;
            }
            else {
                console.error(`❌ Failed to close DOM server for ${existingServer.fileName}`);
                return false;
            }
        }
        return false;
    }
    catch (error) {
        console.error(`❌ Error closing existing server:`, error);
        return false;
    }
}
//# sourceMappingURL=serverConflictHandler.js.map