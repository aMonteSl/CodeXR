/**
 * Launch Analyze Directory LivePanel
 * Engine for directory analysis using LivePanel
 */

import * as vscode from 'vscode';
import { DirectoryAnalysisSessionManager } from './registry/directoryAnalysisSessionManager';
import { DirectoryAnalysisType } from './registry/directoryAnalysisSessionRegistry';
import { GetNecessaryFiles } from './utils/getNecessaryFiles';
import { SaveFiles, FilesToSave } from './utils/saveFiles';
import { LaunchServer } from './utils/launchServer';
import { ManageWatcher } from './utils/manageWatcher';
import { AnalysisConfigurationStorage } from '../configuration/analysisConfigurationStorage';
import { CheckIfAnalysisAlreadyRunning } from './utils/checkIfAnalysisAlreadyRunning';
import { AnalysisType } from './registry/analysisSessionRegistry';
import { DirectoryAnalysisProgressService } from './services';
import { ActiveAnalysisRegistry } from './services/activeAnalysisRegistry';
import path from 'path';

export class LaunchAnalyzeDirectoryLivePanel {
    
    /**
     * Launch directory LivePanel analysis
     */
    public async launch(directoryPath: string, context: vscode.ExtensionContext, isDeep: boolean = false): Promise<void> {
        try {
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting directory analysis for:', directoryPath);
            
            // Check if analysis is already running for this directory
            const canProceed = await CheckIfAnalysisAlreadyRunning.checkAndWarnAboutConflicts(directoryPath, 'DirectoryLivePanel' as AnalysisType);
            if (!canProceed) {
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis cancelled due to conflict');
                return;
            }
            
            // Get the directory analysis session manager
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            
            // Create a new directory analysis session with D_LivePanel type
            const session = await sessionManager.startDirectoryAnalysis(
                directoryPath, 
                'D_LivePanel' as DirectoryAnalysisType, 
                context
            );
            
            // Print session details to console
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory analysis session created:');
            console.log('==========================================');
            console.log(`Session ID: ${session.id}`);
            console.log(`Directory Name: ${session.nameDir}`);
            console.log(`Directory Path: ${session.filePath}`);
            console.log(`Output Directory: ${session.outputDirectory}`);
            console.log(`Output Path: ${session.outputPath}`);
            console.log(`Analysis Type: ${session.analysisType}`);
            console.log(`Is XR: ${session.isXR}`);
            console.log(`Is Deep: ${session.isDeep}`);
            console.log(`Status: ${session.status}`);
            console.log(`Hash256: ${session.hash256}`);
            console.log(`Files Count: ${session.filesList.size}`);
            console.log(`Subdirectories Count: ${session.subDirectoriesList.size}`);
            console.log(`Start Time: ${session.startTime.toISOString()}`);
            
            if (session.metadata) {
                console.log(`Directory Size: ${session.metadata.directorySize} bytes`);
                console.log(`Last Modified: ${session.metadata.lastModified.toISOString()}`);
            }
            
            console.log('Files List:');
            session.filesList.forEach((fullPath, relativePath) => {
                console.log(`  ${relativePath} -> ${fullPath}`);
            });
            
            console.log('Subdirectories List:');
            if (session.subDirectoriesList.size === 0) {
                console.log('  (Empty - only used for deep analysis)');
            } else {
                session.subDirectoriesList.forEach((fullPath, relativePath) => {
                    console.log(`  ${relativePath} -> ${fullPath}`);
                });
            }
            console.log('==========================================');
            
            // Register in Active Analyses UI
            const activeRegistry = ActiveAnalysisRegistry.getInstance();
            const activeSessionId = await activeRegistry.registerDirectoryLivePanelAnalysis(directoryPath, context);
            console.log(`DIR_LIVEPANEL_DEBUG: ✅ Registered in Active Analyses with ID: ${activeSessionId}`);
            console.log(`DIR_LIVEPANEL_DEBUG: 🔄 Initial registration completed, status should be 'creating'`);
            
            // Update session status to analyzing
            sessionManager.updateSessionStatus(session.id, 'analyzing');
            console.log(`DIR_LIVEPANEL_DEBUG: 🔄 Updating status to 'analyzing' for session: ${activeSessionId}`);
            activeRegistry.updateAnalysisStatus(activeSessionId, 'analyzing');
            
            // Log session configuration before starting analysis
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: ====== SESSION CONFIGURATION ======');
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Session ID: ${session.id}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis Type: ${session.analysisType}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Is XR Analysis: ${session.isXR}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Is Deep Analysis: ${session.isDeep}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory Path: ${session.filePath}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Files Count: ${session.filesList.size}`);
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: ===================================');
            
            // Initialize progress service for unified progress tracking
            const progressService = DirectoryAnalysisProgressService.getInstance();
            const totalFiles = session.filesList.size;
            
            // Start unified progress tracking (this will show the progress bar)
            if (totalFiles > 0) {
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting unified progress tracking for ${totalFiles} files`);
                progressService.startProgress(
                    session.id, 
                    'Directory LivePanel', 
                    totalFiles,
                    `Analyzing Directory: ${path.basename(directoryPath)}`
                ).catch(error => {
                    console.error(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Error starting unified progress:`, error);
                });
            }
            
            // Get current theme configuration
            const configStorage = AnalysisConfigurationStorage.getInstance(context);
            const currentTheme = await configStorage.getViewTheme();
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Using theme: ${currentTheme}`);
            
            // Execute directory analysis using getNecessaryFiles (unified progress service handles all progress tracking)
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting Python directory analysis...');
            const analysisResult = await GetNecessaryFiles.getAnalysisDirectoryLivePanel(
                directoryPath,
                context,
                session.id,
                currentTheme
                // No progressCallback - unified service handles progress
            );
            
            if (analysisResult.success) {
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory analysis completed successfully!');
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis results received:');
                
                if (analysisResult.data) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis data: ${Object.keys(analysisResult.data).length} keys`);
                }
                if (analysisResult.indexHtml) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Received HTML file (${analysisResult.indexHtml.length} characters)`);
                }
                if (analysisResult.cssContent) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Received CSS file (${analysisResult.cssContent.length} characters)`);
                }
                if (analysisResult.jsContent) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Received JS file (${analysisResult.jsContent.length} characters)`);
                }

