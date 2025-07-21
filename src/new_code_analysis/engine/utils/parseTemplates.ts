/**
 * Parse Templates for Analysis
 * Handles template parsing and file generation for different analysis types
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { TemplateHTMLProcessor, HTMLTemplateData } from '../../../babia_templates/processing/templateHTMLProcessor';

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
        analysisData: any
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

            // Parse HTML template
            const parsedHtml = ParseTemplates.parseHtmlTemplate(htmlTemplate, context);

            // Parse CSS template (for now, just return as-is)
            const parsedCss = ParseTemplates.parseCssTemplate(cssTemplate);

            // Parse JS template (for now, just return as-is)
            const parsedJs = ParseTemplates.parseJsTemplate(jsTemplate);

            console.log(`PARSE_TEMPLATES: Template parsing completed successfully`);
            
            return {
                indexHtml: parsedHtml,
                cssContent: parsedCss,
                jsContent: parsedJs,
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
     * Parse HTML template and replace placeholders
     */
    private static parseHtmlTemplate(htmlTemplate: string, context: vscode.ExtensionContext): string {
        try {
            // Generate nonce for security
            const nonce = generateNonce();

            // Replace all placeholders in the HTML template
            let parsedHtml = htmlTemplate;

            // Replace nonce placeholder
            parsedHtml = parsedHtml.replace(/\$\{nonce\}/g, nonce);
            
            // Replace styleUri placeholder - for now we'll use inline CSS approach
            parsedHtml = parsedHtml.replace(/\$\{styleUri\}/g, './style.css');
            
            // Replace scriptUri placeholder - for now we'll use relative path
            parsedHtml = parsedHtml.replace(/\$\{scriptUri\}/g, './main.js');

            console.log(`PARSE_TEMPLATES: HTML template parsed with nonce: ${nonce}`);
            console.log(`PARSE_TEMPLATES: Replaced styleUri with: ./style.css`);
            console.log(`PARSE_TEMPLATES: Replaced scriptUri with: ./main.js`);
            
            return parsedHtml;

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error parsing HTML template:`, error);
            return htmlTemplate; // Return original if parsing fails
        }
    }

    /**
     * Parse CSS template
     */
    private static parseCssTemplate(cssTemplate: string): string {
        try {
            // For now, return CSS as-is
            // In the future, we could add variable substitution or minification
            console.log(`PARSE_TEMPLATES: CSS template parsed successfully`);
            return cssTemplate;

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error parsing CSS template:`, error);
            return cssTemplate; // Return original if parsing fails
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
     * Parse JS template
     */
    private static parseJsTemplate(jsTemplate: string): string {
        try {
            // For now, return JS as-is
            // In the future, we could add variable substitution or minification
            console.log(`PARSE_TEMPLATES: JS template parsed successfully`);
            return jsTemplate;

        } catch (error) {
            console.error(`PARSE_TEMPLATES: Error parsing JS template:`, error);
            return jsTemplate; // Return original if parsing fails
        }
    }
}
