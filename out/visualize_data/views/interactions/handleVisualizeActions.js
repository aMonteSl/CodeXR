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
exports.VisualizeDataActionHandler = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chartRegistry_1 = require("../../../babia_templates/registry/chartRegistry");
const visualizeDataState_1 = require("../../state/visualizeDataState");
const jsonFieldAnalyzer_1 = require("../../../utils/jsonFieldAnalyzer");
const nonceGenerator_1 = require("../../../utils/nonceGenerator");
const index_1 = require("../../../servers/runtime/index");
const visualization_settings_1 = require("../../../visualization_settings");
/**
 * Handle Visualize Data Actions
 * Manages user interactions with visualize data items
 */
class VisualizeDataActionHandler {
    context;
    stateManager;
    constructor(context) {
        this.context = context;
        console.log('VISUALIZE_DATA: Action handler initialized');
        this.stateManager = visualizeDataState_1.VisualizeDataStateManager.getInstance(context);
    }
    /**
     * Handle chart type selection
     */
    async handleChartType() {
        console.log('VISUALIZE_DATA: Chart type action triggered');
        try {
            // Get available charts from BabiaXR registry
            const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
            const availableCharts = chartRegistry.getAllCharts();
            // Get supported chart types: donut, pie, bar, barsmap, cyls, cylsmap, bubbles, and boats
            const donutChart = chartRegistry.getChart('donut');
            const pieChart = chartRegistry.getChart('pie');
            const barChart = chartRegistry.getChart('bar');
            const barsmapChart = chartRegistry.getChart('barsmap');
            const cylsChart = chartRegistry.getChart('cyls');
            const cylsmapChart = chartRegistry.getChart('cylsmap');
            const bubblesChart = chartRegistry.getChart('bubbles');
            const boatsChart = chartRegistry.getChart('boats');
            const availableChartTypes = [];
            if (donutChart) {
                availableChartTypes.push(donutChart);
            }
            if (pieChart) {
                availableChartTypes.push(pieChart);
            }
            if (barChart) {
                availableChartTypes.push(barChart);
            }
            if (barsmapChart) {
                availableChartTypes.push(barsmapChart);
            }
            if (cylsChart) {
                availableChartTypes.push(cylsChart);
            }
            if (cylsmapChart) {
                availableChartTypes.push(cylsmapChart);
            }
            if (bubblesChart) {
                availableChartTypes.push(bubblesChart);
            }
            if (boatsChart) {
                availableChartTypes.push(boatsChart);
            }
            if (availableChartTypes.length === 0) {
                console.error('BABIA-TEMPLATES: No supported chart types found in registry');
                vscode.window.showErrorMessage('No chart templates available');
                return;
            }
            // Create quick pick items for available charts
            const quickPickItems = availableChartTypes.map(chart => ({
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
            }
            else {
                console.log('BABIA-TEMPLATES: Chart type selection cancelled');
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in chart type action:', error);
            vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle JSON file selection
     */
    async handleSelectJson() {
        console.log('VISUALIZE_DATA: Select JSON action triggered');
        try {
            const options = {
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
                const jsonAnalysis = await jsonFieldAnalyzer_1.JsonFieldAnalyzer.analyzeJsonFile(filePath);
                if (jsonAnalysis.success) {
                    console.log(`BABIA-TEMPLATES: JSON analysis successful - found ${jsonAnalysis.fields.length} fields`);
                    // Update state with selected JSON and analysis
                    this.stateManager.updateSelectedJson(filePath, fileName);
                    this.stateManager.updateJsonAnalysis(jsonAnalysis);
                    // Trigger tree refresh to update display
                    vscode.commands.executeCommand('codexr.servers.refresh');
                    console.log(`BABIA-TEMPLATES: JSON file selected: ${fileName} (${filePath})`);
                    vscode.window.showInformationMessage(`JSON file selected: ${fileName} (${jsonAnalysis.fields.length} fields found)`);
                }
                else {
                    console.error(`BABIA-TEMPLATES: JSON analysis failed: ${jsonAnalysis.error}`);
                    vscode.window.showErrorMessage(`Failed to analyze JSON file: ${jsonAnalysis.error}`);
                }
            }
            else {
                console.log('BABIA-TEMPLATES: No JSON file selected');
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in select JSON action:', error);
            vscode.window.showErrorMessage(`Failed to select JSON file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle dimension mapping configuration (informational only)
     */
    async handleDimensionMapping() {
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
        }
        catch (error) {
            console.error('DIMENSION-MAPPING: Error in dimension mapping overview:', error);
            vscode.window.showErrorMessage(`Failed to show dimension mapping overview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Find fields that are used in multiple dimension mappings
     */
    findDuplicateFields(state) {
        const fieldCounts = new Map();
        state.dimensionMappings.forEach((mapping) => {
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
    async handleDimensionFieldMapping(dimensionName) {
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
            const availableFields = jsonFieldAnalyzer_1.JsonFieldAnalyzer.getFieldsForDimensionType(state.jsonAnalysis, dimension.dataType);
            if (availableFields.length === 0) {
                const typeInfo = dimension.dataType === 'numeric' ? 'numeric fields' : 'fields';
                vscode.window.showWarningMessage(`No ${typeInfo} available for dimension '${dimension.name}'`);
                return;
            }
            // Create QuickPick items with duplicate field indicators
            const quickPickItems = availableFields.map(field => {
                const displayInfo = jsonFieldAnalyzer_1.JsonFieldAnalyzer.formatFieldForDisplay(field);
                const isAlreadyUsed = state.dimensionMappings.some(mapping => mapping.dataField === field.name && mapping.dimension !== dimensionName);
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
                const isAlreadyUsed = state.dimensionMappings.some(mapping => mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName);
                if (isAlreadyUsed) {
                    const existingMapping = state.dimensionMappings.find(mapping => mapping.dataField === selectedItem.field.name && mapping.dimension !== dimensionName);
                    console.log(`DIMENSION-MAPPING: Warning - Field '${selectedItem.field.name}' is already mapped to dimension '${existingMapping?.dimension}'`);
                    const proceed = await vscode.window.showWarningMessage(`Field '${selectedItem.field.name}' is already used for dimension '${existingMapping?.dimension}'. Continue?`, 'Yes, Continue', 'Cancel');
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
            }
            else {
                console.log(`DIMENSION-MAPPING: Field mapping for dimension '${dimensionName}' cancelled`);
            }
        }
        catch (error) {
            console.error(`DIMENSION-MAPPING: Error in field mapping for dimension '${dimensionName}':`, error);
            vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Handle visualization launch
     */
    async handleLaunchVisualization() {
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
                vscode.window.showWarningMessage(`Cannot launch visualization. Please configure: ${missingItems.join(', ')}`);
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
            const nonce = (0, nonceGenerator_1.generateNonce)(8); // 8 bytes = 16 hex characters
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
            const launchResult = await (0, index_1.launchServerWithFile)(this.context, indexHtmlPath, visualizationName.trim());
            if (launchResult.success && launchResult.serverUrl) {
                vscode.window.showInformationMessage(`🚀 Visualization '${visualizationName}' launched successfully!`, 'View in Browser').then(selection => {
                    if (selection === 'View in Browser' && launchResult.serverUrl) {
                        vscode.env.openExternal(vscode.Uri.parse(launchResult.serverUrl));
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(`Failed to launch visualization server: ${launchResult.error || 'Unknown error'}`);
            }
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error in launch visualization action:', error);
            vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Prepare the visualization directory structure
     */
    async prepareVisualizationDirectory(uniqueName) {
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
     * Generate visualization files using babia-templates
     */
    async generateVisualizationFiles(state, visualizationDir, userVisualizationName) {
        try {
            if (!state.selectedChart || !state.selectedJsonPath) {
                return { success: false, error: 'Missing chart or JSON file configuration' };
            }
            // Copy JSON file as data.json
            const dataJsonPath = path.join(visualizationDir, 'data.json');
            fs.copyFileSync(state.selectedJsonPath, dataJsonPath);
            console.log('VISUALIZE_DATA: Copied data file to:', dataJsonPath);
            // Get visualization settings
            const backgroundColor = await (0, visualization_settings_1.getSelectedBackgroundColor)();
            const groundColor = await (0, visualization_settings_1.getSelectedGroundColor)();
            const environment = await (0, visualization_settings_1.getSelectedEnvironment)();
            const palette = await (0, visualization_settings_1.getSelectedPalette)();
            console.log('VISUALIZE_DATA: Using visualization settings:', {
                backgroundColor,
                groundColor,
                environment,
                palette
            });
            // Load XR template from templates/xr/xr-visualization.html
            const templatePath = path.join(this.context.extensionPath, 'templates', 'xr', 'xr-visualization.html');
            if (!fs.existsSync(templatePath)) {
                return {
                    success: false,
                    error: `XR template not found at: ${templatePath}`
                };
            }
            let htmlTemplate = fs.readFileSync(templatePath, 'utf8');
            console.log('VISUALIZE_DATA: Loaded XR template from:', templatePath);
            // Create chart component based on selected chart type
            const chartComponent = this.generateChartComponent(state.selectedChart, state.dimensionMappings, userVisualizationName, palette);
            // Replace placeholders in the template
            const replacements = {
                'TITLE': userVisualizationName,
                'BACKGROUND_COLOR': backgroundColor,
                'GROUND_COLOR': groundColor,
                'ENVIRONMENT_PRESET': environment,
                'DATA_SOURCE': './data.json',
                'TREE_BUILDER': '', // Not needed for basic charts
                'CHART_COMPONENT': chartComponent,
                'CHART_PALETTE': palette,
                'ICON_PATH': '' // Optional
            };
            // Apply all replacements
            for (const [placeholder, value] of Object.entries(replacements)) {
                const regex = new RegExp(`\\$\\{${placeholder}\\}`, 'g');
                htmlTemplate = htmlTemplate.replace(regex, value);
            }
            // Write index.html
            const indexHtmlPath = path.join(visualizationDir, 'index.html');
            fs.writeFileSync(indexHtmlPath, htmlTemplate, 'utf8');
            console.log('VISUALIZE_DATA: Generated index.html:', indexHtmlPath);
            return { success: true };
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error generating visualization files:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Generate chart component HTML based on chart type and mappings
     */
    generateChartComponent(chart, mappings, title, palette) {
        console.log('BABIA-TEMPLATES: Generating chart component for:', chart.id);
        console.log('BABIA-TEMPLATES: Available mappings:', mappings);
        // Generate chart component based on chart type
        switch (chart.id) {
            case 'donut':
                // Extract key and size mappings for donut chart
                const donutKeyMapping = mappings.find(mapping => mapping.dimension === 'key');
                const donutSizeMapping = mappings.find(mapping => mapping.dimension === 'size');
                const donutKeyField = donutKeyMapping ? donutKeyMapping.dataField : 'key';
                const donutSizeField = donutSizeMapping ? donutSizeMapping.dataField : 'size';
                return `
                    <a-entity id="chart"
                              babia-doughnut="from: data;
                                          title: '${title}';
                                          legend: true;
                                          palette: ${palette};
                                          key: ${donutKeyField};
                                          size: ${donutSizeField};"
                              position="0 4 0"
                              rotation="90 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'pie':
                // Extract key and size mappings for pie chart
                const pieKeyMapping = mappings.find(mapping => mapping.dimension === 'key');
                const pieSizeMapping = mappings.find(mapping => mapping.dimension === 'size');
                const pieKeyField = pieKeyMapping ? pieKeyMapping.dataField : 'key';
                const pieSizeField = pieSizeMapping ? pieSizeMapping.dataField : 'size';
                return `
                    <a-entity id="chart"
                              babia-pie="from: data;
                                         title: '${title}';
                                         legend: true;
                                         palette: ${palette};
                                         key: ${pieKeyField};
                                         size: ${pieSizeField};"
                              position="0 4 0"
                              rotation="90 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'bar':
                // Extract x_axis and height mappings for bar chart
                const barXAxisMapping = mappings.find(mapping => mapping.dimension === 'x_axis');
                const barHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const barXAxisField = barXAxisMapping ? barXAxisMapping.dataField : 'x_axis';
                const barHeightField = barHeightMapping ? barHeightMapping.dataField : 'height';
                console.log('BABIA-TEMPLATES: Bar chart fields:', { x_axis: barXAxisField, height: barHeightField });
                return `
                    <a-entity id="chart"
                              babia-bars="from: data;
                                          title: '${title}';
                                          legend: true;
                                          palette: ${palette};
                                          x_axis: ${barXAxisField};
                                          height: ${barHeightField};
                                          axis_name: true;"
                              position="0 2 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'barsmap':
                // Extract x_axis, z_axis, and height mappings for barsmap chart
                const barsmapXAxisMapping = mappings.find(mapping => mapping.dimension === 'x_axis');
                const barsmapZAxisMapping = mappings.find(mapping => mapping.dimension === 'z_axis');
                const barsmapHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const barsmapXAxisField = barsmapXAxisMapping ? barsmapXAxisMapping.dataField : 'x_axis';
                const barsmapZAxisField = barsmapZAxisMapping ? barsmapZAxisMapping.dataField : 'z_axis';
                const barsmapHeightField = barsmapHeightMapping ? barsmapHeightMapping.dataField : 'height';
                console.log('BABIA-TEMPLATES: Barsmap chart fields:', {
                    x_axis: barsmapXAxisField,
                    z_axis: barsmapZAxisField,
                    height: barsmapHeightField
                });
                return `
                    <a-entity id="chart"
                              babia-barsmap="from: data;
                                             title: '${title}';
                                             legend: true;
                                             palette: ${palette};
                                             x_axis: ${barsmapXAxisField};
                                             z_axis: ${barsmapZAxisField};
                                             height: ${barsmapHeightField};
                                             axis_name: true;"
                              position="0 2 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'bars':
                // Legacy bars support (fallback)
                const legacyBarsKeyMapping = mappings.find(mapping => mapping.dimension === 'key');
                const legacyBarsHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const legacyBarsKeyField = legacyBarsKeyMapping ? legacyBarsKeyMapping.dataField : 'key';
                const legacyBarsHeightField = legacyBarsHeightMapping ? legacyBarsHeightMapping.dataField : 'height';
                return `
                    <a-entity id="chart"
                              babia-bars="from: data;
                                          title: '${title}';
                                          legend: true;
                                          palette: ${palette};
                                          key: ${legacyBarsKeyField};
                                          height: ${legacyBarsHeightField};"
                              position="0 1 -5"
                              scale="1 1 1"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'bubbles':
                // Extract x_axis, z_axis, height, and radius mappings for bubbles chart
                const bubblesXAxisMapping = mappings.find(mapping => mapping.dimension === 'x_axis');
                const bubblesZAxisMapping = mappings.find(mapping => mapping.dimension === 'z_axis');
                const bubblesHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const bubblesRadiusMapping = mappings.find(mapping => mapping.dimension === 'radius');
                const bubblesXAxisField = bubblesXAxisMapping ? bubblesXAxisMapping.dataField : 'x_axis';
                const bubblesZAxisField = bubblesZAxisMapping ? bubblesZAxisMapping.dataField : 'z_axis';
                const bubblesHeightField = bubblesHeightMapping ? bubblesHeightMapping.dataField : 'height';
                const bubblesRadiusField = bubblesRadiusMapping ? bubblesRadiusMapping.dataField : 'radius';
                console.log('BABIA-TEMPLATES: Bubbles chart fields:', {
                    x_axis: bubblesXAxisField,
                    z_axis: bubblesZAxisField,
                    height: bubblesHeightField,
                    radius: bubblesRadiusField
                });
                return `
                    <a-entity id="chart"
                              babia-bubbles="from: data;
                                             title: '${title}';
                                             legend: true;
                                             palette: ${palette};
                                             x_axis: ${bubblesXAxisField};
                                             z_axis: ${bubblesZAxisField};
                                             height: ${bubblesHeightField};
                                             radius: ${bubblesRadiusField};
                                             heightMax: 5;
                                             radiusMax: 1;"
                              position="0 1 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'boats':
                // Extract area, height, and color mappings for boats chart
                const boatsAreaMapping = mappings.find(mapping => mapping.dimension === 'area');
                const boatsHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const boatsColorMapping = mappings.find(mapping => mapping.dimension === 'color');
                const boatsAreaField = boatsAreaMapping ? boatsAreaMapping.dataField : 'area';
                const boatsHeightField = boatsHeightMapping ? boatsHeightMapping.dataField : 'height';
                const boatsColorField = boatsColorMapping ? boatsColorMapping.dataField : 'color';
                console.log('BABIA-TEMPLATES: Boats chart fields:', {
                    area: boatsAreaField,
                    height: boatsHeightField,
                    color: boatsColorField
                });
                return `
                    <a-entity id="chart"
                              babia-boats="from: data;
                                           legend: true;
                                           area: ${boatsAreaField};
                                           height: ${boatsHeightField};
                                           color: ${boatsColorField};"
                              position="0 1 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'cyls':
                // Extract x_axis, height, and radius mappings for cyls chart
                const cylsXAxisMapping = mappings.find(mapping => mapping.dimension === 'x_axis');
                const cylsHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const cylsRadiusMapping = mappings.find(mapping => mapping.dimension === 'radius');
                const cylsXAxisField = cylsXAxisMapping ? cylsXAxisMapping.dataField : 'x_axis';
                const cylsHeightField = cylsHeightMapping ? cylsHeightMapping.dataField : 'height';
                const cylsRadiusField = cylsRadiusMapping ? cylsRadiusMapping.dataField : 'radius';
                console.log('BABIA-TEMPLATES: Cyls chart fields:', {
                    x_axis: cylsXAxisField,
                    height: cylsHeightField,
                    radius: cylsRadiusField
                });
                return `
                    <a-entity id="chart"
                              babia-cyls="from: data;
                                          title: '${title}';
                                          legend: true;
                                          palette: ${palette};
                                          x_axis: ${cylsXAxisField};
                                          height: ${cylsHeightField};
                                          radius: ${cylsRadiusField};
                                          axis_name: true;"
                              position="0 1 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            case 'cylsmap':
                // Extract x_axis, z_axis, height, and radius mappings for cylsmap chart
                const cylsmapXAxisMapping = mappings.find(mapping => mapping.dimension === 'x_axis');
                const cylsmapZAxisMapping = mappings.find(mapping => mapping.dimension === 'z_axis');
                const cylsmapHeightMapping = mappings.find(mapping => mapping.dimension === 'height');
                const cylsmapRadiusMapping = mappings.find(mapping => mapping.dimension === 'radius');
                const cylsmapXAxisField = cylsmapXAxisMapping ? cylsmapXAxisMapping.dataField : 'x_axis';
                const cylsmapZAxisField = cylsmapZAxisMapping ? cylsmapZAxisMapping.dataField : 'z_axis';
                const cylsmapHeightField = cylsmapHeightMapping ? cylsmapHeightMapping.dataField : 'height';
                const cylsmapRadiusField = cylsmapRadiusMapping ? cylsmapRadiusMapping.dataField : 'radius';
                console.log('BABIA-TEMPLATES: Cylsmap chart fields:', {
                    x_axis: cylsmapXAxisField,
                    z_axis: cylsmapZAxisField,
                    height: cylsmapHeightField,
                    radius: cylsmapRadiusField
                });
                return `
                    <a-entity id="chart"
                              babia-cylsmap="from: data;
                                             title: '${title}';
                                             legend: true;
                                             palette: ${palette};
                                             x_axis: ${cylsmapXAxisField};
                                             z_axis: ${cylsmapZAxisField};
                                             height: ${cylsmapHeightField};
                                             radius: ${cylsmapRadiusField};
                                             axis_name: true;"
                              position="0 1 -10"
                              rotation="0 0 0"
                              scale="1.5 1.5 1.5"
                              class="babiaxraycasterclass">
                    </a-entity>`;
            default:
                console.log('BABIA-TEMPLATES: Using generic chart template for:', chart.id);
                // Generic fallback for unknown chart types
                const genericKeyMapping = mappings.find(mapping => mapping.dimension === 'key');
                const genericSizeMapping = mappings.find(mapping => mapping.dimension === 'size');
                const genericKeyField = genericKeyMapping ? genericKeyMapping.dataField : 'key';
                const genericSizeField = genericSizeMapping ? genericSizeMapping.dataField : 'size';
                return `
                    <a-entity id="chart"
                              babia-${chart.id}="from: data;
                                                 title: '${title}';
                                                 legend: true;
                                                 palette: ${palette};
                                                 key: ${genericKeyField};
                                                 size: ${genericSizeField};"
                              position="0 2 -5"
                              scale="1 1 1"
                              class="babiaxraycasterclass">
                    </a-entity>`;
        }
    }
    /**
     * Handle debug state command (for troubleshooting)
     */
    async handleDebugState() {
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
            await vscode.window.showInformationMessage('Visualize Data state diagnostic sent to console. Check Output > Log (Extension Host) for details.', { modal: false });
            console.log('VISUALIZE_DATA: Full state diagnostic:\n' + message);
        }
        catch (error) {
            console.error('VISUALIZE_DATA: Error generating debug state:', error);
            vscode.window.showErrorMessage(`Debug state failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        console.log('VISUALIZE_DATA: Action handler cleanup');
        // Note: We don't dispose the state manager here as it may be used by other components
    }
    /**
     * Get state manager instance
     */
    getStateManager() {
        return this.stateManager;
    }
}
exports.VisualizeDataActionHandler = VisualizeDataActionHandler;
//# sourceMappingURL=handleVisualizeActions.js.map