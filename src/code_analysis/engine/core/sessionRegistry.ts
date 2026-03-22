/**
 * Unified Session Registry
 * Only the essentials for creating and managing sessions
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { generateNonce } from '../../../utils/nonceGenerator';
import { 
    UnifiedAnalysisSession, 
    AnalysisMode, 
    TargetType, 
    AnalysisStatus,
    SessionCreationParams
} from './analysisSession';
import { SHA256Generator } from '../../../utils/sha256Generator';


export class UnifiedSessionRegistry {
    private static instance: UnifiedSessionRegistry;
    private sessions: Map<string, UnifiedAnalysisSession> = new Map();
    private _onSessionChanged = new vscode.EventEmitter<UnifiedAnalysisSession>();
    public readonly onSessionChanged = this._onSessionChanged.event;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        console.log('UNIFIED_REGISTRY: Initializing session registry');
        this.context = context;
    }

    static getInstance(context: vscode.ExtensionContext): UnifiedSessionRegistry {
        if (!UnifiedSessionRegistry.instance) {
            UnifiedSessionRegistry.instance = new UnifiedSessionRegistry(context);
        }
        return UnifiedSessionRegistry.instance;
    }

    /**
     * Check if a session with the same parameters already exists
     * A session is considered duplicate if it has the same:
     * - targetPath
     * - analysisMode
     * - targetType
     * - isDeep
     */
    private hasDuplicateSession(params: SessionCreationParams): UnifiedAnalysisSession | null {
        const existingSessions = this.getAllSessions();

        for (const session of existingSessions) {
            const isDuplicate =
                session.targetPath === params.targetPath &&
                session.analysisMode === params.analysisMode &&
                session.targetType === params.targetType &&
                session.isDeep === (params.isDeep || false) &&
                session.status !== 'closed' &&
                session.status !== 'error';

            if (isDuplicate) {
                console.log(`UNIFIED_REGISTRY: Duplicate session detected for ${params.targetPath}`);
                return session;
            }
        }

        return null;
    }

    /**
     * Create a new unified analysis session - SIMPLIFIED
     */
    async createSession(params: SessionCreationParams): Promise<UnifiedAnalysisSession | null> {
        try {
            console.log(`UNIFIED_REGISTRY: Creating session`, {
                targetPath: params.targetPath,
                analysisMode: params.analysisMode,
                targetType: params.targetType,
                isDeep: params.isDeep || false
            });

            const duplicateSession = this.hasDuplicateSession(params);
            if (duplicateSession) {
                if (duplicateSession.status === 'monitoring') {
                    vscode.window.showWarningMessage(
                        `Analysis already complete for "${duplicateSession.targetName}". Use Active Analyses panel to view results.`,
                        'Open Active Analyses'
                    ).then(choice => {
                        if (choice === 'Open Active Analyses') {
                            vscode.commands.executeCommand('workbench.view.extension.codeXRView');
                        }
                    });
                } else if (duplicateSession.status === 'creating' || duplicateSession.status === 'analyzing') {
                    vscode.window.showWarningMessage(
                        `Analysis for "${duplicateSession.targetName}" is already in progress (${duplicateSession.status})...`
                    );
                } else {
                    vscode.window.showWarningMessage(
                        `Analysis session for "${duplicateSession.targetName}" already exists with status: ${duplicateSession.status}`
                    );
                }

                this._onSessionChanged.fire(duplicateSession);
                return null;
            }

            const id = generateNonce();
            const targetName = path.basename(params.targetPath);
            const storageUri = params.context.storageUri;
            if (!storageUri) {
                throw new Error('Workspace storage URI is not available');
            }

            const outputDirectory = `${path.parse(targetName).name}_${params.analysisMode}_${params.targetType}_${id}`;
            const baseDirectory = params.targetType === 'file' ? 'fileAnalysis' : 'directoryAnalysis';
            const outputPath = path.join(storageUri.fsPath, baseDirectory, outputDirectory);

            let calculatedHash = '';
            if (params.targetType === 'file') {
                try {
                    calculatedHash = await SHA256Generator.generateFileHash(params.targetPath);
                } catch (hashError) {
                    console.error(`UNIFIED_REGISTRY: Error calculating file hash:`, hashError);
                    throw new Error(`Failed to calculate file hash: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
                }
            }

            const session: UnifiedAnalysisSession = {
                id,
                targetPath: params.targetPath,
                targetType: params.targetType,
                targetName,
                analysisMode: params.analysisMode,
                isDeep: params.isDeep || false,
                status: 'creating',
                startTime: new Date(),
                hash256: calculatedHash,
                outputDirectory,
                outputPath,
                requiredFiles: new Map<string, string>(),
                templatePaths: new Map<string, string>(),
                metadata: {}
            };

            if (params.targetType === 'directory') {
                try {
                    const stats = await fs.stat(params.targetPath);
                    if (!stats.isDirectory()) {
                        throw new Error(`Target path is not a directory: ${params.targetPath}`);
                    }
                } catch (statError) {
                    console.error(`UNIFIED_REGISTRY: Error accessing target path ${params.targetPath}:`, statError);
                    throw statError;
                }

                // Directory scanning and initial hashes are populated after Python
                // completes the first analysis, keeping the startup path lightweight.
                session.directoriesToAnalyze = [];
                session.filesToHash = [];
                console.log('UNIFIED_REGISTRY: Directory session will populate tracked files after initial analysis');
            }

            this.sessions.set(id, session);
            this._onSessionChanged.fire(session);

            console.log(`UNIFIED_REGISTRY: Created session ${id} for ${targetName}`);
            return session;

        } catch (error) {
            console.error('UNIFIED_REGISTRY: Error creating session:', error);
            throw error;
        }
    }

    /**
     * Update session status - COMPATIBLE
     */
    updateSessionStatus(sessionId: string, status: AnalysisStatus, progress?: number, error?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        session.status = status;
        if (progress !== undefined) {
            session.progress = progress;
        }
        if (error) {
            session.error = error;
        }
        if (status === 'monitoring' || status === 'error' || status === 'closed') {
            session.endTime = new Date();
        }

        this._onSessionChanged.fire(session);
        return true;
    }

    /**
     * Add required file to session
     */
    addRequiredFile(sessionId: string, fileName: string, content: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        session.requiredFiles.set(fileName, content);
        this._onSessionChanged.fire(session);
        return true;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): UnifiedAnalysisSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all sessions
     */
    getAllSessions(): UnifiedAnalysisSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Remove session by ID
     */
    removeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        // Mark as closed before removal
        session.status = 'closed';
        session.endTime = new Date();
        
        // Remove from registry
        const removed = this.sessions.delete(sessionId);
        
        if (removed) {
            console.log(`UNIFIED_REGISTRY: Removed session ${sessionId} (${session.targetName})`);
            this._onSessionChanged.fire(session);
        }
        
        return removed;
    }

    /**
     * Get active sessions - SIMPLE
     */
    getActiveSessions(): UnifiedAnalysisSession[] {
        return this.getAllSessions().filter(s => 
            s.status === 'creating' || s.status === 'analyzing' || s.status === 'monitoring'
        );
    }

    /**
     * Set session monitoring - SIMPLE
     */
    setSessionMonitoring(sessionId: string, port?: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        session.status = 'monitoring';
        session.endTime = new Date();
        if (port) {
            session.port = port;
        }

        this._onSessionChanged.fire(session);
        return true;
    }

    /**
     * Register server port for session - Centralized function for port assignment
     */
    registerSessionPort(sessionId: string, port: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`UNIFIED_REGISTRY: Session ${sessionId} not found for port registration`);
            return false;
        }

        session.port = port;
        session.assignedPort = port;

        console.log(`UNIFIED_REGISTRY: Registered port ${port} for session ${sessionId}`);

        this._onSessionChanged.fire(session);
        return true;
    }

    /**
     * Get sessions by target path - SIMPLE
     */
    getSessionsByTargetPath(targetPath: string): UnifiedAnalysisSession[] {
        return this.getAllSessions().filter(s => s.targetPath === targetPath);
    }

    /**
     * Get sessions by analysis mode - SIMPLE
     */
    getSessionsByAnalysisMode(analysisMode: AnalysisMode): UnifiedAnalysisSession[] {
        return this.getAllSessions().filter(s => s.analysisMode === analysisMode);
    }

    /**
     * Get sessions by target type - SIMPLE
     */
    getSessionsByTargetType(targetType: TargetType): UnifiedAnalysisSession[] {
        return this.getAllSessions().filter(s => s.targetType === targetType);
    }

    /**
     * Clean up old sessions - COMPATIBLE
     */
    cleanupOldSessions(maxAge?: number): number {
        const now = Date.now();
        const ageLimit = maxAge || 3600000; // Default 1 hour
        let cleaned = 0;
        
        for (const [id, session] of this.sessions) {
            if (session.status === 'closed' && session.endTime) {
                const age = now - session.endTime.getTime();
                if (age > ageLimit) {
                    this.sessions.delete(id);
                    cleaned++;
                }
            }
        }
        
        return cleaned;
    }

    /**
     * Get statistics - SIMPLE
     */
    getStatistics() {
        const sessions = this.getAllSessions();
        return {
            total: sessions.length,
            active: this.getActiveSessions().length,
            monitoring: sessions.filter(s => s.status === 'monitoring').length,
            error: sessions.filter(s => s.status === 'error').length,
            closed: sessions.filter(s => s.status === 'closed').length
        };
    }

    /**
     * Close session - SIMPLIFIED
     */
    closeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        session.status = 'closed';
        session.endTime = new Date();
        this._onSessionChanged.fire(session);
        
        // Remove after delay
        setTimeout(() => this.sessions.delete(sessionId), 2000);
        return true;
    }


    /**
     * Dispose of registry - SIMPLIFIED
     */
    dispose(): void {
        console.log('UNIFIED_REGISTRY: Disposing session registry');
        
        this._onSessionChanged.dispose();
        this.sessions.clear();
    }
}
