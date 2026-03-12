/**
 * Project Analysis Commands
 * Commands for analyzing projects from anywhere in VS Code.
 */

import * as vscode from 'vscode';
import { AnalysisOrchestrator } from '../../engine/analysisOrchestrator';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class ProjectAnalysisCommands {
    constructor(private context: vscode.ExtensionContext) {}

    static getCommandRegistrations(context: vscode.ExtensionContext): CommandRegistration[] {
        const commands = new ProjectAnalysisCommands(context);
        return [
            {
                commandId: 'codeXR.analysis.analyzeProject',
                callback: () => commands.analyzeProjectLivePanel(),
                description: 'Analyze project in LivePanel mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze project in LivePanel mode'
            },
            {
                commandId: 'codeXR.analysis.analyzeProjectDeep',
                callback: () => commands.analyzeProjectLivePanelDeep(),
                description: 'Analyze project in LivePanel deep mode',
                module: 'ANALYSIS',
                errorMessage: 'Failed to analyze project in LivePanel deep mode'
            }
        ];
    }

    private async analyzeProjectLivePanel(): Promise<void> {
        const projectPath = await this.pickWorkspaceFolder('Select workspace folder to analyze');
        if (!projectPath) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing Project',
            cancellable: false,
        }, async (progress) => {
            progress.report({ message: 'Starting project analysis...' });
            await AnalysisOrchestrator.orchestrateAnalysis(projectPath, 'LivePanel', 'directory', this.context, false);
        });
    }

    private async analyzeProjectLivePanelDeep(): Promise<void> {
        const projectPath = await this.pickWorkspaceFolder('Select workspace folder to analyze (Deep)');
        if (!projectPath) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing Project (Deep)',
            cancellable: false,
        }, async (progress) => {
            progress.report({ message: 'Starting deep project analysis (all subdirectories)...' });
            await AnalysisOrchestrator.orchestrateAnalysis(projectPath, 'LivePanel', 'directory', this.context, true);
        });
    }

    private async pickWorkspaceFolder(placeHolder: string): Promise<string | undefined> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(
                'No workspace is currently open. Please open a project folder to analyze.',
            );
            return undefined;
        }

        if (workspaceFolders.length === 1) {
            return workspaceFolders[0].uri.fsPath;
        }

        const selectedItem = await vscode.window.showQuickPick(
            workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                folder,
            })),
            {
                placeHolder,
                canPickMany: false,
            },
        );

        return selectedItem?.folder.uri.fsPath;
    }
}

