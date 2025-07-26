/**
 * Clean Analysis Command
 * Handles cleaning of analysis files from workspace storage
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';
import * as fs from 'fs';
import * as path from 'path';

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
            
            // Clean the entire workspace storage
            const cleanupResult = await CleanAnalysisCommands.cleanCompleteWorkspaceStorage(context);
            
            if (cleanupResult) {
                console.log('CLEAN_ANALYSIS_COMMANDS: Complete workspace storage cleanup completed successfully');
            } else {
                console.warn('CLEAN_ANALYSIS_COMMANDS: Complete workspace storage cleanup completed with some errors');
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
            // Note: Watchers will be stopped when cleaning directories

            // Execute cleanup
            const cleanupResult = await CleanAnalysisCommands.cleanAllAnalysisDirectories(context);

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

    /**
     * Clean complete workspace storage
     */
    private static async cleanCompleteWorkspaceStorage(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            if (!context.storageUri) {
                console.log('CLEAN_ANALYSIS_COMMANDS: No storage URI available, skipping cleanup');
                return true;
            }

            const storagePath = context.storageUri.fsPath;
            
            if (fs.existsSync(storagePath)) {
                console.log(`CLEAN_ANALYSIS_COMMANDS: Cleaning storage directory: ${storagePath}`);
                await this.deleteDirectoryRecursive(storagePath);
                console.log('CLEAN_ANALYSIS_COMMANDS: Storage directory cleaned successfully');
            } else {
                console.log('CLEAN_ANALYSIS_COMMANDS: Storage directory does not exist, nothing to clean');
            }

            return true;
        } catch (error) {
            console.error('CLEAN_ANALYSIS_COMMANDS: Error cleaning workspace storage:', error);
            return false;
        }
    }

    /**
     * Clean all analysis directories
     */
    private static async cleanAllAnalysisDirectories(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            if (!context.storageUri) {
                console.log('CLEAN_ANALYSIS_COMMANDS: No storage URI available, skipping cleanup');
                return true;
            }

            const storagePath = context.storageUri.fsPath;
            const analysisPath = path.join(storagePath, 'analysis');
            
            if (fs.existsSync(analysisPath)) {
                console.log(`CLEAN_ANALYSIS_COMMANDS: Cleaning analysis directory: ${analysisPath}`);
                await this.deleteDirectoryRecursive(analysisPath);
                console.log('CLEAN_ANALYSIS_COMMANDS: Analysis directory cleaned successfully');
            } else {
                console.log('CLEAN_ANALYSIS_COMMANDS: Analysis directory does not exist, nothing to clean');
            }

            return true;
        } catch (error) {
            console.error('CLEAN_ANALYSIS_COMMANDS: Error cleaning analysis directories:', error);
            return false;
        }
    }

    /**
     * Delete directory recursively
     */
    private static async deleteDirectoryRecursive(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                await this.deleteDirectoryRecursive(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
        }

        fs.rmdirSync(dirPath);
    }
}
