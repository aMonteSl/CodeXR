/**
 * Directory XR Parser
 * Handles parsing of directory structure for XR visualization
 * Generates HTML, JS and data files for XR analysis
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { TemplateProcessor } from '../../../../babia_templates/processing/templateProcessor';

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
            // STEP 2: GENERATE HTML USING TEMPLATEPROCESSOR
            // =======================================================
            console.log(`🌐 DIRECTORY_XR_PARSER: STEP 2 - Generating HTML with TemplateProcessor...`);
            
            // Convert dimension mappings to the required format
            const mappings = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
                dimension,
                dataField: dataField as string
            }));
            
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
                tempHtmlPath
            );
            
            if (!htmlGenerationResult.success) {
                console.error(`❌ DIRECTORY_XR_PARSER: HTML generation failed:`, htmlGenerationResult.error);
                return {
                    success: false,
                    error: `HTML generation failed: ${htmlGenerationResult.error}`
                };
            }
            
            // Read the generated HTML file
            const htmlContent = await fs.promises.readFile(tempHtmlPath, 'utf8');
            console.log(`✅ DIRECTORY_XR_PARSER: STEP 2 completed - HTML generated (${htmlContent.length} chars)`);
            
            // Clean up temp file
            try {
                await fs.promises.unlink(tempHtmlPath);
                await fs.promises.rmdir(tempOutputPath);
            } catch (cleanupError) {
                console.warn(`⚠️ DIRECTORY_XR_PARSER: Cleanup warning:`, cleanupError);
            }
            
            // =======================================================
            // STEP 3: GET LIVE_SSE_XR.JS FILE
            // =======================================================
            console.log(`📜 DIRECTORY_XR_PARSER: STEP 3 - Getting live_sse_XR.js file...`);
            
            const jsFilePath = path.join(context.extensionPath, 'templates', 'xr', 'live_sse_XR.js');
            console.log(`📂 DIRECTORY_XR_PARSER: Looking for JS file at: ${jsFilePath}`);
            
            if (!fs.existsSync(jsFilePath)) {
                console.error(`❌ DIRECTORY_XR_PARSER: live_sse_XR.js not found at: ${jsFilePath}`);
                return {
                    success: false,
                    error: `live_sse_XR.js not found at: ${jsFilePath}`
                };
            }
            
            const jsContent = await fs.promises.readFile(jsFilePath, 'utf8');
            console.log(`✅ DIRECTORY_XR_PARSER: STEP 3 completed - JS file loaded (${jsContent.length} chars)`);
            
            // =======================================================
            // STEP 4: PREPARE DATA.JSON (PLACEHOLDER FOR NOW)
            // =======================================================
            console.log(`📊 DIRECTORY_XR_PARSER: STEP 4 - Preparing data.json...`);
            
            // TODO: Next step will be to generate actual directory analysis data
            const placeholderData = {
                metadata: {
                    type: 'directory_xr_analysis',
                    targetPath: session.targetPath,
                    targetName: session.targetName,
                    isDeep: session.isDeep,
                    chartType: chartType,
                    dimensionMappings: dimensionMappings,
                    timestamp: new Date().toISOString(),
                    sessionId: session.id
                },
                data: {
                    // TODO: This will contain the actual directory analysis data
                    placeholder: 'Directory analysis data will be generated here'
                }
            };
            
            const dataJsonContent = JSON.stringify(placeholderData, null, 2);
            console.log(`✅ DIRECTORY_XR_PARSER: STEP 4 completed - data.json prepared (${dataJsonContent.length} chars)`);
            
            // =======================================================
            // STEP 5: PREPARE FINAL FILES MAP
            // =======================================================
            console.log(`📦 DIRECTORY_XR_PARSER: STEP 5 - Preparing final files map...`);
            
            const generatedFiles = new Map<string, string>();
            generatedFiles.set('index.html', htmlContent);
            generatedFiles.set('live_sse_XR.js', jsContent);
            generatedFiles.set('data.json', dataJsonContent);
            
            console.log(`🎉 DIRECTORY_XR_PARSER: All steps completed successfully!`);
            console.log(`📄 DIRECTORY_XR_PARSER: Generated files summary:`);
            console.log(`   📄 index.html: ${htmlContent.length} characters`);
            console.log(`   📄 live_sse_XR.js: ${jsContent.length} characters`);
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
