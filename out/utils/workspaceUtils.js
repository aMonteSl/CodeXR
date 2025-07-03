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
exports.openFolderInWorkspace = openFolderInWorkspace;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Opens a folder in the workspace
 * @param folderPath Path to the folder to open
 * @param openInNewWindow Whether to open in a new window
 */
async function openFolderInWorkspace(folderPath, openInNewWindow = false) {
    const folderUri = vscode.Uri.file(folderPath);
    if (openInNewWindow) {
        // Open in a new window
        await vscode.commands.executeCommand('vscode.openFolder', folderUri, { forceNewWindow: true });
    }
    else {
        // Get the current workspace folders
        const currentFolders = vscode.workspace.workspaceFolders || [];
        if (currentFolders.length === 0) {
            // If there are no workspace folders, simply open this folder
            await vscode.commands.executeCommand('vscode.openFolder', folderUri);
        }
        else {
            // Add this folder to the workspace
            const success = vscode.workspace.updateWorkspaceFolders(currentFolders.length, // index to start deletion
            0, // number of folders to delete
            { uri: folderUri, name: path.basename(folderPath) });
            if (success) {
                // Reveal the folder in the explorer
                await vscode.commands.executeCommand('revealInExplorer', folderUri);
            }
            else {
                vscode.window.showErrorMessage(`Failed to add ${path.basename(folderPath)} to workspace`);
            }
        }
    }
}
//# sourceMappingURL=workspaceUtils.js.map