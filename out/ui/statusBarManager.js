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
exports.updateStatusBar = updateStatusBar;
exports.disposeStatusBar = disposeStatusBar;
exports.showStatusBar = showStatusBar;
const vscode = __importStar(require("vscode"));
// Status bar item for quick access to server actions
let statusBarItem;
/**
 * Updates the status bar with server information
 * @param serverInfo Server information to display
 */
function updateStatusBar(serverInfo) {
    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }
    // Use displayUrl if available, otherwise fall back to url
    const displayUrl = serverInfo.displayUrl || serverInfo.url;
    statusBarItem.text = `$(globe) Server: ${displayUrl}`;
    statusBarItem.tooltip = `${serverInfo.protocol.toUpperCase()} server active\nClick to see options`;
    statusBarItem.command = 'integracionvsaframe.serverStatusActions';
    statusBarItem.show();
}
/**
 * Hides and disposes the status bar item
 */
function disposeStatusBar() {
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
}
/**
 * Shows the status bar with the given server info
 * @param serverInfo Server info to display
 */
function showStatusBar(serverInfo) {
    updateStatusBar(serverInfo);
}
//# sourceMappingURL=statusBarManager.js.map