/**
 * Launch Analyze File Live Panel
 * Live Panel file analysis engine for CodeXR
 */

import * as vscode from 'vscode';
import { getLanguageForFile } from '../../utils/languageMetadata';
import { SUPPORTED_LANGUAGES } from '../../utils/supportedLanguages';
import { GetNecessaryFiles, SaveFiles, FilesToSave, FileWatcher, LaunchServer } from './utils';

export class LaunchAnalyzeFileLivePanel {

    /**
     * Analyze a specific file using Live Panel mode
     */
    static async analyzeFile(filePath: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            // Get file language information
            const languageInfo = getLanguageForFile(filePath);
            
            if (!languageInfo) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" - Language not supported for analysis`
                );
                return;
            }

            console.log(`NEW_CODE_ANALYSIS_ENGINE: LivePanel analysis requested for file: ${filePath}`);
            console.log(`NEW_CODE_ANALYSIS_ENGINE: Detected language: ${languageInfo.name}`);
            console.log(`NEW_CODE_ANALYSIS_ENGINE: File extension: ${languageInfo.extensions.join(', ')}`);
            
            // Show confirmation message to user
            vscode.window.showInformationMessage(
                `CodeXR: LivePanel analysis started for "${filePath}" (${languageInfo.name})`,
                { modal: false }
            );

            // Get analysis data using the new system
            const analysisResult = await GetNecessaryFiles.getAnalysisFileLivePanel(filePath, context);

            if (analysisResult.success && analysisResult.data) {
                console.log(`NEW_CODE_ANALYSIS_ENGINE: Analysis completed successfully!`);
                console.log(`NEW_CODE_ANALYSIS_ENGINE: Analysis data.json:`, JSON.stringify(analysisResult.data, null, 2));
                
                // Log template files received
                if (analysisResult.indexHtml) {
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Received index.html (${analysisResult.indexHtml.length} characters)`);
                }
                if (analysisResult.cssContent) {
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Received CSS file (${analysisResult.cssContent.length} characters)`);
                }
                if (analysisResult.jsContent) {
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Received JS file (${analysisResult.jsContent.length} characters)`);
                }

                // Save all files to workspace storage
                console.log(`NEW_CODE_ANALYSIS_ENGINE: Saving analysis files to workspace storage...`);
                const filesToSave: FilesToSave = {
                    indexHtml: analysisResult.indexHtml!,
                    cssContent: analysisResult.cssContent!,
                    jsContent: analysisResult.jsContent!,
                    dataJson: analysisResult.data
                };

                const saveResult = await SaveFiles.saveAnalysisFiles(
                    filesToSave,
                    filePath,
                    'FileLivePanel',
                    context
                );

                if (saveResult.success) {
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Files saved successfully!`);
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Analysis nonce: ${saveResult.nonce}`);
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Analysis directory: ${saveResult.analysisDirectoryPath}`);
                    console.log(`NEW_CODE_ANALYSIS_ENGINE: Index.html path: ${saveResult.indexHtmlPath}`);

                    // Start file watcher for live updates
                    const watcherId = FileWatcher.startWatching(
                        context,
                        filePath,
                        saveResult.analysisDirectoryPath,
                        'LivePanel'
                    );

                    if (watcherId) {
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: Started file watcher with ID: ${watcherId}`);
                    } else {
                        console.warn(`NEW_CODE_ANALYSIS_ENGINE: Failed to start file watcher for: ${filePath}`);
                    }

                    // Launch SSE server for real-time updates
                    const serverLaunchResult = await LaunchServer.launchAnalysisServer(context, {
                        filePath: filePath,
                        analysisType: 'LivePanel',
                        enableSSE: true,
                        analysisDirectoryPath: saveResult.analysisDirectoryPath,
                        indexHtmlPath: saveResult.indexHtmlPath
                    });

                    if (serverLaunchResult.success) {
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: Server launched successfully!`);
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: Server URL: ${serverLaunchResult.serverUrl}`);
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: Server ID: ${serverLaunchResult.serverId}`);
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: SSE Channel: ${serverLaunchResult.sseChannel}`);
                        
                        // Show enhanced success message with server information
                        vscode.window.showInformationMessage(
                            `CodeXR: Live Panel launched! Analysis: ${saveResult.nonce} | Server: ${serverLaunchResult.serverUrl} | Live updates enabled`,
                            'Open in Browser',
                            'View Servers'
                        ).then(action => {
                            if (action === 'Open in Browser') {
                                vscode.env.openExternal(vscode.Uri.parse(serverLaunchResult.serverUrl!));
                            } else if (action === 'View Servers') {
                                vscode.commands.executeCommand('codexr.servers.view');
                            }
                        });
                    } else {
                        console.log(`NEW_CODE_ANALYSIS_ENGINE: Server launch failed: ${serverLaunchResult.error}`);
                        
                        // Still show success for analysis, but note server issue
                        vscode.window.showWarningMessage(
                            `CodeXR: Analysis completed for "${filePath}" (Session: ${saveResult.nonce}) but server launch failed: ${serverLaunchResult.error}`,
                            'Retry Server Launch',
                            'View Analysis Files'
                        ).then(action => {
                            if (action === 'Retry Server Launch') {
                                // Re-attempt server launch
                                LaunchServer.launchAnalysisServer(context, {
                                    filePath: filePath,
                                    analysisType: 'LivePanel',
                                    enableSSE: true,
                                    analysisDirectoryPath: saveResult.analysisDirectoryPath,
                                    indexHtmlPath: saveResult.indexHtmlPath
                                });
                            } else if (action === 'View Analysis Files') {
                                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(saveResult.analysisDirectoryPath));
                            }
                        });
                    }

                } else {
                    console.error(`NEW_CODE_ANALYSIS_ENGINE: Failed to save files:`, saveResult.error);
                    vscode.window.showErrorMessage(
                        `CodeXR: Analysis completed but failed to save files: ${saveResult.error}`
                    );
                }
            } else {
                console.error(`NEW_CODE_ANALYSIS_ENGINE: Analysis failed:`, analysisResult.error);
                vscode.window.showErrorMessage(
                    `CodeXR: Analysis failed for "${filePath}": ${analysisResult.error}`
                );
            }
            
        } catch (error) {
            console.error('NEW_CODE_ANALYSIS_ENGINE: Error analyzing file:', error);
            vscode.window.showErrorMessage(
                `CodeXR: Failed to analyze file "${filePath}": ${error}`
            );
        }
    }

    /**
     * Check if a file can be analyzed
     */
    static canAnalyzeFile(filePath: string): boolean {
        const extension = require('path').extname(filePath).toLowerCase();
        
        // Check if extension is supported by any language
        for (const [langName, langConfig] of Object.entries(SUPPORTED_LANGUAGES)) {
            if (langConfig.extensions.includes(extension)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get supported file extensions for analysis
     */
    static getSupportedExtensions(): string[] {
        const extensions: string[] = [];
        
        for (const [langName, langConfig] of Object.entries(SUPPORTED_LANGUAGES)) {
            extensions.push(...langConfig.extensions);
        }
        
        return [...new Set(extensions)]; // Remove duplicates
    }
}
