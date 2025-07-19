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
exports.ActiveServersCommands = void 0;
const vscode = __importStar(require("vscode"));
const handleServerActions_1 = require("../views/interactions/handleServerActions");
/**
 * Active Servers Commands
 * VS Code command definitions for active servers functionality
 */
class ActiveServersCommands {
    // Store tree data provider reference for refresh operations
    static treeDataProvider;
    /**
     * Register all active servers commands
     */
    static registerCommands(context, treeDataProvider) {
        console.log('ACTIVE_SERVER: Registering active servers commands');
        // Store the tree data provider reference
        this.treeDataProvider = treeDataProvider;
        // Command: Show server actions (from tree item click)
        const showServerActionsCmd = vscode.commands.registerCommand('codeXR.activeServers.showActions', async (serverId) => {
            await handleServerActions_1.ServerActionHandlers.showServerActions(serverId);
        });
        // Command: Open server in browser
        const openInBrowserCmd = vscode.commands.registerCommand('codeXR.activeServers.openInBrowser', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.openInBrowser(serverId);
            }
        });
        // Command: Open server in lateral panel
        const openInPanelCmd = vscode.commands.registerCommand('codeXR.activeServers.openInPanel', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.openInPanel(serverId);
            }
        });
        // Command: Copy server URL to clipboard
        const copyUrlCmd = vscode.commands.registerCommand('codeXR.activeServers.copyUrl', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.copyUrl(serverId);
            }
        });
        // Command: Stop specific server
        const stopServerCmd = vscode.commands.registerCommand('codeXR.activeServers.stopServer', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.stopServer(serverId);
            }
        });
        // Command: Show server details
        const showDetailsCmd = vscode.commands.registerCommand('codeXR.activeServers.showDetails', async (treeItem) => {
            const serverId = this.extractServerIdFromTreeItem(treeItem);
            if (serverId) {
                await handleServerActions_1.ServerActionHandlers.showServerDetails(serverId);
            }
        });
        // Command: Stop all servers
        const stopAllServersCmd = vscode.commands.registerCommand('codeXR.activeServers.stopAllServers', async () => {
            await handleServerActions_1.ServerActionHandlers.stopAllServers();
        });
        // Command: Refresh server statuses
        const refreshServersCmd = vscode.commands.registerCommand('codeXR.activeServers.refreshServers', async () => {
            // Use the unified tree data provider if available
            if (this.treeDataProvider && this.treeDataProvider.refresh) {
                console.log('ACTIVE_SERVER: Refreshing unified tree view');
                this.treeDataProvider.refresh();
            }
            else {
                console.log('ACTIVE_SERVER: Using fallback refresh handler');
                vscode.commands.executeCommand('codexr.tree.refresh');
            }
        });
        // Command: Open active servers view 
        const openViewCmd = vscode.commands.registerCommand('codeXR.activeServers.openView', async () => {
            await vscode.commands.executeCommand('codexrTree.focus');
        });
        // Register all commands with the extension context
        context.subscriptions.push(showServerActionsCmd, openInBrowserCmd, openInPanelCmd, copyUrlCmd, stopServerCmd, showDetailsCmd, stopAllServersCmd, refreshServersCmd, openViewCmd);
        console.log('ACTIVE_SERVER: Registered 9 active servers commands');
    }
    /**
     * Extract server ID from tree item context
     * @private
     */
    static extractServerIdFromTreeItem(treeItem) {
        // Handle different tree item formats
        if (treeItem && treeItem.server && treeItem.server.id) {
            console.log(`ACTIVE_SERVER: Extracted server ID from tree item: ${treeItem.server.id}`);
            return treeItem.server.id;
        }
        // Fallback: if treeItem is a string, use it directly (for backward compatibility)
        if (typeof treeItem === 'string') {
            console.log(`ACTIVE_SERVER: Using direct server ID: ${treeItem}`);
            return treeItem;
        }
        console.error('ACTIVE_SERVER: Could not extract server ID from tree item:', treeItem);
        return null;
    }
    /**
     * Get all command IDs for external reference
     */
    static getCommandIds() {
        return {
            showActions: 'codeXR.activeServers.showActions',
            openInBrowser: 'codeXR.activeServers.openInBrowser',
            openInPanel: 'codeXR.activeServers.openInPanel',
            copyUrl: 'codeXR.activeServers.copyUrl',
            stopServer: 'codeXR.activeServers.stopServer',
            showDetails: 'codeXR.activeServers.showDetails',
            stopAllServers: 'codeXR.activeServers.stopAllServers',
            refreshServers: 'codeXR.activeServers.refreshServers',
            openView: 'codeXR.activeServers.openView'
        };
    }
}
exports.ActiveServersCommands = ActiveServersCommands;
//# sourceMappingURL=activeServersCommands.js.map