/**
 * Unified Session Manager
 * High-level interface for managing analysis sessions in the new engine
 */

import * as vscode from 'vscode';
import { UnifiedSessionRegistry } from './sessionRegistry';
import { 
    UnifiedAnalysisSession, 
    AnalysisMode, 
    TargetType, 
    AnalysisStatus,
    SessionCreationParams,
    AnalysisSessionFactory
} from './analysisSession';

export class UnifiedSessionManager {
    private static instance: UnifiedSessionManager;
    private registry: UnifiedSessionRegistry;

    private constructor(context: vscode.ExtensionContext) {
        this.registry = UnifiedSessionRegistry.getInstance(context);
        console.log('UNIFIED_MANAGER: Initializing Unified Session Manager');
    }

    static getInstance(context: vscode.ExtensionContext): UnifiedSessionManager {
        if (!UnifiedSessionManager.instance) {
            UnifiedSessionManager.instance = new UnifiedSessionManager(context);
        }
        return UnifiedSessionManager.instance;
    }

    /**
     * Start a new analysis session
     */
    async startAnalysis(
        targetPath: string,
        analysisMode: AnalysisMode,
        targetType: TargetType,
        context: vscode.ExtensionContext,
        options?: {
            isDeep?: boolean;
            debounceTime?: number;
        }
    ): Promise<UnifiedAnalysisSession | null> {
        try {
            const analysisTypeId = AnalysisSessionFactory.getAnalysisTypeId({
                analysisMode,
                targetType,
                isDeep: options?.isDeep || false
            } as UnifiedAnalysisSession);
            
            console.log(`UNIFIED_MANAGER: Starting ${analysisTypeId} analysis for: ${targetPath}`);

            const params: SessionCreationParams = {
                targetPath,
                analysisMode,
                targetType,
                isDeep: options?.isDeep || false,
                context
            };

            console.log(`UNIFIED_MANAGER: 🔍 DEBUG - Creating session with params:`, {
                targetPath: params.targetPath,
                analysisMode: params.analysisMode,
                targetType: params.targetType,
                isDeep: params.isDeep
            });

            // Create session
            const session = await this.registry.createSession(params);
            
            // Check if session creation was skipped due to duplicate
            if (!session) {
                console.log(`UNIFIED_MANAGER: Session creation skipped (duplicate detected)`);
                return null;
            }

            // Set debounce time if provided
            if (options?.debounceTime) {
                this.setSessionDebounceTime(session.id, options.debounceTime);
            }

            return session;

        } catch (error) {
            console.error('UNIFIED_MANAGER: Error starting analysis:', error);
            throw error;
        }
    }

    /**
     * Add a file to the session (called by processors)
     */
    addFileToSession(sessionId: string, fileName: string, content: string): boolean {
        return this.registry.addRequiredFile(sessionId, fileName, content);
    }

    /**
     * Mark session as analyzing (when debounce triggers)
     */
    setAnalyzing(sessionId: string): boolean {
        return this.registry.updateSessionStatus(sessionId, 'analyzing');
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
        return this.registry.setSessionMonitoring(sessionId, port);
    }

    /**
     * Mark analysis as failed
     */
    failAnalysis(sessionId: string, error: string): boolean {
        return this.registry.updateSessionStatus(sessionId, 'error', undefined, error);
    }

    /**
     * Close an analysis session
     */
    closeAnalysis(sessionId: string): boolean {
        return this.registry.closeSession(sessionId);
    }

