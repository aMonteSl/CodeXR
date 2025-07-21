/**
 * File Analysis XR Commands
 * Commands for analyzing individual files in XR mode
 */

import * as vscode from 'vscode';
import { LaunchAnalyzeFileXR } from '../../engine/launchAnalyzeFileXR';

export class FileAnalysisXRCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register XR file analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('FILE_ANALYSIS_XR_COMMANDS: Registering XR analysis commands...');
        
        const commands = new FileAnalysisXRCommands(context);
        
        const analyzeFileXRCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeFileXR',
            (uri?: vscode.Uri) => commands.analyzeFileXR(uri)
        );

        console.log('FILE_ANALYSIS_XR_COMMANDS: XR commands registered successfully');
        return [analyzeFileXRCommand];
    }

    /**
     * Analyze file in XR mode command handler
     */
    private async analyzeFileXR(uri?: vscode.Uri): Promise<void> {
        try {
            let filePath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                filePath = uri.fsPath;
                console.log(`FILE_ANALYSIS_XR_COMMANDS: XR analysis requested from context menu for: ${filePath}`);
            } else {
                // Called from command palette without URI - use active editor
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No file selected for XR analysis 🥽');
                    return;
                }
                filePath = activeEditor.document.fileName;
                console.log(`FILE_ANALYSIS_XR_COMMANDS: XR analysis requested from command palette for: ${filePath}`);
            }

            // Check if file can be analyzed
            if (!LaunchAnalyzeFileXR.canAnalyzeFile(filePath)) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" is not a supported programming language for XR analysis 🥽`
                );
                return;
            }

            // Execute XR analysis
            await LaunchAnalyzeFileXR.analyzeFileXR(filePath, this.context);

        } catch (error) {
            console.error('FILE_ANALYSIS_XR_COMMANDS: Error in XR analyze file command:', error);
            vscode.window.showErrorMessage(`CodeXR: XR analysis failed 🥽 - ${error}`);
        }
    }
}
