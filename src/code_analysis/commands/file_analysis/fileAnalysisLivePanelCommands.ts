/**
 * File Analysis LivePanel Commands
 * Commands for analyzing individual files in LivePanel mode.
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class FileAnalysisLivePanelCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        const commands = new FileAnalysisLivePanelCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.analyzeFile',
                callback: (uri?: vscode.Uri) => commands.analyzeFileLivePanel(uri),
                description: 'Analyze file in LivePanel mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze file in LivePanel mode'
            }
        ];
    }

    private async analyzeFileLivePanel(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;

            if (uri) {
                filePath = uri.fsPath;
                console.log(`FILE_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from context menu for: ${filePath}`);
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for LivePanel analysis');
                    return;
                }
                filePath = activeEditor.document.fileName;
                console.log(`FILE_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from command palette for: ${filePath}`);
            }

            await AnalysisOrchestrator.orchestrateAnalysis(filePath, 'LivePanel', 'file', this.context, false);
        } catch (error) {
            console.error('FILE_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel analyze file command:', error);
            vscode.window.showErrorMessage(`CodeXR: LivePanel analysis failed - ${error}`);
        }
    }
}

