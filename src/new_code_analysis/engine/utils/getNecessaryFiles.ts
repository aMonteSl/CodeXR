/**
 * Get Necessary Files for Analysis
 * Common functions for different types of analysis
 */

import * as vscode from 'vscode';
import { PythonExecutor, AnalysisType, PythonExecutionResult } from './pythonExecutor';
import { ParseTemplates, ParsedTemplateFiles } from './parseTemplates';

export interface AnalysisResult {
    success: boolean;
    data?: any;
    indexHtml?: string;
    cssContent?: string;
    jsContent?: string;
    error?: string;
    filePath: string;
    analysisType: AnalysisType;
}

export class GetNecessaryFiles {

    /**
     * Get analysis for File Live Panel mode
     */
    static async getAnalysisFileLivePanel(
        filePath: string,
        context: vscode.ExtensionContext
    ): Promise<AnalysisResult> {
        try {
            console.log(`GET_NECESSARY_FILES: Starting FileLivePanel analysis for: ${filePath}`);

            // Execute Python analysis using PythonExecutor
            const pythonResult: PythonExecutionResult = await PythonExecutor.executeAnalysis(
                'FileLivePanel',
                filePath,
                context
            );

            if (pythonResult.success && pythonResult.data) {
                console.log(`GET_NECESSARY_FILES: FileLivePanel analysis completed successfully`);
                console.log(`GET_NECESSARY_FILES: Analysis data.json:`, pythonResult.data);

                // Parse templates to get HTML, CSS, and JS files
                console.log(`GET_NECESSARY_FILES: Starting template parsing for LivePanel Files...`);
                const templateResult: ParsedTemplateFiles = await ParseTemplates.parseLivePanelFilesTemplate(
                    context,
                    pythonResult.data
                );

                if (templateResult.success) {
                    console.log(`GET_NECESSARY_FILES: Template files received successfully`);
                    console.log(`GET_NECESSARY_FILES: - HTML file: ${templateResult.indexHtml.length} characters`);
                    console.log(`GET_NECESSARY_FILES: - CSS file: ${templateResult.cssContent.length} characters`);
                    console.log(`GET_NECESSARY_FILES: - JS file: ${templateResult.jsContent.length} characters`);

                    return {
                        success: true,
                        data: pythonResult.data,
                        indexHtml: templateResult.indexHtml,
                        cssContent: templateResult.cssContent,
                        jsContent: templateResult.jsContent,
                        filePath: filePath,
                        analysisType: 'FileLivePanel'
                    };
                } else {
                    console.error(`GET_NECESSARY_FILES: Template parsing failed:`, templateResult.error);
                    return {
                        success: false,
                        error: `Template parsing failed: ${templateResult.error}`,
                        filePath: filePath,
                        analysisType: 'FileLivePanel'
                    };
                }
            } else {
                console.error(`GET_NECESSARY_FILES: FileLivePanel analysis failed:`, pythonResult.error);
                return {
                    success: false,
                    error: pythonResult.error || 'Unknown error during analysis',
                    filePath: filePath,
                    analysisType: 'FileLivePanel'
                };
            }

        } catch (error) {
            console.error(`GET_NECESSARY_FILES: Error in getAnalysisFileLivePanel:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                filePath: filePath,
                analysisType: 'FileLivePanel'
            };
        }
    }
}
