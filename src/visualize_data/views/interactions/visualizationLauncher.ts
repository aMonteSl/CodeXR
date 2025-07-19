import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BabiaChartRegistry } from '../../../babia_templates/registry/chartRegistry';
import { VisualizeDataStateManager, VisualizeDataState } from '../../state/visualizeDataState';
import { JsonFieldAnalyzer } from '../../../utils/jsonFieldAnalyzer';
import { DimensionDataType, DimensionMapping } from '../../../babia_templates/models/chartModels';
import { generateNonce } from '../../../utils/nonceGenerator';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';
import { launchServerWithFile } from '../../../servers/runtime/index';

/**
 * Visualization Launcher
 * Manages visualization creation and launching using centralized template processing
 */
export class VisualizationLauncher {
    private stateManager: VisualizeDataStateManager;

    constructor(private context: vscode.ExtensionContext) {
        console.log('VISUALIZE_DATA: Action handler initialized');
        this.stateManager = VisualizeDataStateManager.getInstance(context);
    }

    /**
     * Handle chart type selection
     */
    public async handleChartType(): Promise<void> {
        console.log('VISUALIZE_DATA: Chart type action triggered');
        
        try {
            // Get available charts from BabiaXR registry
            const chartRegistry = BabiaChartRegistry.getInstance();
            const availableCharts = chartRegistry.getAllCharts();
            
            if (availableCharts.length === 0) {
                console.error('BABIA-TEMPLATES: No chart types found in registry');
                vscode.window.showErrorMessage('No chart templates available');
                return;
            }

            // Create quick pick items for available charts
            const quickPickItems: (vscode.QuickPickItem & { chart: any })[] = availableCharts.map(chart => ({
                label: chart.name,
                description: chart.description,
                detail: `Category: ${chart.category} | Dimensions: ${chart.dimensions.map(d => d.name).join(', ')}`,
                chart: chart
            }));

            // Show quick pick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: 'Select a chart type for visualization',
                title: 'BabiaXR Chart Type Selection'
            });

