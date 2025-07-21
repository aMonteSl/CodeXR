/**
 * Launch Analyze File XR
 * XR mode analysis engine for code files
 */

import * as vscode from 'vscode';
import { getLanguageForFile } from '../../utils/languageMetadata';
import { SUPPORTED_LANGUAGES } from '../../utils/supportedLanguages';
import { GetNecessaryFiles } from './utils/getNecessaryFiles';
import { SaveFiles, FilesToSave } from './utils/saveFiles';
import { FileWatcher } from './utils/fileWatcher';
import { LaunchServer } from './utils/launchServer';
import { AnalysisSessionManager } from './registry/analysisSessionManager';
import { CheckIfAnalysisAlreadyRunning } from './utils/checkIfAnalysisAlreadyRunning';

export class LaunchAnalyzeFileXR {

    /**
     * Analyze file in XR mode
     */
    static async analyzeFileXR(filePath: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            // Get file language information
            const languageInfo = getLanguageForFile(filePath);
            
            if (!languageInfo) {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" - Language not supported for XR analysis 🥽`
                );
                return;
            }

            console.log(`ANALYZE_FILE_XR_ENGINE: XR analysis requested for file: ${filePath}`);
            console.log(`ANALYZE_FILE_XR_ENGINE: Detected language: ${languageInfo.name}`);
            
            // **CHECK: Verify no conflicting analysis is already running**
            const canProceed = await CheckIfAnalysisAlreadyRunning.checkAndWarnAboutConflicts(filePath, 'FileXRAnalysis');
            if (!canProceed) {
                console.log(`ANALYZE_FILE_XR_ENGINE: XR analysis cancelled due to conflicts`);
                return;
            }
            
            // Create analysis session
            const sessionManager = AnalysisSessionManager.getInstance();
            const session = await sessionManager.startAnalysis(filePath, 'FileXRAnalysis', context);
            console.log(`ANALYZE_FILE_XR_ENGINE: Created session ${session.id} for XR analysis`);
            
            // Show start message to user
            const fileName = require('path').basename(filePath);
            vscode.window.showInformationMessage(
                `🥽 CodeXR: Starting XR analysis for "${fileName}" (${languageInfo.name})...`,
                { modal: false }
            );

            // Get file analysis using python xr_file_analysis_coordinator.py with session
            console.log(`ANALYZE_FILE_XR_ENGINE: Calling XR file analysis...`);
            const analysisResult = await GetNecessaryFiles.getAnalysisFileXR(filePath, context, session.id);

