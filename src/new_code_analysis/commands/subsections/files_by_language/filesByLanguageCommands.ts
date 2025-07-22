/**
 * Files By Language Commands
 * Commands specific to the Files By Language subsection
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';
import { AnalysisConfigurationStorage } from '../../../configuration/analysisConfigurationStorage';
import { LaunchAnalyzeFileXR } from '../../../engine/launchAnalyzeFileXR';
import { LaunchAnalyzeFileLivePanel } from '../../../engine/launchAnalyzeFileLivePanel';
import { LaunchVisualizeDOMPanel } from '../../../engine/launchVisualizeDOMPanel';

export class FilesByLanguageCommands {
    
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get files by language command registrations (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext, 
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('NEW_CODE_ANALYSIS: Collecting Files By Language command registrations');
        
        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'newCodeAnalysis.refreshFilesByLanguage',
                callback: () => {
                    console.log('NEW_CODE_ANALYSIS: Refreshing Files by Language section');
                    refreshCallback();
                    vscode.window.showInformationMessage('Files by Language refreshed!');
                },
                description: 'Refresh files by language grouping'
            },
            {
                commandId: 'newCodeAnalysis.openFileFromLanguageGroup',
                callback: (fileUri: vscode.Uri) => {
                    console.log('NEW_CODE_ANALYSIS: Opening file from language group:', fileUri.fsPath);
                    vscode.window.showTextDocument(fileUri);
                },
                description: 'Open file from language group'
            },
            {
                commandId: 'newCodeAnalysis.runAndAnalyzeFile',
                callback: async (filePath: string, languageName: string) => {
                    console.log('NEW_CODE_ANALYSIS: Running and analyzing file:', filePath, 'Language:', languageName);
                    await FilesByLanguageCommands.runAndAnalyzeFile(filePath, languageName, context);
                },
                description: 'Run and analyze file according to current analysis settings'
            }
        ];

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Files By Language command registrations`);
        return commandRegistrations;
    }

    /**
     * Run and analyze file according to current analysis settings
     */
    static async runAndAnalyzeFile(filePath: string, languageName: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            // First, open the file
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const absolutePath = require('path').resolve(workspaceFolder.uri.fsPath, filePath);
            const fileUri = vscode.Uri.file(absolutePath);
            
            // Open the file in editor
            await vscode.window.showTextDocument(fileUri);

            // Get current analysis configuration
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const analysisMode = await storage.getAnalysisMode();

            console.log(`FILES_BY_LANGUAGE: Running analysis for ${filePath} (${languageName}) in ${analysisMode} mode`);

            // Determine which analysis to run based on file type and configuration
            if (languageName === 'HTML') {
                // HTML files always use DOM Visualization
                console.log('FILES_BY_LANGUAGE: Running DOM Visualization for HTML file');
                await LaunchVisualizeDOMPanel.visualizeDOM(absolutePath, context);
            } else {
                // For other files, use the configured analysis mode
                if (analysisMode === 'XR') {
                    console.log('FILES_BY_LANGUAGE: Running XR Analysis');
                    await LaunchAnalyzeFileXR.analyzeFileXR(absolutePath, context);
                } else if (analysisMode === 'LivePanel') {
                    console.log('FILES_BY_LANGUAGE: Running LivePanel Analysis');
                    await LaunchAnalyzeFileLivePanel.analyzeFile(absolutePath, context);
                } else {
                    vscode.window.showWarningMessage(`Unknown analysis mode: ${analysisMode}`);
                }
            }

        } catch (error) {
            console.error('FILES_BY_LANGUAGE: Error running analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze file: ${error}`);
        }
    }
}
