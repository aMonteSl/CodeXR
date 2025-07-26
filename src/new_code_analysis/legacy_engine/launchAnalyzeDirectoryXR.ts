/**
 * Launch Analyze Directory XR
 * XR mode analysis engine for directory analysis with enhanced SSE support
 */

import * as vscode from 'vscode';
import { DirectoryAnalysisSessionManager } from './registry/directoryAnalysisSessionManager';
import { DirectoryAnalysisType } from './registry/directoryAnalysisSessionRegistry';
import { GetNecessaryFiles } from './utils/getNecessaryFiles';
import { SaveFiles, FilesToSave } from './utils/saveFiles';
import { LaunchServer } from './utils/launchServer';
import { ManageWatcher } from './utils/manageWatcher';
import { fileToServerMap } from '../../utils/fileToServerMap';
import { SSEManager } from '../../servers/runtime/sse/SSEManager';
import { DirectoryAnalysisProgressService } from './services';
import path from 'path';
import * as fs from 'fs';

export class LaunchAnalyzeDirectoryXR {
    private static _instance: LaunchAnalyzeDirectoryXR;

    public static getInstance(): LaunchAnalyzeDirectoryXR {
        if (!this._instance) {
            this._instance = new LaunchAnalyzeDirectoryXR();
        }
        return this._instance;
    }

    /**
     * Launch directory XR analysis with enhanced SSE support
     */
    public async launch(directoryPath: string, context: vscode.ExtensionContext, isDeep: boolean = false): Promise<void> {
        try {
            const analysisTypeStr = isDeep ? 'XR Deep' : 'XR';
            console.log(`Starting directory ${analysisTypeStr} analysis with enhanced SSE: ${directoryPath}`);

            // Use the existing directory analysis session manager
            const sessionManager = DirectoryAnalysisSessionManager.getInstance();
            const analysisType = isDeep ? 'D_XRDeep' as DirectoryAnalysisType : 'D_XR' as DirectoryAnalysisType;
            
            const session = await sessionManager.startDirectoryAnalysis(
                directoryPath,
                analysisType,
                context
            );

            console.log(`Directory XR session created: ${session.id}`);
            console.log(`Directory XR ${analysisTypeStr} session configuration:`);
            console.log(`- Session ID: ${session.id}`);
            console.log(`- Is XR: ${session.isXR}`);
            console.log(`- Is Deep: ${session.isDeep}`);
            console.log(`- Analysis Type: ${session.analysisType}`);

            // Initialize progress service for unified progress tracking
            const progressService = DirectoryAnalysisProgressService.getInstance();
            const totalFiles = session.filesList.size;
            
            // Start unified progress tracking (this will show the progress bar with file names and percentage)
            if (totalFiles > 0) {
                console.log(`DIRECTORY_XR_LAUNCHER: Starting unified progress tracking for ${totalFiles} files`);
                progressService.startProgress(
                    session.id, 
                    `Directory ${analysisTypeStr}`, 
                    totalFiles,
                    `🥽 Analyzing Directory ${analysisTypeStr}: ${path.basename(directoryPath)}`
                ).catch(error => {
                    console.error(`DIRECTORY_XR_LAUNCHER: Error starting unified progress:`, error);
                });
            }

            // Get analysis using the existing method (unified progress service handles all progress tracking)
            const analysisResult = await GetNecessaryFiles.getAnalysisDirectoryLivePanel(
                directoryPath,
                context,
                session.id,
                'dark' // Default theme
                // No progressCallback - unified service handles progress
            );

            if (!analysisResult.success || !analysisResult.data) {
                throw new Error(`Analysis failed: ${analysisResult.error || 'No data received'}`);
            }

            console.log('Directory XR analysis completed successfully');

            // Save files using existing structure
            const filesToSave: FilesToSave = {
                indexHtml: analysisResult.indexHtml || '',
                jsContent: analysisResult.jsContent || '',
                dataJson: analysisResult.data
            };

            const saveResult = await SaveFiles.saveAnalysisFiles(
                filesToSave,
                session.id,
                context
            );

            if (!saveResult.success) {
                throw new Error(`Failed to save files: ${saveResult.error}`);
            }

            console.log(`Files saved successfully to: ${saveResult.analysisDirectoryPath}`);

            // Launch server
            const serverResult = await LaunchServer.launchAnalysisServer(
                context,
                {
                    sessionId: session.id,
                    analysisType: isDeep ? 'DeepDirectoryXRAnalysis' : 'DirectoryXRAnalysis',
                    enableSSE: true
                }
            );

            if (!serverResult.success) {
                throw new Error(`Failed to launch server: ${serverResult.error}`);
            }

            console.log(`Server launched on port ${serverResult.port}`);

            // Register file mapping for auto-launcher (done automatically by LaunchServer)
            // The server registration is handled internally by LaunchServer

            // Start enhanced directory watching with custom SSE handler
            await this.startEnhancedDirectoryWatching(
                directoryPath,
                session.id,
                context,
                serverResult.port!,
                saveResult.analysisDirectoryPath!,
                directoryPath // Pass directoryPath as fileUri for SSE registration
            );

            const directoryName = path.basename(directoryPath);
            vscode.window.showInformationMessage(
                `🥽 Directory XR analysis completed for "${directoryName}"! Server running on port ${serverResult.port}`,
                'OK'
            );

        } catch (error) {
            console.error('Failed to launch directory XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory (XR): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Launch directory XR Deep analysis
     */
    public async launchDeep(directoryPath: string, context: vscode.ExtensionContext): Promise<void> {
        console.log(`Launching XR Deep directory analysis for: ${directoryPath}`);
        console.log(`Deep analysis will include ALL subdirectories recursively`);
        
        try {
            // Use the regular launch with Deep flag - infrastructure handles the rest
            await this.launch(directoryPath, context, true);
            
        } catch (error) {
            console.error('Failed to launch directory XR Deep analysis:', error);
            vscode.window.showErrorMessage(`Failed to analyze directory (XR Deep): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Enhanced directory watching with standard SSE pattern
     */
    private async startEnhancedDirectoryWatching(
        directoryPath: string,
        sessionId: string,
        context: vscode.ExtensionContext,
        port: number,
        analysisDirectoryPath: string,
        fileUri: string
    ): Promise<void> {
        try {
            console.log('Starting directory watching using standard SSE pattern...');

            // Start directory watching using STANDARD pattern
            const watcherId = await ManageWatcher.startDirectoryWatching(
                sessionId,
                context
            );

            console.log(`Directory watcher started with ID: ${watcherId}`);

            // No need for custom SSE monitoring - ManageWatcher handles it automatically
            // The directory watcher will call updateDirectoryAnalysisFiles which should
            // follow the same pattern as updateAnalysisFiles for file analysis

        } catch (error) {
            console.error('Failed to start directory watching:', error);
        }
    }
}
