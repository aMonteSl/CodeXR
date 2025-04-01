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
exports.BabiaXRSectionItem = exports.BabiaXRConfigOption = exports.BabiaXRConfigItem = exports.ChartTypeItem = exports.CreateVisualizationItem = void 0;
const vscode = __importStar(require("vscode"));
const baseItems_1 = require("./baseItems");
const treeProvider_1 = require("../treeProvider");
/**
 * Item to create a BabiaXR visualization
 */
class CreateVisualizationItem extends baseItems_1.TreeItem {
    constructor() {
        super('Create Visualization', 'Select a visualization type for BabiaXR', treeProvider_1.TreeItemType.CREATE_VISUALIZATION, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('add'));
    }
}
exports.CreateVisualizationItem = CreateVisualizationItem;
/**
 * Item for a BabiaXR chart type
 */
class ChartTypeItem extends baseItems_1.TreeItem {
    constructor(chartType, tooltip) {
        super(chartType, tooltip, treeProvider_1.TreeItemType.CHART_TYPE, vscode.TreeItemCollapsibleState.None, {
            command: 'integracionvsaframe.createBabiaXRVisualization',
            title: `Create ${chartType}`,
            arguments: [chartType]
        }, new vscode.ThemeIcon('graph'));
    }
}
exports.ChartTypeItem = ChartTypeItem;
/**
 * Represents the BabiaXR configuration item in the tree
 */
class BabiaXRConfigItem extends baseItems_1.TreeItem {
    constructor(context) {
        super('Visualization Settings', 'Default settings for BabiaXR visualizations', treeProvider_1.TreeItemType.BABIAXR_CONFIG, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('settings-gear'));
    }
}
exports.BabiaXRConfigItem = BabiaXRConfigItem;
/**
 * Represents a BabiaXR configuration option in the tree
 */
class BabiaXRConfigOption extends baseItems_1.TreeItem {
    constructor(label, tooltip, command, currentValue) {
        super(label, tooltip, treeProvider_1.TreeItemType.BABIAXR_CONFIG_ITEM, vscode.TreeItemCollapsibleState.None, {
            command: command,
            title: 'Configure ' + label,
            arguments: []
        }, new vscode.ThemeIcon('symbol-color'));
        this.description = currentValue;
    }
}
exports.BabiaXRConfigOption = BabiaXRConfigOption;
/**
 * Section item for BabiaXR
 */
class BabiaXRSectionItem extends baseItems_1.TreeItem {
    constructor() {
        super('BabiaXR', 'Create and configure BabiaXR visualizations', treeProvider_1.TreeItemType.BABIAXR_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('graph'));
    }
}
exports.BabiaXRSectionItem = BabiaXRSectionItem;
//# sourceMappingURL=chartItems.js.map