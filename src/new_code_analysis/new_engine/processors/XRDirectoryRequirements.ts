/**
 * XR Directory Requirements Processor
 * Handles the processing of directory analysis requirements for XR visualization
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { directoryXRParser } from '../parsers/directoryXRParser';

export interface XRDirectoryProcessingResult {
    success: boolean;
    loadedFiles: Map<string, string>;
    error?: string;
}

export class XRDirectoryRequirements {
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('XR_DIRECTORY_REQUIREMENTS: Initializing XR Directory Requirements processor...');
    }
    
    /**
     * Process directory XR analysis requirements
     * This will call directoryXRParser to generate the necessary files
     */
    async processDirectoryXRRequirements(session: UnifiedAnalysisSession): Promise<XRDirectoryProcessingResult> {
        console.log(`📁 XR_DIRECTORY_REQUIREMENTS: Processing XR requirements for directory: ${session.targetName}`);
        console.log(`🔗 XR_DIRECTORY_REQUIREMENTS: Chain: XRDirectoryRequirements → directoryXRParser → templateHTMLProcessor`);
        
        try {
            // Call directoryXRParser to generate XR visualization files
            console.log(`📊 XR_DIRECTORY_REQUIREMENTS: Calling directoryXRParser for session ${session.id}...`);
            const parsingResult = await directoryXRParser.parseDirectoryForXR(session, this.context);
            
            if (!parsingResult.success) {
                console.error(`❌ XR_DIRECTORY_REQUIREMENTS: Directory XR parsing failed:`, parsingResult.error);
                return {
                    success: false,
                    loadedFiles: new Map(),
                    error: parsingResult.error
                };
            }
            
            console.log(`✅ XR_DIRECTORY_REQUIREMENTS: Directory XR parsing completed successfully`);
            console.log(`📄 XR_DIRECTORY_REQUIREMENTS: Generated ${parsingResult.generatedFiles!.size} files:`);
            
            // Log each generated file
            for (const [fileName, content] of parsingResult.generatedFiles!) {
                console.log(`   📄 ${fileName} (${content.length} characters)`);
            }
            
            return {
                success: true,
                loadedFiles: parsingResult.generatedFiles!,
                error: undefined
            };
            
        } catch (error) {
            console.error(`❌ XR_DIRECTORY_REQUIREMENTS: Error processing directory XR requirements:`, error);
            return {
                success: false,
                loadedFiles: new Map(),
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
