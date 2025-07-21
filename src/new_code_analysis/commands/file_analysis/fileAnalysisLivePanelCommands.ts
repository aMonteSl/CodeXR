/**
 * File Analysis LivePanel Commands
 * Commands for analyzing individual files in LivePanel mode
 */

import * as vscode from 'vscode';
import { LaunchAnalyzeFileLivePanel } from '../../engine';

export class FileAnalysisLivePanelCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register LivePanel file analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('FILE_ANALYSIS_LIVEPANEL_COMMANDS: Registering LivePanel analysis commands...');
        
        const commands = new FileAnalysisLivePanelCommands(context);
        
        const analyzeFileCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeFile',
            (uri?: vscode.Uri) => commands.analyzeFileLivePanel(uri)
        );

        console.log('FILE_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel commands registered successfully');
        return [analyzeFileCommand];
    }

    /**
     * Analyze file in LivePanel mode command handler
     */
    private async analyzeFileLivePanel(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                filePath = uri.fsPath;
                console.log(`FILE_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from context menu for: ${filePath}`);
            } else {
                // Called from command palette without URI - use active editor
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for LivePanel analysis');
                    return;
                }
                filePath = activeEditor.document.fileName;
                console.log(`FILE_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from command palette for: ${filePath}`);
            }

            // Check if file can be analyzed
            if (!LaunchAnalyzeFileLivePanel.canAnalyzeFile(filePath)) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" is not a supported programming language for LivePanel analysis`
                );
                return;
            }

            // Execute LivePanel analysis
            await LaunchAnalyzeFileLivePanel.analyzeFile(filePath, this.context);

        } catch (error) {
            console.error('FILE_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel analyze file command:', error);
            vscode.window.showErrorMessage(`CodeXR: LivePanel analysis failed - ${error}`);
        }
    }
}
