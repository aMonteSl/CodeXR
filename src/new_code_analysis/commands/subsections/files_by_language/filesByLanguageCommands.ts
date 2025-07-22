/**
 * Files By Language Commands
 * Commands specific to the Files By Language subsection
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../analysis_settings/analysis_file_mode';

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
            }
        ];

        console.log(`NEW_CODE_ANALYSIS: Collected ${commandRegistrations.length} Files By Language command registrations`);
        return commandRegistrations;
    }
}
