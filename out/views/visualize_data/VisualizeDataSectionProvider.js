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
exports.VisualizeDataSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const visualizeDataItems_1 = require("./items/visualizeDataItems");
const handleVisualizeDataClicks_1 = require("./interactions/handleVisualizeDataClicks");
const visualizeDataState_1 = require("../../visualize_data/state/visualizeDataState");
/**
 * Visualize Data section provider - manages data visualization configuration and launch
 */
class VisualizeDataSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZE_DATA_MODULAR: Initializing Visualize Data section provider');
        this.clickHandler = new handleVisualizeDataClicks_1.VisualizeDataClickHandler(context);
        // Listen to state changes if state manager is available
        if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
            const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
            stateManager.onStateChanged(() => {
                console.log('VISUALIZE_DATA_MODULAR: Visualize data state changed, refreshing section');
                this.refresh();
            });
        }
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'visualizeData';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new visualizeDataItems_1.VisualizeDataModularTreeItem('VISUALIZE DATA', vscode.TreeItemCollapsibleState.Collapsed, 'error', // Using this as section header type
        undefined, new vscode.ThemeIcon('chart-scatter'), 'Data visualization configuration and launch', undefined, 'visualizeDataSection');
    }
    /**
     * Get children items for the Visualize Data section
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return main visualize data items
            console.log('VISUALIZE_DATA_MODULAR: Loading visualize data section children');
            return visualizeDataItems_1.VisualizeDataModularItemFactory.createVisualizeDataItems(this.context);
        }
        // Handle sub-items for collapsible sections
        switch (element.visualizeDataItemType) {
            case 'dimension-mapping':
                return this.getDimensionMappingChildren();
            case 'browse-visualizations':
                return this.getBrowseVisualizationChildren();
            default:
                // Most items don't have children
                return [];
        }
    }
    /**
     * Get dimension mapping children
     */
    getDimensionMappingChildren() {
        console.log('VISUALIZE_DATA_MODULAR: Loading dimension mapping children');
        try {
            // Get current state if available
            let state = undefined;
            if (visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                const stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(this.context);
                state = stateManager.getState();
            }
            return visualizeDataItems_1.VisualizeDataModularItemFactory.createDimensionMappingItems(this.context, state);
        }
        catch (error) {
            console.error('VISUALIZE_DATA_MODULAR: Error loading dimension mapping items:', error);
            return [new visualizeDataItems_1.VisualizeDataModularTreeItem('Error loading dimensions', vscode.TreeItemCollapsibleState.None, 'error', undefined, new vscode.ThemeIcon('error'), 'Failed to load dimension items')];
        }
    }
    /**
     * Get browse visualization children
     */
    async getBrowseVisualizationChildren() {
        console.log('VISUALIZE_DATA_MODULAR: Loading browse visualization children');
        return visualizeDataItems_1.VisualizeDataModularItemFactory.createBrowseVisualizationItems(this.context);
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('VISUALIZE_DATA_MODULAR: Refreshing Visualize Data section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleVisualizeDataClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
exports.VisualizeDataSectionProvider = VisualizeDataSectionProvider;
//# sourceMappingURL=VisualizeDataSectionProvider.js.map