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
const vscode = __importStar(require("vscode"));
const serverManager_1 = require("../server/serverManager");
const chartModel_1 = require("../models/chartModel");
const serverModel_1 = require("../models/serverModel");
const certificateManager_1 = require("../server/certificateManager");
// Import tree items from separate modules
const baseItems_1 = require("./treeItems/baseItems");
const serverItems_1 = require("./treeItems/serverItems");
const chartItems_1 = require("./treeItems/chartItems");
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
    TreeItemType["CHART_TYPE"] = "chart-type";
    TreeItemType["CREATE_VISUALIZATION"] = "create-visualization";
    // Add new types
    TreeItemType["BABIAXR_CONFIG"] = "babiaxr-config";
    TreeItemType["BABIAXR_CONFIG_ITEM"] = "babiaxr-config-item";
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
            return this.getRootChildren();
        }
        switch (element.contextValue) {
            case TreeItemType.SERVERS_SECTION:
                return this.getServersChildren();
            case TreeItemType.BABIAXR_SECTION:
                return this.getBabiaXRChildren();
            case TreeItemType.SERVER_CONFIG:
                return this.getServerConfigChildren();
            case TreeItemType.SERVERS_CONTAINER:
                return this.getActiveServersChildren();
            case TreeItemType.BABIAXR_CONFIG:
                return this.getBabiaXRConfigChildren();
            default:
                return Promise.resolve([]);
        }
    }
    /**
     * Gets the root elements
     */
    getRootChildren() {
        return Promise.resolve([
            new baseItems_1.SectionItem("Servers", "Local server management", TreeItemType.SERVERS_SECTION, vscode.TreeItemCollapsibleState.Expanded),
            new baseItems_1.SectionItem("BabiaXR Visualizations", "Create 3D data visualizations", TreeItemType.BABIAXR_SECTION, vscode.TreeItemCollapsibleState.Expanded)
        ]);
    }
    /**
     * Gets the child elements of the servers section
     */
    getServersChildren() {
        const currentMode = this.context.globalState.get('serverMode') ||
            serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        // Check if default certificates exist
        const defaultCertsExist = (0, certificateManager_1.defaultCertificatesExist)(this.context);
        // Get active servers
        const activeServers = (0, serverManager_1.getActiveServers)();
        const children = [
            new serverItems_1.ServerConfigItem(this.context, currentMode),
            new serverItems_1.StartServerItem(currentMode, defaultCertsExist)
        ];
        // If there are active servers, add the servers container
        if (activeServers.length > 0) {
            children.push(new serverItems_1.ActiveServersContainer(activeServers.length));
        }
        return Promise.resolve(children);
    }
    /**
     * Gets the child elements of the BabiaXR section
     */
    getBabiaXRChildren() {
        // Instead of spreading the promise directly, use Promise.all to handle it properly
        return Promise.all([
            Promise.resolve([
                new chartItems_1.BabiaXRConfigItem(this.context),
                new chartItems_1.CreateVisualizationItem()
            ]),
            this.getChartTypesChildren()
        ]).then(([configItems, chartTypes]) => {
            // Now we can safely concatenate the resolved arrays
            return [...configItems, ...chartTypes];
        });
    }
    /**
     * Gets the server configuration options
     */
    getServerConfigChildren() {
        const currentMode = this.context.globalState.get('serverMode');
        return Promise.resolve([
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTP, this.context),
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS, this.context),
            new serverItems_1.ServerModeItem(serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS, this.context)
        ]);
    }
    /**
     * Gets the list of active servers
     */
    getActiveServersChildren() {
        const activeServers = (0, serverManager_1.getActiveServers)();
        return Promise.resolve(activeServers.map(server => new serverItems_1.ActiveServerItem(server)));
    }
    /**
     * Gets the available chart types
     */
    getChartTypesChildren() {
        return Promise.resolve([
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.BARSMAP_CHART, "Visualize data with 3D bars in a map layout"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.BARS_CHART, "Visualize data with simple 2D bars"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.CYLS_CHART, "Visualize data with cylinder-shaped bars"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.PIE_CHART, "Visualize proportions as circular sectors"),
            new chartItems_1.ChartTypeItem(chartModel_1.ChartType.DONUT_CHART, "Visualize proportions with a hole in the center")
        ]);
    }
    /**
     * Gets the BabiaXR configuration options
     */
    getBabiaXRConfigChildren() {
        // Get saved configuration values or use defaults
        const bgColor = this.context.globalState.get('babiaBackgroundColor') || '#112233';
        const envPreset = this.context.globalState.get('babiaEnvironmentPreset') || 'forest';
        const groundColor = this.context.globalState.get('babiaGroundColor') || '#445566';
        const chartPalette = this.context.globalState.get('babiaChartPalette') || 'ubuntu';
        return Promise.resolve([
            new chartItems_1.BabiaXRConfigOption('Background Color', 'Set default background color for visualizations', 'integracionvsaframe.setBabiaBackgroundColor', bgColor),
            new chartItems_1.BabiaXRConfigOption('Environment Preset', 'Set default environment preset', 'integracionvsaframe.setBabiaEnvironmentPreset', envPreset),
            new chartItems_1.BabiaXRConfigOption('Ground Color', 'Set default ground color', 'integracionvsaframe.setBabiaGroundColor', groundColor),
            new chartItems_1.BabiaXRConfigOption('Chart Palette', 'Set default color palette for charts', 'integracionvsaframe.setBabiaChartPalette', chartPalette)
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
//# sourceMappingURL=treeProvider.js.map