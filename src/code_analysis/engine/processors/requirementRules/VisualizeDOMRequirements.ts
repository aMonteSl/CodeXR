import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { AnalysisBootstrap } from '../analysisBootstrap';

export class VisualizeDOMRequirements {
    private analysisBootstrap: AnalysisBootstrap;

    constructor(context: vscode.ExtensionContext) {
        this.analysisBootstrap = new AnalysisBootstrap(context);
    }

    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        return this.analysisBootstrap.bootstrap(session, theme);
    }

    public static getSupportedExtensions(): string[] {
        return ['.html', '.htm', '.xhtml'];
    }

    public static canVisualizeFile(filePath: string): boolean {
        const fileExtension = path.extname(filePath).toLowerCase();
        return this.getSupportedExtensions().includes(fileExtension);
    }
}
