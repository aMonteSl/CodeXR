/**
 * Launch Visualize DOM Panel
 * DOM visualization engine for HTML files
 */

import * as vscode from 'vscode';
import { getLanguageForFile } from '../../utils/languageMetadata';
import { SUPPORTED_LANGUAGES, getLanguageByExtension } from '../../utils/supportedLanguages';
import { GetNecessaryFiles } from './utils/getNecessaryFiles';
import { SaveFiles, FilesToSave } from './utils/saveFiles';
import { FileWatcher } from './utils/fileWatcher';
import { LaunchServer } from './utils/launchServer';

export class LaunchVisualizeDOMPanel {

    /**
     * Visualize HTML DOM structure
     */
    static async visualizeDOM(filePath: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            // Get file language information
            const languageInfo = getLanguageForFile(filePath);
            
            if (!languageInfo || languageInfo.name !== 'HTML') {
                vscode.window.showWarningMessage(
                    `CodeXR: File "${filePath}" - Not an HTML file for DOM visualization`
                );
                return;
            }

            console.log(`DOM_VISUALIZATION_ENGINE: DOM visualization requested for file: ${filePath}`);
            console.log(`DOM_VISUALIZATION_ENGINE: Detected language: ${languageInfo.name}`);
            console.log(`DOM_VISUALIZATION_ENGINE: File extension: ${languageInfo.extensions.join(', ')}`);
            
            // Show start message to user
            vscode.window.showInformationMessage(
                `CodeXR: Starting DOM analysis for "${filePath}" (${languageInfo.name})`,
                { modal: false }
            );

            // Get DOM analysis using python html_dom_parser.py
            console.log(`DOM_VISUALIZATION_ENGINE: Calling DOM analysis...`);
            const analysisResult = await GetNecessaryFiles.getVisualizationDOM(filePath, context);

            if (analysisResult.success && analysisResult.data && analysisResult.indexHtml) {
                console.log(`DOM_VISUALIZATION_ENGINE: DOM analysis completed successfully`);
                console.log(`DOM_VISUALIZATION_ENGINE: DOM data received:`, analysisResult.data);
                console.log(`DOM_VISUALIZATION_ENGINE: Template files generated - HTML: ${analysisResult.indexHtml.length} chars, JS: ${analysisResult.jsContent?.length || 0} chars`);

                // Prepare files for saving (no CSS needed for DOM visualization)
                const filesToSave: FilesToSave = {
                    indexHtml: analysisResult.indexHtml,
                    jsContent: analysisResult.jsContent || '',
                    dataJson: analysisResult.data
                };

                // Save files to workspace storage using the same pattern as LivePanel
                console.log(`DOM_VISUALIZATION_ENGINE: Saving DOM visualization files...`);
                const saveResult = await SaveFiles.saveAnalysisFiles(
                    filesToSave,
                    require('path').basename(filePath),
                    'DOMVisualization',
                    context
                );

                if (saveResult.success) {
                    console.log(`DOM_VISUALIZATION_ENGINE: Files saved successfully to: ${saveResult.analysisDirectoryPath}`);
                    
                    // Start file watcher for live updates
                    console.log(`DOM_VISUALIZATION_ENGINE: Starting file watcher for HTML DOM updates...`);
                    const watcherId = FileWatcher.startWatching(
                        context,
                        filePath,
                        saveResult.analysisDirectoryPath,
                        'DOMVisualization'
                    );

                    if (watcherId) {
                        console.log(`DOM_VISUALIZATION_ENGINE: File watcher started with ID: ${watcherId}`);
                    } else {
                        console.warn(`DOM_VISUALIZATION_ENGINE: Failed to start file watcher for: ${filePath}`);
                    }

                    // Launch SSE server for DOM visualization
                    const serverLaunchResult = await LaunchServer.launchAnalysisServer(context, {
                        filePath: filePath,
                        analysisType: 'DOMVisualization',
                        enableSSE: true,
                        analysisDirectoryPath: saveResult.analysisDirectoryPath,
                        indexHtmlPath: saveResult.indexHtmlPath
                    });

                    if (serverLaunchResult.success) {
                        console.log(`DOM_VISUALIZATION_ENGINE: Server launched successfully!`);
                        console.log(`DOM_VISUALIZATION_ENGINE: Server URL: ${serverLaunchResult.serverUrl}`);
                        console.log(`DOM_VISUALIZATION_ENGINE: Server ID: ${serverLaunchResult.serverId}`);
                        console.log(`DOM_VISUALIZATION_ENGINE: SSE Channel: ${serverLaunchResult.sseChannel}`);
                        
                        // Show enhanced success message with server information
                        const fileName = require('path').basename(filePath);
                        vscode.window.showInformationMessage(
                            `🌐 DOM Visualization launched! Analysis: ${saveResult.nonce} | Server: ${serverLaunchResult.serverUrl} | Live HTML updates enabled`,
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
                        console.log(`DOM_VISUALIZATION_ENGINE: Server launch failed: ${serverLaunchResult.error}`);
                        
                        // Still show success for analysis, but note server issue
                        const fileName = require('path').basename(filePath);
                        vscode.window.showWarningMessage(
                            `🌐 DOM Visualization completed for "${fileName}" (Session: ${saveResult.nonce}) but server launch failed: ${serverLaunchResult.error}`,
                            'Retry Server Launch',
                            'View Analysis Files'
                        ).then(action => {
                            if (action === 'Retry Server Launch') {
                                // Re-attempt server launch
                                LaunchServer.launchAnalysisServer(context, {
                                    filePath: filePath,
                                    analysisType: 'DOMVisualization',
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
                    console.error(`DOM_VISUALIZATION_ENGINE: Failed to save files:`, saveResult.error);
                    vscode.window.showErrorMessage(
                        `CodeXR: Failed to save DOM visualization files: ${saveResult.error}`
                    );
                }

            } else {
                console.error(`DOM_VISUALIZATION_ENGINE: DOM analysis failed:`, analysisResult.error);
                vscode.window.showErrorMessage(
                    `CodeXR: DOM analysis failed for "${filePath}": ${analysisResult.error}`
                );
            }

        } catch (error) {
            console.error('DOM_VISUALIZATION_ENGINE: Error visualizing DOM:', error);
            vscode.window.showErrorMessage(
                `CodeXR: Failed to visualize DOM for "${filePath}": ${error}`
            );
        }
    }

    /**
     * Check if a file can be visualized as DOM
     */
    static canVisualizeFile(filePath: string): boolean {
        const extension = require('path').extname(filePath).toLowerCase();
        const htmlConfig = SUPPORTED_LANGUAGES.html;
        return htmlConfig.extensions.includes(extension);
    }

    /**
     * Get supported HTML file extensions
     */
    static getSupportedExtensions(): string[] {
        return [...SUPPORTED_LANGUAGES.html.extensions];
    }
}

