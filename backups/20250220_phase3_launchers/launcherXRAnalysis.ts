/**
 * XR Analysis Launcher
 * Handles the launch and orchestration of XR-based analysis for both files and directories
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { SaveFiles } from '../utils/saveFiles';
import { FileWatcherOrchestrator } from '../watchers/fileWatcherOrchestrator';
import { DirectoryWatcherOrchestrator } from '../watchers/directoryWatcherOrchestrator';
import { SessionServerManager } from '../servers/sessionServerManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { DimensionValidator } from '../../../babia_templates/processing/dimensionValidator';
import { BabiaChartRegistry } from '../../../babia_templates/registry/chartRegistry';
import { DimensionMapping } from '../../../babia_templates/models/chartModels';

export class LauncherXRAnalysis {
    
    /**
     * Common validation function for XR analysis configuration
     * Validates chart type and dimension mappings before starting analysis
     */
    private static async validateXRConfiguration(
        chartType: string,
        dimensionMappings: any,
        analysisType: 'file' | 'directory',
        registry: UnifiedSessionRegistry,
        sessionId: string
    ): Promise<{ isValid: boolean; error?: string }> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Validating ${analysisType} XR configuration...`);
        
        // Validate chart type exists
        if (!chartType) {
            const errorMessage = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR Analysis Error: No chart type selected. Please configure chart type in Analysis Settings.`;
            console.error(errorMessage);
            registry.updateSessionStatus(sessionId, 'error', undefined, errorMessage);
            return { isValid: false, error: errorMessage };
        }
        
        // Validate dimension mappings exist
        if (!dimensionMappings || Object.keys(dimensionMappings).length === 0) {
            const errorMessage = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR Analysis Error: No dimension mappings configured. Please configure dimension mappings in Analysis Settings.`;
            console.error(errorMessage);
            registry.updateSessionStatus(sessionId, 'error', undefined, errorMessage);
            return { isValid: false, error: errorMessage };
        }
        
        // Get chart metadata from registry
        const chartRegistry = BabiaChartRegistry.getInstance();
        const chartMetadata = chartRegistry.getChart(chartType);
        
        if (!chartMetadata) {
            const errorMessage = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR Analysis Error: Unknown chart type '${chartType}'. Please select a valid chart type.`;
            console.error(errorMessage);
            registry.updateSessionStatus(sessionId, 'error', undefined, errorMessage);
            return { isValid: false, error: errorMessage };
        }
        
        // Convert dimension mappings to DimensionMapping array for validation
        const mappingsArray: DimensionMapping[] = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
            dimension,
            dataField: dataField as string
        }));
        
        // Validate dimension mappings using DimensionValidator
        const validationResult = DimensionValidator.validateMappings(chartMetadata, mappingsArray);
        
        if (!validationResult.isValid) {
            const errorMessage = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR Analysis Error: Invalid dimension mappings:\n${validationResult.errors.join('\n')}`;
            console.error(errorMessage);
            console.error('Validation errors:', validationResult.errors);
            if (validationResult.warnings.length > 0) {
                console.warn('Validation warnings:', validationResult.warnings);
            }
            registry.updateSessionStatus(sessionId, 'error', undefined, errorMessage);
            return { isValid: false, error: errorMessage };
        }
        
        // Show warnings if any
        if (validationResult.warnings.length > 0) {
            console.warn(`${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR Analysis Warnings:`, validationResult.warnings);
        }
        
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: ${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR configuration validated successfully`);
        console.log(`Chart Type: ${chartType}`);
        console.log(`Dimension Mappings:`);
        for (const [dimension, dataField] of Object.entries(dimensionMappings)) {
            console.log(`      ${dimension} → ${dataField}`);
        }
        
        return { isValid: true };
    }
    
    /**
     * Common validation and configuration retrieval for XR analysis
     * Returns validated configuration or throws error
     */
    private static async validateAndGetXRConfiguration(
        analysisType: 'file' | 'directory',
        registry: UnifiedSessionRegistry,
        sessionId: string,
        context: vscode.ExtensionContext
    ): Promise<{ chartType: string; dimensionMappings: any }> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 0 - Validating ${analysisType} XR configuration...`);
        registry.updateSessionStatus(sessionId, 'analyzing', 10);
        
        // Get configuration from AnalysisConfigurationStorage
        const storage = AnalysisConfigurationStorage.getInstance(context);
        const chartType = analysisType === 'file' 
            ? await storage.getChartTypeFile()
            : await storage.getDirectoryChartType();
        const dimensionMappings = analysisType === 'file'
            ? await storage.getDimensionMappingFile()
            : await storage.getDimensionMappingDirectory();
        
        // Validate configuration using common function
        const validationResult = await this.validateXRConfiguration(
            chartType,
            dimensionMappings,
            analysisType,
            registry,
            sessionId
        );
        
        if (!validationResult.isValid) {
            vscode.window.showErrorMessage(validationResult.error!);
            throw new Error(validationResult.error!);
        }
        
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 0 completed - ${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} XR configuration validated`);
        
        return { chartType, dimensionMappings };
    }
    
    /**
     * Launch XR analysis for a file using session
     */
    static async launchFileXRAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Starting XR FILE analysis with session ${session.id}`);
        
        const registry = UnifiedSessionRegistry.getInstance(context);
        
        try {
            // =================================================================
            // STEP 0: VALIDATE XR CONFIGURATION BEFORE STARTING PROCESS
            // =================================================================
            const config = await this.validateAndGetXRConfiguration('file', registry, session.id, context);
            
            // =====================================================
            // STEP 1: PROCESS FILES WITH FILEREQUIREMENTPROCESSOR
            // =====================================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 1 - Processing files with FileRequirementProcessor...`);
            registry.updateSessionStatus(session.id, 'analyzing', 30);
            
            const fileProcessor = new FileRequirementProcessor(context);
            const processedFiles = await fileProcessor.processRequirements(session);
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 1 completed - Files processed: ${processedFiles.loadedFiles.size}`);
            
            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 2 - Saving files with SaveFiles...`);
            registry.updateSessionStatus(session.id, 'analyzing', 50);
            
            const saveFiles = new SaveFiles();
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles, 
                'fileAnalysis',  // Use consistent base directory like LivePanel
                session.outputDirectory, 
                context
            );
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 2 completed - Files saved to: ${savedPath}`);
            
            // Update session with save information
            session.savedFilesPath = savedPath;
            
            // Store files in session for compatibility
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }
            
            // =======================================================
            // STEP 3: START FILE WATCHER ORCHESTRATOR
            // =======================================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 3 - Starting FileWatcherOrchestrator...`);
            registry.updateSessionStatus(session.id, 'analyzing', 70);
            
            const fileWatcher = new FileWatcherOrchestrator(session, context);
            await fileWatcher.startWatching();
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 3 completed - FileWatcherOrchestrator started`);
            
            // ==================================
            // STEP 4: START SERVER WITH SSE
            // ==================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 4 - Starting server with SSE...`);
            registry.updateSessionStatus(session.id, 'analyzing', 90);
            
            const sessionServerManager = new SessionServerManager(context);
            const serverStatus = await sessionServerManager.startServerForSession(session);
            
            if (serverStatus.isServerActive) {
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Server started successfully on port ${serverStatus.port}`);
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Server URL: ${serverStatus.serverUrl}`);
                
                // Update session with server information
                if (serverStatus.port) {
                    console.log(`NEW_LAUNCHER_XR_ANALYSIS: DEBUG - Session ${session.id} assigned to port ${serverStatus.port}`);
                }
                
                session.assignedPort = serverStatus.port;
                session.serverUrl = serverStatus.serverUrl;
                
                // Emit session change event
                registry.updateSessionStatus(session.id, 'monitoring', 100);
                
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: XR file analysis completed successfully!`);
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Final session status:`, {
                    id: session.id,
                    targetPath: session.targetPath,
                    hash256: session.hash256?.substring(0, 12) + '...',
                    savedFilesPath: session.savedFilesPath,
                    serverUrl: session.serverUrl,
                    assignedPort: session.assignedPort
                });
                
                vscode.window.showInformationMessage(
                    `XR Analysis completed for file: ${session.targetName} - Server running on port ${serverStatus.port}`
                );
            } else {
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Server could not be started for session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'Server could not be started');
                vscode.window.showErrorMessage(`Failed to start XR server for: ${session.targetName}`);
            }
            
        } catch (error) {
            console.error('NEW_LAUNCHER_XR_ANALYSIS: Error launching file XR analysis:', error);
            
            // Update session with error
            registry.updateSessionStatus(session.id, 'error', undefined, error instanceof Error ? error.message : String(error));
            
            vscode.window.showErrorMessage(`Failed to start XR analysis: ${error}`);
        }
    }
    
    /**
     * Launch XR analysis for a directory using session
     */
    static async launchDirectoryXRAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Starting XR DIRECTORY analysis with session ${session.id}`);
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Target: ${session.targetName}${session.isDeep ? ' (Deep mode)' : ' (Normal mode)'}`);
        
        const registry = UnifiedSessionRegistry.getInstance(context);
        
        try {
            // =================================================================
            // STEP 0: VALIDATE XR CONFIGURATION BEFORE STARTING PROCESS
            // =================================================================
            const config = await this.validateAndGetXRConfiguration('directory', registry, session.id, context);
            
            // =====================================================================
            // STEP 1: PROCESS DIRECTORY WITH FILEREQUIREMENTPROCESSOR
            // =====================================================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 1 - Processing directory with FileRequirementProcessor...`);
            registry.updateSessionStatus(session.id, 'analyzing', 30);
            
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: Starting directory file processing chain:`);
            console.log(`   LauncherXRAnalysis → FileRequirementProcessor → XRDirectoryRequirements → directoryXRParser`);
            console.log(`   Using chart type: ${config.chartType}`);
            console.log(`   Using dimension mappings:`, config.dimensionMappings);
            
            const fileProcessor = new FileRequirementProcessor(context);
            const processedFiles = await fileProcessor.processRequirements(session);
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 1 completed - Directory files processed: ${processedFiles.loadedFiles.size}`);
            
            // Log processed files for verification
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: Generated files:`);
            for (const [fileName, content] of processedFiles.loadedFiles) {
                console.log(`   ${fileName} (${content.length} chars)`);
            }
            
            // ===================================
            // STEP 2: SAVE FILES WITH SAVEFILES
            // ===================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 2 - Saving directory analysis files...`);
            registry.updateSessionStatus(session.id, 'analyzing', 50);
            
            const saveFiles = new SaveFiles();
            
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles, 
                'directoryAnalysis',  // Base directory for directory XR analysis
                session.outputDirectory, 
                context
            );
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 2 completed - Directory XR files saved to: ${savedPath}`);
            
            // Update session with save information
            session.savedFilesPath = savedPath;
            
            // Store files in session for compatibility
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }
            
            // Log saved files for verification
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: Saved files to ${savedPath}:`);
            for (const [fileName, content] of processedFiles.loadedFiles) {
                console.log(`   ${fileName} (${content.length} chars)`);
            }
            
            // =======================================================
            // STEP 3: START DIRECTORY WATCHER FOR LIVE UPDATES
            // =======================================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 3 - Starting directory watcher for live updates...`);
            registry.updateSessionStatus(session.id, 'analyzing', 80);
            
            const directoryWatcher = new DirectoryWatcherOrchestrator(session, context);
            const watcherId = await directoryWatcher.startWatching();
            
            if (watcherId) {
                // Update session with watcher information
                session.watcherId = watcherId;
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Directory watcher started with ID: ${watcherId}`);
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Monitoring ${session.filesToHash?.length || 0} files for changes`);
            } else {
                console.warn(`NEW_LAUNCHER_XR_ANALYSIS: Directory watcher could not be started`);
            }
            
            // =======================================================
            // STEP 4: START SESSION SERVER FOR SERVING XR VISUALIZATION
            // =======================================================
            console.log(`NEW_LAUNCHER_XR_ANALYSIS: STEP 4 - Starting session server for XR visualization...`);
            registry.updateSessionStatus(session.id, 'analyzing', 90);
            
            const sessionServerManager = new SessionServerManager(context);
            const serverStatus = await sessionServerManager.startServerForSession(session);
            
            if (serverStatus.isServerActive) {
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: XR Server started successfully on port ${serverStatus.port}`);
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: XR Server URL: ${serverStatus.serverUrl}`);
                
                // Update session with server information using centralized function
                if (serverStatus.port) {
                    console.log(`NEW_LAUNCHER_XR_ANALYSIS: DEBUG - Registering port ${serverStatus.port} for directory session ${session.id}`);
                    const portRegistered = registry.registerSessionPort(session.id, serverStatus.port);
                    console.log(`NEW_LAUNCHER_XR_ANALYSIS: DEBUG - Directory port registration result: ${portRegistered}`);
                }
                
                session.assignedPort = serverStatus.port;
                session.serverUrl = serverStatus.serverUrl;
                
                // Emit session change event
                registry.updateSessionStatus(session.id, 'monitoring', 100);
                
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: XR directory analysis completed successfully!`);
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: Final session status:`, {
                    id: session.id,
                    targetPath: session.targetPath,
                    targetName: session.targetName,
                    isDeep: session.isDeep,
                    chartType: config.chartType,
                    dimensionMappings: config.dimensionMappings,
                    outputDirectory: session.outputDirectory,
                    savedFilesPath: session.savedFilesPath,
                    serverUrl: session.serverUrl,
                    assignedPort: session.assignedPort,
                    watcherId: session.watcherId
                });
                
                vscode.window.showInformationMessage(
                    `XR Directory Analysis completed for: ${session.targetName}${session.isDeep ? ' (Deep)' : ''} - Server running on port ${serverStatus.port}`
                );
            } else {
                console.log(`NEW_LAUNCHER_XR_ANALYSIS: XR Server could not be started for session ${session.id}`);
                registry.updateSessionStatus(session.id, 'error', undefined, 'Server could not be started');
                vscode.window.showErrorMessage(`Failed to start XR server for: ${session.targetName}`);
            }
            
        } catch (error) {
            console.error('NEW_LAUNCHER_XR_ANALYSIS: Error launching directory XR analysis:', error);
            
            // Update session with error
            registry.updateSessionStatus(session.id, 'error', undefined, error instanceof Error ? error.message : String(error));
            
            vscode.window.showErrorMessage(`Failed to start directory XR analysis: ${error}`);
        }
    }
}
