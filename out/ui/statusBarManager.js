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
exports.StatusBarManager = void 0;
exports.getStatusBarManager = getStatusBarManager;
exports.updateStatusBar = updateStatusBar;
exports.resetStatusBar = resetStatusBar;
exports.disposeStatusBar = disposeStatusBar;
const vscode = __importStar(require("vscode"));
/**
 * Manages the extension's status bar functionality
 */
class StatusBarManager {
    context;
    statusBarItem;
    disposables = [];
    updateTimer;
    serverInfo;
    constructor(context) {
        this.context = context;
        // Create status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        // Set default state
        this.resetToDefaultState();
        // Register the status bar item for disposal
        this.context.subscriptions.push(this.statusBarItem);
        // Set up event handlers
        this.registerEventHandlers();
    }
    /**
     * Register all event handlers for status bar updates
     */
    registerEventHandlers() {
        // Track editor changes to show/hide based on file type
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (this.serverInfo) {
                // When server is running, always show status bar
                this.statusBarItem.show();
            }
            else if (editor && (editor.document.languageId === 'javascript' ||
                editor.document.languageId === 'javascriptreact')) {
                // Only show for JS/JSX files when no server is running
                this.statusBarItem.show();
            }
            else if (!this.serverInfo) {
                // Hide for non-JS files when no server is running
                this.statusBarItem.hide();
            }
        });
        // Track document changes
        const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
            if (this.serverInfo) {
                // Don't update if showing server info
                return;
            }
            if (vscode.window.activeTextEditor &&
                event.document === vscode.window.activeTextEditor.document &&
                (event.document.languageId === 'javascript' ||
                    event.document.languageId === 'javascriptreact')) {
                // Use debouncing to avoid too frequent updates
                if (this.updateTimer) {
                    clearTimeout(this.updateTimer);
                }
                this.updateTimer = setTimeout(() => {
                    // For future metrics implementation
                    // this.updateJSMetrics(event.document);
                }, 1000);
            }
        });
        // Add disposables to the list
        this.disposables.push(editorChangeDisposable, documentChangeDisposable);
    }
    /**
     * Updates the status bar with server information
     */
    updateServerInfo(serverInfo) {
        this.serverInfo = serverInfo;
        // Use displayUrl if available, otherwise fall back to url
        const displayUrl = serverInfo.displayUrl || serverInfo.url;
        this.statusBarItem.text = `$(globe) Server: ${displayUrl}`;
        this.statusBarItem.tooltip = `${serverInfo.protocol.toUpperCase()} server active\nClick to see options`;
        this.statusBarItem.command = 'codexr.serverStatusActions';
        this.statusBarItem.show();
    }
    /**
     * Resets the status bar to default state (no server running)
     */
    resetToDefaultState() {
        this.serverInfo = undefined;
        this.statusBarItem.text = '$(code) CodeXR';
        this.statusBarItem.tooltip = 'CodeXR Extension';
        this.statusBarItem.command = 'codexr.showMenu';
        // Only show for JS/JSX files in default state
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'javascript' ||
            editor.document.languageId === 'javascriptreact')) {
            this.statusBarItem.show();
        }
        else {
            this.statusBarItem.hide();
        }
    }
    /**
     * Dispose all resources
     */
    dispose() {
        // Clear any pending timers
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = undefined;
        }
        // Dispose all registered event handlers
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        // Status bar item is disposed by the context subscriptions
    }
}
exports.StatusBarManager = StatusBarManager;
// Create a singleton instance for the extension
let statusBarManagerInstance;
/**
 * Get or create the StatusBarManager instance
 */
function getStatusBarManager(context) {
    if (!statusBarManagerInstance) {
        statusBarManagerInstance = new StatusBarManager(context);
    }
    return statusBarManagerInstance;
}
/**
 * Update the status bar with server information (facade for backward compatibility)
 */
function updateStatusBar(serverInfo) {
    if (statusBarManagerInstance) {
        statusBarManagerInstance.updateServerInfo(serverInfo);
    }
}
/**
 * Reset the status bar to default state (facade for backward compatibility)
 */
function resetStatusBar() {
    if (statusBarManagerInstance) {
        statusBarManagerInstance.resetToDefaultState();
    }
}
/**
 * Dispose the status bar (facade for backward compatibility)
 */
function disposeStatusBar() {
    if (statusBarManagerInstance) {
        statusBarManagerInstance.dispose();
        statusBarManagerInstance = undefined;
    }
}
//# sourceMappingURL=statusBarManager.js.map