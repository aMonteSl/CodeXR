/**
 * Directory Analysis Commands
 * Commands for analyzing directories
 * Follows the "nested dolls" pattern
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';
import { DirectoryAnalysisLivePanelCommands } from './directoryAnalysisLivePanelCommands';

export class DirectoryAnalysisCommands {
    
    /**
     * Register directory analysis commands
     */
    static registerCommands(context: vscode.ExtensionContext): vscode.Disposable[] {
        console.log('DIRECTORY_ANALYSIS: Registering directory analysis commands');

        const disposables: vscode.Disposable[] = [];

        // Register LivePanel directory analysis commands
        const livePanelDisposables = DirectoryAnalysisLivePanelCommands.registerCommands(context);
        disposables.push(...livePanelDisposables);
        
        context.subscriptions.push(...disposables);

        console.log(`DIRECTORY_ANALYSIS: Registered ${disposables.length} directory analysis commands`);
        return disposables;
    }

    /**
     * Get command registrations (nested dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback: () => void
    ): CommandRegistration[] {
        console.log('DIRECTORY_ANALYSIS: Collecting directory analysis command registrations');

        const commandRegistrations: CommandRegistration[] = [
            {
                commandId: 'newCodeAnalysis.analyzeDirectory',
                callback: async (uri: vscode.Uri) => {
                    // This will be handled by DirectoryAnalysisLivePanelCommands
                    await vscode.commands.executeCommand('newCodeAnalysis.analyzeDirectory', uri);
                },
                description: 'Analyze directory with LivePanel'
            }
        ];

        console.log(`DIRECTORY_ANALYSIS: Collected ${commandRegistrations.length} directory analysis command registrations`);
        return commandRegistrations;
    }
}
