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
exports.VisualizeDataStateManager = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
/**
 * Visualize Data State Manager
 * Manages state persistence and updates for visualization configuration
 */
class VisualizeDataStateManager {
    static instance;
    state;
    context;
    // Event emitter for state changes
    _onStateChanged = new vscode.EventEmitter();
    onStateChanged = this._onStateChanged.event;
    constructor(context) {
        this.context = context;
        this.state = this.loadState();
        console.log('VISUALIZE-STATE: State manager initialized with state:', {
            hasChart: !!this.state.selectedChart,
            hasJsonPath: !!this.state.selectedJsonPath,
            mappingsCount: this.state.dimensionMappings.length,
            isReadyToLaunch: this.state.isReadyToLaunch
        });
    }
    /**
     * Get singleton instance
     */
    static getInstance(context) {
        if (!VisualizeDataStateManager.instance) {
            if (!context) {
                throw new Error('Context required for first initialization');
            }
            VisualizeDataStateManager.instance = new VisualizeDataStateManager(context);
        }
        return VisualizeDataStateManager.instance;
    }
    /**
     * Check if instance exists (for safe access)
     */
    static hasInstance() {
        return !!VisualizeDataStateManager.instance;
    }
    /**
     * Get initial state
     */
    getInitialState() {
        return {
            selectedChart: undefined,
            selectedJsonPath: undefined,
            selectedJsonName: undefined,
            jsonAnalysis: undefined,
            dimensionMappings: [],
            isDimensionMappingConfigured: false,
            isReadyToLaunch: false
        };
    }
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Update selected chart
     */
    updateSelectedChart(chart) {
        console.log('VISUALIZE-STATE: Chart selected:', {
            chartId: chart.id,
            chartName: chart.name,
            requiredDimensions: chart.dimensions.filter(d => d.required).map(d => d.name),
            previousMappings: this.state.dimensionMappings.length
        });
        this.state = {
            ...this.state,
            selectedChart: chart,
            dimensionMappings: [], // Clear dimension mappings when chart changes
            isDimensionMappingConfigured: false, // Reset dimension mapping when chart changes
            isReadyToLaunch: this.calculateReadyToLaunch(chart, this.state.selectedJsonPath, false)
        };
        this.saveState();
        this.notifyStateChange();
        console.log('VISUALIZE-STATE: Chart selection updated, cleared previous mappings');
    }
    /**
     * Update selected JSON file
     */
    updateSelectedJson(filePath, fileName) {
        const isValidPath = filePath && fs.existsSync(filePath);
        console.log('VISUALIZE-STATE: JSON file selection:', {
            fileName: fileName || 'none',
            filePath: filePath || 'none',
            fileExists: isValidPath,
            previousFile: this.state.selectedJsonName || 'none'
        });
        this.state = {
            ...this.state,
            selectedJsonPath: isValidPath ? filePath : undefined,
            selectedJsonName: isValidPath ? fileName : undefined,
            jsonAnalysis: isValidPath ? this.state.jsonAnalysis : undefined,
            dimensionMappings: isValidPath ? this.state.dimensionMappings : [], // Clear mappings if invalid file
            isDimensionMappingConfigured: isValidPath ? this.state.isDimensionMappingConfigured : false,
            isReadyToLaunch: this.calculateReadyToLaunch(this.state.selectedChart, isValidPath ? filePath : undefined, isValidPath ? this.state.isDimensionMappingConfigured : false)
        };
        this.saveState();
        this.notifyStateChange();
        if (!isValidPath && filePath) {
            console.warn('VISUALIZE-STATE: Invalid or non-existent file path provided:', filePath);
        }
    }
    /**
     * Update dimension mapping configuration
     */
    updateDimensionMapping(isConfigured) {
        console.log(`BABIA-TEMPLATES: Dimension mapping configured: ${isConfigured}`);
        this.state = {
            ...this.state,
            isDimensionMappingConfigured: isConfigured,
            isReadyToLaunch: this.calculateReadyToLaunch(this.state.selectedChart, this.state.selectedJsonPath, isConfigured)
        };
        this.notifyStateChange();
    }
    /**
     * Calculate if ready to launch visualization
     */
    calculateReadyToLaunch(chart, jsonPath, dimensionMappingConfigured) {
        const hasChart = !!chart;
        const hasJson = !!jsonPath;
        const hasDimensionMapping = dimensionMappingConfigured ?? this.state.isDimensionMappingConfigured;
        return hasChart && hasJson && hasDimensionMapping;
    }
    /**
     * Reset state
     */
    reset() {
        console.log('BABIA-TEMPLATES: State reset');
        this.state = this.getInitialState();
        this.notifyStateChange();
    }
    /**
     * Notify state change
     */
    notifyStateChange() {
        this._onStateChanged.fire(this.getState());
    }
    /**
     * Check if chart is selected
     */
    hasSelectedChart() {
        return !!this.state.selectedChart;
    }
    /**
     * Check if JSON is selected
     */
    hasSelectedJson() {
        return !!this.state.selectedJsonPath;
    }
    /**
     * Get selected chart name for display
     */
    getSelectedChartName() {
        return this.state.selectedChart?.name;
    }
    /**
     * Get selected JSON name for display
     */
    getSelectedJsonName() {
        return this.state.selectedJsonName;
    }
    /**
     * Update JSON analysis result
     */
    updateJsonAnalysis(jsonAnalysis) {
        console.log('DIMENSION-MAPPING: Updating JSON analysis result');
        this.state.jsonAnalysis = jsonAnalysis;
        // Clear existing dimension mappings when JSON changes
        this.state.dimensionMappings = [];
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: JSON analysis updated', {
            fieldsCount: jsonAnalysis.fields.length,
            numericFieldsCount: jsonAnalysis.fields.filter(f => f.isNumeric).length
        });
    }
    /**
     * Update dimension mappings
     */
    updateDimensionMappings(mappings) {
        console.log('DIMENSION-MAPPING: Updating dimension mappings');
        this.state.dimensionMappings = mappings;
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: Dimension mappings updated', {
            count: mappings.length,
            mappings: mappings.map(m => `${m.dimension} -> ${m.dataField}`)
        });
    }
    /**
     * Update single dimension mapping
     */
    updateSingleDimensionMapping(dimensionName, fieldName) {
        console.log(`DIMENSION-MAPPING: Updating mapping for dimension '${dimensionName}' to field '${fieldName}'`);
        // Remove existing mapping for this dimension
        this.state.dimensionMappings = this.state.dimensionMappings.filter(mapping => mapping.dimension !== dimensionName);
        // Add new mapping
        const newMapping = {
            dimension: dimensionName,
            dataField: fieldName
        };
        this.state.dimensionMappings.push(newMapping);
        // Check for duplicate field usage and provide detailed warning
        const duplicateMappings = this.state.dimensionMappings.filter(mapping => mapping.dataField === fieldName);
        if (duplicateMappings.length > 1) {
            const affectedDimensions = duplicateMappings.map(m => m.dimension).join(', ');
            console.log(`DIMENSION-MAPPING: Warning - Field '${fieldName}' is used in multiple dimensions: ${affectedDimensions}`);
            // Log each duplicate mapping for clarity
            duplicateMappings.forEach(mapping => {
                console.log(`DIMENSION-MAPPING: Field '${fieldName}' mapped to dimension '${mapping.dimension}'`);
            });
        }
        this.updateComputedProperties();
        this.saveState();
        this._onStateChanged.fire(this.state);
        console.log('DIMENSION-MAPPING: Single dimension mapping updated', {
            dimension: dimensionName,
            field: fieldName,
            totalMappings: this.state.dimensionMappings.length
        });
    }
    /**
     * Update computed properties based on current state
     */
    updateComputedProperties() {
        // Check if dimension mapping is configured
        this.state.isDimensionMappingConfigured = this.areDimensionsMapped();
        // Check if ready to launch visualization
        this.state.isReadyToLaunch = this.canLaunchVisualization();
    }
    /**
     * Check if dimensions are properly mapped
     */
    areDimensionsMapped() {
        if (!this.state.selectedChart) {
            return false;
        }
        const requiredDimensions = this.state.selectedChart.dimensions.filter(d => d.required);
        return requiredDimensions.every(dimension => this.state.dimensionMappings.some(mapping => mapping.dimension === dimension.name));
    }
    /**
     * Check if visualization can be launched
     */
    canLaunchVisualization() {
        return !!(this.state.selectedChart &&
            this.state.selectedJsonPath &&
            this.state.isDimensionMappingConfigured);
    }
    /**
     * Save state to persistent storage
     */
    saveState() {
        try {
            this.context.workspaceState.update('visualizeDataState', this.state);
            console.log('BABIA-TEMPLATES: State saved to workspace storage');
        }
        catch (error) {
            console.error('BABIA-TEMPLATES: Failed to save state:', error);
        }
    }
    /**
     * Load state from persistent storage
     */
    loadState() {
        try {
            const savedState = this.context.workspaceState.get('visualizeDataState');
            if (savedState) {
                console.log('VISUALIZE-STATE: Loading saved state from workspace storage:', {
                    selectedChart: savedState.selectedChart || 'none',
                    selectedJsonPath: savedState.selectedJsonPath || 'none',
                    hasJsonAnalysis: !!savedState.jsonAnalysis,
                    hasDimensionMappings: !!savedState.dimensionMappings?.length,
                    isDimensionMappingConfigured: savedState.isDimensionMappingConfigured || false
                });
                // Validate file path if it exists
                const isValidJsonPath = savedState.selectedJsonPath && fs.existsSync(savedState.selectedJsonPath);
                if (savedState.selectedJsonPath && !isValidJsonPath) {
                    console.warn('VISUALIZE-STATE: Stored JSON file no longer exists:', savedState.selectedJsonPath);
                }
                // Ensure all required properties exist with validation
                const validatedState = {
                    ...this.getInitialState(),
                    ...savedState,
                    // Reset file-related state if path is invalid
                    selectedJsonPath: isValidJsonPath ? savedState.selectedJsonPath : undefined,
                    selectedJsonName: isValidJsonPath ? savedState.selectedJsonName : undefined,
                    jsonAnalysis: isValidJsonPath ? savedState.jsonAnalysis : undefined,
                    dimensionMappings: isValidJsonPath ? (savedState.dimensionMappings || []) : [],
                    isDimensionMappingConfigured: isValidJsonPath ? (savedState.isDimensionMappingConfigured || false) : false
                };
                // Recalculate ready state based on validated data
                validatedState.isReadyToLaunch = this.calculateReadyToLaunch(validatedState.selectedChart, validatedState.selectedJsonPath, validatedState.isDimensionMappingConfigured);
                console.log('VISUALIZE-STATE: State loaded and validated:', {
                    finalChart: validatedState.selectedChart,
                    finalJsonPath: validatedState.selectedJsonPath,
                    finalJsonExists: validatedState.selectedJsonPath ? fs.existsSync(validatedState.selectedJsonPath) : false,
                    finalMappingsCount: validatedState.dimensionMappings.length,
                    finalIsConfigured: validatedState.isDimensionMappingConfigured,
                    finalIsReady: validatedState.isReadyToLaunch
                });
                return validatedState;
            }
        }
        catch (error) {
            console.error('VISUALIZE-STATE: Failed to load state:', error);
        }
        console.log('VISUALIZE-STATE: No stored state found, using initial state');
        return this.getInitialState();
    }
    /**
     * Cleanup resources
     */
    dispose() {
        this._onStateChanged.dispose();
    }
}
exports.VisualizeDataStateManager = VisualizeDataStateManager;
//# sourceMappingURL=visualizeDataState.js.map