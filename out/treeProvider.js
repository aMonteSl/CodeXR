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
exports.LocalServerProvider = exports.TreeItemType = void 0;
const vscode = __importStar(require("vscode")); // Import VS Code API
const fs = __importStar(require("fs")); // For file verification
const path = __importStar(require("path")); // For path handling
const server_1 = require("./server"); // For server functionality
const chartModel_1 = require("./models/chartModel"); // For chart types
const serverModel_1 = require("./models/serverModel"); // For server models
// Types of tree items for context handling
var TreeItemType;
(function (TreeItemType) {
    TreeItemType["SERVERS_SECTION"] = "servers-section";
    TreeItemType["BABIAXR_SECTION"] = "babiaxr-section";
    TreeItemType["SERVER_CONFIG"] = "server-config";
    TreeItemType["SERVER_MODE"] = "server-mode";
    TreeItemType["START_SERVER"] = "start-server";
    TreeItemType["ACTIVE_SERVER"] = "active-server";
    TreeItemType["SERVERS_CONTAINER"] = "servers-container";
    TreeItemType["CREATE_VISUALIZATION"] = "create-visualization";
    TreeItemType["CHART_TYPE"] = "chart-type";
})(TreeItemType || (exports.TreeItemType = TreeItemType = {}));
/**
 * Tree data provider implementation for the sidebar view
 */
class LocalServerProvider {
    // Event emitter to notify data changes
    _onDidChangeTreeData = new vscode.EventEmitter();
    // Event that VS Code listens to for view updates
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    // Extension context for storage access
    context;
    constructor(context) {
        this.context = context;
        // Initialize with default values if no previous configuration exists
        if (!this.context.globalState.get('serverMode')) {
            this.context.globalState.update('serverMode', serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS);
        }
    }
    /**
     * Refreshes the tree view
     */
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    /**
     * Returns the UI element for an item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Gets the child elements of an element or root elements
     */
    getChildren(element) {
        if (!element) {
            // Root elements - Main sections
            return Promise.resolve([
                new SectionItem("Servers", "Local server management", TreeItemType.SERVERS_SECTION, vscode.TreeItemCollapsibleState.Expanded),
                new SectionItem("BabiaXR Visualizations", "Create 3D data visualizations", TreeItemType.BABIAXR_SECTION, vscode.TreeItemCollapsibleState.Expanded)
            ]);
        }
        // Handle child nodes based on parent element type
        switch (element.contextValue) {
            case TreeItemType.SERVERS_SECTION:
                return this.getServersSectionChildren();
            case TreeItemType.BABIAXR_SECTION:
                return this.getBabiaXRSectionChildren();
            case TreeItemType.SERVER_CONFIG:
                return this.getServerConfigChildren();
            case TreeItemType.SERVERS_CONTAINER:
                return this.getActiveServersChildren();
            case TreeItemType.CREATE_VISUALIZATION:
                return this.getChartTypesChildren();
            default:
                return Promise.resolve([]);
        }
    }
    /**
     * Gets the child elements of the servers section
     */
    getServersSectionChildren() {
        const currentMode = this.context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Check if default certificates exist
        const extensionPath = this.context.extensionPath;
        const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
        const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
        const defaultCertsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);
        // Get active servers
        const activeServers = (0, server_1.getActiveServers)();
        const children = [
            new ServerConfigItem(this.context, currentMode),
            new StartServerItem(currentMode, defaultCertsExist)
        ];
        // If there are active servers, add the servers container
        if (activeServers.length > 0) {
            children.push(new ActiveServersContainer(activeServers.length));
        }
        return Promise.resolve(children);
    }
    /**
     * Gets the child elements of the BabiaXR section
     */
    getBabiaXRSectionChildren() {
        return Promise.resolve([
            new CreateVisualizationItem()
            // You could add more items like "Recent Visualizations" if you implement them
        ]);
    }
    /**
     * Gets the server configuration options
     */
    getServerConfigChildren() {
        const currentMode = this.context.globalState.get('serverMode');
        return Promise.resolve([
            new ServerModeItem(serverModel_1.ServerMode.HTTP, this.context),
            new ServerModeItem(serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS, this.context),
            new ServerModeItem(serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS, this.context)
        ]);
    }
    /**
     * Gets the list of active servers
     */
    getActiveServersChildren() {
        const activeServers = (0, server_1.getActiveServers)();
        return Promise.resolve(activeServers.map(server => new ActiveServerItem(server)));
    }
    /**
     * Gets the available chart types
     */
    getChartTypesChildren() {
        return Promise.resolve([
            new ChartTypeItem(chartModel_1.ChartType.BAR_CHART, "Visualize categorical data with bars"),
            new ChartTypeItem(chartModel_1.ChartType.PIE_CHART, "Visualize proportions as circular sectors")
        ]);
    }
    /**
     * Changes the server mode
     */
    async changeServerMode(mode) {
        if (mode === serverModel_1.ServerMode.HTTP) {
            // Warn about limitations on VR devices
            const selection = await vscode.window.showWarningMessage('HTTP mode is not compatible with virtual reality devices due to security restrictions. ' +
                'Do you want to continue?', 'Yes, I understand', 'Cancel');
            if (selection !== 'Yes, I understand') {
                return;
            }
        }
        // Save the selected mode
        await this.context.globalState.update('serverMode', mode);
        this.refresh();
    }
}
exports.LocalServerProvider = LocalServerProvider;
/**
 * Base class for tree items
 */
