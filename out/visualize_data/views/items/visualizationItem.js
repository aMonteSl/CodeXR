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
exports.BrowseVisualizationItemFactory = exports.BrowseVisualizationTreeItem = void 0;
const vscode = __importStar(require("vscode"));
/**
 * Tree item for browse visualizations
 */
class BrowseVisualizationTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    visualization;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, visualization, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.visualization = visualization;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.BrowseVisualizationTreeItem = BrowseVisualizationTreeItem;
/**
 * Factory for creating browse visualization items
 */
class BrowseVisualizationItemFactory {
    /**
     * Create browse visualizations section
     */
    static createBrowseVisualizationsSection() {
        return new BrowseVisualizationTreeItem('Browse Visualizations', vscode.TreeItemCollapsibleState.Expanded, 'browse-section', undefined, undefined, new vscode.ThemeIcon('folder-opened'), 'Browse previously generated visualizations', undefined, 'browse-visualizations-section');
    }
    /**
     * Create items for stored visualizations
     */
    static createStoredVisualizationItems(visualizations) {
        if (visualizations.length === 0) {
            return [
                new BrowseVisualizationTreeItem('No visualizations found', vscode.TreeItemCollapsibleState.None, 'stored-visualization', undefined, undefined, new vscode.ThemeIcon('info'), 'No stored visualizations available. Generate some visualizations first.', undefined, 'no-visualizations')
            ];
        }
        return visualizations.map(visualization => {
            const isValid = visualization.isValid;
            const icon = isValid ? new vscode.ThemeIcon('play') : new vscode.ThemeIcon('warning');
            const tooltip = isValid
                ? `Launch visualization: ${visualization.name}\nPath: ${visualization.folderPath}`
                : `Invalid visualization: ${visualization.name}\nMissing required files in: ${visualization.folderPath}`;
            const description = isValid ? undefined : '⚠️ Invalid';
            return new BrowseVisualizationTreeItem(visualization.name, vscode.TreeItemCollapsibleState.None, 'stored-visualization', visualization, isValid ? {
                command: 'codeXR.browseVisualizations.launch',
                title: 'Launch Visualization',
                arguments: [visualization]
            } : undefined, icon, tooltip, description, 'stored-visualization');
        });
    }
    /**
     * Create reset all visualizations item
     */
    static createResetAllItem() {
        return new BrowseVisualizationTreeItem('Reset All Visualizations', vscode.TreeItemCollapsibleState.None, 'stored-visualization', undefined, {
            command: 'codeXR.browseVisualizations.resetAll',
            title: 'Reset All Visualizations',
            arguments: []
        }, new vscode.ThemeIcon('trash'), 'Delete all stored visualizations', undefined, 'reset-all-visualizations');
    }
}
exports.BrowseVisualizationItemFactory = BrowseVisualizationItemFactory;
//# sourceMappingURL=visualizationItem.js.map