    /**
     * Set session debounce time
     */
    setSessionDebounceTime(sessionId: string, debounceTime: number): boolean {
        const session = this.registry.getSession(sessionId);
        if (!session) {
            return false;
        }

        if (!session.metadata) {
            session.metadata = {
                targetSize: 0,
                lastModified: new Date()
            };
        }
        session.metadata.debounceTime = debounceTime;
        
        return true;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): UnifiedAnalysisSession | undefined {
        return this.registry.getSession(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): UnifiedAnalysisSession[] {
        return this.registry.getActiveSessions();
    }

    /**
     * Get all sessions
     */
    getAllSessions(): UnifiedAnalysisSession[] {
        return this.registry.getAllSessions();
    }

    /**
     * Get sessions for a specific target path
     */
    getSessionsForTarget(targetPath: string): UnifiedAnalysisSession[] {
        return this.registry.getSessionsByTargetPath(targetPath);
    }

    /**
     * Get sessions by analysis mode
     */
    getSessionsByMode(analysisMode: AnalysisMode): UnifiedAnalysisSession[] {
        return this.registry.getSessionsByAnalysisMode(analysisMode);
    }

    /**
     * Get sessions by target type
     */
    getSessionsByTargetType(targetType: TargetType): UnifiedAnalysisSession[] {
        return this.registry.getSessionsByTargetType(targetType);
    }

    /**
     * Check if target has active analysis
     */
    hasActiveAnalysis(targetPath: string, analysisMode?: AnalysisMode, targetType?: TargetType): boolean {
        const sessions = this.getSessionsForTarget(targetPath);
        return sessions.some(session => {
            const isActive = AnalysisSessionFactory.isActiveSession(session);
            const modeMatches = !analysisMode || session.analysisMode === analysisMode;
            const typeMatches = !targetType || session.targetType === targetType;
            return isActive && modeMatches && typeMatches;
        });
    }

    /**
     * Get the latest active session for a target and analysis type
     */
    getLatestActiveSession(
        targetPath: string, 
        analysisMode: AnalysisMode, 
        targetType: TargetType
    ): UnifiedAnalysisSession | undefined {
        const sessions = this.getSessionsForTarget(targetPath)
            .filter(session => 
                session.analysisMode === analysisMode && 
                session.targetType === targetType &&
                AnalysisSessionFactory.isActiveSession(session)
            )
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
        
        return sessions.length > 0 ? sessions[0] : undefined;
    }

    /**
     * Get sessions by analysis type ID
     */
    getSessionsByAnalysisType(analysisMode: AnalysisMode, targetType: TargetType, isDeep?: boolean): UnifiedAnalysisSession[] {
        return this.getAllSessions().filter(session => {
            const modeMatches = session.analysisMode === analysisMode;
            const typeMatches = session.targetType === targetType;
            const depthMatches = isDeep === undefined || session.isDeep === isDeep;
            return modeMatches && typeMatches && depthMatches;
        });
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
    onSessionChanged(listener: (session: UnifiedAnalysisSession) => void): vscode.Disposable {
        return this.registry.onSessionChanged(listener);
    }

    /**
     * Helper method to handle analysis execution with automatic session management
     */
    async executeWithSession<T>(
        targetPath: string,
        analysisMode: AnalysisMode,
        targetType: TargetType,
        context: vscode.ExtensionContext,
        executionFunction: (session: UnifiedAnalysisSession) => Promise<T>,
        options?: {
            isDeep?: boolean;
            debounceTime?: number;
        }
    ): Promise<{ session: UnifiedAnalysisSession; result: T } | { session: UnifiedAnalysisSession; error: string } | null> {
        
        let session: UnifiedAnalysisSession | null = null;
        
        try {
            // Start session
            session = await this.startAnalysis(targetPath, analysisMode, targetType, context, options);
            
            // Check if session creation was skipped due to duplicate
            if (!session) {
                console.log(`UNIFIED_MANAGER: Analysis execution skipped (duplicate detected)`);
                return null;
            }
            
            // Execute analysis
            const result = await executionFunction(session);
            
            // Mark as completed
            this.completeAnalysis(session.id);
            
            return { session, result };
            
        } catch (error) {
            // Mark as failed
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`UNIFIED_MANAGER: Analysis execution failed:`, error);
            
            // If we have a session, mark it as failed and return error info
            if (session) {
                this.failAnalysis(session.id, errorMessage);
                return { session, error: errorMessage };
            } else {
                // If no session was created, just throw the error
                throw error;
            }
        }
    }

    /**
     * Get registry instance for direct access (use with caution)
     */
    getRegistry(): UnifiedSessionRegistry {
        return this.registry;
    }

    /**
     * Dispose of manager and clean up resources
     */
    dispose(): void {
        this.registry.dispose();
        console.log('UNIFIED_MANAGER: Manager disposed');
    }
}
