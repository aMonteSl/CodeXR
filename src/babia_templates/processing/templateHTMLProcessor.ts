/**
 * Template HTML Processor
 * Specialized processor for HTML DOM visualization templates
 * Handles template processing, placeholder replacement, and HTML generation for DOM visualization
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getVisualizationConfiguration, VisualizationSettings } from '../../utils/getVisualizationConfiguration';
import { generateNonce } from '../../utils/nonceGenerator';

export interface HTMLTemplateData {
    htmlContent: string;
    fileName: string;
    filePath: string;
    title?: string;
}

export interface HTMLProcessingResult {
    success: boolean;
    indexHtml?: string;
    jsContent?: string;
    error?: string;
}

/**
 * Template HTML Processor for DOM Visualization
 */
export class TemplateHTMLProcessor {

    /**
     * Process HTML DOM visualization template
     * @param templateData The HTML content and metadata
     * @param context VS Code extension context
     * @returns Processed HTML and JS content
     */
    static async processHTMLTemplate(
        templateData: HTMLTemplateData,
        context: vscode.ExtensionContext
    ): Promise<HTMLProcessingResult> {
        try {
            console.log('TEMPLATE_HTML_PROCESSOR: Starting HTML template processing...');
            console.log('TEMPLATE_HTML_PROCESSOR: File:', templateData.fileName);
            console.log('TEMPLATE_HTML_PROCESSOR: HTML content length:', templateData.htmlContent.length);

            // 1. Load DOM visualization template
            const templateHtml = await this.loadDOMTemplate(context);
            if (!templateHtml) {
                return {
                    success: false,
                    error: 'Failed to load DOM visualization template'
                };
            }

            // 2. Load HTML live reload JavaScript
            const jsContent = await this.loadHTMLLiveReloadJS(context);
            if (!jsContent) {
                return {
                    success: false,
                    error: 'Failed to load HTML live reload JavaScript'
                };
            }

            // 3. Get visualization settings
            const visualizationSettings = await getVisualizationConfiguration();

            // 4. Prepare template variables
            const templateVariables = this.prepareTemplateVariables(
                templateData,
                visualizationSettings
            );

            // 5. Replace placeholders in HTML template
            const processedHtml = this.replacePlaceholders(templateHtml, templateVariables);

            // 6. Process JavaScript if needed (for now, return as-is)
            const processedJs = jsContent;

            console.log('TEMPLATE_HTML_PROCESSOR: Template processing completed successfully');
            console.log('TEMPLATE_HTML_PROCESSOR: Generated HTML length:', processedHtml.length);
            console.log('TEMPLATE_HTML_PROCESSOR: Generated JS length:', processedJs.length);

            // 🔍 DEBUG: Verify what we're about to return
            const returnResult = {
                success: true,
                indexHtml: processedHtml,
                jsContent: processedJs
            };

            console.log('TEMPLATE_HTML_PROCESSOR:  DEBUG - About to return result:', {
                success: returnResult.success,
                hasIndexHtml: !!returnResult.indexHtml,
                hasJsContent: !!returnResult.jsContent,
                indexHtmlLength: returnResult.indexHtml?.length || 0,
                jsContentLength: returnResult.jsContent?.length || 0,
                indexHtmlType: typeof returnResult.indexHtml,
                jsContentType: typeof returnResult.jsContent
            });

            console.log('TEMPLATE_HTML_PROCESSOR:  DEBUG - indexHtml preview:', returnResult.indexHtml?.substring(0, 100) + '...');
            console.log('TEMPLATE_HTML_PROCESSOR:  DEBUG - jsContent preview:', returnResult.jsContent?.substring(0, 100) + '...');

            return returnResult;

        } catch (error) {
            console.error('TEMPLATE_HTML_PROCESSOR: Error processing HTML template:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Load DOM visualization template from templates/xr/html/dom-visualization-template.html
     * @private
     */
    private static async loadDOMTemplate(context: vscode.ExtensionContext): Promise<string | null> {
        try {
            const templatePath = path.join(
                context.extensionPath,
                'templates',
                'xr',
                'html',
                'dom-visualization-template.html'
            );

            console.log('TEMPLATE_HTML_PROCESSOR: Loading template from:', templatePath);

            if (!fs.existsSync(templatePath)) {
                console.error('TEMPLATE_HTML_PROCESSOR: Template file not found:', templatePath);
                return null;
            }

            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            console.log('TEMPLATE_HTML_PROCESSOR: Template loaded successfully, length:', templateContent.length);
            
            return templateContent;

        } catch (error) {
            console.error('TEMPLATE_HTML_PROCESSOR: Error loading DOM template:', error);
            return null;
        }
    }

    /**
     * Load HTML live reload JavaScript from templates/xr/sse/live_sse_fileDOM.js
     * @private
     */
    private static async loadHTMLLiveReloadJS(context: vscode.ExtensionContext): Promise<string | null> {
        try {
            const jsPath = path.join(
                context.extensionPath,
                'templates',
                'xr',
                'sse',
                'live_sse_fileDOM.js'
            );

            console.log('TEMPLATE_HTML_PROCESSOR: Loading JS from:', jsPath);

            if (!fs.existsSync(jsPath)) {
                console.error('TEMPLATE_HTML_PROCESSOR: JS file not found:', jsPath);
                return null;
            }

            const jsContent = fs.readFileSync(jsPath, 'utf-8');
            console.log('TEMPLATE_HTML_PROCESSOR: JS loaded successfully, length:', jsContent.length);
            
            return jsContent;

        } catch (error) {
            console.error('TEMPLATE_HTML_PROCESSOR: Error loading HTML live reload JS:', error);
            return null;
        }
    }

    /**
     * Prepare template variables for placeholder replacement
     * @private
     */
    private static prepareTemplateVariables(
        templateData: HTMLTemplateData,
        visualizationSettings: VisualizationSettings
    ): Record<string, string> {
        // Escape HTML content for safe injection into babia-html attribute
        const escapedHtmlContent = this.escapeHtmlForAttribute(templateData.htmlContent);

        // Generate nonce for security
        const nonce = generateNonce();

        const variables = {
            // File metadata
            TITLE: templateData.title || `DOM Visualization - ${templateData.fileName}`,
            FILE_NAME: templateData.fileName,
            FILE_PATH: templateData.filePath,

            // HTML content for babia-html component
            HTML_CONTENT: escapedHtmlContent,
            HTML_CONTENT_JSON: this.escapeHtmlForJsonScript(templateData.htmlContent),

            // Visualization settings
            BACKGROUND_COLOR: visualizationSettings.backgroundColor,
            ENVIRONMENT_PRESET: visualizationSettings.environment,
            GROUND_COLOR: visualizationSettings.groundColor,
            PALETTE: visualizationSettings.palette,

            // Script loading (matches saveFiles.ts pattern)
            nonce: nonce,
            scriptUri: './main.js'
        };

        console.log('TEMPLATE_HTML_PROCESSOR: Template variables prepared:');
        console.log('TEMPLATE_HTML_PROCESSOR: - Title:', variables.TITLE);
        console.log('TEMPLATE_HTML_PROCESSOR: - File:', variables.FILE_NAME);
        console.log('TEMPLATE_HTML_PROCESSOR: - HTML content length:', templateData.htmlContent.length);
        console.log('TEMPLATE_HTML_PROCESSOR: - Environment:', variables.ENVIRONMENT_PRESET);
        console.log('TEMPLATE_HTML_PROCESSOR: - Background:', variables.BACKGROUND_COLOR);
        console.log('TEMPLATE_HTML_PROCESSOR: - Nonce:', variables.nonce);
        console.log('TEMPLATE_HTML_PROCESSOR: - Script URI:', variables.scriptUri);

        return variables;
    }

    /**
     * Replace placeholders in template with actual values
     * @private
     */
    private static replacePlaceholders(template: string, variables: Record<string, string>): string {
        let processedTemplate = template;

        // Replace each variable placeholder
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `\${${key}}`;
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            processedTemplate = processedTemplate.replace(regex, value);
            
            console.log(`TEMPLATE_HTML_PROCESSOR: Replaced ${placeholder} with value (${value.length} chars)`);
        }

        return processedTemplate;
    }

    /**
     * Escape HTML content for safe injection into HTML attribute
     * @private
     */
    private static escapeHtmlForAttribute(htmlContent: string): string {
        return htmlContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static escapeHtmlForJsonScript(htmlContent: string): string {
        return JSON.stringify(htmlContent)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    /**
     * Get supported HTML file extensions
     */
    static getSupportedExtensions(): string[] {
        return ['.html', '.htm', '.xhtml'];
    }

    /**
     * Validate HTML template data
     */
    static validateTemplateData(templateData: HTMLTemplateData): boolean {
        if (!templateData.htmlContent || templateData.htmlContent.trim().length === 0) {
            console.error('TEMPLATE_HTML_PROCESSOR: No HTML content provided');
            return false;
        }

        if (!templateData.fileName || templateData.fileName.trim().length === 0) {
            console.error('TEMPLATE_HTML_PROCESSOR: No file name provided');
            return false;
        }

        if (!templateData.filePath || templateData.filePath.trim().length === 0) {
            console.error('TEMPLATE_HTML_PROCESSOR: No file path provided');
            return false;
        }

        return true;
    }
}

