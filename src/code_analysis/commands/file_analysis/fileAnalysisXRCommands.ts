/**
 * File Analysis XR Commands
 * Commands for analyzing individual files in XR mode.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageForFile } from '../../../utils/languageMetadata';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class FileAnalysisXRCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        const commands = new FileAnalysisXRCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.analyzeFileXR',
                callback: (uri?: vscode.Uri) => commands.analyzeFileXR(uri),
                description: 'Analyze file in XR mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze file in XR mode'
            }
        ];
    }

    private async analyzeFileXR(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;

            if (uri) {
                filePath = uri.fsPath;
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for XR analysis');
                    return;
                }
                filePath = activeEditor.document.fileName;
            }

            const languageInfo = getLanguageForFile(filePath);
            if (!languageInfo) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${path.basename(filePath)}" - Language not supported for XR analysis`,
                );
                return;
            }

            await AnalysisOrchestrator.orchestrateAnalysis(filePath, 'XR', 'file', this.context, false);
        } catch (error) {
            console.error('FILE_ANALYSIS_XR_COMMANDS: Error in XR file analysis:', error);
            vscode.window.showErrorMessage(`CodeXR: XR analysis failed - ${error}`);
        }
    }
}

