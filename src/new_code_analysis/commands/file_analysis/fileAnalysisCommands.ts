/**
 * File Analysis Commands
 * Commands for analyzing individual files
 */

import * as vscode from 'vscode';
import { LaunchAnalyzeFileLivePanel } from '../../engine';

export class FileAnalysisCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register file analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        const commands = new FileAnalysisCommands(context);
        
        const analyzeFileCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeFile',
            (uri?: vscode.Uri) => commands.analyzeFile(uri)
        );

        return [analyzeFileCommand];
    }

    /**
     * Analyze file command handler
     */
    private async analyzeFile(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                filePath = uri.fsPath;
            } else {
                // Called from command palette without URI - use active editor
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for analysis');
                    return;
                }
                filePath = activeEditor.document.fileName;
            }

            console.log(`FILE_ANALYSIS_COMMAND: Analyze file requested for: ${filePath}`);

            // Check if file can be analyzed
            if (!LaunchAnalyzeFileLivePanel.canAnalyzeFile(filePath)) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" is not a supported programming language`
                );
                return;
            }

            // Execute analysis
            await LaunchAnalyzeFileLivePanel.analyzeFile(filePath, this.context);

        } catch (error) {
            console.error('FILE_ANALYSIS_COMMAND: Error in analyze file command:', error);
            vscode.window.showErrorMessage(`CodeXR: Analysis failed - ${error}`);
        }
    }
}
