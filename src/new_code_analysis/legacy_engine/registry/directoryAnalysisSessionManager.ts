/**
 * Directory Analysis Session Manager
 * Manages the lifecycle of directory analysis sessions
 */

import * as vscode from 'vscode';
import { 
    DirectoryAnalysisSessionRegistry, 
    DirectoryAnalysisSession, 
    DirectoryAnalysisType,
    DirectoryAnalysisStatus 
} from './directoryAnalysisSessionRegistry';

export class DirectoryAnalysisSessionManager {
    private static instance: DirectoryAnalysisSessionManager;
    private registry: DirectoryAnalysisSessionRegistry;

    private constructor() {
        console.log('DIRECTORY_ANALYSIS_MANAGER: Initializing Directory Analysis Session Manager');
        this.registry = DirectoryAnalysisSessionRegistry.getInstance();
    }

    static getInstance(): DirectoryAnalysisSessionManager {
        if (!DirectoryAnalysisSessionManager.instance) {
            DirectoryAnalysisSessionManager.instance = new DirectoryAnalysisSessionManager();
        }
        return DirectoryAnalysisSessionManager.instance;
    }

    /**
     * Start a new directory analysis session
     */
    async startDirectoryAnalysis(
        directoryPath: string,
        analysisType: DirectoryAnalysisType,
        context: vscode.ExtensionContext
    ): Promise<DirectoryAnalysisSession> {
        try {
            console.log(`DIRECTORY_ANALYSIS_MANAGER: Starting ${analysisType} analysis for directory: ${directoryPath}`);

            // Create new session
            const session = await this.registry.createSession(directoryPath, analysisType, context);
            
            console.log(`DIRECTORY_ANALYSIS_MANAGER: Session ${session.id} created successfully`);
            return session;

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_MANAGER: Error starting directory analysis:', error);
            throw error;
        }
    }

    /**
     * Update session status
     */
    updateSessionStatus(
        sessionId: string, 
        status: DirectoryAnalysisStatus, 
        progress?: number, 
        error?: string
    ): boolean {
        return this.registry.updateSessionStatus(sessionId, status, progress, error);
    }

    /**
     * Complete a session
     */
    completeSession(sessionId: string, port?: number): boolean {
        return this.registry.setSessionCompleted(sessionId, port);
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): DirectoryAnalysisSession | undefined {
        return this.registry.getSession(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): DirectoryAnalysisSession[] {
        return this.registry.getActiveSessions();
    }

    /**
     * Close a session
     */
    closeSession(sessionId: string): boolean {
        return this.registry.closeSession(sessionId);
    }

    /**
     * Check if directory has existing active sessions
     */
    hasActiveSessionsForDirectory(directoryPath: string): boolean {
        const sessions = this.registry.getSessionsByDirectoryPath(directoryPath);
        return sessions.some(session => 
            session.status === 'creating' || 
            session.status === 'analyzing'
        );
    }

    /**
     * Get registry instance for direct access
     */
    getRegistry(): DirectoryAnalysisSessionRegistry {
        return this.registry;
    }

    /**
     * Clean up old completed/failed sessions
     */
    cleanupOldSessions(maxAge: number = 3600000): number {
        const sessions = this.registry.getAllSessions();
        const now = new Date().getTime();
        let cleanedCount = 0;

        for (const session of sessions) {
            if ((session.status === 'completed' || session.status === 'failed') && session.endTime) {
                const age = now - session.endTime.getTime();
                if (age > maxAge) {
                    this.registry.removeSession(session.id);
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`DIRECTORY_ANALYSIS_MANAGER: Cleaned up ${cleanedCount} old directory sessions`);
        }
        
        return cleanedCount;
    }

    /**
     * Dispose of manager and clean up resources
     */
    dispose(): void {
        this.registry.dispose();
        console.log('DIRECTORY_ANALYSIS_MANAGER: Manager disposed');
    }
}
