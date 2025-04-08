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
const serverModel_1 = require("../server/models/serverModel");
const analysisTreeProvider_1 = require("../analysis/providers/analysisTreeProvider");
const babiaTreeProvider_1 = require("../babiaxr/providers/babiaTreeProvider");
const serverTreeProvider_1 = require("../server/providers/serverTreeProvider");
// Types of tree items for context handling
var TreeItemType;
(function (TreeItemType) {
    TreeItemType["SERVERS_SECTION"] = "servers-section";
    TreeItemType["BABIAXR_SECTION"] = "babiaxr-section";
    TreeItemType["SERVER_CONFIG"] = "server-config";
    TreeItemType["SERVER_MODE"] = "server-mode";
    TreeItemType["START_SERVER"] = "start-server";
    TreeItemType["ACTIVE_SERVER"] = "active-server";
    TreeItemType["SERVERS_CONTAINER"] = "serverContainer";
    TreeItemType["CHART_TYPE"] = "chart-type";
    TreeItemType["CREATE_VISUALIZATION"] = "create-visualization";
    TreeItemType["BABIAXR_CONFIG"] = "babiaxr-config";
    TreeItemType["BABIAXR_CONFIG_ITEM"] = "babiaxr-config-item";
    TreeItemType["BABIAXR_EXAMPLES_CONTAINER"] = "babiaxr-examples-container";
    TreeItemType["BABIAXR_EXAMPLE"] = "babiaxr-example";
    TreeItemType["BABIAXR_EXAMPLE_CATEGORY"] = "example-category";
    TreeItemType["JS_FILE"] = "js-file";
    TreeItemType["JS_FILES_CONTAINER"] = "js-files-container";
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
    // Specialized tree providers
    analysisTreeProvider;
    babiaTreeProvider;
    serverTreeProvider;
    constructor(context) {
        this.context = context;
        // Initialize specialized providers
        this.analysisTreeProvider = new analysisTreeProvider_1.AnalysisTreeProvider(context);
        this.babiaTreeProvider = new babiaTreeProvider_1.BabiaTreeProvider(context);
        this.serverTreeProvider = new serverTreeProvider_1.ServerTreeProvider(context);
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
                return this.serverTreeProvider.getServersChildren();
            case TreeItemType.BABIAXR_SECTION:
                return this.babiaTreeProvider.getBabiaXRChildren();
            case TreeItemType.SERVER_CONFIG:
                return this.serverTreeProvider.getServerConfigChildren();
            case TreeItemType.SERVERS_CONTAINER:
                return this.serverTreeProvider.getActiveServersChildren();
            case TreeItemType.BABIAXR_CONFIG:
                return this.babiaTreeProvider.getBabiaXRConfigChildren();
            case TreeItemType.BABIAXR_EXAMPLES_CONTAINER:
                return this.babiaTreeProvider.getBabiaXRExamplesChildren();
            case TreeItemType.CREATE_VISUALIZATION:
                return this.babiaTreeProvider.getCreateVisualizationChildren();
            case TreeItemType.BABIAXR_EXAMPLE_CATEGORY:
                if (element.children && element.children.length > 0) {
                    return Promise.resolve(element.children);
                }
                return Promise.resolve([]);
            case TreeItemType.JS_FILES_CONTAINER:
                return this.analysisTreeProvider.getJavaScriptFilesChildren();
            default:
                return Promise.resolve([]);
        }
    }
    /**
     * Gets the root elements
     */
    getRootChildren() {
        return Promise.resolve([
            this.serverTreeProvider.getServersSectionItem(),
            this.babiaTreeProvider.getBabiaXRSectionItem(),
            this.analysisTreeProvider.getJavaScriptFilesContainer()
        ]);
    }
    /**
     * Changes the server mode - delegated to ServerTreeProvider
     */
    async changeServerMode(mode) {
        await this.serverTreeProvider.changeServerMode(mode);
        this.refresh();
    }
}
exports.LocalServerProvider = LocalServerProvider;
//# sourceMappingURL=treeProvider.js.map