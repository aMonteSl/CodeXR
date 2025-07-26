/**
 * Analysis Session Manager
 * Orchestrates analysis sessions and provides high-level interface
 */

import * as vscode from 'vscode';
import { AnalysisSessionRegistry, AnalysisSession, AnalysisType, AnalysisStatus } from './analysisSessionRegistry';

export class AnalysisSessionManager {
    private static instance: AnalysisSessionManager;
    private registry: AnalysisSessionRegistry;

    private constructor() {
        this.registry = AnalysisSessionRegistry.getInstance();
        console.log('ANALYSIS_MANAGER: Initializing Analysis Session Manager');
    }

    static getInstance(): AnalysisSessionManager {
        if (!AnalysisSessionManager.instance) {
            AnalysisSessionManager.instance = new AnalysisSessionManager();
        }
        return AnalysisSessionManager.instance;
    }

    /**
     * Start a new analysis session
     */
    async startAnalysis(
        filePath: string,
        analysisType: AnalysisType,
        context: vscode.ExtensionContext,
        options?: {
            debounceTime?: number;
        }
    ): Promise<AnalysisSession> {
        try {
            console.log(`ANALYSIS_MANAGER: Starting ${analysisType} analysis for ${filePath}`);

            // Create session
            const session = await this.registry.createSession(filePath, analysisType, context);

            // Set debounce time if provided
            if (options?.debounceTime) {
                this.registry.setSessionDebounceTime(session.id, options.debounceTime);
            }

            return session;

        } catch (error) {
            console.error('ANALYSIS_MANAGER: Error starting analysis:', error);
            throw error;
        }
    }

    /**
     * Add a file to the session (called by GetNecessaryFiles)
     */
    addFileToSession(sessionId: string, fileName: string, content: string): boolean {
        return this.registry.addRequiredFile(sessionId, fileName, content);
    }

    /**
     * Mark session as analyzing (when debounce triggers)
     */
    setAnalyzing(sessionId: string): boolean {
        return this.registry.setSessionAnalyzing(sessionId);
    }

    /**
     * Update analysis progress
     */
    updateProgress(sessionId: string, progress: number): boolean {
        return this.registry.updateSessionStatus(sessionId, 'creating', progress);
    }

    /**
     * Mark analysis as completed and set port (when server launches)
     */
    completeAnalysis(sessionId: string, port?: number): boolean {
        return this.registry.setSessionCompleted(sessionId, port);
    }

    /**
     * Mark analysis as failed
     */
    failAnalysis(sessionId: string, error: string): boolean {
        return this.registry.updateSessionStatus(sessionId, 'failed', undefined, error);
    }

    /**
     * Close an analysis session
     */
    closeAnalysis(sessionId: string): boolean {
        return this.registry.closeSession(sessionId);
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): AnalysisSession | undefined {
        return this.registry.getSession(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): AnalysisSession[] {
        return this.registry.getActiveSessions();
    }

    /**
     * Get all sessions
     */
    getAllSessions(): AnalysisSession[] {
        return this.registry.getAllSessions();
    }

    /**
     * Get sessions for a specific file
     */
    getSessionsForFile(filePath: string): AnalysisSession[] {
        return this.registry.getSessionsByFilePath(filePath);
    }

    /**
     * Get sessions by analysis type
     */
    getSessionsByType(analysisType: AnalysisType): AnalysisSession[] {
        return this.registry.getSessionsByType(analysisType);
    }

    /**
     * Check if file has active analysis
     */
    hasActiveAnalysis(filePath: string, analysisType?: AnalysisType): boolean {
        const sessions = this.getSessionsForFile(filePath);
        return sessions.some(session => {
            const isActive = session.status === 'creating' || session.status === 'analyzing';
            const typeMatches = !analysisType || session.analysisType === analysisType;
            return isActive && typeMatches;
        });
    }

    /**
     * Get the latest active session for a file and analysis type
     */
    getLatestActiveSession(filePath: string, analysisType: AnalysisType): AnalysisSession | undefined {
        const sessions = this.getSessionsForFile(filePath)
            .filter(session => session.analysisType === analysisType && 
                              (session.status === 'creating' || session.status === 'analyzing'))
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        
        return sessions[0];
    }

    /**
     * Clean up old sessions
     */
    cleanup(maxAge: number = 3600000): number {
        return this.registry.cleanupOldSessions(maxAge);
    }

    /**
     * Get registry statistics
     */
    getStatistics() {
        return this.registry.getStatistics();
    }

    /**
     * Subscribe to session changes
     */
    onSessionChanged(listener: (session: AnalysisSession) => void): vscode.Disposable {
        return this.registry.onSessionChanged(listener);
    }

    /**
     * Helper method to handle analysis execution with automatic session management
     */
    async executeWithSession<T>(
        filePath: string,
        analysisType: AnalysisType,
        context: vscode.ExtensionContext,
        executionFunction: (session: AnalysisSession) => Promise<T>,
        options?: {
            debounceTime?: number;
        }
    ): Promise<{ session: AnalysisSession; result: T } | { session: AnalysisSession; error: string }> {
        
        let session: AnalysisSession;
        
        try {
            // Start session
            session = await this.startAnalysis(filePath, analysisType, context, options);
            
            // Execute analysis
            const result = await executionFunction(session);
            
            // Mark as completed
            this.completeAnalysis(session.id);
            
            return { session, result };
            
        } catch (error) {
            // Mark as failed
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (session!) {
                this.failAnalysis(session.id, errorMessage);
                return { session, error: errorMessage };
            } else {
                throw error;
            }
        }
    }

    /**
     * Dispose of manager and clean up resources
     */
    dispose(): void {
        this.registry.dispose();
        console.log('ANALYSIS_MANAGER: Manager disposed');
    }
}
