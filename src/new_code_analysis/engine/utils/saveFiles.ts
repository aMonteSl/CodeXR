/**
 * Save Files for Analysis
 * Handles saving analysis files to workspace storage
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { AnalysisSessionManager } from '../registry/analysisSessionManager';
import { DirectoryAnalysisSessionRegistry } from '../registry/directoryAnalysisSessionRegistry';

export interface SavedAnalysisFiles {
    success: boolean;
    nonce: string;
    analysisDirectoryPath: string;
    indexHtmlPath: string;
    error?: string;
}

export interface FilesToSave {
    indexHtml: string;
    jsContent: string;
    dataJson: any;
    cssContent?: string; // Optional for compatibility, not used in DOM visualization
}

export class SaveFiles {

    /**
     * Save analysis files to workspace storage using session
     */
    static async saveAnalysisFiles(
        filesToSave: FilesToSave,
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<SavedAnalysisFiles> {
        try {
            console.log(`SAVE_FILES: Starting to save analysis files for session: ${sessionId}`);

            // Try to find session and get necessary paths
            let sessionInfo: { outputDirectory: string; outputPath: string; id: string } | null = null;
            
            // Try file analysis registry first
            const sessionManager = AnalysisSessionManager.getInstance();
            const fileSession = sessionManager.getSession(sessionId);
            
            if (fileSession) {
                sessionInfo = {
                    outputDirectory: fileSession.outputDirectory,
                    outputPath: fileSession.outputPath,
                    id: fileSession.id
                };
                console.log(`SAVE_FILES: Using file session data`);
            } else {
                // Try directory analysis registry
                const directorySessionRegistry = DirectoryAnalysisSessionRegistry.getInstance();
                const directorySession = directorySessionRegistry.getSession(sessionId);
                
                if (directorySession) {
                    sessionInfo = {
                        outputDirectory: directorySession.outputDirectory,
                        outputPath: directorySession.outputPath,
                        id: directorySession.id
                    };
                    console.log(`SAVE_FILES: Using directory session data`);
                }
            }
            
            if (!sessionInfo) {
                throw new Error(`Session ${sessionId} not found in either file or directory registries`);
            }
            
            console.log(`SAVE_FILES: Session found - Directory: ${sessionInfo.outputDirectory}, Path: ${sessionInfo.outputPath}`);
            
            // Use session-provided paths
            const analysisSessionDir = sessionInfo.outputPath;
            const indexHtmlPath = path.join(analysisSessionDir, 'index.html');

            // Ensure directories exist
            await SaveFiles.ensureDirectoryExists(path.dirname(analysisSessionDir));
            await SaveFiles.ensureDirectoryExists(analysisSessionDir);

            console.log(`SAVE_FILES: Created analysis directory: ${analysisSessionDir}`);

            // Save files
            const cssPath = path.join(analysisSessionDir, 'style.css');
            const jsPath = path.join(analysisSessionDir, 'main.js');
            const dataJsonPath = path.join(analysisSessionDir, 'data.json');

            // Write files to storage
            await fs.promises.writeFile(indexHtmlPath, filesToSave.indexHtml, 'utf-8');
            
            // Only save CSS if provided (DOM visualization doesn't need it)
            if (filesToSave.cssContent) {
                await fs.promises.writeFile(cssPath, filesToSave.cssContent, 'utf-8');
                console.log(`SAVE_FILES: - style.css: ${cssPath}`);
            } else {
                console.log(`SAVE_FILES: - style.css: Skipped (not needed for DOM visualization)`);
            }
            
            await fs.promises.writeFile(jsPath, filesToSave.jsContent, 'utf-8');
            await fs.promises.writeFile(dataJsonPath, JSON.stringify(filesToSave.dataJson, null, 2), 'utf-8');

            console.log(`SAVE_FILES: Successfully saved all files:`);
            console.log(`SAVE_FILES: - index.html: ${indexHtmlPath}`);
            console.log(`SAVE_FILES: - main.js: ${jsPath}`);
            console.log(`SAVE_FILES: - data.json: ${dataJsonPath}`);

            return {
                success: true,
                nonce: sessionInfo.id,
                analysisDirectoryPath: analysisSessionDir,
                indexHtmlPath: indexHtmlPath
            };

        } catch (error) {
            console.error(`SAVE_FILES: Error saving analysis files:`, error);
            return {
                success: false,
                nonce: '',
                analysisDirectoryPath: '',
                indexHtmlPath: '',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Clean all analysis directories (called on plugin restart)
     */
    static async cleanAllAnalysisDirectories(context: vscode.ExtensionContext): Promise<boolean> {
        try {
            console.log(`SAVE_FILES: Starting cleanup of all analysis directories`);

            const storageUri = context.storageUri;
            if (!storageUri) {
                console.log(`SAVE_FILES: No workspace storage URI available - nothing to clean`);
                return true;
            }

            const analysisBaseDir = path.join(storageUri.fsPath, 'analysis');
            const directoryAnalysisBaseDir = path.join(storageUri.fsPath, 'directory_analysis');
            
            let success = true;

            // Clean file analysis directories
            if (fs.existsSync(analysisBaseDir)) {
                // Get all analysis directories that follow the new pattern {fileName}_{analysisType}_{nonce}
                const allAnalysisDirs = fs.readdirSync(analysisBaseDir, { withFileTypes: true })
                    .filter(entry => entry.isDirectory())
                    .filter(entry => entry.name.includes('_')) // Pattern: fileName_analysisType_nonce or fileName_nonce (legacy)
                    .map(entry => path.join(analysisBaseDir, entry.name));

                console.log(`SAVE_FILES: Found ${allAnalysisDirs.length} file analysis directories to clean`);

                // Remove all file analysis directories
                for (const dirPath of allAnalysisDirs) {
                    try {
                        await fs.promises.rm(dirPath, { recursive: true, force: true });
                        console.log(`SAVE_FILES: Cleaned file analysis directory: ${dirPath}`);
                    } catch (dirError) {
                        console.error(`SAVE_FILES: Failed to clean file analysis directory ${dirPath}:`, dirError);
                        success = false;
                    }
                }

                // If analysis base directory is empty, remove it too
                try {
                    const remainingEntries = await fs.promises.readdir(analysisBaseDir);
                    if (remainingEntries.length === 0) {
                        await fs.promises.rmdir(analysisBaseDir);
                        console.log(`SAVE_FILES: Removed empty file analysis base directory`);
                    }
                } catch (error) {
                    console.warn(`SAVE_FILES: Could not remove file analysis base directory:`, error);
                }
            } else {
                console.log(`SAVE_FILES: File analysis directory doesn't exist - nothing to clean`);
            }

            // Clean directory analysis directories
            if (fs.existsSync(directoryAnalysisBaseDir)) {
                const allDirectoryAnalysisDirs = fs.readdirSync(directoryAnalysisBaseDir, { withFileTypes: true })
                    .filter(entry => entry.isDirectory())
                    .map(entry => path.join(directoryAnalysisBaseDir, entry.name));

                console.log(`SAVE_FILES: Found ${allDirectoryAnalysisDirs.length} directory analysis directories to clean`);

                // Remove all directory analysis directories
                for (const dirPath of allDirectoryAnalysisDirs) {
                    try {
                        await fs.promises.rm(dirPath, { recursive: true, force: true });
                        console.log(`SAVE_FILES: Cleaned directory analysis directory: ${dirPath}`);
                    } catch (dirError) {
                        console.error(`SAVE_FILES: Failed to clean directory analysis directory ${dirPath}:`, dirError);
                        success = false;
                    }
                }

                // If directory analysis base directory is empty, remove it too
                try {
                    const remainingEntries = await fs.promises.readdir(directoryAnalysisBaseDir);
                    if (remainingEntries.length === 0) {
                        await fs.promises.rmdir(directoryAnalysisBaseDir);
                        console.log(`SAVE_FILES: Removed empty directory analysis base directory`);
                    }
                } catch (error) {
                    console.warn(`SAVE_FILES: Could not remove directory analysis base directory:`, error);
                }
            } else {
                console.log(`SAVE_FILES: Directory analysis directory doesn't exist - nothing to clean`);
            }

            console.log(`SAVE_FILES: Analysis directories cleanup completed`);
            return success;

        } catch (error) {
            console.error(`SAVE_FILES: Error during analysis directories cleanup:`, error);
            return false;
        }
    }

    /**
     * Ensure directory exists, create if it doesn't
     */
    private static async ensureDirectoryExists(dirPath: string): Promise<void> {
        try {
            if (!fs.existsSync(dirPath)) {
                await fs.promises.mkdir(dirPath, { recursive: true });
                console.log(`SAVE_FILES: Created directory: ${dirPath}`);
            }
        } catch (error) {
            console.error(`SAVE_FILES: Failed to create directory ${dirPath}:`, error);
            throw error;
        }
    }
}
