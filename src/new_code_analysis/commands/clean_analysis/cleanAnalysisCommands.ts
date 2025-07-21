/**
 * Clean Analysis Command
 * Handles cleaning of analysis files from workspace storage
 */

import * as vscode from 'vscode';
import { SaveFiles, FileWatcher } from '../../engine/utils';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';

export class CleanAnalysisCommands {

    /**
     * Get command registrations for clean analysis functionality (Nested Dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback?: () => void
    ): CommandRegistration[] {
        console.log('CLEAN_ANALYSIS_COMMANDS: Collecting command registrations...');

        const commands: CommandRegistration[] = [];

        // Manual clean command
        commands.push({
            commandId: 'codeXR.newCodeAnalysis.cleanAnalysis',
            callback: async () => {
                await CleanAnalysisCommands.executeCleanAnalysis(context);
                if (refreshCallback) {
                    refreshCallback();
                }
            },
            description: 'Clean all analysis directories and files from workspace storage'
        });

        console.log(`CLEAN_ANALYSIS_COMMANDS: Collected ${commands.length} command registrations`);
        return commands;
    }

    /**
     * Execute cleanup of analysis files on plugin startup
     */
    static async executeStartupCleanup(context: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('CLEAN_ANALYSIS_COMMANDS: Executing startup cleanup...');
            
            // Stop all file watchers (in case of restart)
            console.log('CLEAN_ANALYSIS_COMMANDS: Stopping all file watchers...');
            FileWatcher.stopAllWatchers();
            
            const cleanupResult = await SaveFiles.cleanAllAnalysisDirectories(context);
            
            if (cleanupResult) {
                console.log('CLEAN_ANALYSIS_COMMANDS: Startup cleanup completed successfully');
            } else {
                console.warn('CLEAN_ANALYSIS_COMMANDS: Startup cleanup completed with some errors');
            }

        } catch (error) {
            console.error('CLEAN_ANALYSIS_COMMANDS: Error during startup cleanup:', error);
        }
    }

    /**
     * Execute manual cleanup of analysis files
     */
    private static async executeCleanAnalysis(context: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('CLEAN_ANALYSIS_COMMANDS: Manual cleanup requested');

            // Show confirmation dialog
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to clean all analysis files? This will remove all saved analysis data from the current workspace.',
                { modal: true },
                'Clean Analysis Files',
                'Cancel'
            );

            if (result !== 'Clean Analysis Files') {
                console.log('CLEAN_ANALYSIS_COMMANDS: Manual cleanup cancelled by user');
                return;
            }

            // Stop all file watchers first
            console.log('CLEAN_ANALYSIS_COMMANDS: Stopping all file watchers...');
            FileWatcher.stopAllWatchers();

            // Execute cleanup
            const cleanupResult = await SaveFiles.cleanAllAnalysisDirectories(context);

            if (cleanupResult) {
                vscode.window.showInformationMessage(
                    'CodeXR: Analysis files cleaned successfully'
                );
                console.log('CLEAN_ANALYSIS_COMMANDS: Manual cleanup completed successfully');
            } else {
                vscode.window.showErrorMessage(
                    'CodeXR: Failed to clean some analysis files. Check console for details.'
                );
                console.error('CLEAN_ANALYSIS_COMMANDS: Manual cleanup completed with errors');
            }

        } catch (error) {
            console.error('CLEAN_ANALYSIS_COMMANDS: Error during manual cleanup:', error);
            vscode.window.showErrorMessage(
                `CodeXR: Error during cleanup: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
