/**
 * Parse Templates for Analysis
 * Handles template parsing and file generation for different analysis types
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { TemplateHTMLProcessor, HTMLTemplateData } from '../../../babia_templates/processing/templateHTMLProcessor';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';

export interface ParsedTemplateFiles {
    indexHtml: string;
    cssContent: string;
    jsContent: string;
    success: boolean;
    error?: string;
}

export class ParseTemplates {

    /**
     * Parse LivePanel Files template for File Live Panel analysis
     */
    static async parseLivePanelFilesTemplate(
        context: vscode.ExtensionContext,
        analysisData: any,
        theme?: string
    ): Promise<ParsedTemplateFiles> {
        try {
            console.log(`PARSE_TEMPLATES: Starting LivePanel Files template parsing`);

            // Define template paths
            const templateDir = path.join(context.extensionPath, 'templates', 'analysis_livePanel', 'file');
            const htmlPath = path.join(templateDir, 'fileAnalysis.html');
            const cssPath = path.join(templateDir, 'fileAnalysisstyle.css');
            const jsPath = path.join(templateDir, 'fileAnalysismain.js');

            // Check if template files exist
            if (!fs.existsSync(htmlPath)) {
                throw new Error(`HTML template not found at: ${htmlPath}`);
            }
            if (!fs.existsSync(cssPath)) {
                throw new Error(`CSS template not found at: ${cssPath}`);
            }
            if (!fs.existsSync(jsPath)) {
                throw new Error(`JS template not found at: ${jsPath}`);
            }

            // Read template files
            console.log(`PARSE_TEMPLATES: Reading template files from: ${templateDir}`);
            const htmlTemplate = fs.readFileSync(htmlPath, 'utf-8');
            const cssTemplate = fs.readFileSync(cssPath, 'utf-8');
            const jsTemplate = fs.readFileSync(jsPath, 'utf-8');

            // Generate nonce for security and process HTML directly
            const nonce = generateNonce();
            const themeClass = theme === 'Light' ? 'light-theme' : 'dark-theme';
            const themeValue = theme === 'Light' ? 'light' : 'dark';
            
            // Inject theme initialization script
            const themeScript = `<script nonce="${nonce}">window.initialTheme = '${themeValue}';</script>`;
            
            const parsedHtml = htmlTemplate
                .replace(/\$\{nonce\}/g, nonce)
                .replace(/\$\{styleUri\}/g, './style.css')
                .replace(/\$\{scriptUri\}/g, './main.js')
                .replace(/\$\{theme\}/g, themeClass)
                .replace(/<\/head>/, `${themeScript}\n</head>`);

            console.log(`PARSE_TEMPLATES: Template parsing completed successfully`);
            
            return {
                indexHtml: parsedHtml,
                cssContent: cssTemplate,
                jsContent: jsTemplate,
                success: true
            };

        } catch (error) {
            console.log(`PARSE_TEMPLATES: Error parsing LivePanel Files template:`, error);
            return {
                indexHtml: '',
                cssContent: '',
                jsContent: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Parse DOM Visualization template for HTML DOM analysis
     */
    static async parseDOMVisualizationTemplate(
        context: vscode.ExtensionContext,
        domData: { htmlContent: string; fileName: string; filePath: string; title?: string }
    ): Promise<ParsedTemplateFiles> {
        try {
            console.log(`PARSE_TEMPLATES: Starting DOM Visualization template parsing`);
            console.log(`PARSE_TEMPLATES: File: ${domData.fileName}`);
            console.log(`PARSE_TEMPLATES: HTML content length: ${domData.htmlContent.length}`);

            // Validate template data
            const templateData: HTMLTemplateData = {
                htmlContent: domData.htmlContent,
                fileName: domData.fileName,
                filePath: domData.filePath,
                title: domData.title
            };

            if (!TemplateHTMLProcessor.validateTemplateData(templateData)) {
                throw new Error('Invalid template data provided');
            }

            // Process HTML template using TemplateHTMLProcessor
            const processingResult = await TemplateHTMLProcessor.processHTMLTemplate(
                templateData,
                context
            );

            if (!processingResult.success) {
                throw new Error(`Template processing failed: ${processingResult.error}`);
            }

            console.log(`PARSE_TEMPLATES: DOM Visualization template processing completed successfully`);
            console.log(`PARSE_TEMPLATES: Generated HTML length: ${processingResult.indexHtml?.length || 0}`);
            console.log(`PARSE_TEMPLATES: Generated JS length: ${processingResult.jsContent?.length || 0}`);

            return {
                indexHtml: processingResult.indexHtml || '',
                cssContent: '', // DOM visualization uses inline styles in template
                jsContent: processingResult.jsContent || '',
                success: true,
                error: undefined
            };

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error parsing DOM Visualization template:`, error);
            return {
                indexHtml: '',
                cssContent: '',
                jsContent: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Parse XR Visualization template for XR analysis with boats chart
     */
    static async parseXRVisualizationTemplate(
        context: vscode.ExtensionContext,
        xrData: { 
            analysisData: any; 
            fileName: string; 
            filePath: string; 
            title?: string;
            chartId: string;
        }
    ): Promise<ParsedTemplateFiles> {
        try {
            console.log(`PARSE_TEMPLATES: Starting XR Visualization template parsing`);
            console.log(`PARSE_TEMPLATES: File: ${xrData.fileName}`);
            console.log(`PARSE_TEMPLATES: Chart ID: ${xrData.chartId}`);
            console.log(`PARSE_TEMPLATES: Analysis data:`, xrData.analysisData);

            // Prepare dimension mappings for boats chart (area=parameters, height=lineCount, color=complexity)
            const mappings = TemplateProcessor.createDefaultXRMappings();
            console.log(`PARSE_TEMPLATES: Using dimension mappings:`, mappings);

            // Prepare data source path (this will be replaced with actual data.json path)
            const dataSource = './data.json';

            // Generate temporary output path for template processing
            const tempOutputPath = require('path').join(require('os').tmpdir(), 'xr-template-temp.html');

            // Generate XR visualization using the modular TemplateProcessor
            const result = await TemplateProcessor.generateXRVisualization(
                xrData.chartId,
                mappings,
                xrData.title || `XR Analysis - ${xrData.fileName}`,
                dataSource,
                context,
                tempOutputPath
            );

            if (!result.success) {
                throw new Error(`XR visualization generation failed: ${result.error}`);
            }

            // Read the generated HTML file
            const fs = require('fs');
            const generatedHtml = fs.readFileSync(tempOutputPath, 'utf8');

            // Clean up temporary file
            try {
                fs.unlinkSync(tempOutputPath);
            } catch (cleanupError) {
                console.warn(`PARSE_TEMPLATES: Could not clean up temp file: ${tempOutputPath}`);
            }

            // Generate SSE JavaScript content for XR mode
            const sseJsContent = await this.loadXRSSEScript(context);

            console.log(`PARSE_TEMPLATES: XR Visualization template processing completed successfully`);
            console.log(`PARSE_TEMPLATES: Generated HTML length: ${generatedHtml.length}`);
            console.log(`PARSE_TEMPLATES: Generated JS length: ${sseJsContent.length}`);

            return {
                indexHtml: generatedHtml,
                cssContent: '', // XR templates include inline styles
                jsContent: sseJsContent,
                success: true,
                error: undefined
            };

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error parsing XR Visualization template:`, error);
            return {
                indexHtml: '',
                cssContent: '',
                jsContent: '',
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Load XR SSE script for live updates
     * @private
     */
    private static async loadXRSSEScript(context: vscode.ExtensionContext): Promise<string> {
        try {
            const fs = require('fs');
            const path = require('path');
            
            const sseScriptPath = path.join(
                context.extensionPath,
                'templates',
                'xr',
                'sse',
                'live_sse_fileXR.js'
            );

            if (!fs.existsSync(sseScriptPath)) {
                console.warn(`PARSE_TEMPLATES: XR SSE script not found at: ${sseScriptPath}`);
                return '';
            }

            const sseScript = fs.readFileSync(sseScriptPath, 'utf8');
            console.log(`PARSE_TEMPLATES: XR SSE script loaded successfully, length: ${sseScript.length}`);
            
            return sseScript;

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error loading XR SSE script:`, error);
            return '';
        }
    }
}
