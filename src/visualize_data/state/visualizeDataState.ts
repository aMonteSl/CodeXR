import * as vscode from 'vscode';
import * as fs from 'fs';
import { ChartMetadata, DimensionMapping } from '../../babia_templates/models/chartModels';
import { JsonAnalysisResult } from '../../utils/jsonFieldAnalyzer';

/**
 * Visualize Data State
 * Manages the current state of visualization configuration
 */
export interface VisualizeDataState {
    /** Selected chart type */
    selectedChart?: ChartMetadata;
    
    /** Path to selected JSON file */
    selectedJsonPath?: string;
    
    /** Name of selected JSON file */
    selectedJsonName?: string;
    
    /** JSON analysis result */
    jsonAnalysis?: JsonAnalysisResult;
    
    /** Current dimension mappings */
    dimensionMappings: DimensionMapping[];
    
    /** Whether dimension mapping is configured */
    isDimensionMappingConfigured: boolean;
    
    /** Whether ready to launch visualization */
    isReadyToLaunch: boolean;
}

/**
 * Visualize Data State Manager
 * Manages state persistence and updates for visualization configuration
 */
export class VisualizeDataStateManager {
    private static instance: VisualizeDataStateManager;
    private state: VisualizeDataState;
    private context: vscode.ExtensionContext;
    
    // Event emitter for state changes
    private readonly _onStateChanged = new vscode.EventEmitter<VisualizeDataState>();
    public readonly onStateChanged = this._onStateChanged.event;

    private constructor(context: vscode.ExtensionContext) {
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
    public static getInstance(context?: vscode.ExtensionContext): VisualizeDataStateManager {
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
    public static hasInstance(): boolean {
        return !!VisualizeDataStateManager.instance;
    }

    /**
     * Get initial state
     */
    private getInitialState(): VisualizeDataState {
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
    public getState(): VisualizeDataState {
        return { ...this.state };
    }

    /**
     * Update selected chart
     */
    public updateSelectedChart(chart: ChartMetadata): void {
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
    public updateSelectedJson(filePath: string, fileName: string): void {
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
    public updateDimensionMapping(isConfigured: boolean): void {
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
    private calculateReadyToLaunch(chart?: ChartMetadata, jsonPath?: string, dimensionMappingConfigured?: boolean): boolean {
        const hasChart = !!chart;
        const hasJson = !!jsonPath;
        const hasDimensionMapping = dimensionMappingConfigured ?? this.state.isDimensionMappingConfigured;
        
        return hasChart && hasJson && hasDimensionMapping;
    }

    /**
     * Reset state
     */
    public reset(): void {
        console.log('BABIA-TEMPLATES: State reset');
        this.state = this.getInitialState();
        this.notifyStateChange();
    }

    /**
     * Notify state change
     */
    private notifyStateChange(): void {
        this._onStateChanged.fire(this.getState());
    }

    /**
     * Check if chart is selected
     */
    public hasSelectedChart(): boolean {
        return !!this.state.selectedChart;
    }

    /**
     * Check if JSON is selected
     */
    public hasSelectedJson(): boolean {
        return !!this.state.selectedJsonPath;
    }

    /**
     * Get selected chart name for display
     */
    public getSelectedChartName(): string | undefined {
        return this.state.selectedChart?.name;
    }

    /**
     * Get selected JSON name for display
     */
    public getSelectedJsonName(): string | undefined {
        return this.state.selectedJsonName;
    }

    /**
     * Update JSON analysis result
     */
    updateJsonAnalysis(jsonAnalysis: JsonAnalysisResult): void {
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
    updateDimensionMappings(mappings: DimensionMapping[]): void {
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
    updateSingleDimensionMapping(dimensionName: string, fieldName: string): void {
        console.log(`DIMENSION-MAPPING: Updating mapping for dimension '${dimensionName}' to field '${fieldName}'`);
        
        // Remove existing mapping for this dimension
        this.state.dimensionMappings = this.state.dimensionMappings.filter(
            mapping => mapping.dimension !== dimensionName
        );
        
        // Add new mapping
        const newMapping: DimensionMapping = {
            dimension: dimensionName,
            dataField: fieldName
        };
        
        this.state.dimensionMappings.push(newMapping);
        
        // Check for duplicate field usage and provide detailed warning
        const duplicateMappings = this.state.dimensionMappings.filter(
            mapping => mapping.dataField === fieldName
        );
        
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
    private updateComputedProperties(): void {
        // Check if dimension mapping is configured
        this.state.isDimensionMappingConfigured = this.areDimensionsMapped();
        
        // Check if ready to launch visualization
        this.state.isReadyToLaunch = this.canLaunchVisualization();
    }

    /**
     * Check if dimensions are properly mapped
     */
    private areDimensionsMapped(): boolean {
        if (!this.state.selectedChart) {
            return false;
        }
        
        const requiredDimensions = this.state.selectedChart.dimensions.filter(d => d.required);
        return requiredDimensions.every(dimension => 
            this.state.dimensionMappings.some(mapping => mapping.dimension === dimension.name)
        );
    }

    /**
     * Check if visualization can be launched
     */
    private canLaunchVisualization(): boolean {
        return !!(
            this.state.selectedChart &&
            this.state.selectedJsonPath &&
            this.state.isDimensionMappingConfigured
        );
    }

    /**
     * Save state to persistent storage
     */
    private saveState(): void {
        try {
            this.context.workspaceState.update('visualizeDataState', this.state);
            console.log('BABIA-TEMPLATES: State saved to workspace storage');
        } catch (error) {
            console.error('BABIA-TEMPLATES: Failed to save state:', error);
        }
    }

    /**
     * Load state from persistent storage
     */
    private loadState(): VisualizeDataState {
        try {
            const savedState = this.context.workspaceState.get<VisualizeDataState>('visualizeDataState');
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
                validatedState.isReadyToLaunch = this.calculateReadyToLaunch(
                    validatedState.selectedChart,
                    validatedState.selectedJsonPath,
                    validatedState.isDimensionMappingConfigured
                );
                
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
        } catch (error) {
            console.error('VISUALIZE-STATE: Failed to load state:', error);
        }
        
        console.log('VISUALIZE-STATE: No stored state found, using initial state');
        return this.getInitialState();
    }

    /**
     * Cleanup resources
     */
    public dispose(): void {
        this._onStateChanged.dispose();
    }
}