                // Save all files to workspace storage using session
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Saving analysis files to workspace storage...`);
                const filesToSave: FilesToSave = {
                    indexHtml: analysisResult.indexHtml!,
                    cssContent: analysisResult.cssContent!,
                    jsContent: analysisResult.jsContent!,
                    dataJson: analysisResult.data
                };

                const saveResult = await SaveFiles.saveAnalysisFiles(
                    filesToSave,
                    session.id,
                    context
                );

                if (saveResult.success) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Files saved successfully!`);
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis nonce: ${saveResult.nonce}`);
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis directory: ${saveResult.analysisDirectoryPath}`);
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Index.html path: ${saveResult.indexHtmlPath}`);

                    // Start intelligent directory watching for real-time analysis updates (FIRST)
                    console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Starting intelligent directory watching...`);
                    try {
                        const watcherId = await ManageWatcher.startDirectoryWatching(session.id, context);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Directory watching started successfully for: ${directoryPath}`);
                        console.log(`WATCHER_DIRECTORY_LIVE_PANEL: Watcher ID: ${watcherId}`);
                    } catch (watcherError) {
                        console.error(`WATCHER_DIRECTORY_LIVE_PANEL: Failed to start directory watching:`, watcherError);
                        // Don't fail the entire process, just log the warning
                        vscode.window.showWarningMessage(`Directory analysis completed but file watching failed: ${watcherError}`);
                    }

                    // Launch SSE server for real-time updates
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Launching server with SSE support...`);
                    const serverLaunchResult = await LaunchServer.launchAnalysisServer(context, {
                        sessionId: session.id,
                        enableSSE: true
                    });

                    if (serverLaunchResult.success) {
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server launched successfully!`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server URL: ${serverLaunchResult.serverUrl}`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server ID: ${serverLaunchResult.serverId}`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: SSE Channel: ${serverLaunchResult.sseChannel}`);
                        
                        // Update Active Analyses with server information
                        console.log(`DIR_LIVEPANEL_DEBUG: 🌐 Updating server info - port: ${serverLaunchResult.port}, url: ${serverLaunchResult.serverUrl}`);
                        activeRegistry.updateAnalysisServer(
                            activeSessionId, 
                            serverLaunchResult.port, 
                            serverLaunchResult.serverUrl
                        );
                        console.log(`DIR_LIVEPANEL_DEBUG: ✅ Updating status to 'completed' for session: ${activeSessionId}`);
                        activeRegistry.updateAnalysisStatus(activeSessionId, 'completed');
                        
                        // Show unified success message with VR icon (like XR)
                        vscode.window.showInformationMessage(
                            `🥽 Directory LivePanel analysis completed for "${session.nameDir}"! Server running on port ${serverLaunchResult.port}`,
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
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server launch failed: ${serverLaunchResult.error}`);
                        
                        // Update Active Analyses with failed status
                        console.log(`DIR_LIVEPANEL_DEBUG: ❌ Server launch failed, updating status to 'failed' for session: ${activeSessionId}`);
                        activeRegistry.failAnalysis(activeSessionId, serverLaunchResult.error || 'Server launch failed');
                        
                        // Still show success for analysis, but note server issue
                        vscode.window.showWarningMessage(
                            `Directory analysis completed for "${session.nameDir}" but server launch failed: ${serverLaunchResult.error}`,
                            'Retry Server Launch',
                            'View Analysis Files'
                        ).then(action => {
                            if (action === 'Retry Server Launch') {
                                // Re-attempt server launch
                                LaunchServer.launchAnalysisServer(context, {
                                    sessionId: session.id,
                                    enableSSE: true
                                });
                            } else if (action === 'View Analysis Files') {
                                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(saveResult.analysisDirectoryPath));
                            }
                        });
                    }

                    // Update session status to completed
                    sessionManager.updateSessionStatus(session.id, 'completed', 100);
                    
                } else {
                    console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Failed to save files:', saveResult.error);
                    
                    // Update session status to failed
                    sessionManager.updateSessionStatus(session.id, 'failed', undefined, `Failed to save files: ${saveResult.error}`);
                    
                    vscode.window.showErrorMessage(
                        `Directory analysis completed but failed to save files: ${saveResult.error}`
                    );
                }
                
            } else {
                console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory analysis failed:', analysisResult.error);
                
                // Update session status to failed
                sessionManager.updateSessionStatus(session.id, 'failed', undefined, analysisResult.error);
                
                // Show error message to user
                vscode.window.showErrorMessage(
                    `Directory analysis failed for "${session.nameDir}": ${analysisResult.error}`
                );
            }

        } catch (error) {
            console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Error in directory analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory: ${error}`);
            throw error;
        }
    }

    /**
     * Analyze directory using LivePanel Deep (recursive analysis)
     */
    static async analyzeDirectoryDeep(directoryPath: string, context: vscode.ExtensionContext): Promise<void> {
        try {
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting DEEP directory analysis for:', directoryPath);
            
            // Check if analysis is already running for this directory
            const canProceed = await CheckIfAnalysisAlreadyRunning.checkAndWarnAboutConflicts(directoryPath, 'DirectoryLivePanelDeep' as AnalysisType);
            if (!canProceed) {
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: DEEP Analysis cancelled due to conflict');
                return;
            }
            
            // Get the directory analysis session manager
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            
            // Create a new directory analysis session with D_DeepLivePanel type
            const session = await sessionManager.startDirectoryAnalysis(
                directoryPath, 
                'D_DeepLivePanel' as DirectoryAnalysisType, 
                context
            );
            
            // Print session details to console
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory DEEP analysis session created:');
            console.log('==========================================');
            console.log(`Session ID: ${session.id}`);
            console.log(`Directory Name: ${session.nameDir}`);
            console.log(`Directory Path: ${session.filePath}`);
            console.log(`Output Directory: ${session.outputDirectory}`);
            console.log(`Output Path: ${session.outputPath}`);
            console.log(`Analysis Type: ${session.analysisType}`);
            console.log(`Is XR: ${session.isXR}`);
            console.log(`Is Deep: ${session.isDeep}`);
            console.log(`Status: ${session.status}`);
            console.log(`Hash256: ${session.hash256}`);
            console.log(`Files Count: ${session.filesList.size}`);
            console.log(`Subdirectories Count: ${session.subDirectoriesList.size}`);
            console.log(`Start Time: ${session.startTime.toISOString()}`);
            
            if (session.metadata) {
                console.log(`Directory Size: ${session.metadata.directorySize} bytes`);
                console.log(`Last Modified: ${session.metadata.lastModified.toISOString()}`);
            }
            
            console.log('Files List (Deep Analysis):');
            session.filesList.forEach((fullPath, relativePath) => {
                console.log(`  ${relativePath} -> ${fullPath}`);
            });
            
            console.log('Subdirectories List (Deep Analysis):');
            session.subDirectoriesList.forEach((fullPath, relativePath) => {
                console.log(`  ${relativePath} -> ${fullPath}`);
            });
            console.log('==========================================');
            
            // Update session status to analyzing
            sessionManager.updateSessionStatus(session.id, 'analyzing');
            
            // Log session configuration before starting analysis
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: ====== DEEP SESSION CONFIGURATION ======');
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Session ID: ${session.id}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Analysis Type: ${session.analysisType}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Is XR Analysis: ${session.isXR}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Is Deep Analysis: ${session.isDeep}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory Path: ${session.filePath}`);
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Files Count: ${session.filesList.size}`);
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: ===================================');
            
            // Initialize progress service for unified progress tracking
            const progressService = DirectoryAnalysisProgressService.getInstance();
            const totalFiles = session.filesList.size;
            
            // Start unified progress tracking (this will show the progress bar)
            if (totalFiles > 0) {
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting unified progress tracking for ${totalFiles} files (DEEP)`);
                progressService.startProgress(
                    session.id, 
                    'Directory LivePanel Deep', 
                    totalFiles,
                    `Analyzing Directory (Deep): ${path.basename(directoryPath)}`
                ).catch(error => {
                    console.error(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Error starting unified progress (DEEP):`, error);
                });
            }
            
            // Get current theme configuration
            const configStorage = AnalysisConfigurationStorage.getInstance(context);
            const currentTheme = await configStorage.getViewTheme();
            console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Using theme: ${currentTheme}`);
            
            // Execute directory DEEP analysis using getNecessaryFiles
            console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting Python directory DEEP analysis...');
            const analysisResult = await GetNecessaryFiles.getAnalysisDirectoryLivePanel(
                directoryPath,
                context,
                session.id,
                currentTheme
            );
            
            if (analysisResult.success) {
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory DEEP analysis completed successfully!');
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: DEEP Analysis results received:');
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: - Data: ${JSON.stringify(analysisResult.data).length} characters`);
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: - HTML: ${analysisResult.indexHtml?.length || 0} characters`);
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: - CSS: ${analysisResult.cssContent?.length || 0} characters`);
                console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: - JS: ${analysisResult.jsContent?.length || 0} characters`);
                
                // Save analysis files using SaveFiles
                console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Saving DEEP analysis files...');
                const filesToSave: FilesToSave = {
                    indexHtml: analysisResult.indexHtml || '',
                    cssContent: analysisResult.cssContent || '',
                    jsContent: analysisResult.jsContent || '',
                    dataJson: analysisResult.data
                };
                
                const saveResult = await SaveFiles.saveAnalysisFiles(
                    filesToSave,
                    session.id,
                    context
                );
                
                if (saveResult.success) {
                    console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Files saved successfully to: ${saveResult.analysisDirectoryPath}`);
                    
                    // Start watcher for file changes
                    console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Starting DEEP watcher for file changes...');
                    ManageWatcher.startDirectoryWatching(session.id, context);
                    
                    // Launch analysis server
                    console.log('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Launching server for DEEP analysis...');
                    const serverLaunchResult = await LaunchServer.launchAnalysisServer(context, {
                        sessionId: session.id,
                        enableSSE: true
                    });

                    if (serverLaunchResult.success) {
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server launched successfully!`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server URL: ${serverLaunchResult.serverUrl}`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server ID: ${serverLaunchResult.serverId}`);
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: SSE Channel: ${serverLaunchResult.sseChannel}`);
                        
                        // Show unified success message with VR icon (like XR) 
                        vscode.window.showInformationMessage(
                            `🥽 Directory LivePanel Deep analysis completed for "${session.nameDir}"! Server running on port ${serverLaunchResult.port}`,
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
                        console.log(`LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Server launch failed: ${serverLaunchResult.error}`);
                        
                        // Still show success for analysis, but note server issue
                        vscode.window.showWarningMessage(
                            `Deep directory analysis completed for "${session.nameDir}" but server launch failed: ${serverLaunchResult.error}`,
                            'Retry Server Launch',
                            'View Analysis Files'
                        ).then(action => {
                            if (action === 'Retry Server Launch') {
                                // Re-attempt server launch
                                LaunchServer.launchAnalysisServer(context, {
                                    sessionId: session.id,
                                    enableSSE: true
                                });
                            } else if (action === 'View Analysis Files') {
                                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(saveResult.analysisDirectoryPath));
                            }
                        });
                    }

                    // Update session status to completed
                    sessionManager.updateSessionStatus(session.id, 'completed', 100);
                    
                } else {
                    console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Failed to save files:', saveResult.error);
                    
                    // Update session status to failed
                    sessionManager.updateSessionStatus(session.id, 'failed', undefined, `Failed to save files: ${saveResult.error}`);
                    
                    vscode.window.showErrorMessage(
                        `Deep directory analysis completed but failed to save files: ${saveResult.error}`
                    );
                }
                
            } else {
                console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Directory DEEP analysis failed:', analysisResult.error);
                
                // Update session status to failed
                sessionManager.updateSessionStatus(session.id, 'failed', undefined, analysisResult.error);
                
                // Show error message to user
                vscode.window.showErrorMessage(
                    `Deep directory analysis failed for "${session.nameDir}": ${analysisResult.error}`
                );
            }

        } catch (error) {
            console.error('LAUNCH_ANALYZE_DIRECTORY_LIVEPANEL: Error in DEEP directory analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory (deep): ${error}`);
            throw error;
        }
    }

    // Compatibility method for older code
    static async analyzeDirectory(directoryPath: string, context: vscode.ExtensionContext): Promise<void> {
        const instance = new LaunchAnalyzeDirectoryLivePanel();
        await instance.launch(directoryPath, context, false);
    }
}