            if (selectedItem && selectedItem.chart) {
                const selectedChart = selectedItem.chart;
                
                // Update state with selected chart
                this.stateManager.updateSelectedChart(selectedChart);
                
                // Trigger tree refresh to update display
                vscode.commands.executeCommand('codexr.servers.refresh');
                
                console.log(`BABIA-TEMPLATES: Chart type selected: ${selectedChart.name}`);
                vscode.window.showInformationMessage(`Chart type selected: ${selectedChart.name}`);
            } else {
                console.log('BABIA-TEMPLATES: Chart type selection cancelled');
            }
        } catch (error) {
            console.error('VISUALIZE_DATA: Error in chart type action:', error);
            vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle JSON file selection
     */
    public async handleSelectJson(): Promise<void> {
        console.log('VISUALIZE_DATA: Select JSON action triggered');
        
        try {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Select JSON File',
                filters: {
                    'JSON files': ['json']
                },
                title: 'Select JSON Data File for Visualization'
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            
            if (fileUri && fileUri[0]) {
                const filePath = fileUri[0].fsPath;
                const fileName = path.basename(filePath);
                
                // Analyze JSON file to extract field information
                console.log(`BABIA-TEMPLATES: Starting JSON analysis for ${fileName}`);
                const jsonAnalysis = await JsonFieldAnalyzer.analyzeJsonFile(filePath);
                
                if (jsonAnalysis.success) {
                    console.log(`BABIA-TEMPLATES: JSON analysis successful - found ${jsonAnalysis.fields.length} fields`);
                    
                    // Update state with selected JSON and analysis
                    this.stateManager.updateSelectedJson(filePath, fileName);
                    this.stateManager.updateJsonAnalysis(jsonAnalysis);
                    
                    // Trigger tree refresh to update display
                    vscode.commands.executeCommand('codexr.servers.refresh');
                    
                    console.log(`BABIA-TEMPLATES: JSON file selected: ${fileName} (${filePath})`);
                    vscode.window.showInformationMessage(`JSON file selected: ${fileName} (${jsonAnalysis.fields.length} fields found)`);
                } else {
                    console.error(`BABIA-TEMPLATES: JSON analysis failed: ${jsonAnalysis.error}`);
                    vscode.window.showErrorMessage(`Failed to analyze JSON file: ${jsonAnalysis.error}`);
                }
            } else {
                console.log('BABIA-TEMPLATES: No JSON file selected');
            }
        } catch (error) {
            console.error('VISUALIZE_DATA: Error in select JSON action:', error);
            vscode.window.showErrorMessage(`Failed to select JSON file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle dimension mapping configuration (informational only)
     */
    public async handleDimensionMapping(): Promise<void> {
        console.log('DIMENSION-MAPPING: Dimension mapping overview requested');
        
        try {
            const state = this.stateManager.getState();
            
            if (!state.selectedChart) {
                vscode.window.showWarningMessage('Please select a chart type first');
                return;
            }
            
            if (!state.jsonAnalysis) {
                vscode.window.showWarningMessage('Please select a JSON file first');
                return;
            }
            
            // Show dimension mapping status overview
            const requiredDimensions = state.selectedChart.dimensions.filter(d => d.required);
            const mappedDimensions = state.dimensionMappings.length;
            const totalDimensions = state.selectedChart.dimensions.length;
            
            let message = `Chart: ${state.selectedChart.name}\n`;
            message += `Dimensions: ${mappedDimensions}/${totalDimensions} configured\n`;
            message += `Required: ${requiredDimensions.map(d => d.name).join(', ')}\n`;
            message += `Available fields: ${state.jsonAnalysis.fields.length}`;
            
            // Check for duplicate fields
            const duplicateFields = this.findDuplicateFields(state);
            if (duplicateFields.length > 0) {
                message += `\n⚠️ Duplicate field usage: ${duplicateFields.join(', ')}`;
            }
            
            vscode.window.showInformationMessage(`Dimension Mapping Status:\n${message}`);
            
        } catch (error) {
            console.error('DIMENSION-MAPPING: Error in dimension mapping overview:', error);
            vscode.window.showErrorMessage(`Failed to show dimension mapping overview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Find fields that are used in multiple dimension mappings
     */
    private findDuplicateFields(state: VisualizeDataState): string[] {
        const fieldCounts = new Map<string, number>();
        
        state.dimensionMappings.forEach((mapping: DimensionMapping) => {
            const count = fieldCounts.get(mapping.dataField) || 0;
            fieldCounts.set(mapping.dataField, count + 1);
        });
        
        return Array.from(fieldCounts.entries())
            .filter(([_, count]) => count > 1)
            .map(([field, _]) => field);
    }

    /**
     * Handle dimension field mapping for a specific dimension
     */
    public async handleDimensionFieldMapping(dimensionName: string): Promise<void> {
        console.log(`DIMENSION-MAPPING: Field mapping for dimension '${dimensionName}' triggered`);
        
        try {
            const state = this.stateManager.getState();
            
            if (!state.selectedChart || !state.jsonAnalysis) {
                vscode.window.showWarningMessage('Please select a chart type and JSON file first');
                return;
            }
            
            // Find the dimension definition
            const dimension = state.selectedChart.dimensions.find(d => d.name === dimensionName);
            if (!dimension) {
                vscode.window.showErrorMessage(`Dimension '${dimensionName}' not found in chart`);
                return;
            }
            
            // Get available fields for this dimension type
            const availableFields = JsonFieldAnalyzer.getFieldsForDimensionType(state.jsonAnalysis, dimension.dataType);
            
            if (availableFields.length === 0) {
                const typeInfo = dimension.dataType === 'numeric' ? 'numeric fields' : 'fields';
                vscode.window.showWarningMessage(`No ${typeInfo} available for dimension '${dimension.name}'`);
                return;
            }
            
            // Create QuickPick items with duplicate field indicators
            const quickPickItems = availableFields.map(field => {
                const displayInfo = JsonFieldAnalyzer.formatFieldForDisplay(field);
                const isAlreadyUsed = state.dimensionMappings.some(mapping => 
                    mapping.dataField === field.name && mapping.dimension !== dimensionName
                );
                
                let label = displayInfo.label;
                let description = displayInfo.description;
                
                if (isAlreadyUsed) {
                    label += ' ⚠️';
                    description += ' (already used in another dimension)';
                }
                
                return {
                    label: label,
                    description: description,
                    detail: displayInfo.detail,
                    field: field
                };
            });
            
            // Show QuickPick
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `Select field for ${dimension.name} (${dimension.dataType === 'numeric' ? 'numeric only' : 'any value'})`,
                title: `Map Dimension: ${dimension.name}`,
                matchOnDescription: true,
                matchOnDetail: true
            });
            
            if (selectedItem) {
                // Check if field is already used and warn user
                const isAlreadyUsed = state.dimensionMappings.some(mapping => 
                    mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName
                );
                
                if (isAlreadyUsed) {
                    const existingMapping = state.dimensionMappings.find(mapping => 
                        mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName
                    );
                    
                    console.log(`DIMENSION-MAPPING: Warning - Field '${selectedItem.field.name}' is already mapped to dimension '${existingMapping?.dimension}'`);
                    
                    const proceed = await vscode.window.showWarningMessage(
                        `Field '${selectedItem.field.name}' is already used for dimension '${existingMapping?.dimension}'. Continue?`,
                        'Yes, Continue',
                        'Cancel'
                    );
                    
                    if (proceed !== 'Yes, Continue') {
                        console.log(`DIMENSION-MAPPING: Duplicate field mapping cancelled by user`);
                        return;
                    }
                }
                
                // Update dimension mapping
                this.stateManager.updateSingleDimensionMapping(dimensionName, selectedItem.field.name);
                
                // Trigger tree refresh
                vscode.commands.executeCommand('codexr.servers.refresh');
                
                console.log(`DIMENSION-MAPPING: Mapped dimension '${dimensionName}' to field '${selectedItem.field.name}'`);
                vscode.window.showInformationMessage(`Mapped ${dimension.name} to field: ${selectedItem.field.name}`);
            } else {
                console.log(`DIMENSION-MAPPING: Field mapping for dimension '${dimensionName}' cancelled`);
            }
            
        } catch (error) {
            console.error(`DIMENSION-MAPPING: Error in field mapping for dimension '${dimensionName}':`, error);
            vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle visualization launch
     */
    public async handleLaunchVisualization(): Promise<void> {
        console.log('VISUALIZE_DATA: Launch visualization action triggered');
        
        try {
            const state = this.stateManager.getState();
            
            // Check if ready to launch (icon should already be showing correct state)
            if (!state.isReadyToLaunch) {
                const missingItems = [];
                if (!state.selectedChart) {
                    missingItems.push('Chart Type');
                }
                if (!state.selectedJsonPath) {
                    missingItems.push('JSON File');
                }
                if (!state.isDimensionMappingConfigured) {
                    missingItems.push('Dimension Mapping');
                }
                
                vscode.window.showWarningMessage(
                    `Cannot launch visualization. Please configure: ${missingItems.join(', ')}`
                );
                return;
            }

            // Get visualization name from user
            const visualizationName = await vscode.window.showInputBox({
                prompt: 'Enter a name for your visualization',
                placeHolder: 'e.g., ventas, sales_analysis',
                value: 'my_visualization',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Visualization name cannot be empty';
                    }
                    if (!/^[a-zA-Z0-9_-]+$/.test(value.trim())) {
                        return 'Name can only contain letters, numbers, underscores, and dashes';
                    }
                    return null;
                }
            });

            if (!visualizationName) {
                console.log('VISUALIZE_DATA: User cancelled visualization name input');
                return;
            }

            // Generate secure unique name
            const nonce = generateNonce(8); // 8 bytes = 16 hex characters
            const uniqueName = `${visualizationName.trim()}_${nonce}`;
            
            console.log('VISUALIZE_DATA: Creating visualization:', uniqueName);

            // Prepare visualization directory
            const visualizationDir = await this.prepareVisualizationDirectory(uniqueName);
            
            // Generate visualization files
            const result = await this.generateVisualizationFiles(state, visualizationDir, visualizationName.trim());
            
            if (!result.success) {
                vscode.window.showErrorMessage(`Failed to generate visualization: ${result.error}`);
                return;
            }

            // Launch the server with custom name
            const indexHtmlPath = path.join(visualizationDir, 'index.html');
            console.log('VISUALIZE_DATA: Launching server with file:', indexHtmlPath);
            console.log(`SERVER: Using custom name '${visualizationName.trim()}' for visualization server`);
            
            const launchResult = await launchServerWithFile(this.context, indexHtmlPath, visualizationName.trim());
            
            if (launchResult.success && launchResult.serverUrl) {
                vscode.window.showInformationMessage(
                    `🚀 Visualization '${visualizationName}' launched successfully!`,
                    'View in Browser'
                ).then(selection => {
                    if (selection === 'View in Browser' && launchResult.serverUrl) {
                        vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                    }
                });
            } else {
                vscode.window.showErrorMessage(
                    `Failed to launch visualization server: ${launchResult.error || 'Unknown error'}`
                );
            }

        } catch (error) {
            console.error('VISUALIZE_DATA: Error in launch visualization action:', error);
            vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Prepare the visualization directory structure
     */
    private async prepareVisualizationDirectory(uniqueName: string): Promise<string> {
        const globalStorageUri = this.context.globalStorageUri;
        const visualizeDataDir = path.join(globalStorageUri.fsPath, 'visualize-data');
        const visualizationDir = path.join(visualizeDataDir, uniqueName);

        // Ensure directories exist
        if (!fs.existsSync(visualizeDataDir)) {
            fs.mkdirSync(visualizeDataDir, { recursive: true });
            console.log('VISUALIZE_DATA: Created visualize-data directory:', visualizeDataDir);
        }

        if (!fs.existsSync(visualizationDir)) {
            fs.mkdirSync(visualizationDir, { recursive: true });
            console.log('VISUALIZE_DATA: Created visualization directory:', visualizationDir);
        }

        return visualizationDir;
    }

    /**
     * Generate visualization files using centralized TemplateProcessor
     */
    private async generateVisualizationFiles(
        state: VisualizeDataState, 
        visualizationDir: string,
        userVisualizationName: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            if (!state.selectedChart || !state.selectedJsonPath) {
                return { success: false, error: 'Missing chart or JSON file configuration' };
            }

            console.log('VISUALIZATION_LAUNCHER: Using centralized TemplateProcessor for HTML generation');

            // Copy JSON file as data.json
            const dataJsonPath = path.join(visualizationDir, 'data.json');
            fs.copyFileSync(state.selectedJsonPath, dataJsonPath);
            console.log('VISUALIZATION_LAUNCHER: Copied data file to:', dataJsonPath);

            // Prepare output path for index.html
            const indexHtmlPath = path.join(visualizationDir, 'index.html');

            // Use centralized TemplateProcessor to generate the complete XR visualization
            const result = await TemplateProcessor.generateXRVisualization(
                state.selectedChart.id,
                state.dimensionMappings,
                userVisualizationName,
                './data.json',
                this.context,
                indexHtmlPath
            );

            if (!result.success) {
                console.error('VISUALIZATION_LAUNCHER: TemplateProcessor failed:', result.error);
                return { 
                    success: false, 
                    error: `Template processing failed: ${result.error}` 
                };
            }

            console.log('VISUALIZATION_LAUNCHER: Successfully generated index.html using TemplateProcessor');
            return { success: true };

        } catch (error) {
            console.error('VISUALIZATION_LAUNCHER: Error generating visualization files:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Handle debug state command (for troubleshooting)
     */
    public async handleDebugState(): Promise<void> {
        console.log('VISUALIZE_DATA: Debug state action triggered');
        
        try {
            const state = this.stateManager.getState();
            
            // Validate file path existence
            const fileExists = state.selectedJsonPath ? fs.existsSync(state.selectedJsonPath) : false;
            
            // Prepare state information
            const stateInfo = {
                selectedChart: state.selectedChart?.name || 'None',
                selectedJsonPath: state.selectedJsonPath || 'None',
                selectedJsonName: state.selectedJsonName || 'None',
                fileExists: fileExists,
                jsonAnalysisPresent: !!state.jsonAnalysis,
                jsonAnalysisFields: state.jsonAnalysis ? state.jsonAnalysis.fields.map(f => f.name) : [],
                dimensionMappingsCount: state.dimensionMappings.length,
                isDimensionMappingConfigured: state.isDimensionMappingConfigured,
                isReadyToLaunch: state.isReadyToLaunch,
                requiredDimensions: state.selectedChart?.dimensions.map(d => d.name) || [],
                mappedDimensions: state.dimensionMappings.map(m => `${m.dimension}: ${m.dataField}`)
            };
            
            // Create diagnostic message
            const message = [
                'Visualize Data State Diagnostic:',
                '',
                `Chart: ${stateInfo.selectedChart}`,
                `Required Dimensions: [${stateInfo.requiredDimensions.join(', ')}]`,
                '',
                `JSON File: ${stateInfo.selectedJsonName}`,
                `Path: ${stateInfo.selectedJsonPath}`,
                `File Exists: ${stateInfo.fileExists}`,
                `Analysis Present: ${stateInfo.jsonAnalysisPresent}`,
                `Available Fields: [${stateInfo.jsonAnalysisFields.join(', ')}]`,
                '',
                `Mapped Dimensions: ${stateInfo.mappedDimensions.length}`,
                ...stateInfo.mappedDimensions.map(mapping => `  - ${mapping}`),
                '',
                `Configuration Complete: ${stateInfo.isDimensionMappingConfigured}`,
                `Ready to Launch: ${stateInfo.isReadyToLaunch}`
            ].join('\n');
            
            console.log('VISUALIZE_DATA: State diagnostic:', stateInfo);
            
            // Show diagnostic information
            await vscode.window.showInformationMessage(
                'Visualize Data state diagnostic sent to console. Check Output > Log (Extension Host) for details.',
                { modal: false }
            );
            
            console.log('VISUALIZE_DATA: Full state diagnostic:\n' + message);
            
        } catch (error) {
            console.error('VISUALIZE_DATA: Error generating debug state:', error);
            vscode.window.showErrorMessage(`Debug state failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Cleanup resources
     */
    public cleanup(): void {
        console.log('VISUALIZE_DATA: Action handler cleanup');
        // Note: We don't dispose the state manager here as it may be used by other components
    }

    /**
     * Get state manager instance
     */
    public getStateManager(): VisualizeDataStateManager {
        return this.stateManager;
    }
}
