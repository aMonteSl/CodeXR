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
exports.ActiveServersSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const activeServerItems_1 = require("./items/activeServerItems");
const handleActiveServerClicks_1 = require("./interactions/handleActiveServerClicks");
const activeServerRegistry_1 = require("../../active_servers/registry/activeServerRegistry");
/**
 * Active Servers section provider - manages running servers display and control
 */
class ActiveServersSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    constructor(context) {
        this.context = context;
        console.log('ACTIVE_SERVERS_MODULAR: Initializing Active Servers section provider');
        this.clickHandler = new handleActiveServerClicks_1.ActiveServerClickHandler(context);
        // Listen to registry changes for active servers
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        console.log(`ACTIVE_SERVERS_MODULAR: Connected to active server registry, current servers: ${registry.getAllServers().length}`);
        registry.onRegistryChange(() => {
            console.log('ACTIVE_SERVERS_MODULAR: Active servers registry changed, refreshing section');
            this.refresh();
        });
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'activeServers';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const activeServers = registry.getAllServers();
        const runningCount = activeServers.filter(server => server.status === 'running').length;
        const title = runningCount > 0
            ? `ACTIVE SERVERS (${runningCount} running)`
            : 'ACTIVE SERVERS';
        return new activeServerItems_1.ActiveServerTreeItem(title, vscode.TreeItemCollapsibleState.Expanded, 'no-servers', // Using this as section header type
        undefined, new vscode.ThemeIcon('server-process'), 'Currently running servers', undefined, 'activeServersSection');
    }
    /**
     * Get children items for the Active Servers section
     */
    async getChildren(element) {
        // If element is provided, it means we're getting children for a specific item
        // For the Active Servers section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }
        console.log('ACTIVE_SERVERS_MODULAR: Loading active servers section children');
        const registry = (0, activeServerRegistry_1.getActiveServerRegistry)();
        const activeServers = registry.getAllServers();
        const runningServers = activeServers.filter(server => server.status === 'running');
        console.log(`ACTIVE_SERVERS_MODULAR: Found ${activeServers.length} total servers, ${runningServers.length} running`);
        // Show "No active servers" message if no servers exist
        if (activeServers.length === 0) {
            console.log('ACTIVE_SERVERS_MODULAR: No servers found, showing "No active servers" message');
            return [activeServerItems_1.ActiveServerItemFactory.createNoServersItem()];
        }
        const children = [];
        // Add "Stop All Servers" option if there are 2 or more running servers
        if (runningServers.length >= 2) {
            console.log(`ACTIVE_SERVERS_MODULAR: Adding "Stop All Servers" option for ${runningServers.length} running servers`);
            children.push(activeServerItems_1.ActiveServerItemFactory.createStopAllServersItem(runningServers.length));
        }
        // Add individual server items
        console.log(`ACTIVE_SERVERS_MODULAR: Creating ${activeServers.length} individual server items`);
        const serverItems = activeServers.map(server => activeServerItems_1.ActiveServerItemFactory.createServerItem(server));
        children.push(...serverItems);
        console.log(`ACTIVE_SERVERS_MODULAR: Returning ${children.length} children for Active Servers section`);
        return children;
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('ACTIVE_SERVERS_MODULAR: Refreshing Active Servers section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleActiveServerClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.ActiveServersSectionProvider = ActiveServersSectionProvider;
//# sourceMappingURL=ActiveServersSectionProvider.js.map