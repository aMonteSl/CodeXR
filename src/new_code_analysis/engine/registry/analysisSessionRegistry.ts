/**
 * Analysis Session Registry
 * Central store for all analysis sessions and their states
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { generateNonce } from '../../../utils/nonceGenerator';
import { SHA256Generator } from '../../../utils/sha256Generator';

export type AnalysisStatus = 'creating' | 'analyzing' | 'completed' | 'failed' | 'closing';
export type AnalysisType = 'LivePanel' | 'DOMVisualization' | 'FileXRAnalysis' | 'DirectoryLivePanel';

export interface AnalysisSession {
    id: string;                    // Generated nonce
    fileName: string;              // File name with extension (e.g., "main.py")
    filePath: string;              // Full path to the source file
    outputDirectory: string;       // Directory name: {filename}_{analysisType}_{nonce}
    outputPath: string;            // Full path to analysis results directory
    analysisType: AnalysisType;    // Type of analysis being performed
    status: AnalysisStatus;        // Current status
    hash256: string;               // SHA256 of the source file
    requiredFiles: Map<string, string>; // Map of filename -> file content (actual files, not just names)
    port?: number;                 // Port where analysis is being served (if applicable)
    startTime: Date;               // When analysis started
    endTime?: Date;                // When analysis completed/failed
    error?: string;                // Error message if failed
    progress?: number;             // Progress percentage (0-100)
    metadata?: {                   // Additional metadata
        fileSize: number;
        debounceTime?: number;
        lastModified: Date;
    };
}

export class AnalysisSessionRegistry {
    private static instance: AnalysisSessionRegistry;
    private sessions: Map<string, AnalysisSession> = new Map();
    private _onSessionChanged = new vscode.EventEmitter<AnalysisSession>();
    public readonly onSessionChanged = this._onSessionChanged.event;

    private constructor() {
        console.log('ANALYSIS_REGISTRY: Initializing Analysis Session Registry');
    }

    static getInstance(): AnalysisSessionRegistry {
        if (!AnalysisSessionRegistry.instance) {
            AnalysisSessionRegistry.instance = new AnalysisSessionRegistry();
        }
        return AnalysisSessionRegistry.instance;
    }

    /**
     * Create a new analysis session
     */
    async createSession(
        filePath: string,
        analysisType: AnalysisType,
        context: vscode.ExtensionContext
    ): Promise<AnalysisSession> {
        try {
            const id = generateNonce();
            const fileName = path.basename(filePath);
            const hash256 = await SHA256Generator.generateFileHash(filePath);
            const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            
            // Generate output directory name and full path
            const storageUri = context.storageUri;
            if (!storageUri) {
                throw new Error('Workspace storage URI is not available');
            }
            
            const outputDirectory = `${path.parse(fileName).name}_${analysisType}_${id}`;
            const outputPath = path.join(storageUri.fsPath, 'analysis', outputDirectory);

            const session: AnalysisSession = {
                id,
                fileName,
                filePath,
                outputDirectory,
                outputPath,
                analysisType,
                status: 'creating',
                hash256,
                requiredFiles: new Map<string, string>(),
                startTime: new Date(),
                metadata: {
                    fileSize: stats.size,
                    lastModified: new Date(stats.mtime)
                }
            };

            this.sessions.set(id, session);
            this._onSessionChanged.fire(session);
            
            console.log(`ANALYSIS_REGISTRY: Created session ${id} for ${fileName} (${analysisType})`);
            return session;

        } catch (error) {
            console.error('ANALYSIS_REGISTRY: Error creating session:', error);
            throw error;
        }
    }

    /**
     * Update session status
     */
    updateSessionStatus(sessionId: string, status: AnalysisStatus, progress?: number, error?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`ANALYSIS_REGISTRY: Session ${sessionId} not found for status update`);
            return false;
        }

        session.status = status;
        if (progress !== undefined) {
            session.progress = progress;
        }
        if (error) {
            session.error = error;
        }
        if (status === 'completed' || status === 'failed') {
            session.endTime = new Date();
        }

        this._onSessionChanged.fire(session);
        console.log(`ANALYSIS_REGISTRY: Updated session ${sessionId} status to ${status}`);
        return true;
    }

    /**
     * Add a file to the session's required files
     */
    addRequiredFile(sessionId: string, fileName: string, content: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`ANALYSIS_REGISTRY: Session ${sessionId} not found for adding file`);
            return false;
        }

        session.requiredFiles.set(fileName, content);
        this._onSessionChanged.fire(session);
        console.log(`ANALYSIS_REGISTRY: Added file ${fileName} to session ${sessionId}`);
        return true;
    }

    /**
     * Get a specific file from the session's required files
     */
    getRequiredFile(sessionId: string, fileName: string): string | undefined {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return undefined;
        }
        return session.requiredFiles.get(fileName);
    }

    /**
     * Get all required files for a session
     */
    getAllRequiredFiles(sessionId: string): Map<string, string> | undefined {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return undefined;
        }
        return session.requiredFiles;
    }

    /**
     * Set session status to analyzing (when debounce triggers)
     */
    setSessionAnalyzing(sessionId: string): boolean {
        return this.updateSessionStatus(sessionId, 'analyzing');
    }

    /**
     * Set session status to completed (when server is launched and port is available)
     */
    setSessionCompleted(sessionId: string, port?: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`ANALYSIS_REGISTRY: Session ${sessionId} not found for completion`);
            return false;
        }

        session.status = 'completed';
        session.endTime = new Date();
        session.progress = 100;
        
        if (port) {
            session.port = port;
        }

        this._onSessionChanged.fire(session);
        console.log(`ANALYSIS_REGISTRY: Completed session ${sessionId}${port ? ` on port ${port}` : ''}`);
        return true;
    }

    /**
     * Update session debounce time
     */
    setSessionDebounceTime(sessionId: string, debounceTime: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        if (!session.metadata) {
            session.metadata = {
                fileSize: 0,
                lastModified: new Date()
            };
        }
        session.metadata.debounceTime = debounceTime;
        
        this._onSessionChanged.fire(session);
        return true;
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): AnalysisSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all active sessions (creating or analyzing, excluding closing)
     */
    getActiveSessions(): AnalysisSession[] {
        return Array.from(this.sessions.values()).filter(
            session => session.status === 'creating' || session.status === 'analyzing'
        );
    }

    /**
     * Get all sessions
     */
    getAllSessions(): AnalysisSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Get sessions by file path
     */
    getSessionsByFilePath(filePath: string): AnalysisSession[] {
        return Array.from(this.sessions.values()).filter(
            session => session.filePath === filePath
        );
    }

    /**
     * Get sessions by analysis type
     */
    getSessionsByType(analysisType: AnalysisType): AnalysisSession[] {
        return Array.from(this.sessions.values()).filter(
            session => session.analysisType === analysisType
        );
    }

    /**
     * Remove session (for closing analysis)
     */
    removeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`ANALYSIS_REGISTRY: Session ${sessionId} not found for removal`);
            return false;
        }

        this.sessions.delete(sessionId);
        console.log(`ANALYSIS_REGISTRY: Removed session ${sessionId}`);
        return true;
    }

    /**
     * Close session (mark as closing and schedule for removal)
     */
    closeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`ANALYSIS_REGISTRY: Session ${sessionId} not found for closing`);
            return false;
        }

        session.status = 'closing';
        session.endTime = new Date();
        this._onSessionChanged.fire(session);
        
        // Schedule removal after a delay to allow UI updates
        setTimeout(() => {
            this.removeSession(sessionId);
        }, 2000);

        console.log(`ANALYSIS_REGISTRY: Closing session ${sessionId}`);
        return true;
    }

    /**
     * Clean up old completed/failed sessions
     */
    cleanupOldSessions(maxAge: number = 3600000): number { // Default 1 hour
        const now = new Date().getTime();
        let cleanedCount = 0;

        for (const [id, session] of this.sessions) {
            if ((session.status === 'completed' || session.status === 'failed') && session.endTime) {
                const age = now - session.endTime.getTime();
                if (age > maxAge) {
                    this.sessions.delete(id);
                    cleanedCount++;
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`ANALYSIS_REGISTRY: Cleaned up ${cleanedCount} old sessions`);
        }
        
        return cleanedCount;
    }

    /**
     * Get session statistics
     */
    getStatistics(): {
        total: number;
        active: number;
        completed: number;
        failed: number;
        byType: Record<AnalysisType, number>;
    } {
        const sessions = Array.from(this.sessions.values());
        const stats = {
            total: sessions.length,
            active: sessions.filter(s => s.status === 'creating' || s.status === 'analyzing').length,
            completed: sessions.filter(s => s.status === 'completed').length,
            failed: sessions.filter(s => s.status === 'failed').length,
            byType: {
                'LivePanel': sessions.filter(s => s.analysisType === 'LivePanel').length,
                'DirectoryLivePanel': sessions.filter(s => s.analysisType === 'DirectoryLivePanel').length,
                'DOMVisualization': sessions.filter(s => s.analysisType === 'DOMVisualization').length,
                'FileXRAnalysis': sessions.filter(s => s.analysisType === 'FileXRAnalysis').length
            } as Record<AnalysisType, number>
        };

        return stats;
    }

    /**
     * Manually fire session changed event (for UI refresh)
     */
    public fireSessionChanged(session: AnalysisSession): void {
        console.log(`ANALYSIS_REGISTRY: 🔥 Manually firing session changed event for: ${session.id}`);
        this._onSessionChanged.fire(session);
    }

    /**
     * Dispose of registry and clean up resources
     */
    dispose(): void {
        this._onSessionChanged.dispose();
        this.sessions.clear();
        console.log('ANALYSIS_REGISTRY: Registry disposed');
    }
}
