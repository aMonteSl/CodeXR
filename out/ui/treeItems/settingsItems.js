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
exports.VisualizationSettingsItem = void 0;
const vscode = __importStar(require("vscode"));
const baseItems_1 = require("./baseItems");
const treeProvider_1 = require("../treeProvider");
const chartItems_1 = require("./chartItems"); // Fixed import path
/**
 * Top-level Visualization Settings item for the tree view
 */
class VisualizationSettingsItem extends baseItems_1.TreeItem {
    constructor(context) {
        super('Visualization Settings', 'Configure visualization environment and appearance', treeProvider_1.TreeItemType.VISUALIZATION_SETTINGS, // Now this will be a string
        vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('settings-gear') // Cambiado de 'paintcan' a 'settings-gear'
        );
        this.context = context;
    }
    context;
    /**
     * Gets the children of this item
     * @returns Tree items for visualization settings
     */
    getChildren() {
        const bgColor = this.context.globalState.get('babiaBackgroundColor') || '#112233';
        const envPreset = this.context.globalState.get('babiaEnvironmentPreset') || 'forest';
        const groundColor = this.context.globalState.get('babiaGroundColor') || '#445566';
        const chartPalette = this.context.globalState.get('babiaChartPalette') || 'ubuntu';
        return Promise.resolve([
            new chartItems_1.BabiaXRConfigOption('Background Color', 'Set default background color for visualizations', 'codexr.setBackgroundColor', bgColor),
            new chartItems_1.BabiaXRConfigOption('Environment Preset', 'Set default environment preset', 'codexr.setEnvironmentPreset', envPreset),
            new chartItems_1.BabiaXRConfigOption('Ground Color', 'Set default ground color', 'codexr.setGroundColor', groundColor),
            new chartItems_1.BabiaXRConfigOption('Chart Palette', 'Set default color palette for charts', 'codexr.setChartPalette', chartPalette)
        ]);
    }
}
exports.VisualizationSettingsItem = VisualizationSettingsItem;
//# sourceMappingURL=settingsItems.js.map