class TreeItem extends vscode.TreeItem {
    constructor(label, tooltip, contextValue, collapsibleState, command, iconPath) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.contextValue = contextValue;
        this.command = command;
        if (iconPath) {
            this.iconPath = iconPath;
        }
    }
}
/**
 * Item for the main sections
 */
class SectionItem extends TreeItem {
    constructor(label, tooltip, contextValue, collapsibleState) {
        super(label, tooltip, contextValue, collapsibleState);
        // Assign icon based on section
        if (contextValue === TreeItemType.SERVERS_SECTION) {
            this.iconPath = new vscode.ThemeIcon('server');
        }
        else if (contextValue === TreeItemType.BABIAXR_SECTION) {
            this.iconPath = new vscode.ThemeIcon('graph');
        }
    }
}
/**
 * Item to start the server
 */
class StartServerItem extends TreeItem {
    constructor(currentMode, defaultCertsExist) {
        // Determine description type based on current mode
        let description;
        switch (currentMode) {
            case serverModel_1.ServerMode.HTTP:
                description = "HTTP mode (no certificates)";
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                description = defaultCertsExist
                    ? "HTTPS with default certificates"
                    : "⚠️ Default certificates not found";
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                description = "HTTPS with custom certificates";
                break;
        }
        super('Start Local Server', 'Start server in ' + currentMode + ' mode\nSelect an HTML file to serve', TreeItemType.START_SERVER, vscode.TreeItemCollapsibleState.None, {
            command: 'integracionvsaframe.startServerWithConfig',
            title: 'Start Server'
        }, new vscode.ThemeIcon('play'));
        this.description = description;
        // Context for coloring the item in case of warning
        if (currentMode === serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist) {
            this.contextValue = 'warning';
        }
    }
}
/**
 * Item for server configuration
 */
class ServerConfigItem extends TreeItem {
    constructor(context, currentMode) {
        super('Server Configuration', 'Configuration for the local server', TreeItemType.SERVER_CONFIG, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('gear'));
        this.description = currentMode;
    }
}
/**
 * Item for each available server mode
 */
class ServerModeItem extends TreeItem {
    constructor(mode, context) {
        const currentMode = context.globalState.get('serverMode');
        let tooltip;
        let iconPath;
        // Set explanatory tooltip based on mode
        switch (mode) {
            case serverModel_1.ServerMode.HTTP:
                tooltip = 'Use simple HTTP (no encryption)\n⚠️ Does not work with VR devices';
                iconPath = new vscode.ThemeIcon('globe');
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                tooltip = 'Use HTTPS with certificates included in the extension';
                iconPath = new vscode.ThemeIcon('shield');
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                tooltip = 'Use HTTPS with custom certificates (you will need to select them)';
                iconPath = new vscode.ThemeIcon('key');
                break;
        }
        super(mode, tooltip, TreeItemType.SERVER_MODE, vscode.TreeItemCollapsibleState.None, {
            command: 'integracionvsaframe.changeServerMode',
            title: 'Change server mode',
            arguments: [mode]
        }, iconPath);
        // If it's the current mode, mark as selected
        if (mode === currentMode) {
            this.description = '✓ Selected';
        }
    }
}
/**
 * Item for the active servers container
 */
class ActiveServersContainer extends TreeItem {
    constructor(count) {
        super(`Active Servers (${count})`, 'Currently running servers', TreeItemType.SERVERS_CONTAINER, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('server-environment'));
    }
}
/**
 * Item for an active server
 */
class ActiveServerItem extends TreeItem {
    constructor(serverInfo) {
        super(path.basename(serverInfo.filePath), `${serverInfo.protocol.toUpperCase()} Server
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`, TreeItemType.ACTIVE_SERVER, vscode.TreeItemCollapsibleState.None, {
            command: 'integracionvsaframe.serverOptions',
            title: 'Server Options',
            arguments: [serverInfo]
        }, new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe'));
        this.description = serverInfo.url;
    }
}
/**
 * Item to create a BabiaXR visualization
 */
class CreateVisualizationItem extends TreeItem {
    constructor() {
        super('Create Visualization', 'Select a visualization type for BabiaXR', TreeItemType.CREATE_VISUALIZATION, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('add'));
    }
}
/**
 * Item for a BabiaXR chart type
 */
class ChartTypeItem extends TreeItem {
    constructor(chartType, tooltip) {
        super(chartType, tooltip, TreeItemType.CHART_TYPE, vscode.TreeItemCollapsibleState.None, {
            command: 'integracionvsaframe.createBabiaXRVisualization',
            title: `Create ${chartType}`,
            arguments: [chartType]
        }, new vscode.ThemeIcon('graph'));
    }
}
//# sourceMappingURL=treeProvider.js.map