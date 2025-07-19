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
exports.ServerItemFactory = exports.ServerTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const serverSettingsManager_1 = require("../../../servers/storage/serverSettingsManager");
/**
 * Get current server configuration for dynamic item creation
 */
function getServerConfig() {
    return serverSettingsManager_1.ServerSettingsManager.getInstance().getLegacyConfig();
}
/**
 * Server tree items for the Servers section
 */
class ServerTreeItem extends vscode.TreeItem {
    serverItemType;
    constructor(label, collapsibleState, serverItemType, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.serverItemType = serverItemType;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.ServerTreeItem = ServerTreeItem;
/**
 * Factory for creating server-related tree items
 */
class ServerItemFactory {
    /**
     * Create server configuration group item
     */
    static createConfigurationGroup() {
        console.log('SERVERS: Creating Server Configuration group item');
        return new ServerTreeItem('Server Configuration', vscode.TreeItemCollapsibleState.Collapsed, 'config-group', undefined, new vscode.ThemeIcon('settings-gear'), 'Configure server settings');
    }
    /**
     * Create start server option item
     */
    static createStartServerOption(port, httpMode) {
        console.log(`SERVERS: Creating Start Local Server option for port ${port} (${httpMode})`);
        return new ServerTreeItem('Start Local Server', vscode.TreeItemCollapsibleState.None, 'launch-option', {
            command: 'codexr.server.launch',
            title: 'Start Local Server'
        }, new vscode.ThemeIcon('play'), `Start server on port ${port} (${httpMode})`);
    }
    /**
     * Create configuration option items
     */
    static createConfigurationOptions() {
        console.log('SERVERS: Creating server configuration option items');
        const config = getServerConfig();
        return [
            new ServerTreeItem(`HTTP Mode: ${config.httpMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.httpMode',
                title: 'Configure HTTP Mode'
            }, new vscode.ThemeIcon(config.httpMode === 'HTTP' ? 'unlock' : 'lock'), `Click to change server mode (currently: ${config.httpMode})`),
            new ServerTreeItem(`Default Port: ${config.port}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.port',
                title: 'Configure Port'
            }, new vscode.ThemeIcon('symbol-numeric'), `Click to change default port (currently: ${config.port})`),
            new ServerTreeItem(`Auto-Open: ${config.autoOpen ? 'Enabled' : 'Disabled'}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.autoOpen',
                title: 'Toggle Auto-Open'
            }, new vscode.ThemeIcon(config.autoOpen ? 'check' : 'x'), `Click to toggle auto-open (currently: ${config.autoOpen ? 'enabled' : 'disabled'})`),
            new ServerTreeItem(`Open Mode: ${config.openMode}`, vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.openMode',
                title: 'Configure Open Mode'
            }, new vscode.ThemeIcon('window'), `Click to change open mode (currently: ${config.openMode})`),
            new ServerTreeItem('Reset to Default', vscode.TreeItemCollapsibleState.None, 'config-option', {
                command: 'codexr.server.config.resetToDefault',
                title: 'Reset to Default Settings'
            }, new vscode.ThemeIcon('refresh'), 'Reset all server configuration to default values')
        ];
    }
}
exports.ServerItemFactory = ServerItemFactory;
//# sourceMappingURL=serverItems.js.map