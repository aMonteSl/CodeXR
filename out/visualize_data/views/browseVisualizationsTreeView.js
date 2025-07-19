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
exports.BrowseVisualizationsTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const visualizationRestorer_1 = require("../runtime/visualizationRestorer");
const visualizationItem_1 = require("./items/visualizationItem");
/**
 * Browse Visualizations Tree Data Provider
 * Provides tree view data for browsing stored visualizations
 */
class BrowseVisualizationsTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    restorer;
    visualizations = [];
    constructor(context) {
        this.context = context;
        this.restorer = new visualizationRestorer_1.VisualizationRestorer(context);
        console.log('BROWSE-VISUALIZATIONS: Tree data provider initialized');
        // Initial scan
        this.refresh();
    }
    /**
     * Refresh the tree view
     */
    async refresh() {
        console.log('BROWSE-VISUALIZATIONS: Refreshing tree view...');
        try {
            this.visualizations = await this.restorer.scanStoredVisualizations();
            this._onDidChangeTreeData.fire();
            console.log(`BROWSE-VISUALIZATIONS: Tree view refreshed with ${this.visualizations.length} visualizations`);
        }
        catch (error) {
            console.error('BROWSE-VISUALIZATIONS: Error refreshing tree view:', error);
        }
    }
    /**
     * Get tree item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for tree view
     */
    getChildren(element) {
        if (!element) {
            // Root level - return Browse Visualizations section
            return Promise.resolve([visualizationItem_1.BrowseVisualizationItemFactory.createBrowseVisualizationsSection()]);
        }
        if (element.type === 'browse-section') {
            // Return stored visualizations and reset option
            const visualizationItems = visualizationItem_1.BrowseVisualizationItemFactory.createStoredVisualizationItems(this.visualizations);
            // Add reset button if there are visualizations
            if (this.visualizations.length > 0) {
                visualizationItems.push(visualizationItem_1.BrowseVisualizationItemFactory.createResetAllItem());
            }
            return Promise.resolve(visualizationItems);
        }
        // No children for visualization items
        return Promise.resolve([]);
    }
    /**
     * Launch a visualization
     */
    async launchVisualization(visualization) {
        console.log(`BROWSE-VISUALIZATIONS: Launch requested for: ${visualization.name}`);
        await this.restorer.launchVisualization(visualization);
    }
    /**
     * Reset all visualizations
     */
    async resetAllVisualizations() {
        console.log('BROWSE-VISUALIZATIONS: Reset all requested');
        await this.restorer.resetAllVisualizations();
        await this.refresh(); // Refresh the tree view after reset
    }
    /**
     * Get the visualization restorer instance
     */
    getRestorer() {
        return this.restorer;
    }
}
exports.BrowseVisualizationsTreeDataProvider = BrowseVisualizationsTreeDataProvider;
//# sourceMappingURL=browseVisualizationsTreeView.js.map