/**
 * Directory Analysis LivePanel Commands
 * Commands for analyzing directories in LivePanel mode
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../new_engine/analysisOrchestrator';

export class DirectoryAnalysisLivePanelCommands {

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Register LivePanel directory analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Registering LivePanel analysis commands...');
        
        const commands = new DirectoryAnalysisLivePanelCommands(context);
        
        const analyzeDirectoryCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeDirectory',
            (uri?: vscode.Uri) => commands.analyzeDirectoryLivePanel(uri)
        );

        const analyzeDirectoryDeepCommand = vscode.commands.registerCommand(
            'newCodeAnalysis.analyzeDirectoryDeep',
            (uri?: vscode.Uri) => commands.analyzeDirectoryLivePanelDeep(uri)
        );

        console.log('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel commands registered successfully');
        return [analyzeDirectoryCommand, analyzeDirectoryDeepCommand];
    }

    /**
     * Analyze directory in LivePanel mode command handler
     */
    private async analyzeDirectoryLivePanel(uri?: vscode.Uri): Promise<void> {
        try {
            let directoryPath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                if (uri.scheme === 'file') {
                    const stat = await vscode.workspace.fs.stat(uri);
                    if (stat.type === vscode.FileType.Directory) {
                        directoryPath = uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from context menu for directory: ${directoryPath}`);
                    } else {
                        // If it's a file, use its parent directory
                        const path = require('path');
                        directoryPath = path.dirname(uri.fsPath);
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel analysis requested from file, using parent directory: ${directoryPath}`);
                    }
                } else {
                    vscode.window.showWarningMessage('CodeXR: Invalid URI for directory analysis');
                    return;
                }
            } else {
                // Called from command palette without URI - use workspace folder or active file's directory
                if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                    // If there's only one workspace folder, use it
                    if (vscode.workspace.workspaceFolders.length === 1) {
                        directoryPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Using workspace folder: ${directoryPath}`);
                    } else {
                        // Multiple workspace folders - let user pick
                        const picked = await vscode.window.showWorkspaceFolderPick();
                        if (!picked) {
                            return; // User cancelled
                        }
                        directoryPath = picked.uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: User selected workspace folder: ${directoryPath}`);
                    }
                } else {
                    // No workspace folders - try to use active editor's directory
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const path = require('path');
                        directoryPath = path.dirname(activeEditor.document.fileName);
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Using active file's directory: ${directoryPath}`);
                    } else {
                        vscode.window.showWarningMessage('CodeXR: No directory selected for LivePanel analysis');
                        return;
                    }
                }
            }

            // Execute LivePanel directory analysis using NEW ENGINE
            console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Starting NEW ENGINE LivePanel analysis for directory: ${directoryPath}`);
            await AnalysisOrchestrator.orchestrateAnalysis(
                directoryPath,
                'LivePanel',
                'directory',
                this.context,
                false // isDeep = false for normal directory analysis
            );

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel analyze directory command:', error);
            vscode.window.showErrorMessage(`CodeXR: Directory LivePanel analysis failed - ${error}`);
        }
    }

    /**
     * Analyze directory in LivePanel Deep mode command handler
     */
    private async analyzeDirectoryLivePanelDeep(uri?: vscode.Uri): Promise<void> {
        try {
            let directoryPath: string;

            if (uri) {
                // Called from context menu or command palette with URI
                if (uri.scheme === 'file') {
                    const stat = await vscode.workspace.fs.stat(uri);
                    if (stat.type === vscode.FileType.Directory) {
                        directoryPath = uri.fsPath;
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel Deep analysis requested from context menu for directory: ${directoryPath}`);
                    } else {
                        // If it's a file, use its parent directory
                        const path = require('path');
                        directoryPath = path.dirname(uri.fsPath);
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: LivePanel Deep analysis requested from file, using parent directory: ${directoryPath}`);
                    }
                } else {
                    vscode.window.showErrorMessage('CodeXR: Invalid directory URI for LivePanel Deep analysis');
                    return;
                }
            } else {
                // Called from command palette without URI - ask user or use active file's directory
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    // Use the first workspace folder
                    directoryPath = workspaceFolders[0].uri.fsPath;
                    console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Using workspace folder for LivePanel Deep analysis: ${directoryPath}`);
                } else {
                    // Try to use the directory of the active file
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const path = require('path');
                        directoryPath = path.dirname(activeEditor.document.fileName);
                        console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Using active file's directory for Deep analysis: ${directoryPath}`);
                    } else {
                        vscode.window.showWarningMessage('CodeXR: No directory selected for LivePanel Deep analysis');
                        return;
                    }
                }
            }

            // Execute LivePanel Deep directory analysis using NEW ENGINE
            console.log(`DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Deep analysis requested for directory using NEW ENGINE: ${directoryPath}`);
            await AnalysisOrchestrator.orchestrateAnalysis(
                directoryPath,
                'LivePanel',
                'directory',
                this.context,
                true // isDeep = true for deep directory analysis
            );

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel Deep analyze directory command:', error);
            vscode.window.showErrorMessage(`CodeXR: Directory LivePanel Deep analysis failed - ${error}`);
        }
    }
}
