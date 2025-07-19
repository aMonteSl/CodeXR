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
exports.VisualizeDataIcons = exports.VisualizeDataItemFactory = exports.VisualizeDataTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const visualizeDataState_1 = require("../../state/visualizeDataState");
/**
 * Tree item for visualize data items
 */
class VisualizeDataTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    iconPath;
    tooltip;
    description;
    contextValue;
    constructor(label, collapsibleState, type, command, iconPath, tooltip, description, contextValue) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
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
exports.VisualizeDataTreeItem = VisualizeDataTreeItem;
/**
 * Factory for creating visualize data items
 */
class VisualizeDataItemFactory {
    /**
     * Create all visualize data items with current state
     */
    static createVisualizeDataItems(context) {
        console.log('BABIA-TEMPLATES: Creating visualize data items...');
        // Get current state if context is available and state manager exists
        let stateManager;
        let state;
        try {
            if (context && visualizeDataState_1.VisualizeDataStateManager.hasInstance()) {
                stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                state = stateManager.getState();
                console.log('BABIA-TEMPLATES: Retrieved state from manager', {
                    hasChart: !!state.selectedChart,
                    chartName: state.selectedChart?.name,
                    hasJson: !!state.selectedJsonName,
                    jsonName: state.selectedJsonName
                });
            }
            else if (context) {
                // Try to initialize state manager if context is available
                stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
                state = stateManager.getState();
                console.log('BABIA-TEMPLATES: Initialized new state manager');
            }
            else {
                console.log('BABIA-TEMPLATES: No context available, using default state');
            }
        }
        catch (error) {
            // State manager not initialized yet, use default values
            console.log('BABIA-TEMPLATES: Error accessing state manager, using defaults:', error);
        }
        const chartDescription = state?.selectedChart
            ? `Selected: ${state.selectedChart.name}`
            : 'No chart selected';
        const jsonDescription = state?.selectedJsonName
            ? `Selected: ${state.selectedJsonName}`
            : 'No file selected';
        const dimensionDescription = state?.isDimensionMappingConfigured
            ? 'Configured'
            : 'Not configured';
        const launchDescription = state?.isReadyToLaunch
            ? 'Ready to launch'
            : 'Configure required settings';
        console.log('BABIA-TEMPLATES: Item descriptions:', {
            chart: chartDescription,
            json: jsonDescription,
            dimension: dimensionDescription,
            launch: launchDescription
        });
        return [
            // Chart Type
            new VisualizeDataTreeItem('Chart Type', vscode.TreeItemCollapsibleState.None, 'chart-type', {
                command: 'codeXR.visualizeData.chartType',
                title: 'Select Chart Type'
            }, new vscode.ThemeIcon('graph'), 'Select visualization chart type', chartDescription, 'visualize-data-chart-type'),
            // Select JSON File
            new VisualizeDataTreeItem('Select JSON File', vscode.TreeItemCollapsibleState.None, 'select-json', {
                command: 'codeXR.visualizeData.selectJson',
                title: 'Select JSON File'
            }, new vscode.ThemeIcon('file-code'), 'Select JSON data file for visualization', jsonDescription, 'visualize-data-select-json'),
            // Dimension Mapping
            VisualizeDataItemFactory.createDimensionMappingItem(state),
            // Launch Visualization - Icon changes based on readiness
            new VisualizeDataTreeItem('Launch Visualization', vscode.TreeItemCollapsibleState.None, 'launch-visualization', {
                command: 'codeXR.visualizeData.launchVisualization',
                title: 'Launch Visualization'
            }, state?.isReadyToLaunch
                ? new vscode.ThemeIcon('rocket') // Ready to launch - rocket icon
                : new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow')), // Not ready - yellow warning
            'Launch the configured visualization', launchDescription, 'visualize-data-launch'),
            // Browse Visualizations
            new VisualizeDataTreeItem('Browse Visualizations', vscode.TreeItemCollapsibleState.Collapsed, 'browse-visualizations', undefined, // No command - expandable section
            new vscode.ThemeIcon('folder-opened'), 'Browse and launch previously generated visualizations', undefined, 'visualize-data-browse-visualizations')
        ];
    }
    /**
     * Create dimension mapping item with collapsible state
     */
    static createDimensionMappingItem(state) {
        if (!state?.selectedChart || !state?.jsonAnalysis) {
            return new VisualizeDataTreeItem('Dimension Mapping', vscode.TreeItemCollapsibleState.None, 'dimension-mapping', undefined, new vscode.ThemeIcon('settings-gear'), 'Select chart type and JSON file first', 'Not available', 'visualize-data-dimension-mapping');
        }
        const requiredCount = state.selectedChart.dimensions.filter(d => d.required).length;
        const mappedCount = state.dimensionMappings.length;
        const isConfigured = this.areRequiredDimensionsMapped(state);
        const description = isConfigured
            ? `Configured (${mappedCount}/${state.selectedChart.dimensions.length})`
            : `${mappedCount}/${requiredCount} required`;
        return new VisualizeDataTreeItem('Dimension Mapping', vscode.TreeItemCollapsibleState.Collapsed, 'dimension-mapping', undefined, // Remove command to allow expand/collapse behavior
        isConfigured
            ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('settings-gear'), 'Configure dimension mapping for visualization - Click to expand/collapse', description, 'visualize-data-dimension-mapping');
    }
    /**
     * Create dimension items for collapsible dimension mapping
     */
    static createDimensionItems(state) {
        if (!state.selectedChart) {
            return [];
        }
        return state.selectedChart.dimensions.map(dimension => this.createDimensionItem(dimension, state));
    }
    /**
     * Create individual dimension tree item
     */
    static createDimensionItem(dimension, state) {
        const currentMapping = state.dimensionMappings.find(m => m.dimension === dimension.name);
        const isRequired = dimension.required;
        // Check for duplicate field usage
        const isDuplicateField = currentMapping && this.isFieldUsedInOtherMappings(currentMapping.dataField, dimension.name, state);
        // Create label with status
        let label = `${dimension.name}`; // Use actual dimension name (key, size)
        let description = '';
        let tooltip = `${dimension.name}`;
        // Add field mapping status
        if (currentMapping) {
            description = `→ ${currentMapping.dataField}`;
            tooltip += `\nMapped to: ${currentMapping.dataField}`;
            if (isDuplicateField) {
                description += ' (duplicate)';
                tooltip += '\n⚠️ Warning: This field is used in multiple mappings';
                console.log(`DIMENSION-MAPPING: Duplicate field usage detected - '${currentMapping.dataField}' is used for multiple dimensions`);
            }
        }
        else {
            description = 'Not Mapped';
            tooltip += '\nNot mapped - Click to select field';
        }
        // Add data type suffix
        const dataTypeSuffix = dimension.dataType === 'numeric' ? ' (numeric only)' : ' (any value)';
        description += dataTypeSuffix;
        tooltip += `\nData type: ${dimension.dataType === 'numeric' ? 'numeric only' : 'any value'}`;
        // Set icon based on mapping status and requirement
        let iconPath;
        if (currentMapping && isDuplicateField) {
            iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.red'));
        }
        else if (currentMapping) {
            iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
        }
        else if (isRequired) {
            iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
        }
        else {
            iconPath = new vscode.ThemeIcon('circle-outline');
        }
        return new VisualizeDataTreeItem(label, vscode.TreeItemCollapsibleState.None, 'dimension-item', {
            command: 'codeXR.visualizeData.mapDimensionField',
            title: 'Map Dimension Field',
            arguments: [dimension.name]
        }, iconPath, tooltip, description, 'visualize-data-dimension-item');
    }
    /**
     * Check if all required dimensions are mapped
     */
    static areRequiredDimensionsMapped(state) {
        if (!state.selectedChart) {
            return false;
        }
        const requiredDimensions = state.selectedChart.dimensions.filter(d => d.required);
        return requiredDimensions.every(dimension => state.dimensionMappings.some(mapping => mapping.dimension === dimension.name));
    }
    /**
     * Check if a field is used in other dimension mappings
     */
    static isFieldUsedInOtherMappings(fieldName, currentDimensionName, state) {
        return state.dimensionMappings.some(mapping => mapping.dataField === fieldName && mapping.dimension !== currentDimensionName);
    }
}
exports.VisualizeDataItemFactory = VisualizeDataItemFactory;
/**
 * Icons for visualize data items
 */
class VisualizeDataIcons {
    static chartType = new vscode.ThemeIcon('graph');
    static selectJson = new vscode.ThemeIcon('file-code');
    static dimensionMapping = new vscode.ThemeIcon('settings-gear');
    static launchVisualization = new vscode.ThemeIcon('play');
    static section = new vscode.ThemeIcon('chart-scatter');
}
exports.VisualizeDataIcons = VisualizeDataIcons;
//# sourceMappingURL=visualizeDataItems.js.map