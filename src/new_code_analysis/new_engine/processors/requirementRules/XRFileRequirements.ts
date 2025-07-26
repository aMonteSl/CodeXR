import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { FileXRParser } from '../../parsers';

/**
 * XR File Requirements Processor
 * Handles the specific requirements for XR file analysis
 */
export class XRFileRequirements {
    private context: vscode.ExtensionContext;
    private fileXRParser: FileXRParser;

    constructor(context: vscode.ExtensionContext) {
        console.log('XR_FILE_REQUIREMENTS: Initializing XRFileRequirements...');
        this.context = context;
        this.fileXRParser = new FileXRParser(context);
        console.log('XR_FILE_REQUIREMENTS: XRFileRequirements initialized');
    }

    /**
     * Get required files for XR file analysis
     * This method delegates to FileXRParser for processing chart configuration and validation
     */
    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`XR_FILE_REQUIREMENTS: 🎯 Getting XR file requirements for session ${session.id}`);
        console.log(`XR_FILE_REQUIREMENTS: Target file: ${session.targetPath}`);
        console.log(`XR_FILE_REQUIREMENTS: Theme: ${theme || 'default'}`);

        try {
            // Delegate to FileXRParser to handle configuration validation and template processing
            const processedFiles = await this.fileXRParser.parseFileAnalysis(session, theme);

            // Create ProcessedRequirements structure
            const requirements: ProcessedRequirements = {
                sessionId: session.id,
                analysisMode: 'XR',
                targetPath: session.targetPath,
                loadedFiles: processedFiles.loadedFiles,
                estimatedComplexity: 'low',
                processingTime: new Date()
            };

            console.log(`XR_FILE_REQUIREMENTS: ✅ XR file requirements processed successfully`);
            console.log(`XR_FILE_REQUIREMENTS: Total files loaded: ${requirements.loadedFiles.size}`);

            return requirements;

        } catch (error) {
            console.error(`XR_FILE_REQUIREMENTS: ❌ Error processing XR file requirements:`, error);
            throw error;
        }
    }
}
