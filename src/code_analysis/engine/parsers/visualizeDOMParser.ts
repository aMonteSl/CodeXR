import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateHTMLProcessor, HTMLTemplateData } from '../../../babia_templates/processing/templateHTMLProcessor';
import {
    readVirtualScreenRuntimeContent,
    VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME,
} from '../components/customComponents';

/**
 * VisualizeDOM Parser - Bridge to TemplateHTMLProcessor
 * 
 * This class:
 * - Acts as a bridge between the new engine and the existing templateHTMLProcessor
 * - Processes HTML files for DOM visualization
 * - Returns processed template files ready for visualization
 */
export class VisualizeDOMParser {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('VISUALIZE_DOM_PARSER:  Initializing VisualizeDOMParser...');
        this.context = context;
        console.log('VISUALIZE_DOM_PARSER:  VisualizeDOMParser initialized successfully');
    }

    /**
     * Process HTML templates for DOM visualization
     * This is essentially a bridge to the templateHTMLProcessor
     * 
     * @param templateData - HTML content and metadata
     * @param theme - Current user theme (optional)
     * @returns Map with fileName -> processed content
     */
    public async processHTMLTemplates(
        templateData: HTMLTemplateData, 
        theme?: string,
        virtualScreenSessionId?: string,
    ): Promise<Map<string, string>> {
        console.log(`VISUALIZE_DOM_PARSER:  Processing HTML templates for DOM visualization`);
        console.log(`VISUALIZE_DOM_PARSER: File: ${templateData.fileName}`);
        console.log(`VISUALIZE_DOM_PARSER: HTML content length: ${templateData.htmlContent.length}`);
        console.log(`VISUALIZE_DOM_PARSER: Theme: ${theme || 'default'}`);

        try {
            // STEP 1: Validate template data
            console.log(`VISUALIZE_DOM_PARSER:  Step 1 - Validating template data...`);
            if (!TemplateHTMLProcessor.validateTemplateData(templateData)) {
                console.error(`VISUALIZE_DOM_PARSER:  Template data validation failed`);
                throw new Error('Invalid template data provided');
            }
            console.log(`VISUALIZE_DOM_PARSER:  Template data validation passed`);

            // STEP 2: Call templateHTMLProcessor to get processed HTML and JS
            console.log(`VISUALIZE_DOM_PARSER:  Step 2 - Calling TemplateHTMLProcessor...`);
            console.log(`VISUALIZE_DOM_PARSER:  Calling with templateData:`, {
                fileName: templateData.fileName,
                filePath: templateData.filePath,
                title: templateData.title,
                htmlContentLength: templateData.htmlContent.length
            });
            
            const processingResult = await TemplateHTMLProcessor.processHTMLTemplate(
                templateData,
                this.context
            );

            // 🔍 DEBUG: Log detailed information about what templateHTMLProcessor returned
            console.log(`VISUALIZE_DOM_PARSER:  TemplateHTMLProcessor returned:`, {
                
                success: processingResult.success,
                hasIndexHtml: !!processingResult.indexHtml,
                hasJsContent: !!processingResult.jsContent,
                indexHtmlLength: processingResult.indexHtml?.length || 0,
                jsContentLength: processingResult.jsContent?.length || 0,
                error: processingResult.error || 'No error'
            });

            if (!processingResult.success) {
                console.error(`VISUALIZE_DOM_PARSER:  TemplateHTMLProcessor failed:`, processingResult.error);
                throw new Error(`Template processing failed: ${processingResult.error}`);
            }

            if (!processingResult.indexHtml || !processingResult.jsContent) {
                console.error(`VISUALIZE_DOM_PARSER:  TemplateHTMLProcessor returned incomplete data:`, {
                    hasIndexHtml: !!processingResult.indexHtml,
                    hasJsContent: !!processingResult.jsContent
                });
                throw new Error('TemplateHTMLProcessor returned incomplete data');
            }

            console.log(`VISUALIZE_DOM_PARSER:  TemplateHTMLProcessor returned complete data`);
            console.log(`VISUALIZE_DOM_PARSER:  indexHtml: ${processingResult.indexHtml.length} chars`);
            console.log(`VISUALIZE_DOM_PARSER:  jsContent: ${processingResult.jsContent.length} chars`);

            // STEP 3: Create result Map with the two files from templateHTMLProcessor
            console.log(`VISUALIZE_DOM_PARSER:  Step 3 - Creating result Map...`);
            const resultFiles = new Map<string, string>();

            // Add index.html from templateHTMLProcessor
            resultFiles.set('index.html', processingResult.indexHtml);
            console.log(`VISUALIZE_DOM_PARSER:  Added index.html (${processingResult.indexHtml.length} chars)`);

            // Add main.js from templateHTMLProcessor 
            resultFiles.set('main.js', processingResult.jsContent);
            console.log(`VISUALIZE_DOM_PARSER:  Added main.js (${processingResult.jsContent.length} chars)`);
            const virtualScreenRuntime = await readVirtualScreenRuntimeContent(this.context.extensionPath);
            resultFiles.set(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntime);
            console.log(`VISUALIZE_DOM_PARSER:  Added ${VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME} (${virtualScreenRuntime.length} chars)`);

            // 🔍 FINAL DEBUG: Verify the result Map
            console.log(`VISUALIZE_DOM_PARSER:  FINAL DEBUG - Result Map verification:`);
            console.log(`VISUALIZE_DOM_PARSER:  Map size: ${resultFiles.size}`);
            console.log(`VISUALIZE_DOM_PARSER:  Map keys: [${Array.from(resultFiles.keys()).join(', ')}]`);
            console.log(`VISUALIZE_DOM_PARSER:  Map instanceof Map: ${resultFiles instanceof Map}`);

            // Test iteration
            console.log(`VISUALIZE_DOM_PARSER:  Testing iteration:`);
            let count = 0;
            for (const [fileName, content] of resultFiles) {
                count++;
                console.log(`VISUALIZE_DOM_PARSER:  File ${count}: ${fileName} (${content.length} chars)`);
            }

            console.log(`VISUALIZE_DOM_PARSER:  Successfully created Map with ${resultFiles.size} files`);
            return resultFiles;

        } catch (error) {
            console.error(`VISUALIZE_DOM_PARSER:  Error processing HTML templates:`, error);
            throw error;
        }
    }

    /**
     * Get supported file extensions for DOM visualization
     */
    public static getSupportedExtensions(): string[] {
        return TemplateHTMLProcessor.getSupportedExtensions();
    }

    /**
     * Validate if a file can be processed for DOM visualization
     */
    public static canProcessFile(filePath: string): boolean {
        const supportedExtensions = this.getSupportedExtensions();
        const fileExtension = path.extname(filePath).toLowerCase();
        
        console.log(`VISUALIZE_DOM_PARSER:  Checking if file can be processed: ${filePath}`);
        console.log(`VISUALIZE_DOM_PARSER:  File extension: ${fileExtension}`);
        
        const canProcess = supportedExtensions.includes(fileExtension);
        if (canProcess) {
            console.log(`VISUALIZE_DOM_PARSER:  File ${filePath} can be processed`);
        } else {
            console.log(`VISUALIZE_DOM_PARSER:  File ${filePath} cannot be processed. Supported: ${supportedExtensions.join(', ')}`);
        }
        
        return canProcess;
    }
}




