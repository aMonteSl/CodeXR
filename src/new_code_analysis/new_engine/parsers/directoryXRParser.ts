/**
 * Directory XR Parser
 * Handles parsing of directory structure for XR visualization
 * Generates HTML, JS and data files for XR analysis
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';
import { ExecutePython } from '../utils/executePython';
import { DimensionMapping } from '../../../babia_templates/models/chartModels';

export interface DirectoryXRParsingResult {
    success: boolean;
    generatedFiles?: Map<string, string>;
    error?: string;
}

export class DirectoryXRParser {
    
    /**
     * Parse directory for XR visualization
     * Generates the necessary files: HTML, JS, and data.json
     */
    async parseDirectoryForXR(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<DirectoryXRParsingResult> {
        console.log(`🏗️ DIRECTORY_XR_PARSER: Starting XR parsing for directory: ${session.targetName}`);
        console.log(`📂 DIRECTORY_XR_PARSER: Target path: ${session.targetPath}`);
        console.log(`🔍 DIRECTORY_XR_PARSER: Deep analysis: ${session.isDeep}`);
        
        try {
            // =======================================================
            // STEP 1: GET CONFIGURATION (CHART TYPE & DIMENSIONS)
            // =======================================================
            console.log(`⚙️ DIRECTORY_XR_PARSER: STEP 1 - Getting user configuration...`);
            
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const chartType = await storage.getDirectoryChartType();
            const dimensionMappings = await storage.getDimensionMappingDirectory();
            
            console.log(`📊 DIRECTORY_XR_PARSER: Chart type: ${chartType}`);
            console.log(`🎯 DIRECTORY_XR_PARSER: Dimension mappings:`, dimensionMappings);
            
            // =======================================================
            // STEP 2: GENERATE REAL DATA.JSON USING PYTHON ANALYSIS
            // =======================================================
            console.log(`📊 DIRECTORY_XR_PARSER: STEP 2 - Generating real data.json using Python analysis...`);
            
            // Create ExecutePython instance
            const executePython = new ExecutePython(context);
            
            // Create a specialized session for XR directory analysis
            const xrAnalysisSession: UnifiedAnalysisSession = {
                id: session.id,
                targetPath: session.targetPath,
                targetName: session.targetName,
                targetType: 'directory',
                analysisMode: 'XR',
                isDeep: session.isDeep,
                status: 'analyzing',
                startTime: new Date(),
                hash256: session.hash256,
                outputDirectory: session.outputDirectory,
                outputPath: session.outputPath,
                requiredFiles: new Map(),
                templatePaths: new Map(),
                metadata: {},
                // ✅ COPY FILTERED FILES FROM ORIGINAL SESSION - CRITICAL FOR DIRECTORY FILTERING
                filesToHash: session.filesToHash,
                directoriesToAnalyze: session.directoriesToAnalyze
            };
            
            console.log(`🚀 DIRECTORY_XR_PARSER: Executing Python analysis for directory...`);
            console.log(`📂 DIRECTORY_XR_PARSER: Target path: ${xrAnalysisSession.targetPath}`);
            console.log(`🔍 DIRECTORY_XR_PARSER: Analysis settings:`, {
                analysisMode: xrAnalysisSession.analysisMode,
                isDeep: xrAnalysisSession.isDeep
            });
            
            // Execute Python analysis with progress reporting
            const analysisResult = await executePython.executeAnalysis(xrAnalysisSession);
            
            let dataJsonContent: string;
            let analysisData: any[] = [];
            
            if (!analysisResult || (Array.isArray(analysisResult) && analysisResult.length === 0)) {
                console.warn(`⚠️ DIRECTORY_XR_PARSER: Python analysis returned empty result`);
                // Create empty array for no files
                dataJsonContent = JSON.stringify([], null, 2);
                analysisData = [];
                console.log(`📄 DIRECTORY_XR_PARSER: Using empty array - no files analyzed`);
            } else {
                console.log(`✅ DIRECTORY_XR_PARSER: Python analysis completed successfully!`);
                console.log(`📊 DIRECTORY_XR_PARSER: Analysis result:`, {
                    isArray: Array.isArray(analysisResult),
                    fileCount: Array.isArray(analysisResult) ? analysisResult.length : 0,
                    resultType: typeof analysisResult
                });
                
                // Use analysis result directly as the data.json content (array of files)
                analysisData = Array.isArray(analysisResult) ? analysisResult : [];
                dataJsonContent = JSON.stringify(analysisData, null, 2);
                console.log(`✅ DIRECTORY_XR_PARSER: STEP 2 completed - data.json generated (${dataJsonContent.length} chars)`);
                console.log(`📄 DIRECTORY_XR_PARSER: Generated data for ${analysisData.length} files`);
                
                // Log sample file data for verification
                if (analysisData.length > 0) {
                    console.log(`📋 DIRECTORY_XR_PARSER: Sample file data:`, {
                        fileName: analysisData[0].fileName,
                        language: analysisData[0].language,
                        totalLines: analysisData[0].totalLines,
                        functionCount: analysisData[0].functionCount,
                        fileSizeBytes: analysisData[0].fileSizeBytes
                    });
                }
            }
            
            // =======================================================
            // STEP 3: GENERATE HTML USING TEMPLATEPROCESSOR WITH ANALYSIS DATA
            // =======================================================
            console.log(`🌐 DIRECTORY_XR_PARSER: STEP 3 - Generating HTML with TemplateProcessor and analysis data...`);
            
            // Convert dimension mappings to the required format
            const mappings: DimensionMapping[] = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
                dimension,
                dataField
            }));
            console.log(`🔄 DIRECTORY_XR_PARSER: Converted mappings:`, mappings);
            
            // Create a temporary output path for HTML generation
            const tempOutputPath = path.join(context.storageUri?.fsPath || '/tmp', 'temp_xr_generation');
            await fs.promises.mkdir(tempOutputPath, { recursive: true });
            const tempHtmlPath = path.join(tempOutputPath, 'index.html');
            
            const htmlGenerationResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                mappings,
                `Directory Analysis: ${session.targetName}`,
                'data.json', // Data source file name
                context,
                tempHtmlPath,
                analysisData // Pass the Python analysis data for directory detection
            );
            
            if (!htmlGenerationResult.success) {
                console.error(`❌ DIRECTORY_XR_PARSER: HTML generation failed:`, htmlGenerationResult.error);
                return {
                    success: false,
                    error: `HTML generation failed: ${htmlGenerationResult.error}`
                };
            }
            
            const htmlContent = await fs.promises.readFile(tempHtmlPath, 'utf8');
            console.log(`✅ DIRECTORY_XR_PARSER: STEP 3 completed - HTML generated (${htmlContent.length} chars)`);
            
            // Clean up temp file
            try {
                await fs.promises.unlink(tempHtmlPath);
                await fs.promises.rmdir(tempOutputPath);
            } catch (cleanupError) {
                console.warn(`⚠️ DIRECTORY_XR_PARSER: Cleanup warning:`, cleanupError);
            }

            // =======================================================
            // STEP 4: GET LIVE_SSE_XR.JS FILE (saved as main.js)
            // =======================================================
            console.log(`📜 DIRECTORY_XR_PARSER: STEP 4 - Getting live_sse_XR.js file (will be saved as main.js)...`);
            
            const jsFilePath = path.join(context.extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
            console.log(`📂 DIRECTORY_XR_PARSER: Looking for JS file at: ${jsFilePath}`);
            
            if (!fs.existsSync(jsFilePath)) {
                console.error(`❌ DIRECTORY_XR_PARSER: live_sse_XR.js not found at: ${jsFilePath}`);
                return {
                    success: false,
                    error: `live_sse_XR.js not found at: ${jsFilePath}`
                };
            }
            
            const jsContent = await fs.promises.readFile(jsFilePath, 'utf8');
            console.log(`✅ DIRECTORY_XR_PARSER: STEP 4 completed - JS file loaded (${jsContent.length} chars)`);

            // =======================================================
            // STEP 5: PREPARE FINAL FILES MAP
            // =======================================================
            console.log(`📦 DIRECTORY_XR_PARSER: STEP 5 - Preparing final files map...`);
            
            const generatedFiles = new Map<string, string>();
            generatedFiles.set('index.html', htmlContent);
            generatedFiles.set('main.js', jsContent); // FIXED: Save as main.js instead of live_sse_XR.js
            generatedFiles.set('data.json', dataJsonContent);
            
            console.log(`🎉 DIRECTORY_XR_PARSER: All steps completed successfully!`);
            console.log(`📄 DIRECTORY_XR_PARSER: Generated files summary:`);
            console.log(`   📄 index.html: ${htmlContent.length} characters`);
            console.log(`   📄 main.js: ${jsContent.length} characters`);
            console.log(`   📄 data.json: ${dataJsonContent.length} characters`);
            
            return {
                success: true,
                generatedFiles: generatedFiles
            };
            
        } catch (error) {
            console.error(`❌ DIRECTORY_XR_PARSER: Error during directory XR parsing:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

// Export singleton instance
export const directoryXRParser = new DirectoryXRParser();
