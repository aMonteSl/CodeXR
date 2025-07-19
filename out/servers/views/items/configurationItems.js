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
exports.getServerConfig = getServerConfig;
exports.updateServerConfig = updateServerConfig;
exports.createConfigurationItems = createConfigurationItems;
const vscode = __importStar(require("vscode"));
const unifiedServersTreeView_1 = require("../unifiedServersTreeView");
const serverNodeIcons_1 = require("./serverNodeIcons");
const serverSettingsManager_1 = require("../../storage/serverSettingsManager");
/**
 * Get current server configuration
 */
function getServerConfig() {
    return serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
}
/**
 * Update server configuration
 */
async function updateServerConfig(updates) {
    const manager = serverSettingsManager_1.ServerSettingsManager.getInstance();
    await manager.updateFromLegacyConfig(updates);
}
/**
 * Create configuration items for the server tree view
 */
function createConfigurationItems() {
    const config = getServerConfig();
    // Determine icon based on HTTP mode security
    const httpModeIcon = config.httpMode === 'HTTP'
        ? serverNodeIcons_1.ServerNodeIcons.httpModeUnsecure
        : serverNodeIcons_1.ServerNodeIcons.httpModeSecure;
    return [
        new unifiedServersTreeView_1.UnifiedServerTreeItem(`HTTP Mode: ${config.httpMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.httpMode',
            title: 'Configure HTTP Mode'
        }, serverNodeIcons_1.ServerNodeIcons.httpMode, `Click to change server mode (currently: ${config.httpMode})`),
        new unifiedServersTreeView_1.UnifiedServerTreeItem(`Default Port: ${config.port}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.port',
            title: 'Configure Port'
        }, serverNodeIcons_1.ServerNodeIcons.defaultPort, `Click to change default port (currently: ${config.port})`),
        new unifiedServersTreeView_1.UnifiedServerTreeItem(`Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.autoOpen',
            title: 'Toggle Auto-Open'
        }, serverNodeIcons_1.ServerNodeIcons.autoOpen, `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`),
        new unifiedServersTreeView_1.UnifiedServerTreeItem(`Open Mode: ${config.openMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.openMode',
            title: 'Configure Open Mode'
        }, serverNodeIcons_1.ServerNodeIcons.openMode, `Click to change open mode (currently: ${config.openMode})`),
        new unifiedServersTreeView_1.UnifiedServerTreeItem('Reset to Default', vscode.TreeItemCollapsibleState.None, 'config-option', {
            command: 'codexr.server.config.resetToDefault',
            title: 'Reset to Default Settings'
        }, serverNodeIcons_1.ServerNodeIcons.reset, 'Reset all server configuration to default values')
    ];
}
//# sourceMappingURL=configurationItems.js.map