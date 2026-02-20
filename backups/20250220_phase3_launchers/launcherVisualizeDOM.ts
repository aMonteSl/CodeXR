/**
 * VisualizeDOM Launcher
 * Launches DOM visualization analysis for HTML files using the new engine
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { VisualizeDOMRequirements } from '../processors/requirementRules/VisualizeDOMRequirements';
import { SaveFiles } from '../utils/saveFiles';
import { VisualizeDOMWatcher } from '../watchers/visualizeDOMWatcher';
import { SessionServerManager } from '../servers/sessionServerManager';

export class LauncherVisualizeDOM {
    
    /**
     * Launch VisualizeDOM analysis for HTML files
     */
    static async launchVisualizeDOMAnalysis(
        session: UnifiedAnalysisSession, 
        context: vscode.ExtensionContext
    ): Promise<void> {
        console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Starting VisualizeDOM analysis for session: ${session.id}`);
        console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Target: ${session.targetName} (${session.targetType})`);
        console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Analysis mode: ${session.analysisMode}`);

        const registry = UnifiedSessionRegistry.getInstance(context);

        try {
            // ========================================
            // STEP 1: GET PROCESSED FILES FROM PROCESSOR
            // ========================================
            console.log(`🔧 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: STEP 1 - Getting processed files from VisualizeDOMRequirements...`);
            registry.updateSessionStatus(session.id, 'analyzing', 20);
            
            const visualizeDOMRequirements = new VisualizeDOMRequirements(context);
            const processedFiles = await visualizeDOMRequirements.getRequiredFiles(session);
            
            console.log(`✅ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Received ${processedFiles.loadedFiles.size} processed template files`);
            
            // 🔍 DEBUG: Log detailed information about received files
            console.log(`🔍 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: DEBUG - processedFiles:`, {
                sessionId: processedFiles.sessionId,
                analysisMode: processedFiles.analysisMode,
                targetPath: processedFiles.targetPath,
                loadedFilesSize: processedFiles.loadedFiles.size,
                loadedFilesType: typeof processedFiles.loadedFiles,
                isMap: processedFiles.loadedFiles instanceof Map
            });
            
            // Detailed log of received files
            console.log(`📋 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Files received from processor:`);
            if (processedFiles.loadedFiles.size === 0) {
                console.warn(`⚠️ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: NO FILES RECEIVED! This is the problem.`);
            } else {
                for (const [fileName, content] of processedFiles.loadedFiles) {
                    console.log(`📄 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: ${fileName} (${content.length} chars)`);
                }
            }

            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`💾 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: STEP 2 - Saving processed files to storage...`);
            registry.updateSessionStatus(session.id, 'analyzing', 40);
            
            const saveFiles = new SaveFiles();
            const folderName = 'visualizeDOMAnalysis';
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles,
                folderName,
                session.outputDirectory,
                context
            );
            
            console.log(`✅ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Files successfully saved to: ${savedPath}`);
            
            // Update session with save information
            session.savedFilesPath = savedPath;
            
            // Store files in session for compatibility
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }

            // =======================================================
            // STEP 3: START SERVER FOR SESSION
            // =======================================================
            console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: STEP 3 - Starting server for session...`);
            registry.updateSessionStatus(session.id, 'analyzing', 60);
            
            const sessionServerManager = new SessionServerManager(context);
            const serverStatus = await sessionServerManager.startServerForSession(session);
            
            if (serverStatus.isServerActive && serverStatus.port) {
                console.log(`✅ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Server started successfully on port ${serverStatus.port}`);
                console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Server URL: ${serverStatus.serverUrl}`);
                
                // Update session with server information using centralized function
                console.log(`NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: 🔍 DEBUG - Registering port ${serverStatus.port} for session ${session.id}`);
                const portRegistered = registry.registerSessionPort(session.id, serverStatus.port);
                console.log(`NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: 🔍 DEBUG - Port registration result: ${portRegistered}`);
                
                session.assignedPort = serverStatus.port;
                session.serverUrl = serverStatus.serverUrl;
                
            } else {
                console.error(`❌ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Failed to start server for session ${session.id}`);
                throw new Error(`Failed to start server for VisualizeDOM analysis`);
            }

            // =======================================================
            // STEP 4: START HTML FILE WATCHER FOR LIVE UPDATES
            // =======================================================
            console.log(`🔍 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: STEP 4 - Starting HTML file watcher for live updates...`);
            registry.updateSessionStatus(session.id, 'analyzing', 80);
            
            try {
                const watcherId = await VisualizeDOMWatcher.startWatching(
                    session.id,
                    session.targetPath, // HTML file path
                    savedPath, // Output directory where files are saved
                    context
                );
                
                if (watcherId) {
                    console.log(`✅ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Started HTML file watcher with ID: ${watcherId}`);
                    session.watcherId = watcherId; // Store watcher ID in session
                } else {
                    console.warn(`⚠️ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Failed to start HTML file watcher`);
                }
            } catch (watcherError) {
                console.error(`❌ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Error starting HTML file watcher:`, watcherError);
                // Continue without watcher - analysis is still valid
            }

            // =======================================================
            // STEP 5: UPDATE SESSION STATUS TO MONITORING - SUCCESS
            // =======================================================
            console.log(`🎯 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: STEP 5 - Finalizing session...`);
            registry.updateSessionStatus(session.id, 'monitoring', 100);
            session.status = 'monitoring';
            session.endTime = new Date();

            console.log(`🎉 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: VisualizeDOM analysis completed successfully!`);
            console.log(`🎉 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Session ${session.id} completed with ${processedFiles.loadedFiles.size} files`);
            console.log(`🎉 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Files saved to: ${savedPath}`);
            console.log(`🌐 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Server running on: ${session.serverUrl}`);
            console.log(`🔍 NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: HTML file watcher active for live updates`);

        } catch (error) {
            console.error(`❌ NEW_LAUNCHER_VISUALIZEDOM_ANALYSIS: Error during VisualizeDOM analysis:`, error);
            
            // Update session status to error
            registry.updateSessionStatus(
                session.id, 
                'error', 
                0, 
                `VisualizeDOM analysis failed: ${error instanceof Error ? error.message : String(error)}`
            );
            session.status = 'error';
            session.endTime = new Date();
            
            vscode.window.showErrorMessage(
                `VisualizeDOM analysis failed: ${error instanceof Error ? error.message : String(error)}`
            );
            
            // Re-throw error for proper handling upstream
            throw error;
        }
    }
    
    /**
     * Validate if file can be visualized with DOM analysis
     */
    static canVisualizeFile(filePath: string): boolean {
        // Check if file is HTML
        const htmlExtensions = ['.html', '.htm', '.xhtml'];
        return htmlExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }
}
