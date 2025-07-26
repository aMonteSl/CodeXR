/**
 * Active Analysis Registry Service
 * Unified service to register all types of analyses in the Active Analyses UI
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AnalysisSessionRegistry, AnalysisType, AnalysisSession } from '../registry/analysisSessionRegistry';
import { DirectoryAnalysisSessionRegistry, DirectoryAnalysisSession } from '../registry/directoryAnalysisSessionRegistry';
import { generateNonce } from '../../../utils/nonceGenerator';

export class ActiveAnalysisRegistry {
    private static instance: ActiveAnalysisRegistry;
    private fileSessionRegistry: AnalysisSessionRegistry;
    private directorySessionRegistry: DirectoryAnalysisSessionRegistry;

    private constructor() {
        this.fileSessionRegistry = AnalysisSessionRegistry.getInstance();
        this.directorySessionRegistry = DirectoryAnalysisSessionRegistry.getInstance();
        console.log('ACTIVE_ANALYSIS_REGISTRY: Initialized unified analysis registry');
    }

    public static getInstance(): ActiveAnalysisRegistry {
        if (!ActiveAnalysisRegistry.instance) {
            ActiveAnalysisRegistry.instance = new ActiveAnalysisRegistry();
        }
        return ActiveAnalysisRegistry.instance;
    }

    /**
     * Register a file LivePanel analysis in Active Analyses
     */
    public async registerFileLivePanelAnalysis(
        filePath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string
    ): Promise<string> {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 📄 Starting File LivePanel registration for: ${filePath}`);
            
            // Create session in file registry with FileLivePanel type
            const session = await this.fileSessionRegistry.createSession(filePath, 'FileLivePanel', context);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ File session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ File LivePanel analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering file LivePanel analysis:', error);
            throw error;
        }
    }

    /**
     * Register a directory LivePanel analysis in Active Analyses
     */
    public async registerDirectoryLivePanelAnalysis(
        directoryPath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string,
        isDeep: boolean = false
    ): Promise<string> {
        try {
            const analysisTypeStr = isDeep ? 'Deep Directory LivePanel' : 'Directory LivePanel';
            console.log(`ACTIVE_REGISTRY_DEBUG: 📁 Starting ${analysisTypeStr} registration for: ${directoryPath}`);
            
            // For directories, create a simple session object manually since the old registry
            // doesn't handle directories properly (tries to hash them as files)
            const id = generateNonce();
            const dirName = path.basename(directoryPath);
            const analysisType: AnalysisType = isDeep ? 'DeepDirectoryLivePanel' : 'DirectoryLivePanel';
            
            const session: AnalysisSession = {
                id,
                fileName: dirName,
                filePath: directoryPath,
                outputDirectory: `${dirName}_${analysisType}_${id}`,
                outputPath: path.join(context.storageUri?.fsPath || '/tmp', 'analysis', `${dirName}_${analysisType}_${id}`),
                analysisType,
                status: 'creating',
                startTime: new Date(),
                hash256: '', // Directories don't have file hashes
                requiredFiles: new Map<string, string>(), // Empty for directories
                metadata: {
                    fileSize: 0, // Directories don't have a single file size
                    lastModified: new Date()
                }
            };

            // Manually add to the sessions registry
            (this.fileSessionRegistry as any).sessions.set(id, session);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ ${analysisTypeStr} session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ ${analysisTypeStr} analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering directory LivePanel analysis:', error);
            throw error;
        }
    }

    /**
     * Register a VisualizeDOM analysis in Active Analyses
     */
    public async registerVisualizeDOMAnalysis(
        filePath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string
    ): Promise<string> {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Starting VisualizeDOM registration for: ${filePath}`);
            
            // Create session in file registry with DOMVisualization type
            const session = await this.fileSessionRegistry.createSession(filePath, 'DOMVisualization', context);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ VisualizeDOM session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ VisualizeDOM analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering VisualizeDOM analysis:', error);
            throw error;
        }
    }

    /**
     * Register a file XR analysis in Active Analyses
     */
    public async registerFileXRAnalysis(
        filePath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string
    ): Promise<string> {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🥽 Starting File XR registration for: ${filePath}`);
            
            // Create session in file registry with FileXRAnalysis type
            const session = await this.fileSessionRegistry.createSession(filePath, 'FileXRAnalysis', context);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ File XR session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ File XR analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering File XR analysis:', error);
            throw error;
        }
    }

    /**
     * Register a directory XR analysis in Active Analyses
     */
    public async registerDirectoryXRAnalysis(
        directoryPath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string
    ): Promise<string> {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🥽📁 Starting Directory XR registration for: ${directoryPath}`);
            
            // For directories, create a simple session object manually
            const id = generateNonce();
            const dirName = path.basename(directoryPath);
            
            const session: AnalysisSession = {
                id,
                fileName: dirName,
                filePath: directoryPath,
                outputDirectory: `${dirName}_DirectoryXRAnalysis_${id}`,
                outputPath: path.join(context.storageUri?.fsPath || '/tmp', 'analysis', `${dirName}_DirectoryXRAnalysis_${id}`),
                analysisType: 'DirectoryXRAnalysis',
                status: 'creating',
                startTime: new Date(),
                hash256: '', // Directories don't have file hashes
                requiredFiles: new Map<string, string>(), // Empty for directories
                metadata: {
                    fileSize: 0, // Directories don't have a single file size
                    lastModified: new Date()
                }
            };

            // Manually add to the sessions registry
            (this.fileSessionRegistry as any).sessions.set(id, session);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ Directory XR session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ Directory XR analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering directory XR analysis:', error);
            throw error;
        }
    }

    /**
     * Register a deep directory XR analysis in Active Analyses
     */
    public async registerDeepDirectoryXRAnalysis(
        directoryPath: string,
        context: vscode.ExtensionContext,
        serverPort?: number,
        serverUrl?: string
    ): Promise<string> {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🥽📚 Starting Deep Directory XR registration for: ${directoryPath}`);
            
            // For directories, create a simple session object manually
            const id = generateNonce();
            const dirName = path.basename(directoryPath);
            
            const session: AnalysisSession = {
                id,
                fileName: dirName,
                filePath: directoryPath,
                outputDirectory: `${dirName}_DeepDirectoryXRAnalysis_${id}`,
                outputPath: path.join(context.storageUri?.fsPath || '/tmp', 'analysis', `${dirName}_DeepDirectoryXRAnalysis_${id}`),
                analysisType: 'DeepDirectoryXRAnalysis',
                status: 'creating',
                startTime: new Date(),
                hash256: '', // Directories don't have file hashes
                requiredFiles: new Map<string, string>(), // Empty for directories
                metadata: {
                    fileSize: 0, // Directories don't have a single file size
                    lastModified: new Date()
                }
            };

            // Manually add to the sessions registry
            (this.fileSessionRegistry as any).sessions.set(id, session);
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ Deep Directory XR session created with ID: ${session.id}`);
            console.log(`ACTIVE_REGISTRY_DEBUG: 📋 Session details: type=${session.analysisType}, status=${session.status}`);
            
            // Update with server information if provided
            if (serverPort || serverUrl) {
                this.updateFileAnalysisServer(session.id, serverPort, serverUrl);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🌐 Server info updated: port=${serverPort}, url=${serverUrl}`);
            }
            
            // Force UI refresh after registration
            this.refreshActiveAnalysesUI();
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ Deep Directory XR analysis registered and UI refreshed with session ID: ${session.id}`);
            return session.id;
            
        } catch (error) {
            console.error('ACTIVE_REGISTRY_DEBUG: ❌ Error registering deep directory XR analysis:', error);
            throw error;
        }
    }

    /**
     * Update analysis status
     */
    public updateAnalysisStatus(
        sessionId: string,
        status: 'creating' | 'analyzing' | 'completed' | 'failed' | 'closing',
        progress?: number,
        error?: string
    ): boolean {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🔄 Updating status for session ${sessionId}: ${status}`);
            
            // Try updating in file registry first
            const updated = this.fileSessionRegistry.updateSessionStatus(sessionId, status, progress, error);
            
            if (updated) {
                console.log(`ACTIVE_REGISTRY_DEBUG: ✅ Updated session ${sessionId} status to: ${status}`);
                
                // Force UI refresh after status update
                this.refreshActiveAnalysesUI();
                console.log(`ACTIVE_REGISTRY_DEBUG: 🔄 UI refreshed after status update`);
                
                return true;
            }
            
            console.warn(`ACTIVE_REGISTRY_DEBUG: ⚠️ Session ${sessionId} not found for status update`);
            return false;
            
        } catch (error) {
            console.error(`ACTIVE_REGISTRY_DEBUG: ❌ Error updating session ${sessionId} status:`, error);
            return false;
        }
    }

    /**
     * Update server information for an analysis
     */
    public updateAnalysisServer(sessionId: string, port?: number, url?: string): boolean {
        return this.updateFileAnalysisServer(sessionId, port, url);
    }

    /**
     * Complete an analysis session
     */
    public completeAnalysis(sessionId: string): boolean {
        return this.updateAnalysisStatus(sessionId, 'completed');
    }

    /**
     * Fail an analysis session
     */
    public failAnalysis(sessionId: string, error: string): boolean {
        return this.updateAnalysisStatus(sessionId, 'failed', undefined, error);
    }

    /**
     * Close/remove an analysis session
     */
    public closeAnalysis(sessionId: string): boolean {
        try {
            // Mark as closing first
            this.updateAnalysisStatus(sessionId, 'closing');
            
            // Remove from registry after a short delay
            setTimeout(() => {
                this.fileSessionRegistry.removeSession(sessionId);
                console.log(`ACTIVE_ANALYSIS_REGISTRY: 🗑️ Removed session ${sessionId} from registry`);
            }, 1000);
            
            return true;
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSIS_REGISTRY: ❌ Error closing session ${sessionId}:`, error);
            return false;
        }
    }

    // Private helper methods

    /**
     * Update server information for file analysis
     */
    private updateFileAnalysisServer(sessionId: string, port?: number, url?: string): boolean {
        try {
            const session = this.fileSessionRegistry.getSession(sessionId);
            if (!session) {
                console.warn(`ACTIVE_ANALYSIS_REGISTRY: Session ${sessionId} not found for server update`);
                return false;
            }

            // Update session with server info
            if (port !== undefined) {
                session.port = port;
            }
            if (url) {
                // Store server URL in metadata if not already present
                if (!session.metadata) {
                    session.metadata = {
                        fileSize: 0,
                        lastModified: new Date()
                    };
                }
                (session.metadata as any).serverUrl = url;
            }

            console.log(`ACTIVE_ANALYSIS_REGISTRY: ✅ Updated server info for session ${sessionId}: port=${port}, url=${url}`);
            return true;

        } catch (error) {
            console.error(`ACTIVE_ANALYSIS_REGISTRY: ❌ Error updating server info for session ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Force refresh of Active Analyses UI
     */
    private refreshActiveAnalysesUI(): void {
        try {
            console.log(`ACTIVE_REGISTRY_DEBUG: 🔄 Forcing Active Analyses UI refresh via registry events...`);
            
            // Fire session changed events to trigger UI refresh
            const allSessions = this.fileSessionRegistry.getAllSessions();
            console.log(`ACTIVE_REGISTRY_DEBUG: 📊 Found ${allSessions.length} total sessions to refresh`);
            
            if (allSessions.length > 0) {
                // Fire event for the most recent session to trigger UI update
                const latestSession = allSessions[allSessions.length - 1];
                this.fileSessionRegistry.fireSessionChanged(latestSession);
                console.log(`ACTIVE_REGISTRY_DEBUG: 🔥 Fired session changed event for session: ${latestSession.id}`);
            }
            
            console.log(`ACTIVE_REGISTRY_DEBUG: ✅ UI refresh events fired`);
            
        } catch (error) {
            console.error(`ACTIVE_REGISTRY_DEBUG: ❌ Error refreshing UI:`, error);
        }
    }
}
