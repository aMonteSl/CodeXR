/**
 * Clean Analysis Command
 * Handles cleaning of analysis files from workspace storage
 */

import * as vscode from 'vscode';
import { CommandRegistration } from '../subsections/analysis_settings/analysis_file_mode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeXRLogger } from '../../../core/logging/logger';

const logger = CodeXRLogger.getLogger('CLEAN_ANALYSIS');

export class CleanAnalysisCommands {

    /**
     * Get command registrations for clean analysis functionality (Nested Dolls pattern)
     */
    static getCommandRegistrations(
        context: vscode.ExtensionContext,
        refreshCallback?: () => void,
    ): CommandRegistration[] {
        const commands: CommandRegistration[] = [];

        commands.push({
            commandId: 'codeXR.analysis.cleanAnalysis',
            callback: async () => {
                await CleanAnalysisCommands.executeCleanAnalysis(context);
                if (refreshCallback) {
                    refreshCallback();
                }
            },
            description: 'Clean all analysis directories and files from workspace storage',
        });

        return commands;
    }

    /**
     * Execute cleanup of stale analysis files on plugin startup.
     */
    static async executeStartupCleanup(context: vscode.ExtensionContext, activationStartedAt: number): Promise<void> {
        try {
            await CleanAnalysisCommands.cleanStaleAnalysisArtifacts(context, activationStartedAt);
        } catch (error) {
            logger.warn('Startup cleanup failed.', error);
        }
    }

    /**
     * Execute manual cleanup of analysis files.
     */
    private static async executeCleanAnalysis(context: vscode.ExtensionContext): Promise<void> {
        try {
            const result = await vscode.window.showWarningMessage(
                'Are you sure you want to clean all analysis files? This will remove all saved analysis data from the current workspace.',
                { modal: true },
                'Clean Analysis Files',
                'Cancel',
            );

            if (result !== 'Clean Analysis Files') {
                return;
            }

            const cleanupResult = await CleanAnalysisCommands.cleanAllAnalysisDirectories(context);

            if (cleanupResult) {
                vscode.window.showInformationMessage('CodeXR: Analysis files cleaned successfully');
            } else {
                vscode.window.showErrorMessage(
                    'CodeXR: Failed to clean some analysis files. Check the CodeXR output for details.',
                );
            }
        } catch (error) {
            logger.error('Manual cleanup failed.', error);
            vscode.window.showErrorMessage(
                `CodeXR: Error during cleanup: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Clean analysis artifacts that were already present before activation completed.
     */
    private static async cleanStaleAnalysisArtifacts(
        context: vscode.ExtensionContext,
        activationStartedAt: number,
    ): Promise<boolean> {
        try {
            const analysisPath = this.getAnalysisPath(context);
            if (!analysisPath || !fs.existsSync(analysisPath)) {
                return true;
            }

            const entries = fs.readdirSync(analysisPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(analysisPath, entry.name);
                const stats = fs.statSync(entryPath);
                if (stats.mtimeMs >= activationStartedAt) {
                    continue;
                }

                await this.deletePathRecursive(entryPath);
            }

            this.removeDirectoryIfEmpty(analysisPath);
            return true;
        } catch (error) {
            logger.warn('Error cleaning startup analysis artifacts.', error);
            return false;
        }
    }

    /**
     * Clean all analysis directories.
     */
    private static async cleanAllAnalysisDirectories(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            const analysisPath = this.getAnalysisPath(context);
            if (!analysisPath || !fs.existsSync(analysisPath)) {
                return true;
            }

            await this.deletePathRecursive(analysisPath);
            return true;
        } catch (error) {
            logger.warn('Error cleaning analysis directories.', error);
            return false;
        }
    }

    private static getAnalysisPath(context: vscode.ExtensionContext): string | null {
        if (!context.storageUri) {
            return null;
        }

        return path.join(context.storageUri.fsPath, 'analysis');
    }

    private static async deletePathRecursive(targetPath: string): Promise<void> {
        if (!fs.existsSync(targetPath)) {
            return;
        }

        const stat = fs.statSync(targetPath);
        if (!stat.isDirectory()) {
            fs.unlinkSync(targetPath);
            return;
        }

        const files = fs.readdirSync(targetPath);
        for (const file of files) {
            await this.deletePathRecursive(path.join(targetPath, file));
        }

        fs.rmdirSync(targetPath);
    }

    private static removeDirectoryIfEmpty(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            return;
        }

        if (fs.readdirSync(dirPath).length === 0) {
            fs.rmdirSync(dirPath);
        }
    }
}

