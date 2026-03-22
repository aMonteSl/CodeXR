/**
 * Files By Language Commands
 * Commands specific to the Files By Language subsection
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { AnalysisOrchestrator } from '../../../engine/analysisOrchestrator';
import { WorkspaceSnapshotService } from '../../../services/workspaceSnapshotService';
import { CodeXRLogger } from '../../../../core/logging/logger';

const logger = CodeXRLogger.getLogger('FILES_BY_LANGUAGE_COMMANDS');

export class FilesByLanguageCommands {
    constructor(private readonly context: vscode.ExtensionContext) {}

    /**
     * Get files by language command registrations (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback: () => void,
    ): CommandRegistration[] {
        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'codeXR.analysis.refreshFilesByLanguage',
                callback: async () => {
                    await WorkspaceSnapshotService.getInstance(context).refresh();
                    refreshCallback();
                    vscode.window.showInformationMessage('Files by Language refreshed!');
                },
                description: 'Refresh files by language grouping',
            },
            {
                commandId: 'codeXR.analysis.openFileFromLanguageGroup',
                callback: (fileUri: vscode.Uri) => {
                    void vscode.window.showTextDocument(fileUri);
                },
                description: 'Open file from language group',
            },
            {
                commandId: 'codeXR.analysis.runAndAnalyzeFile',
                callback: async (filePath: string, languageName: string) => {
                    await FilesByLanguageCommands.runAndAnalyzeFile(filePath, languageName, context);
                },
                description: 'Run and analyze file according to current analysis settings',
            },
        ];

        return commandRegistrations;
    }

    /**
     * Run and analyze file according to current analysis settings
     */
    static async runAndAnalyzeFile(filePath: string, languageName: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            const absolutePath = FilesByLanguageCommands.resolveFilePath(filePath);
            if (!absolutePath) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const fileUri = vscode.Uri.file(absolutePath);
            await vscode.window.showTextDocument(fileUri);

            const storage = AnalysisConfigurationStorage.getInstance(context);
            const analysisMode = await storage.getAnalysisMode();

            if (languageName === 'HTML') {
                await AnalysisOrchestrator.orchestrateAnalysis(
                    absolutePath,
                    'VisualizeDOM',
                    'file',
                    context,
                    false,
                );
                return;
            }

            if (analysisMode === 'XR') {
                await AnalysisOrchestrator.orchestrateAnalysis(
                    absolutePath,
                    'XR',
                    'file',
                    context,
                    false,
                );
                return;
            }

            if (analysisMode === 'LivePanel') {
                await AnalysisOrchestrator.orchestrateAnalysis(
                    absolutePath,
                    'LivePanel',
                    'file',
                    context,
                    false,
                );
                return;
            }

            vscode.window.showWarningMessage(`Unknown analysis mode: ${analysisMode}`);
        } catch (error) {
            logger.error(() => `Failed to run and analyze file ${filePath}.`, error);
            vscode.window.showErrorMessage(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private static resolveFilePath(filePath: string): string | null {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return null;
        }

        return path.resolve(workspaceFolder.uri.fsPath, filePath);
    }
}
