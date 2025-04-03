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
        const isColor = label.includes('Color');
        super(label, tooltip, treeProvider_1.TreeItemType.BABIAXR_CONFIG_ITEM, vscode.TreeItemCollapsibleState.None, {
            command: command,
            title: 'Configure ' + label,
            arguments: []
        }, 
        // Use the appropriate icon
        isColor ?
            new vscode.ThemeIcon('symbol-color') :
            new vscode.ThemeIcon('symbol-property'));
        // For color values, add a color emoji indicator based on the color's hue
        if (isColor && currentValue && currentValue.startsWith('#')) {
            // Get a matching emoji for the color
            const colorEmoji = getColorEmoji(currentValue);
            this.description = `${currentValue} ${colorEmoji}`;
        }
        else {
            this.description = currentValue;
        }
    }
}
exports.BabiaXRConfigOption = BabiaXRConfigOption;
/**
 * Gets a matching emoji for a hex color
 */
function getColorEmoji(hexColor) {
    // Parse the color to get RGB values
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    // Get hue from RGB
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    // Grayscale check
    if (max - min < 30) {
        if (max < 60)
            return '⬛'; // Black
        if (max < 180)
            return '⬜'; // Gray 
        return '⬜'; // White
    }
    // Calculate hue
    let hue = 0;
    if (max === r) {
        hue = (g - b) / (max - min) * 60;
        if (hue < 0)
            hue += 360;
    }
    else if (max === g) {
        hue = ((b - r) / (max - min) * 60) + 120;
    }
    else {
        hue = ((r - g) / (max - min) * 60) + 240;
    }
    // Map hue to emoji
    if (hue < 30 || hue >= 330)
        return '🟥'; // Red
    if (hue < 60)
        return '🟧'; // Orange
    if (hue < 90)
        return '🟨'; // Yellow
    if (hue < 180)
        return '🟩'; // Green
    if (hue < 270)
        return '🟦'; // Blue
    return '🟪'; // Purple
}
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