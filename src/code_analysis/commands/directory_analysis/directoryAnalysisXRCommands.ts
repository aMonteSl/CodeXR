/**
 * Directory Analysis XR Commands
 * Commands for analyzing directories in XR mode.
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class DirectoryAnalysisXRCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        const commands = new DirectoryAnalysisXRCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.analyzeDirectoryXR',
                callback: (uri?: vscode.Uri) => commands.analyzeDirectoryXR(uri),
                description: 'Analyze directory in XR mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze directory in XR mode'
            },
            {
                commandId: 'codeXR.analysis.analyzeDirectoryXRDeep',
                callback: (uri?: vscode.Uri) => commands.analyzeDirectoryXRDeep(uri),
                description: 'Analyze directory in XR deep mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze directory in XR deep mode'
            },
            {
                commandId: 'codeXR.analysis.analyzeProjectXR',
                callback: () => commands.analyzeProjectXR(),
                description: 'Analyze project in XR mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze project in XR mode'
            },
            {
                commandId: 'codeXR.analysis.analyzeProjectXRDeep',
                callback: () => commands.analyzeProjectXRDeep(),
                description: 'Analyze project in XR deep mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze project in XR deep mode'
            }
        ];
    }

    private async analyzeDirectoryXR(uri?: vscode.Uri): Promise<void> {
        try {
            const directoryPath = await this.resolveDirectoryPath(uri, 'Select Directory to Analyze (XR)');
            if (!directoryPath) {
                return;
            }

            await AnalysisOrchestrator.orchestrateAnalysis(directoryPath, 'XR', 'directory', this.context, false);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeDirectoryXR:', error);
            vscode.window.showErrorMessage(
                `Failed to start directory XR analysis: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async analyzeDirectoryXRDeep(uri?: vscode.Uri): Promise<void> {
        try {
            const directoryPath = await this.resolveDirectoryPath(uri, 'Select Directory for XR Deep Analysis');
            if (!directoryPath) {
                return;
            }

            await AnalysisOrchestrator.orchestrateAnalysis(directoryPath, 'XR', 'directory', this.context, true);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_XR_COMMANDS: Error in analyzeDirectoryXRDeep:', error);
            vscode.window.showErrorMessage(
                `Failed to start directory XR Deep analysis: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async analyzeProjectXR(): Promise<void> {
        const projectPath = await this.resolveProjectPath('Select project to analyze (XR)');
        if (!projectPath) {
            return;
        }

        await AnalysisOrchestrator.orchestrateAnalysis(projectPath, 'XR', 'directory', this.context, false);
    }

    private async analyzeProjectXRDeep(): Promise<void> {
        const projectPath = await this.resolveProjectPath('Select project to analyze (XR Deep)');
        if (!projectPath) {
            return;
        }

        await AnalysisOrchestrator.orchestrateAnalysis(projectPath, 'XR', 'directory', this.context, true);
    }

    private async resolveDirectoryPath(uri: vscode.Uri | undefined, dialogLabel: string): Promise<string | undefined> {
        if (uri) {
            if (uri.scheme !== 'file') {
                vscode.window.showErrorMessage('Invalid file path for directory analysis');
                return undefined;
            }

            const stat = await vscode.workspace.fs.stat(uri);
            return stat.type === vscode.FileType.Directory
                ? uri.fsPath
                : vscode.Uri.file(uri.fsPath).with({ path: uri.path.substring(0, uri.path.lastIndexOf('/')) }).fsPath;
        }

        const folderUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: dialogLabel,
        });

        return folderUris?.[0]?.fsPath;
    }

    private async resolveProjectPath(placeHolder: string): Promise<string | undefined> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found. Please open a project folder first.');
            return undefined;
        }

        if (workspaceFolders.length === 1) {
            return workspaceFolders[0].uri.fsPath;
        }

        const selectedFolder = await vscode.window.showQuickPick(
            workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                folder,
            })),
            { placeHolder },
        );

        return selectedFolder?.folder.uri.fsPath;
    }
}

