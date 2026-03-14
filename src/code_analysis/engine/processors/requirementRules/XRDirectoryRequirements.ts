import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { AnalysisBootstrap } from '../analysisBootstrap';

export interface XRDirectoryProcessingResult {
    success: boolean;
    loadedFiles: Map<string, string>;
    error?: string;
}

export class XRDirectoryRequirements {
    private analysisBootstrap: AnalysisBootstrap;

    constructor(context: vscode.ExtensionContext) {
        this.analysisBootstrap = new AnalysisBootstrap(context);
    }

    async processDirectoryXRRequirements(session: UnifiedAnalysisSession): Promise<XRDirectoryProcessingResult> {
        try {
            const requirements = await this.analysisBootstrap.bootstrap(session);
            return {
                success: true,
                loadedFiles: requirements.loadedFiles,
            };
        } catch (error) {
            return {
                success: false,
                loadedFiles: new Map(),
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
