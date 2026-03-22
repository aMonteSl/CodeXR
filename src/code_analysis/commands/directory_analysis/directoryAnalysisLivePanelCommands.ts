/**
 * Directory Analysis LivePanel Commands
 * Commands for analyzing directories in LivePanel mode.
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class DirectoryAnalysisLivePanelCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        const commands = new DirectoryAnalysisLivePanelCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.analyzeDirectory',
                callback: (uri?: vscode.Uri) => commands.analyzeDirectoryLivePanel(uri),
                description: 'Analyze directory in LivePanel mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze directory in LivePanel mode'
            },
            {
                commandId: 'codeXR.analysis.analyzeDirectoryDeep',
                callback: (uri?: vscode.Uri) => commands.analyzeDirectoryLivePanelDeep(uri),
                description: 'Analyze directory in LivePanel deep mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze directory in LivePanel deep mode'
            }
        ];
    }

    private async analyzeDirectoryLivePanel(uri?: vscode.Uri): Promise<void> {
        try {
            let directoryPath: string;

            if (uri) {
                if (uri.scheme !== 'file') {
                    vscode.window.showWarningMessage('CodeXR: Invalid URI for directory analysis');
                    return;
                }

                const stat = await vscode.workspace.fs.stat(uri);
                if (stat.type === vscode.FileType.Directory) {
                    directoryPath = uri.fsPath;
                } else {
                    directoryPath = require('path').dirname(uri.fsPath);
                }
            } else if (vscode.workspace.workspaceFolders?.length) {
                if (vscode.workspace.workspaceFolders.length === 1) {
                    directoryPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                } else {
                    const picked = await vscode.window.showWorkspaceFolderPick();
                    if (!picked) {
                        return;
                    }
                    directoryPath = picked.uri.fsPath;
                }
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No directory selected for LivePanel analysis');
                    return;
                }
                directoryPath = require('path').dirname(activeEditor.document.fileName);
            }

            await AnalysisOrchestrator.orchestrateAnalysis(directoryPath, 'LivePanel', 'directory', this.context, false);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel analyze directory command:', error);
            vscode.window.showErrorMessage(`CodeXR: Directory LivePanel analysis failed - ${error}`);
        }
    }

    private async analyzeDirectoryLivePanelDeep(uri?: vscode.Uri): Promise<void> {
        try {
            let directoryPath: string;

            if (uri) {
                if (uri.scheme !== 'file') {
                    vscode.window.showErrorMessage('CodeXR: Invalid directory URI for LivePanel Deep analysis');
                    return;
                }

                const stat = await vscode.workspace.fs.stat(uri);
                directoryPath = stat.type === vscode.FileType.Directory
                    ? uri.fsPath
                    : require('path').dirname(uri.fsPath);
            } else if (vscode.workspace.workspaceFolders?.length) {
                directoryPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            } else {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showWarningMessage('CodeXR: No directory selected for LivePanel Deep analysis');
                    return;
                }
                directoryPath = require('path').dirname(activeEditor.document.fileName);
            }

            await AnalysisOrchestrator.orchestrateAnalysis(directoryPath, 'LivePanel', 'directory', this.context, true);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_LIVEPANEL_COMMANDS: Error in LivePanel Deep analyze directory command:', error);
            vscode.window.showErrorMessage(`CodeXR: Directory LivePanel Deep analysis failed - ${error}`);
        }
    }
}