            if (analysisResult.success && analysisResult.data) {
                console.log(`ANALYZE_FILE_XR_ENGINE: XR analysis completed successfully!`);
                console.log(`ANALYZE_FILE_XR_ENGINE: ===== XR ANALYSIS RESULTS =====`);
                console.log(`ANALYZE_FILE_XR_ENGINE: Data.json:`, JSON.stringify(analysisResult.data, null, 2));
                
                // Check and log generated files
                if (analysisResult.indexHtml) {
                    console.log(`ANALYZE_FILE_XR_ENGINE: ✅ INDEX.HTML Generated - Length: ${analysisResult.indexHtml.length} characters`);
                    console.log(`ANALYZE_FILE_XR_ENGINE: HTML Preview (first 200 chars):`, analysisResult.indexHtml.substring(0, 200) + '...');
                } else {
                    console.warn(`ANALYZE_FILE_XR_ENGINE: ❌ No INDEX.HTML generated`);
                }
                
                if (analysisResult.jsContent) {
                    console.log(`ANALYZE_FILE_XR_ENGINE: ✅ SSE JAVASCRIPT Generated - Length: ${analysisResult.jsContent.length} characters`);
                    console.log(`ANALYZE_FILE_XR_ENGINE: JS Preview (first 200 chars):`, analysisResult.jsContent.substring(0, 200) + '...');
                } else {
                    console.warn(`ANALYZE_FILE_XR_ENGINE: ❌ No SSE JavaScript generated`);
                }
                
                console.log(`ANALYZE_FILE_XR_ENGINE: ===== BOATS CHART CONFIGURATION =====`);
                console.log(`ANALYZE_FILE_XR_ENGINE: Chart Type: boats`);
                console.log(`ANALYZE_FILE_XR_ENGINE: Area Dimension: parameters (function parameters count)`);
                console.log(`ANALYZE_FILE_XR_ENGINE: Height Dimension: lineCount (lines of code count)`);
                console.log(`ANALYZE_FILE_XR_ENGINE: Color Dimension: complexity (cyclomatic complexity)`);
                console.log(`ANALYZE_FILE_XR_ENGINE: ============================================`);

                // Save all files to workspace storage using session
                console.log(`ANALYZE_FILE_XR_ENGINE: Saving XR analysis files to workspace storage...`);
                const filesToSave: FilesToSave = {
                    indexHtml: analysisResult.indexHtml!,
                    jsContent: analysisResult.jsContent!,
                    dataJson: analysisResult.data
                    // Note: XR analysis doesn't use CSS file, only HTML + JS + JSON
                };

                const saveResult = await SaveFiles.saveAnalysisFiles(
                    filesToSave,
                    session.id,
                    context
                );

                if (saveResult.success) {
                    console.log(`ANALYZE_FILE_XR_ENGINE: XR files saved successfully!`);
                    console.log(`ANALYZE_FILE_XR_ENGINE: XR Analysis nonce: ${saveResult.nonce}`);
                    console.log(`ANALYZE_FILE_XR_ENGINE: XR Analysis directory: ${saveResult.analysisDirectoryPath}`);
                    console.log(`ANALYZE_FILE_XR_ENGINE: XR Index.html path: ${saveResult.indexHtmlPath}`);

                    // Start file watcher for live updates with session
                    const watcherId = await FileWatcher.startWatching(
                        session.id,
                        context
                    );

                    if (watcherId) {
                        console.log(`ANALYZE_FILE_XR_ENGINE: XR File watcher started with ID: ${watcherId}`);
                    }

                    // Launch server for XR visualization with session
                    console.log(`ANALYZE_FILE_XR_ENGINE: Launching server for XR visualization...`);
                    const serverResult = await LaunchServer.launchAnalysisServer(
                        context,
                        {
                            sessionId: session.id,
                            enableSSE: true
                        }
                    );

                    if (serverResult.success) {
                        console.log(`ANALYZE_FILE_XR_ENGINE: XR Server launched successfully!`);
                        console.log(`ANALYZE_FILE_XR_ENGINE: XR Server URL: ${serverResult.serverUrl}`);
                        console.log(`ANALYZE_FILE_XR_ENGINE: XR Server Port: ${serverResult.port}`);
                    } else {
                        console.error(`ANALYZE_FILE_XR_ENGINE: Failed to launch XR server:`, serverResult.error);
                        // Don't fail the entire process for server launch failure
                    }

                    // Show success message with data info
                    vscode.window.showInformationMessage(
                        `🥽 XR Analysis completed for "${fileName}"! Boats chart visualization saved, file watcher started, and server launched.`,
                        'Got it!',
                        'View File',
                        'Open XR Visualization'
                    ).then(action => {
                        if (action === 'View File') {
                            vscode.window.showTextDocument(vscode.Uri.file(filePath));
                        } else if (action === 'Open XR Visualization') {
                            if (serverResult.success && serverResult.serverUrl) {
                                // Open the XR visualization from the launched server
                                vscode.commands.executeCommand('simpleBrowser.show', serverResult.serverUrl);
                            } else {
                                // Fallback to local file
                                vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.file(saveResult.indexHtmlPath));
                            }
                        }
                    });

                } else {
                    console.error(`ANALYZE_FILE_XR_ENGINE: Failed to save XR files:`, saveResult.error);
                    vscode.window.showErrorMessage(
                        `CodeXR: Failed to save XR analysis files for "${fileName}" 🥽: ${saveResult.error}`
                    );
                }

            } else {
                console.error(`ANALYZE_FILE_XR_ENGINE: XR analysis failed:`, analysisResult.error);
                vscode.window.showErrorMessage(
                    `CodeXR: XR analysis failed for "${fileName}" 🥽: ${analysisResult.error}`
                );
            }

        } catch (error) {
            console.error('ANALYZE_FILE_XR_ENGINE: Error in XR analysis:', error);
            vscode.window.showErrorMessage(
                `CodeXR: XR analysis failed 🥽 - ${error}`
            );
        }
    }

    /**
     * Check if a file can be analyzed in XR mode
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
     * Get supported file extensions for XR analysis
     */
    static getSupportedExtensions(): string[] {
        const extensions: string[] = [];
        
        for (const [langName, langConfig] of Object.entries(SUPPORTED_LANGUAGES)) {
            extensions.push(...langConfig.extensions);
        }
        
        return [...new Set(extensions)]; // Remove duplicates
    }
}
