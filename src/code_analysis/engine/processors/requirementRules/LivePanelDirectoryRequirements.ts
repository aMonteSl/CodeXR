import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { AnalysisBootstrap } from '../analysisBootstrap';

export class LivePanelDirectoryRequirements {
    private analysisBootstrap: AnalysisBootstrap;

    constructor(context: vscode.ExtensionContext) {
        this.analysisBootstrap = new AnalysisBootstrap(context);
    }

    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        return this.analysisBootstrap.bootstrap(session, theme);
    }
}
