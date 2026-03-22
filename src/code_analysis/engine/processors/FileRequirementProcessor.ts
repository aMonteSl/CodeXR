import * as vscode from 'vscode';
import { ThemeUtils } from '../utils/themeUtils';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { AnalysisBootstrap, BootstrapProcessedRequirements } from './analysisBootstrap';

export interface FileRequirement {
    filePath: string;
    fileName: string;
    fileType: 'template';
    priority: 'critical';
    extractionStrategy: 'full';
    reason: string;
}

export interface ProcessedRequirements {
    sessionId: string;
    analysisMode: string;
    targetPath: string;
    loadedFiles: Map<string, string>;
    estimatedComplexity: 'low';
    processingTime: Date;
}

export class FileRequirementProcessor {
    private analysisBootstrap: AnalysisBootstrap;

    constructor(context: vscode.ExtensionContext) {
        console.log('FILE_REQUIREMENT_PROCESSOR: Initializing FileRequirementProcessor...');
        this.analysisBootstrap = new AnalysisBootstrap(context);
        ThemeUtils.initialize(context);
        console.log('FILE_REQUIREMENT_PROCESSOR: ThemeUtils initialized');
        console.log('FILE_REQUIREMENT_PROCESSOR: AnalysisBootstrap initialized');
    }

    public async processRequirements(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`FILE_REQUIREMENT_PROCESSOR:  Processing requirements for session ${session.id}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Analysis mode: ${session.analysisMode}, Target type: ${session.targetType}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Target path: ${session.targetPath}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Theme: ${theme || 'default'}`);

        try {
            const requirements: BootstrapProcessedRequirements = await this.analysisBootstrap.bootstrap(session, theme);

            console.log(`FILE_REQUIREMENT_PROCESSOR:  Requirements processed successfully for session ${session.id}`);
            console.log(`FILE_REQUIREMENT_PROCESSOR: Total files loaded: ${requirements.loadedFiles.size}`);
            console.log(`FILE_REQUIREMENT_PROCESSOR: Estimated complexity: ${requirements.estimatedComplexity}`);

            return requirements;
        } catch (error) {
            console.error(`FILE_REQUIREMENT_PROCESSOR:  Error processing requirements for session ${session.id}:`, error);
            throw error;
        }
    }
}
