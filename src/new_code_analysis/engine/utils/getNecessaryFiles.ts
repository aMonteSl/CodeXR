/**
 * Get Necessary Files for Analysis
 * Common functions for different types of analysis
 */

import * as vscode from 'vscode';
import { PythonExecutor, AnalysisType, PythonExecutionResult } from './pythonExecutor';
import { ParseTemplates, ParsedTemplateFiles } from './parseTemplates';
import { AnalysisSessionManager } from '../registry/analysisSessionManager';

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
     * Get analysis for DOM Visualization
     */
    static async getVisualizationDOM(
        filePath: string,
        context: vscode.ExtensionContext,
        sessionId: string
    ): Promise<AnalysisResult> {
        try {
            console.log(`GET_NECESSARY_FILES: Starting DOM visualization analysis for: ${filePath}`);

            const sessionManager = AnalysisSessionManager.getInstance();

            // Execute Python analysis using html_dom_parser.py
            const pythonResult: PythonExecutionResult = await PythonExecutor.executeAnalysis(
                'DOMVisualization',
                filePath,
                context
            );

            if (pythonResult.success && pythonResult.data) {
                console.log(`GET_NECESSARY_FILES: DOM visualization analysis completed successfully`);
                console.log(`GET_NECESSARY_FILES: Received htmlContent:`, pythonResult.data.htmlContent ? 'YES' : 'NO');

                // The python parser returns { htmlContent: "clean html content", originalFile: "path", preparedForVisualization: true }
                // Extract the HTML content string for babia-html visualization
                const htmlContentString = pythonResult.data.htmlContent || '';
                
                if (htmlContentString) {
                    console.log(`GET_NECESSARY_FILES: HTML content length: ${htmlContentString.length} characters`);
                    
                    // Add HTML content to session
                    await sessionManager.addFileToSession(sessionId, 'source.html', htmlContentString);
                    // Parse templates to get HTML, CSS, and JS files for DOM visualization
                    console.log(`GET_NECESSARY_FILES: Starting DOM visualization template parsing...`);
                    const templateResult: ParsedTemplateFiles = await ParseTemplates.parseDOMVisualizationTemplate(
                        context,
                        {
                            htmlContent: htmlContentString,
                            fileName: require('path').basename(filePath),
                            filePath: filePath,
                            title: `DOM Visualization - ${require('path').basename(filePath)}`
                        }
                    );

                    if (templateResult.success) {
                        console.log(`GET_NECESSARY_FILES: DOM visualization template files received successfully`);
                        console.log(`GET_NECESSARY_FILES: - HTML file: ${templateResult.indexHtml.length} characters`);
                        console.log(`GET_NECESSARY_FILES: - CSS file: ${templateResult.cssContent.length} characters`);
                        console.log(`GET_NECESSARY_FILES: - JS file: ${templateResult.jsContent.length} characters`);

                        // Add template files to session
                        await sessionManager.addFileToSession(sessionId, 'index.html', templateResult.indexHtml);
                        await sessionManager.addFileToSession(sessionId, 'style.css', templateResult.cssContent);
                        await sessionManager.addFileToSession(sessionId, 'main.js', templateResult.jsContent);
                        
                        // Add analysis data as JSON to session
                        const dataJson = JSON.stringify({
                            htmlContent: htmlContentString,
                            originalFile: filePath,
                            preparedForVisualization: true
                        }, null, 2);
                        await sessionManager.addFileToSession(sessionId, 'data.json', dataJson);

                        return {
                            success: true,
                            data: {
                                htmlContent: htmlContentString,
                                originalFile: filePath,
                                preparedForVisualization: true
                            },
                            indexHtml: templateResult.indexHtml,
                            cssContent: templateResult.cssContent,
                            jsContent: templateResult.jsContent,
                            filePath: filePath,
                            analysisType: 'DOMVisualization'
                        };
                    } else {
                        console.error(`GET_NECESSARY_FILES: DOM visualization template parsing failed:`, templateResult.error);
                        return {
                            success: false,
                            error: `Template parsing failed: ${templateResult.error}`,
                            filePath: filePath,
                            analysisType: 'DOMVisualization'
                        };
                    }
                } else {
                    console.error(`GET_NECESSARY_FILES: No HTML content received from parser`);
                    return {
                        success: false,
                        error: 'No HTML content could be extracted from file',
                        filePath: filePath,
                        analysisType: 'DOMVisualization'
                    };
                }

            } else {
                console.error(`GET_NECESSARY_FILES: DOM visualization analysis failed:`, pythonResult.error);
                return {
                    success: false,
                    error: pythonResult.error || 'Unknown error during DOM analysis',
                    filePath: filePath,
                    analysisType: 'DOMVisualization'
                };
            }

        } catch (error) {
            console.error(`GET_NECESSARY_FILES: Error in getVisualizationDOM:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                filePath: filePath,
                analysisType: 'DOMVisualization'
            };
        }
    }

    /**
     * Get analysis for File Live Panel mode
     */
    static async getAnalysisFileLivePanel(
        filePath: string,
        context: vscode.ExtensionContext,
        theme?: string,
        sessionId?: string
    ): Promise<AnalysisResult> {
        try {
            console.log(`GET_NECESSARY_FILES: Starting FileLivePanel analysis for: ${filePath}`);

            const sessionManager = AnalysisSessionManager.getInstance();

            // Execute Python analysis using PythonExecutor
            const pythonResult: PythonExecutionResult = await PythonExecutor.executeAnalysis(
                'FileLivePanel',
                filePath,
                context
            );

            if (pythonResult.success && pythonResult.data) {
                console.log(`GET_NECESSARY_FILES: FileLivePanel analysis completed successfully`);
                console.log(`GET_NECESSARY_FILES: Analysis data.json:`, pythonResult.data);

                // Add source file content to session if sessionId provided
                if (sessionId) {
                    try {
                        const fileUri = vscode.Uri.file(filePath);
                        const fileContent = await vscode.workspace.fs.readFile(fileUri);
                        const sourceContent = Buffer.from(fileContent).toString('utf8');
                        await sessionManager.addFileToSession(sessionId, require('path').basename(filePath), sourceContent);
                    } catch (error) {
                        console.warn(`GET_NECESSARY_FILES: Could not read source file for session: ${error}`);
                    }
                }

                // Parse templates to get HTML, CSS, and JS files
                console.log(`GET_NECESSARY_FILES: Starting template parsing for LivePanel Files...`);
                const templateResult: ParsedTemplateFiles = await ParseTemplates.parseLivePanelFilesTemplate(
                    context,
                    pythonResult.data,
                    theme
                );

                if (templateResult.success) {
                    console.log(`GET_NECESSARY_FILES: Template files received successfully`);
                    console.log(`GET_NECESSARY_FILES: - HTML file: ${templateResult.indexHtml.length} characters`);
                    console.log(`GET_NECESSARY_FILES: - CSS file: ${templateResult.cssContent.length} characters`);
                    console.log(`GET_NECESSARY_FILES: - JS file: ${templateResult.jsContent.length} characters`);

                    // Add template files to session if sessionId provided
                    if (sessionId) {
                        await sessionManager.addFileToSession(sessionId, 'index.html', templateResult.indexHtml);
                        await sessionManager.addFileToSession(sessionId, 'style.css', templateResult.cssContent);
                        await sessionManager.addFileToSession(sessionId, 'main.js', templateResult.jsContent);
                        
                        // Add analysis data as JSON to session
                        const dataJson = JSON.stringify(pythonResult.data, null, 2);
                        await sessionManager.addFileToSession(sessionId, 'data.json', dataJson);
                    }

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

    /**
     * Get analysis for File XR mode
     */
    static async getAnalysisFileXR(
        filePath: string,
        context: vscode.ExtensionContext,
        sessionId?: string
    ): Promise<AnalysisResult> {
        try {
            console.log(`GET_NECESSARY_FILES: Starting FileXR analysis for: ${filePath}`);

            const sessionManager = AnalysisSessionManager.getInstance();

            // Execute Python analysis using PythonExecutor
            const pythonResult: PythonExecutionResult = await PythonExecutor.executeAnalysis(
                'FileXRAnalysis',
                filePath,
                context
            );

            if (pythonResult.success && pythonResult.data) {
                console.log(`GET_NECESSARY_FILES: FileXR analysis completed successfully`);
                console.log(`GET_NECESSARY_FILES: XR Analysis data.json:`, JSON.stringify(pythonResult.data, null, 2));

                // Add source file content to session if sessionId provided
                if (sessionId) {
                    try {
                        const fileUri = vscode.Uri.file(filePath);
                        const fileContent = await vscode.workspace.fs.readFile(fileUri);
                        const sourceContent = Buffer.from(fileContent).toString('utf8');
                        await sessionManager.addFileToSession(sessionId, require('path').basename(filePath), sourceContent);
                    } catch (error) {
                        console.warn(`GET_NECESSARY_FILES: Could not read source file for session: ${error}`);
                    }
                }

                // Parse XR visualization template using boats chart
                console.log(`GET_NECESSARY_FILES: Starting XR visualization template parsing...`);
                const templateResult: ParsedTemplateFiles = await ParseTemplates.parseXRVisualizationTemplate(
                    context,
                    {
                        analysisData: pythonResult.data,
                        fileName: require('path').basename(filePath),
                        filePath: filePath,
                        title: `XR Analysis - ${require('path').basename(filePath)}`,
                        chartId: 'boats' // Use boats chart for XR analysis
                    }
                );

                if (templateResult.success) {
                    console.log(`GET_NECESSARY_FILES: XR visualization template files received successfully`);
                    console.log(`GET_NECESSARY_FILES: - HTML file: ${templateResult.indexHtml.length} characters`);
                    console.log(`GET_NECESSARY_FILES: - JS file: ${templateResult.jsContent.length} characters`);

                    // Add template files to session if sessionId provided
                    if (sessionId) {
                        await sessionManager.addFileToSession(sessionId, 'index.html', templateResult.indexHtml);
                        await sessionManager.addFileToSession(sessionId, 'main.js', templateResult.jsContent);
                        
                        // Add analysis data as JSON to session
                        const dataJson = JSON.stringify(pythonResult.data, null, 2);
                        await sessionManager.addFileToSession(sessionId, 'data.json', dataJson);
                    }

                    return {
                        success: true,
                        data: pythonResult.data,
                        indexHtml: templateResult.indexHtml,
                        jsContent: templateResult.jsContent,
                        filePath: filePath,
                        analysisType: 'FileXRAnalysis'
                    };
                } else {
                    console.error(`GET_NECESSARY_FILES: XR template parsing failed:`, templateResult.error);
                    return {
                        success: false,
                        error: `XR template parsing failed: ${templateResult.error}`,
                        filePath: filePath,
                        analysisType: 'FileXRAnalysis'
                    };
                }
            } else {
                console.error(`GET_NECESSARY_FILES: FileXR analysis failed:`, pythonResult.error);
                return {
                    success: false,
                    error: pythonResult.error || 'Unknown error during XR analysis',
                    filePath: filePath,
                    analysisType: 'FileXRAnalysis'
                };
            }

        } catch (error) {
            console.error(`GET_NECESSARY_FILES: Error in getAnalysisFileXR:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                filePath: filePath,
                analysisType: 'FileXRAnalysis'
            };
        }
    }
}
