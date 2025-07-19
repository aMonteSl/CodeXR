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
exports.ActiveServersTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const activeServerRegistry_1 = require("../registry/activeServerRegistry");
const serverItems_1 = require("./items/serverItems");
/**
 * Active Servers Tree Data Provider
 * Manages the tree view display of active servers
 */
class ActiveServersTreeDataProvider {
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor() {
        console.log('ACTIVE_SERVERS: Tree data provider initialized');
        // Listen to registry changes
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        registry.onRegistryChange(() => {
            console.log('ACTIVE_SERVERS: Registry changed, refreshing tree view');
            this.refresh();
        });
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for tree item
     */
    getChildren(element) {
        if (!element) {
            // Root level - return active servers directly
            console.log('ACTIVE_SERVERS: Loading active servers');
            return this.getServerItems();
        }
        // Server items have no children
        return Promise.resolve([]);
    }
    /**
     * Refresh the tree view
     */
    refresh() {
        console.log('ACTIVE_SERVERS: Refreshing tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get server items
     * @private
     */
    getServerItems() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const servers = registry.getServersByStatus('running');
        if (servers.length === 0) {
            const noServersItem = serverItems_1.ServerItemFactory.createNoServersItem();
            return Promise.resolve([noServersItem]);
        }
        // Sort servers by port
        servers.sort((a, b) => a.port - b.port);
        const serverItems = servers.map(server => serverItems_1.ServerItemFactory.createServerItem(server));
        console.log(`ACTIVE_SERVERS: Created ${serverItems.length} server items`);
        return Promise.resolve(serverItems);
    }
    /**
     * Get server item by server ID
     */
    getServerItem(serverId) {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const server = registry.getServer(serverId);
        if (!server) {
            return undefined;
        }
        return serverItems_1.ServerItemFactory.createServerItem(server);
    }
    /**
     * Check if tree view has content
     */
    hasContent() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        return registry.getRunningServerCount() > 0;
    }
    /**
     * Get tree view statistics
     */
    getStats() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const stats = registry.getStats();
        return {
            totalServers: stats.total,
            runningServers: stats.running,
            hasContent: this.hasContent()
        };
    }
    /**
     * Dispose of the tree data provider
     */
    dispose() {
        this._onDidChangeTreeData.dispose();
        console.log('ACTIVE_SERVERS: Tree data provider disposed');
    }
}
exports.ActiveServersTreeDataProvider = ActiveServersTreeDataProvider;
//# sourceMappingURL=activeServersTreeView.js.map