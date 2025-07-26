import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { VisualizeDOMParser } from '../../parsers/visualizeDOMParser';
import { ExecutePython } from '../../utils/executePython';

/**
 * Handles template files for VisualizeDOM analysis
 * 
 * This class:
 * - Determines which templates are needed for DOM visualization
 * - Calls VisualizeDOMParser to load and process templates
 * - Returns loaded and processed files for HTML DOM visualization
 */
export class VisualizeDOMRequirements {
    private visualizeDOMParser: VisualizeDOMParser;
    private executePython: ExecutePython;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('VISUALIZE_DOM_REQUIREMENTS: 🌐 Initializing VisualizeDOMRequirements...');
        this.context = context;
        this.visualizeDOMParser = new VisualizeDOMParser(context);
        this.executePython = new ExecutePython(context);
        console.log('VISUALIZE_DOM_REQUIREMENTS: ✅ VisualizeDOMRequirements initialized successfully');
    }

    /**
     * Gets loaded template files for VisualizeDOM analysis
     * 
     * @param session - Unified analysis session
     * @param theme - Current user theme (optional, defaults to 'vscode-light')
     * @returns Promise with loaded and processed template files
     */
    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`VISUALIZE_DOM_REQUIREMENTS: 🎯 Getting template files for VisualizeDOM analysis`);
        console.log(`VISUALIZE_DOM_REQUIREMENTS: Target: ${session.targetName} (${session.targetType})`);
        console.log(`VISUALIZE_DOM_REQUIREMENTS: Session ID: ${session.id}`);
        console.log(`VISUALIZE_DOM_REQUIREMENTS: Theme: ${theme || 'default'}`);

        try {
            // STEP 1: Validate that we have a file (VisualizeDOM only works with files)
            if (session.targetType !== 'file') {
                console.error(`VISUALIZE_DOM_REQUIREMENTS: ❌ VisualizeDOM only supports files, not ${session.targetType}`);
                throw new Error(`VisualizeDOM analysis only supports files, not ${session.targetType}`);
            }

            // STEP 2: Validate HTML file extension
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 📄 Step 1 - Validating HTML file: ${session.targetPath}`);
            const isValidHTMLFile = this.validateHTMLFile(session.targetPath);
            if (!isValidHTMLFile) {
                console.error(`VISUALIZE_DOM_REQUIREMENTS: ❌ File ${session.targetName} is not a valid HTML file`);
                throw new Error(`File ${session.targetName} is not a valid HTML file for DOM visualization`);
            }
            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ HTML file validation passed`);

            // STEP 3: Read HTML content directly from file (NO PYTHON FOR NOW)
            console.log(`VISUALIZE_DOM_REQUIREMENTS: � Step 2 - Reading HTML content directly from file...`);
            const htmlContent = await this.readHTMLFile(session.targetPath);
            
            if (!htmlContent || htmlContent.trim().length === 0) {
                console.error(`VISUALIZE_DOM_REQUIREMENTS: ❌ No HTML content found in file`);
                throw new Error(`No HTML content found in file: ${session.targetName}`);
            }
            
            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ HTML content read successfully`);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 📄 HTML content length: ${htmlContent.length}`);

            // STEP 4: Process templates using the parser with HTML content
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔧 Step 3 - Processing VisualizeDOM templates...`);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: � Passing to visualizeDOMParser:`, {
                fileName: session.targetName,
                filePath: session.targetPath,
                title: `DOM Visualization - ${session.targetName}`,
                htmlContentLength: htmlContent.length
            });
            
            const processedFiles = await this.visualizeDOMParser.processHTMLTemplates({
                htmlContent: htmlContent, // Use the HTML content directly
                fileName: session.targetName,
                filePath: session.targetPath,
                title: `DOM Visualization - ${session.targetName}`
            }, theme);

            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ Template processing completed`);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 📋 Generated ${processedFiles.size} template files`);

            // STEP 5: Log details of processed files
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 DEBUG - Processed files details:`);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 DEBUG - processedFiles type:`, typeof processedFiles);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 DEBUG - processedFiles instanceof Map:`, processedFiles instanceof Map);
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 DEBUG - processedFiles.size:`, processedFiles.size);
            
            if (processedFiles.size > 0) {
                console.log(`VISUALIZE_DOM_REQUIREMENTS: 📋 Processed template files:`);
                for (const [fileName, content] of processedFiles) {
                    console.log(`VISUALIZE_DOM_REQUIREMENTS: 📄 ${fileName} (${content.length} chars)`);
                }
            } else {
                console.warn(`VISUALIZE_DOM_REQUIREMENTS: ⚠️ No files were generated by the parser!`);
            }

            // STEP 6: Prepare return object
            const returnObject = {
                sessionId: session.id,
                analysisMode: session.analysisMode,
                targetPath: session.targetPath,
                loadedFiles: processedFiles,
                estimatedComplexity: 'low' as const,
                processingTime: new Date()
            };
            
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 DEBUG - Return object:`, {
                sessionId: returnObject.sessionId,
                analysisMode: returnObject.analysisMode,
                targetPath: returnObject.targetPath,
                loadedFilesSize: returnObject.loadedFiles.size,
                estimatedComplexity: returnObject.estimatedComplexity
            });

            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ Requirements processing completed successfully`);
            return returnObject;

        } catch (error) {
            console.error(`VISUALIZE_DOM_REQUIREMENTS: ❌ Error getting required files:`, error);
            
            return {
                sessionId: session.id,
                analysisMode: session.analysisMode,
                targetPath: session.targetPath,
                loadedFiles: new Map(),
                estimatedComplexity: 'low',
                processingTime: new Date()
            };
        }
    }

    /**
     * Validate if file is a supported HTML file
     * @private
     */
    private validateHTMLFile(filePath: string): boolean {
        const supportedExtensions = ['.html', '.htm', '.xhtml'];
        const fileExtension = path.extname(filePath).toLowerCase();
        
        console.log(`VISUALIZE_DOM_REQUIREMENTS: 🔍 Checking file extension: ${fileExtension}`);
        
        const isValid = supportedExtensions.includes(fileExtension);
        if (isValid) {
            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ File extension ${fileExtension} is supported`);
        } else {
            console.log(`VISUALIZE_DOM_REQUIREMENTS: ❌ File extension ${fileExtension} not supported. Supported: ${supportedExtensions.join(', ')}`);
        }
        
        return isValid;
    }

    /**
     * Get supported HTML file extensions
     */
    public static getSupportedExtensions(): string[] {
        return ['.html', '.htm', '.xhtml'];
    }

    /**
     * Read HTML content from file
     * @private
     */
    private async readHTMLFile(filePath: string): Promise<string> {
        try {
            console.log(`VISUALIZE_DOM_REQUIREMENTS: 📖 Reading HTML file: ${filePath}`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            const htmlContent = fs.readFileSync(filePath, 'utf-8');
            console.log(`VISUALIZE_DOM_REQUIREMENTS: ✅ HTML file read successfully (${htmlContent.length} chars)`);
            
            return htmlContent;
            
        } catch (error) {
            console.error(`VISUALIZE_DOM_REQUIREMENTS: ❌ Error reading HTML file:`, error);
            throw error;
        }
    }
}
