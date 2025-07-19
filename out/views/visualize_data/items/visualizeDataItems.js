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
exports.VisualizeDataModularItemFactory = exports.VisualizeDataModularTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const visualizeDataItems_1 = require("../../../visualize_data/views/items/visualizeDataItems");
const visualizationRestorer_1 = require("../../../visualize_data/runtime/visualizationRestorer");
const visualizationItem_1 = require("../../../visualize_data/views/items/visualizationItem");
/**
 * Visualize Data tree items for the Visualize Data section
 */
class VisualizeDataModularTreeItem extends vscode.TreeItem {
    visualizeDataItemType;
    visualizeDataItem;
    constructor(label, collapsibleState, visualizeDataItemType, command, iconPath, tooltip, description, contextValue, visualizeDataItem) {
        super(label, collapsibleState);
        this.visualizeDataItemType = visualizeDataItemType;
        this.visualizeDataItem = visualizeDataItem;
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip || label;
        this.description = description;
        this.contextValue = contextValue;
    }
}
exports.VisualizeDataModularTreeItem = VisualizeDataModularTreeItem;
/**
 * Factory for creating Visualize Data-related tree items
 */
class VisualizeDataModularItemFactory {
    /**
     * Create "Error loading visualize data" message item
     */
    static createErrorItem() {
        console.log('VISUALIZE_DATA_MODULAR: Creating error loading visualize data item');
        return new VisualizeDataModularTreeItem('Error loading visualize data', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load visualize data items');
    }
    /**
     * Create main visualize data items
     */
    static createVisualizeDataItems(context) {
        console.log('VISUALIZE_DATA_MODULAR: Creating visualize data items');
        try {
            const visualizeDataItems = visualizeDataItems_1.VisualizeDataItemFactory.createVisualizeDataItems(context);
            const children = visualizeDataItems.map(item => {
                // Handle collapsible dimension mapping and browse visualizations
                let collapsibleState = vscode.TreeItemCollapsibleState.None;
                let itemType = item.type;
                if (item.type === 'dimension-mapping' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                else if (item.type === 'browse-visualizations' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
                return new VisualizeDataModularTreeItem(item.label, collapsibleState, itemType, item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} visualize data items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating visualize data items:', error);
            return [VisualizeDataModularItemFactory.createErrorItem()];
        }
    }
    /**
     * Create dimension mapping sub-items
     */
    static createDimensionMappingItems(context, state) {
        console.log('VISUALIZE_DATA_MODULAR: Creating dimension mapping items');
        try {
            // Provide a default state if none provided
            const stateToUse = state || {
                selectedChart: undefined,
                selectedJsonPath: undefined,
                selectedJsonName: undefined,
                jsonAnalysis: undefined,
                dimensionMappings: [],
                isDimensionMappingConfigured: false,
                isReadyToLaunch: false
            };
            const dimensionItems = visualizeDataItems_1.VisualizeDataItemFactory.createDimensionItems(stateToUse);
            const children = dimensionItems.map(item => {
                return new VisualizeDataModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'dimension-item', item.command, item.iconPath, item.tooltip, item.description, item.contextValue, item);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} dimension mapping items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error creating dimension mapping items:', error);
            return [new VisualizeDataModularTreeItem('Error loading dimensions', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load dimension items')];
        }
    }
    /**
     * Create browse visualizations sub-items
     */
    static async createBrowseVisualizationItems(context) {
        console.log('VISUALIZE_DATA_MODULAR: Creating browse visualization items');
        try {
            const visualizationRestorer = new visualizationRestorer_1.VisualizationRestorer(context);
            // Scan for stored visualizations
            const visualizations = await visualizationRestorer.scanStoredVisualizations();
            // Create items for visualizations
            const visualizationItems = visualizationItem_1.BrowseVisualizationItemFactory.createStoredVisualizationItems(visualizations);
            // Add reset button if there are visualizations
            if (visualizations.length > 0) {
                visualizationItems.push(visualizationItem_1.BrowseVisualizationItemFactory.createResetAllItem());
            }
            // Convert to modular tree items
            const children = visualizationItems.map((item) => {
                return new VisualizeDataModularTreeItem(item.label, vscode.TreeItemCollapsibleState.None, 'stored-visualization', item.command, item.iconPath, item.tooltip, item.description, item.contextValue);
            });
            console.log(`VISUALIZE_DATA_MODULAR: Created ${children.length} browse visualization items`);
            return children;
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading browse visualizations:', error);
            return [new VisualizeDataModularTreeItem('Error loading visualizations', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load stored visualizations')];
        }
    }
}
exports.VisualizeDataModularItemFactory = VisualizeDataModularItemFactory;
//# sourceMappingURL=visualizeDataItems.js.map