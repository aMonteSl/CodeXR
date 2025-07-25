/**
 * Live Panel Analysis Launcher
 * Handles the launch and orchestration of Live Panel analysis for both files and directories
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { SaveFiles } from '../utils/saveFiles';
import { SessionWatcherManager } from '../watchers/sessionWatcherManager';
import { SessionServerManager } from '../servers/sessionServerManager';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';


export class LauncherLivePanel {
    
    /**
     * Launch Live Panel analysis for a file using session - NEW CLEAR ARCHITECTURE
     */
    static async launchFileLivePanelAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`🚀 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Starting Live Panel FILE analysis with session ${session.id}`);
        
        const registry = UnifiedSessionRegistry.getInstance(context);
        
        try {
            // Verify that file hash was calculated during session creation
            if (!session.hash256) {
                console.error(`❌ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: File hash not found in session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'File hash missing from session');
                return;
            }
            
            console.log(`📊 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: File hash from session: ${session.hash256.substring(0, 12)}...`);

            // Get current theme configuration
            const configStorage = AnalysisConfigurationStorage.getInstance(context);
            const currentTheme = await configStorage.getViewTheme();
            console.log(`NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Using theme: ${currentTheme}`);

            // =====================================================
            // STEP 1: GET TEMPLATES AND DATA.JSON WITH PROCESSOR
            // =====================================================
            console.log(`📥 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 1 - Getting template files and data.json...`);
            registry.updateSessionStatus(session.id, 'analyzing', 20);
            
            const fileRequirementProcessor = new FileRequirementProcessor(context);
            const processedFiles = await fileRequirementProcessor.processRequirements(session, currentTheme);
            
            console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Received ${processedFiles.loadedFiles.size} processed template files`);
            
            // Detailed log of received files
            console.log(`📋 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Files received from processor:`);
            for (const [fileName, content] of processedFiles.loadedFiles) {
                console.log(`📄 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: ${fileName} (${content.length} chars)`);
            }

            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`💾 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 2 - Saving processed files to storage...`);
            registry.updateSessionStatus(session.id, 'analyzing', 40);
            
            const saveFiles = new SaveFiles();
            const folderName = 'fileAnalysis';
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles,
                folderName,
                session.outputDirectory,
                context
            );
            
            console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Files successfully saved to: ${savedPath}`);
            
            // Update session with save information
            session.savedFilesPath = savedPath;
            
            // Store files in session for compatibility
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }

            // =======================================================
            // STEP 3: START WATCHER WITH DEBOUNCE AND RE-ANALYSIS
            // =======================================================
            console.log(`🔍 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 3 - Starting file watcher with debounce...`);
            registry.updateSessionStatus(session.id, 'analyzing', 60);
            
            const sessionWatcherManager = new SessionWatcherManager(context);
            const watcherId = await sessionWatcherManager.startWatchingSession(session);
            
            if (watcherId) {
                console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: File watcher started successfully with ID: ${watcherId}`);
                session.watcherId = watcherId;
            } else {
                console.log(`⚠️ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: File watcher could not be started`);
            }

            // ==================================
            // STEP 4: START SERVER WITH SSE
            // ==================================
            console.log(`🚀 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 4 - Starting server with SSE...`);
            registry.updateSessionStatus(session.id, 'analyzing', 80);
            
            const sessionServerManager = new SessionServerManager(context);
            const serverStatus = await sessionServerManager.startServerForSession(session);
            
            if (serverStatus.isServerActive) {
                console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Server started successfully on port ${serverStatus.port}`);
                console.log(`🌐 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Server URL: ${serverStatus.serverUrl}`);
                
                // Update session with server information
                session.assignedPort = serverStatus.port;
                session.serverUrl = serverStatus.serverUrl;
                
                // Emit session change event
                registry.updateSessionStatus(session.id, 'monitoring', 100);
                
                console.log(`🎉 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Live Panel file analysis completed successfully!`);
                console.log(`📊 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Final session status:`, {
                    id: session.id,
                    targetPath: session.targetPath,
                    hash256: session.hash256?.substring(0, 12) + '...',
                    savedFilesPath: session.savedFilesPath,
                    watcherId: session.watcherId,
                    serverUrl: session.serverUrl,
                    assignedPort: session.assignedPort
                });
            } else {
                console.log(`❌ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Server could not be started for session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'Server could not be started');
            }
            
        } catch (error) {
            console.error('❌ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Error launching file Live Panel analysis:', error);
            
            // Update session with error
            registry.updateSessionStatus(session.id, 'error', undefined, error instanceof Error ? error.message : String(error));
            
            vscode.window.showErrorMessage(`Failed to start Live Panel analysis: ${error}`);
        }
    }
    
    /**
     * Launch Live Panel analysis for a directory using session - NEW CLEAR ARCHITECTURE
     */
    static async launchDirectoryLivePanelAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`🚀 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Starting Live Panel DIRECTORY analysis with session ${session.id}`);
        
        const registry = UnifiedSessionRegistry.getInstance(context);
        
        try {
            // Verify that directory discovery was completed during session creation
            const directoriesToAnalyze = session.directoriesToAnalyze || [];
            const filesToHash = session.filesToHash || [];
            
            console.log(`📁 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Session comes with ${directoriesToAnalyze.length} directories to analyze`);
            console.log(`📄 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Session comes with ${filesToHash.length} files to hash`);
            
            if (directoriesToAnalyze.length === 0) {
                console.warn(`⚠️ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: No directories to analyze for session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'No directories to analyze');
                return;
            }

            if (filesToHash.length === 0) {
                console.warn(`⚠️ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: No files to hash for session ${session.id}`);
            }

            // Get current theme configuration
            const configStorage = AnalysisConfigurationStorage.getInstance(context);
            const currentTheme = await configStorage.getViewTheme();
            console.log(`NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Using theme: ${currentTheme}`);

            // =====================================================
            // STEP 1: GET TEMPLATES AND DATA.JSON WITH PROCESSOR
            // =====================================================
            console.log(`📥 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 1 - Getting template files and data.json...`);
            registry.updateSessionStatus(session.id, 'analyzing', 20);
            
            const fileRequirementProcessor = new FileRequirementProcessor(context);
            const processedFiles = await fileRequirementProcessor.processRequirements(session, currentTheme);
            
            console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Received ${processedFiles.loadedFiles.size} processed template files`);
            
            // Detailed log of received files
            console.log(`📋 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Files received from processor:`);
            for (const [fileName, content] of processedFiles.loadedFiles) {
                console.log(`📄 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: ${fileName} (${content.length} chars)`);
            }

            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`💾 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 2 - Saving processed files to storage...`);
            registry.updateSessionStatus(session.id, 'analyzing', 40);
            
            const saveFiles = new SaveFiles();
            const folderName = 'directoryAnalysis';
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles,
                folderName,
                session.outputDirectory,
                context
            );
            
            console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Files successfully saved to: ${savedPath}`);
            
            // Update session with save information
            session.savedFilesPath = savedPath;
            
            // Store files in session for compatibility
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }

            // =======================================================
            // STEP 3: START WATCHER WITH DEBOUNCE AND RE-ANALYSIS
            // =======================================================
            console.log(`🔍 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 3 - Starting directory watcher with debounce...`);
            registry.updateSessionStatus(session.id, 'analyzing', 60);
            
            const sessionWatcherManager = new SessionWatcherManager(context);
            const watcherId = await sessionWatcherManager.startWatchingSession(session);
            
            if (watcherId) {
                console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Directory watcher started successfully with ID: ${watcherId}`);
                session.watcherId = watcherId;
            } else {
                console.log(`⚠️ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Directory watcher could not be started`);
            }

            // ==================================
            // STEP 4: START SERVER WITH SSE
            // ==================================
            console.log(`🚀 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: STEP 4 - Starting server with SSE...`);
            registry.updateSessionStatus(session.id, 'analyzing', 80);
            
            const sessionServerManager = new SessionServerManager(context);
            const serverStatus = await sessionServerManager.startServerForSession(session);
            
            if (serverStatus.isServerActive) {
                console.log(`✅ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Directory server started successfully on port ${serverStatus.port}`);
                console.log(`🌐 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Directory server URL: ${serverStatus.serverUrl}`);
                
                // Update session with server information
                session.assignedPort = serverStatus.port;
                session.serverUrl = serverStatus.serverUrl;
                
                // Emit session change event
                registry.updateSessionStatus(session.id, 'monitoring', 100);
                
                console.log(`🎉 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Live Panel directory analysis completed successfully!`);
                console.log(`📊 NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Final session status:`, {
                    id: session.id,
                    targetPath: session.targetPath,
                    directoriesToAnalyze: directoriesToAnalyze.length,
                    filesToHash: filesToHash.length,
                    savedFilesPath: session.savedFilesPath,
                    watcherId: session.watcherId,
                    serverUrl: session.serverUrl,
                    assignedPort: session.assignedPort
                });
            } else {
                console.log(`❌ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Directory server could not be started for session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'Directory server could not be started');
            }
            
        } catch (error) {
            console.error('❌ NEW_LAUNCHER_LIVEPANEL_ANALYSIS: Error launching directory Live Panel analysis:', error);
            
            // Update session with error
            registry.updateSessionStatus(session.id, 'error', undefined, error instanceof Error ? error.message : String(error));
            
            vscode.window.showErrorMessage(`Failed to start Live Panel directory analysis: ${error}`);
        }
    }
}
