import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { DimensionValidator } from '../../../babia_templates/processing/dimensionValidator';
import { chartTemplates } from '../../../babia_templates/charts/templateCharts';
import { ChartMetadata, DimensionMapping } from '../../../babia_templates/models/chartModels';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';
import { ExecutePython } from '../utils/executePython';

/**
 * Parsed XR File Analysis result interface
 */
export interface ParsedXRFileAnalysis {
    sessionId: string;
    chartType: string;
    chartMetadata: ChartMetadata;
    dimensionMappings: DimensionMapping[];
    validationResult: any;
    loadedFiles: Map<string, string>;
}

/**
 * XR File Parser
 * Handles the parsing and validation of XR file analysis configuration
 * Acts as a bridge to the TemplateProcessor from babia_templates
 */
export class FileXRParser {
    private context: vscode.ExtensionContext;
    private configStorage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        console.log('FILE_XR_PARSER: Initializing FileXRParser...');
        this.context = context;
        this.configStorage = AnalysisConfigurationStorage.getInstance(context);
        console.log('FILE_XR_PARSER: FileXRParser initialized');
    }

    /**
     * Main parsing method for XR file analysis
     * Retrieves chart configuration from globalStorage and validates it
     */
    public async parseFileAnalysis(session: UnifiedAnalysisSession, theme?: string): Promise<ParsedXRFileAnalysis> {
        console.log(`FILE_XR_PARSER: 🔍 Parsing XR file analysis for session ${session.id}`);
        console.log(`FILE_XR_PARSER: Target file: ${session.targetPath}`);

        try {
            // 1. Get chart type from configuration storage
            const chartType = await this.configStorage.getChartTypeFile();
            console.log(`FILE_XR_PARSER: Chart type from configuration: "${chartType}"`);

            if (!chartType) {
                throw new Error('No chart type configured. Please select a chart type in the Analysis Settings.');
            }

            // 2. Find chart metadata
            const chartMetadata = chartTemplates.find(chart => chart.id === chartType);
            if (!chartMetadata) {
                throw new Error(`Chart type "${chartType}" not found in available charts.`);
            }

            console.log(`FILE_XR_PARSER: Found chart metadata for "${chartMetadata.name}"`);
            console.log(`FILE_XR_PARSER: Chart has ${chartMetadata.dimensions.length} dimensions:`,
                chartMetadata.dimensions.map(d => `${d.name} (${d.dataType}, ${d.required ? 'required' : 'optional'})`));

            // 3. Get dimension mappings from configuration storage
            const dimensionMappings = await this.configStorage.getDimensionMappingFile();
            console.log(`FILE_XR_PARSER: Dimension mappings from configuration:`, dimensionMappings);

            // Convert from configuration format to babia template format
            const babiaFormatMappings: DimensionMapping[] = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
                dimension,
                dataField
            }));

            console.log(`FILE_XR_PARSER: Converted to babia format:`, babiaFormatMappings);

            // 4. Validate dimension mappings using DimensionValidator
            console.log(`FILE_XR_PARSER: 🔍 Validating dimension mappings...`);
            const validationResult = DimensionValidator.validateMappings(chartMetadata, babiaFormatMappings);

            console.log(`FILE_XR_PARSER: Validation result:`, {
                isValid: validationResult.isValid,
                errorsCount: validationResult.errors.length,
                warningsCount: validationResult.warnings.length
            });

            if (validationResult.errors.length > 0) {
                console.log(`FILE_XR_PARSER: ❌ Validation errors:`, validationResult.errors);
            }

            if (validationResult.warnings.length > 0) {
                console.log(`FILE_XR_PARSER: ⚠️ Validation warnings:`, validationResult.warnings);
            }

            // 5. Display configuration information (TODO message as requested)
            this.displayConfigurationInfo(chartType, chartMetadata, babiaFormatMappings, validationResult);

            // 6. Execute Python analysis to get data.json
            console.log(`FILE_XR_PARSER: 🐍 ===============================`);
            console.log(`FILE_XR_PARSER: 🐍 INITIATING PYTHON ANALYSIS PHASE`);
            console.log(`FILE_XR_PARSER: 🐍 ===============================`);
            console.log(`FILE_XR_PARSER: 🐍 Target file: ${session.targetPath}`);
            console.log(`FILE_XR_PARSER: 🐍 Session ID: ${session.id}`);
            console.log(`FILE_XR_PARSER: 🐍 Expected output: data.json with XR function analysis`);

            const pythonExecutor = new ExecutePython(this.context);
            console.log(`FILE_XR_PARSER: 🐍 ExecutePython instance created`);

            console.log(`FILE_XR_PARSER: 🐍 Calling executeAnalysis...`);
            const analysisData = await pythonExecutor.executeAnalysis(session);

            console.log(`FILE_XR_PARSER: 🐍 Python analysis completed!`);
            console.log(`FILE_XR_PARSER: 🐍 ==============================`);
            console.log(`FILE_XR_PARSER: 🐍 PYTHON ANALYSIS RESULTS`);
            console.log(`FILE_XR_PARSER: 🐍 ==============================`);
            console.log(`FILE_XR_PARSER: 🐍 Result type: ${typeof analysisData}`);
            console.log(`FILE_XR_PARSER: 🐍 Is array: ${Array.isArray(analysisData)}`);
            console.log(`FILE_XR_PARSER: 🐍 Is null/undefined: ${analysisData === null || analysisData === undefined}`);

            if (Array.isArray(analysisData)) {
                console.log(`FILE_XR_PARSER: 🐍 Array length: ${analysisData.length}`);
                if (analysisData.length > 0) {
                    console.log(`FILE_XR_PARSER: 🐍 First element keys: [${Object.keys(analysisData[0]).join(', ')}]`);
                    console.log(`FILE_XR_PARSER: 🐍 Sample data:`, {
                        functionName: analysisData[0].functionName,
                        complexity: analysisData[0].complexity,
                        lineCount: analysisData[0].lineCount,
                        fileName: analysisData[0].fileName
                    });
                }
            } else if (analysisData && typeof analysisData === 'object') {
                console.log(`FILE_XR_PARSER: 🐍 Object keys: [${Object.keys(analysisData).join(', ')}]`);
            }

            if (!analysisData || (Array.isArray(analysisData) && analysisData.length === 0)) {
                console.error(`FILE_XR_PARSER: 🐍 ❌ PYTHON ANALYSIS FAILED - NO DATA RETURNED`);
                throw new Error('Python analysis returned no data. Cannot generate XR visualization.');
            }

            console.log(`FILE_XR_PARSER: 🐍 ✅ Python analysis data validation passed`);
            console.log(`FILE_XR_PARSER: � Analysis data summary:`, {
                totalRecords: Array.isArray(analysisData) ? analysisData.length : 1,
                dataStructure: Array.isArray(analysisData) ? 'array' : typeof analysisData,
                sampleKeys: Array.isArray(analysisData) && analysisData.length > 0 ? Object.keys(analysisData[0]) : 'N/A'
            });

            // 7. Save data.json to session output directory
            console.log(`FILE_XR_PARSER: 💾 ===============================`);
            console.log(`FILE_XR_PARSER: 💾 SAVING DATA.JSON PHASE`);
            console.log(`FILE_XR_PARSER: 💾 ===============================`);

            const dataJsonPath = `${session.outputPath}/data.json`;
            console.log(`FILE_XR_PARSER: 💾 Target data.json path: ${dataJsonPath}`);
            console.log(`FILE_XR_PARSER: 💾 Session output directory: ${session.outputPath}`);

            // Ensure output directory exists
            if (!fs.existsSync(session.outputPath)) {
                console.log(`FILE_XR_PARSER: 💾 Creating output directory: ${session.outputPath}`);
                fs.mkdirSync(session.outputPath, { recursive: true });
                console.log(`FILE_XR_PARSER: 💾 ✅ Output directory created successfully`);
            } else {
                console.log(`FILE_XR_PARSER: 💾 ✅ Output directory already exists`);
            }

            // Convert analysisData to JSON string with pretty formatting
            console.log(`FILE_XR_PARSER: 💾 Converting analysis data to JSON string...`);
            const jsonString = JSON.stringify(analysisData, null, 2);
            console.log(`FILE_XR_PARSER: 💾 JSON string length: ${jsonString.length} characters`);
            console.log(`FILE_XR_PARSER: 💾 JSON preview (first 200 chars): ${jsonString.substring(0, 200)}${jsonString.length > 200 ? '...' : ''}`);

            // Save the analysis data as data.json
            console.log(`FILE_XR_PARSER: 💾 Writing data.json to disk...`);
            fs.writeFileSync(dataJsonPath, jsonString, 'utf8');

            // Verify the file was written correctly
            if (fs.existsSync(dataJsonPath)) {
                const writtenFileSize = fs.statSync(dataJsonPath).size;
                console.log(`FILE_XR_PARSER: 💾 ✅ data.json saved successfully!`);
                console.log(`FILE_XR_PARSER: 💾 File size: ${writtenFileSize} bytes`);
                console.log(`FILE_XR_PARSER: 💾 File location: ${dataJsonPath}`);

                // Read back first few lines to verify content
                const savedContent = fs.readFileSync(dataJsonPath, 'utf8');
                console.log(`FILE_XR_PARSER: 💾 Verification - saved content preview: ${savedContent.substring(0, 100)}...`);
            } else {
                console.error(`FILE_XR_PARSER: 💾 ❌ Failed to save data.json - file does not exist after write`);
                throw new Error('Failed to save data.json file');
            }

            // 7.5. Copy live_sse_fileXR.js as main.js to output directory
            console.log(`FILE_XR_PARSER: 📂 ===============================`);
            console.log(`FILE_XR_PARSER: 📂 COPYING LIVE SSE SCRIPT AS MAIN.JS`);
            console.log(`FILE_XR_PARSER: 📂 ===============================`);

            const liveSSEPath = path.join(this.context.extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
            const mainJSPath = `${session.outputPath}/main.js`;

            console.log(`FILE_XR_PARSER: 📂 Source live SSE script: ${liveSSEPath}`);
            console.log(`FILE_XR_PARSER: 📂 Target main.js path: ${mainJSPath}`);

            try {
                if (fs.existsSync(liveSSEPath)) {
                    console.log(`FILE_XR_PARSER: 📂 ✅ Live SSE script found, copying...`);
                    const liveSSEContent = fs.readFileSync(liveSSEPath, 'utf8');
                    fs.writeFileSync(mainJSPath, liveSSEContent, 'utf8');

                    if (fs.existsSync(mainJSPath)) {
                        const mainJSSize = fs.statSync(mainJSPath).size;
                        console.log(`FILE_XR_PARSER: 📂 ✅ main.js copied successfully!`);
                        console.log(`FILE_XR_PARSER: 📂 File size: ${mainJSSize} bytes`);
                        console.log(`FILE_XR_PARSER: 📂 File location: ${mainJSPath}`);
                    } else {
                        console.error(`FILE_XR_PARSER: 📂 ❌ Failed to copy main.js`);
                    }
                } else {
                    console.error(`FILE_XR_PARSER: 📂 ❌ Live SSE script not found at: ${liveSSEPath}`);
                }
            } catch (copyError) {
                console.error(`FILE_XR_PARSER: 📂 ❌ Error copying live SSE script:`, copyError);
                // Continue execution even if copy fails
            }

            // 8. Generate XR visualization using TemplateProcessor
            console.log(`FILE_XR_PARSER: 🚀 ===============================`);
            console.log(`FILE_XR_PARSER: 🚀 BABIA_TEMPLATES PHASE - CALLING TEMPLATEPROCESSOR`);
            console.log(`FILE_XR_PARSER: 🚀 ===============================`);

            // Prepare parameters for TemplateProcessor
            const fileName = session.targetName || 'analysis';
            const title = `XR Analysis: ${fileName}`;
            const dataSource = `./data.json`; // Relative path to the data file
            const outputPath = `${session.outputPath}/index.html`; // Main XR visualization file

            console.log(`FILE_XR_PARSER: 🚀 TEMPLATEPROCESSOR PARAMETERS:`);
            console.log(`FILE_XR_PARSER: 🚀 - Chart Type: ${chartType}`);
            console.log(`FILE_XR_PARSER: 🚀 - Chart Name: ${chartMetadata.name}`);
            console.log(`FILE_XR_PARSER: 🚀 - Chart Category: ${chartMetadata.category}`);
            console.log(`FILE_XR_PARSER: 🚀 - Dimension Mappings Count: ${babiaFormatMappings.length}`);
            console.log(`FILE_XR_PARSER: 🚀 - Title: "${title}"`);
            console.log(`FILE_XR_PARSER: 🚀 - Data Source: "${dataSource}"`);
            console.log(`FILE_XR_PARSER: 🚀 - Output HTML Path: "${outputPath}"`);
            console.log(`FILE_XR_PARSER: 🚀 - Template Analysis Data Type: ${typeof analysisData}`);
            console.log(`FILE_XR_PARSER: 🚀 - Template Analysis Data Length: ${Array.isArray(analysisData) ? analysisData.length : 'N/A'}`);

            console.log(`FILE_XR_PARSER: 🚀 DIMENSION MAPPINGS FOR TEMPLATEPROCESSOR:`);
            babiaFormatMappings.forEach((mapping, index) => {
                console.log(`FILE_XR_PARSER: 🚀   ${index + 1}. ${mapping.dimension} → "${mapping.dataField}"`);
            });

            // For file analysis, pass the analysisData to detectDirectoryAnalysis (should return false)
            const templateAnalysisData = analysisData; // Use the Python analysis data for template processing

            console.log(`FILE_XR_PARSER: 🚀 Calling TemplateProcessor.generateXRVisualization()...`);
            console.log(`FILE_XR_PARSER: 🚀 This will generate the index.html file with A-Frame XR content`);

            // Call TemplateProcessor to generate the XR visualization
            const templateResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                babiaFormatMappings,
                title,
                dataSource,
                this.context,
                outputPath,
                templateAnalysisData // Pass the Python analysis data
            );

            console.log(`FILE_XR_PARSER: 🚀 TemplateProcessor.generateXRVisualization() completed!`);
            console.log(`FILE_XR_PARSER: 🚀 ===============================`);
            console.log(`FILE_XR_PARSER: 🚀 TEMPLATEPROCESSOR RESULTS`);
            console.log(`FILE_XR_PARSER: 🚀 ===============================`);
            console.log(`FILE_XR_PARSER: 🚀 Success: ${templateResult.success}`);
            console.log(`FILE_XR_PARSER: 🚀 Error: ${templateResult.error || 'None'}`);

            if (!templateResult.success) {
                console.error(`FILE_XR_PARSER: 🚀 ❌ TEMPLATE GENERATION FAILED`);
                throw new Error(`Template generation failed: ${templateResult.error}`);
            }

            console.log(`FILE_XR_PARSER: 🚀 ✅ TemplateProcessor completed successfully!`);
            console.log(`FILE_XR_PARSER: 🚀 XR visualization generated at: ${outputPath}`);

            // Verify the generated index.html file
            if (fs.existsSync(outputPath)) {
                const htmlFileSize = fs.statSync(outputPath).size;
                console.log(`FILE_XR_PARSER: 🚀 ✅ index.html verification:`);
                console.log(`FILE_XR_PARSER: 🚀   - File exists: YES`);
                console.log(`FILE_XR_PARSER: 🚀   - File size: ${htmlFileSize} bytes`);
                console.log(`FILE_XR_PARSER: 🚀   - File path: ${outputPath}`);
            } else {
                console.error(`FILE_XR_PARSER: 🚀 ❌ index.html file was not generated!`);
            }

            // Load the generated files into the session (for launcher saving)
            console.log(`FILE_XR_PARSER: 📁 ===============================`);
            console.log(`FILE_XR_PARSER: 📁 LOADING GENERATED FILES FOR LAUNCHER`);
            console.log(`FILE_XR_PARSER: 📁 (Parser only processes - Launcher will save)`);
            console.log(`FILE_XR_PARSER: 📁 ===============================`);
            console.log(`FILE_XR_PARSER: 📁 Scanning output directory: ${session.outputPath}`);

            const loadedFiles = await this.loadGeneratedFiles(session.outputPath);

            console.log(`FILE_XR_PARSER: 📁 ===============================`);
            console.log(`FILE_XR_PARSER: 📁 FILE LOADING RESULTS`);
            console.log(`FILE_XR_PARSER: 📁 ===============================`);
            console.log(`FILE_XR_PARSER: 📁 Total files loaded: ${loadedFiles.size}`);

            if (loadedFiles.size > 0) {
                console.log(`FILE_XR_PARSER: 📁 LOADED FILES DETAILS:`);
                Array.from(loadedFiles.entries()).forEach(([fileName, content], index) => {
                    console.log(`FILE_XR_PARSER: 📁   ${index + 1}. ${fileName} (${content.length} chars)`);
                });

                // Check for expected files
                const expectedFiles = ['data.json', 'index.html', 'main.js'];
                expectedFiles.forEach(expectedFile => {
                    if (loadedFiles.has(expectedFile)) {
                        console.log(`FILE_XR_PARSER: 📁 ✅ Expected file found: ${expectedFile}`);
                    } else {
                        console.log(`FILE_XR_PARSER: 📁 ⚠️ Expected file missing: ${expectedFile}`);
                    }
                });
            } else {
                console.log(`FILE_XR_PARSER: 📁 ⚠️ No files were loaded from output directory`);
            }

            console.log(`FILE_XR_PARSER: ✅ ===============================`);
            console.log(`FILE_XR_PARSER: ✅ XR FILE ANALYSIS PARSING COMPLETED SUCCESSFULLY`);
            console.log(`FILE_XR_PARSER: ✅ (Returning files to launcher for saving and watching)`);
            console.log(`FILE_XR_PARSER: ✅ ===============================`);
            console.log(`FILE_XR_PARSER: ✅ Session ID: ${session.id}`);
            console.log(`FILE_XR_PARSER: ✅ Chart Type: ${chartType}`);
            console.log(`FILE_XR_PARSER: ✅ Total Mappings: ${babiaFormatMappings.length}`);
            console.log(`FILE_XR_PARSER: ✅ Validation Status: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
            console.log(`FILE_XR_PARSER: ✅ Files Generated: ${loadedFiles.size}`);
            console.log(`FILE_XR_PARSER: ✅ Python Data Records: ${Array.isArray(analysisData) ? analysisData.length : 'N/A'}`);
            console.log(`FILE_XR_PARSER: ✅ Next: Launcher will save files and start watcher`);
            console.log(`FILE_XR_PARSER: ✅ ===============================`);

            return {
                sessionId: session.id,
                chartType,
                chartMetadata,
                dimensionMappings: babiaFormatMappings,
                validationResult,
                loadedFiles
            };

        } catch (error) {
            console.error(`FILE_XR_PARSER: ❌ Error parsing XR file analysis:`, error);

            // Show user-friendly error message
            vscode.window.showErrorMessage(
                `XR Analysis Configuration Error: ${error instanceof Error ? error.message : String(error)}`
            );

            throw error;
        }
    }

    /**
     * Display configuration information to the user
     * Shows the selected chart type and dimension mappings with validation status
     */
    private displayConfigurationInfo(
        chartType: string,
        chartMetadata: ChartMetadata,
        dimensionMappings: DimensionMapping[],
        validationResult: any
    ): void {
        console.log(`\n🎯 === XR FILE ANALYSIS CONFIGURATION ===`);
        console.log(`📊 Chart Type: ${chartType} (${chartMetadata.name})`);
        console.log(`📝 Chart Description: ${chartMetadata.description}`);
        console.log(`🏷️ Chart Category: ${chartMetadata.category}`);
        console.log(`📐 Total Dimensions: ${chartMetadata.dimensions.length}`);

        console.log(`\n📋 === DIMENSION MAPPINGS ===`);
        if (dimensionMappings.length === 0) {
            console.log(`⚠️ No dimension mappings configured!`);
        } else {
            dimensionMappings.forEach((mapping, index) => {
                const dimension = chartMetadata.dimensions.find(d => d.name === mapping.dimension);
                const requiredText = dimension?.required ? '(REQUIRED)' : '(optional)';
                const dataTypeText = dimension?.dataType ? `[${dimension.dataType}]` : '';

                console.log(`  ${index + 1}. ${mapping.dimension} ${requiredText} ${dataTypeText} → "${mapping.dataField}"`);
            });
        }

        console.log(`\n✅ === VALIDATION STATUS ===`);
        console.log(`📊 Validation: ${validationResult.isValid ? '✅ VALID' : '❌ INVALID'}`);

        if (validationResult.errors.length > 0) {
            console.log(`❌ Errors (${validationResult.errors.length}):`);
            validationResult.errors.forEach((error: string, index: number) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        if (validationResult.warnings.length > 0) {
            console.log(`⚠️ Warnings (${validationResult.warnings.length}):`);
            validationResult.warnings.forEach((warning: string, index: number) => {
                console.log(`  ${index + 1}. ${warning}`);
            });
        }

        console.log(`========================================\n`);

        // Also show summary in VS Code notification
        const mappingsCount = dimensionMappings.length;
        const dimensionsCount = chartMetadata.dimensions.length;
        const requiredDimensionsCount = chartMetadata.dimensions.filter(d => d.required).length;

        const statusIcon = validationResult.isValid ? '✅' : '❌';
        const summaryMessage = `${statusIcon} XR Analysis Config: ${chartType} chart with ${mappingsCount}/${dimensionsCount} dimensions mapped (${requiredDimensionsCount} required)`;

        if (validationResult.isValid) {
            vscode.window.showInformationMessage(summaryMessage);
        } else {
            vscode.window.showWarningMessage(summaryMessage + ` - ${validationResult.errors.length} errors found`);
        }
    }

    /**
     * Load generated files from the output directory
     * Scans the output directory and loads all relevant files for the session
     */
    private async loadGeneratedFiles(outputPath: string): Promise<Map<string, string>> {
        console.log(`FILE_XR_PARSER: 📁 Loading generated files from: ${outputPath}`);

        const loadedFiles = new Map<string, string>();

        try {
            // Ensure output directory exists
            if (!fs.existsSync(outputPath)) {
                console.log(`FILE_XR_PARSER: Output directory does not exist: ${outputPath}`);
                return loadedFiles;
            }

            // Read all files in the output directory
            const files = fs.readdirSync(outputPath, { withFileTypes: true });

            for (const file of files) {
                if (file.isFile()) {
                    const filePath = path.join(outputPath, file.name);

                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        loadedFiles.set(file.name, content);

                        console.log(`FILE_XR_PARSER: ✅ Loaded file: ${file.name} (${content.length} chars)`);
                    } catch (error) {
                        console.error(`FILE_XR_PARSER: ❌ Error loading file ${file.name}:`, error);
                    }
                }
            }

            console.log(`FILE_XR_PARSER: 📁 Total files loaded: ${loadedFiles.size}`);
            console.log(`FILE_XR_PARSER: 📋 File list:`, Array.from(loadedFiles.keys()));

        } catch (error) {
            console.error(`FILE_XR_PARSER: ❌ Error loading generated files:`, error);
        }

        return loadedFiles;
    }
}
