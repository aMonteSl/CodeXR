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
exports.getLanguageName = void 0;
exports.getFilePathFromUri = getFilePathFromUri;
exports.createErrorItem = createErrorItem;
exports.refreshTreeProvider = refreshTreeProvider;
exports.withProgressNotification = withProgressNotification;
const vscode = __importStar(require("vscode"));
const languageUtils_1 = require("../../utils/languageUtils");
Object.defineProperty(exports, "getLanguageName", { enumerable: true, get: function () { return languageUtils_1.getLanguageName; } });
/**
 * Shared helper functions for command operations
 */
/**
 * Extracts file path from URI or active editor
 * @param fileUri Optional URI to extract path from
 * @returns File path or undefined if not available
 */
function getFilePathFromUri(fileUri) {
    if (fileUri) {
        return fileUri.fsPath;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No file is currently open');
        return undefined;
    }
    return editor.document.uri.fsPath;
}
/**
 * Creates a tree item for displaying error messages
 * @param message Error message to display
 * @param tooltip Optional tooltip text
 * @returns TreeItem-like object for displaying the error
 */
function createErrorItem(message, tooltip) {
    return {
        label: message,
        tooltip: tooltip || message,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        iconPath: new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground')),
        contextValue: 'error'
    };
}
/**
 * Refreshes the tree data provider if available
 * @param showMessage Whether to show a success message
 */
function refreshTreeProvider(showMessage = false) {
    const treeDataProvider = global.treeDataProvider;
    if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
        treeDataProvider.refresh();
        if (showMessage) {
            vscode.window.showInformationMessage('Tree view refreshed');
        }
    }
    else if (showMessage) {
        vscode.window.showWarningMessage('Tree data provider not available');
    }
}
/**
 * Shows a progress notification while executing an async operation
 * @param title Title of the progress notification
 * @param operation Async operation to execute
 * @param progressUpdates Optional progress update messages
 * @returns Result of the operation
 */
async function withProgressNotification(title, operation, cancellable = false) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable
    }, operation);
}
//# sourceMappingURL=commandHelpers.js.map