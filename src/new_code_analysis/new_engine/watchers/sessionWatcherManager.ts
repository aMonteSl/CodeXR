/**
 * Session Watcher Manager
 * Maneja file watchers para sesiones de análisis - siguiendo arquitectura muñecas rusas
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { FileWatcherOrchestrator } from './fileWatcherOrchestrator';
import { DirectoryWatcherOrchestrator } from './directoryWatcherOrchestrator';

export class SessionWatcherManager {
    private activeWatchers: Map<string, FileWatcherOrchestrator | DirectoryWatcherOrchestrator> = new Map();
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('SESSION_WATCHER_MANAGER: Initializing Session Watcher Manager');
    }

    /**
     * Inicia watcher para una sesión específica
     * Maneja tanto file analysis como directory analysis
     */
    async startWatchingSession(session: UnifiedAnalysisSession): Promise<string | null> {
        try {
            console.log(`SESSION_WATCHER_MANAGER: 🔍 Starting watcher for session ${session.id}`);
            console.log(`SESSION_WATCHER_MANAGER: Target: ${session.targetPath}`);
            console.log(`SESSION_WATCHER_MANAGER: Mode: ${session.analysisMode}, Type: ${session.targetType}`);

            // Solo para LivePanel por ahora
            if (session.analysisMode !== 'LivePanel') {
                console.log(`SESSION_WATCHER_MANAGER: ⏭️ Skipping watcher for ${session.analysisMode} (not implemented yet)`);
                return null;
            }

            let orchestrator: FileWatcherOrchestrator | DirectoryWatcherOrchestrator;
            let watcherId: string | null = null;

            if (session.targetType === 'file') {
                // File analysis - usar FileWatcherOrchestrator
                console.log(`SESSION_WATCHER_MANAGER: 📄 Setting up file watcher`);

                // Verificar que el archivo existe
                if (!fs.existsSync(session.targetPath)) {
                    console.error(`SESSION_WATCHER_MANAGER: ❌ File does not exist: ${session.targetPath}`);
                    return null;
                }

                // Verificar que la sesión tiene archivos guardados
                if (!session.savedFilesPath) {
                    console.error(`SESSION_WATCHER_MANAGER: ❌ Session ${session.id} does not have saved files path`);
                    return null;
                }

                // Crear orchestrator para file analysis
                orchestrator = new FileWatcherOrchestrator(session, this.context);
                
            } else if (session.targetType === 'directory') {
                // Directory analysis - usar DirectoryWatcherOrchestrator
                console.log(`SESSION_WATCHER_MANAGER: 📁 Setting up directory watcher`);

                // Verificar que el directorio existe
                if (!fs.existsSync(session.targetPath)) {
                    console.error(`SESSION_WATCHER_MANAGER: ❌ Directory does not exist: ${session.targetPath}`);
                    return null;
                }

                // Verificar que la sesión tiene archivos guardados
                if (!session.savedFilesPath) {
                    console.error(`SESSION_WATCHER_MANAGER: ❌ Session ${session.id} does not have saved files path`);
                    return null;
                }

                // Verificar que hay archivos para observar
                if (!session.filesToHash || session.filesToHash.length === 0) {
                    console.error(`SESSION_WATCHER_MANAGER: ❌ No files to watch in directory session ${session.id}`);
                    return null;
                }

                // Crear orchestrator para directory analysis
                orchestrator = new DirectoryWatcherOrchestrator(session, this.context);

            } else {
                console.error(`SESSION_WATCHER_MANAGER: ❌ Unknown target type: ${session.targetType}`);
                return null;
            }

            // Iniciar el watcher
            watcherId = await orchestrator.startWatching();
            
            if (watcherId) {
                this.activeWatchers.set(session.id, orchestrator);
                console.log(`SESSION_WATCHER_MANAGER: ✅ Successfully started watcher for session ${session.id}`);
                console.log(`SESSION_WATCHER_MANAGER: Watcher ID: ${watcherId}`);
                console.log(`SESSION_WATCHER_MANAGER: Total active watchers: ${this.activeWatchers.size}`);
                return watcherId;
            } else {
                console.error(`SESSION_WATCHER_MANAGER: ❌ Failed to start watcher for session ${session.id}`);
                return null;
            }

        } catch (error) {
            console.error(`SESSION_WATCHER_MANAGER: ❌ Error starting watcher for session ${session.id}:`, error);
            return null;
        }
    }

    /**
     * Para watcher de una sesión
     */
    async stopWatchingSession(sessionId: string): Promise<boolean> {
        try {
            console.log(`SESSION_WATCHER_MANAGER: 🛑 Stopping watcher for session ${sessionId}`);
            
            const orchestrator = this.activeWatchers.get(sessionId);
            if (!orchestrator) {
                console.log(`SESSION_WATCHER_MANAGER: ⚠️ No active watcher found for session ${sessionId}`);
                return false;
            }

            orchestrator.stopWatching();
            this.activeWatchers.delete(sessionId);
            console.log(`SESSION_WATCHER_MANAGER: ✅ Successfully stopped watcher for session ${sessionId}`);
            console.log(`SESSION_WATCHER_MANAGER: Remaining active watchers: ${this.activeWatchers.size}`);
            return true;

        } catch (error) {
            console.error(`SESSION_WATCHER_MANAGER: ❌ Error stopping watcher for session ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Para todos los watchers activos
     */
    async stopAllWatchers(): Promise<number> {
        console.log(`SESSION_WATCHER_MANAGER: 🛑 Stopping all ${this.activeWatchers.size} active watchers`);
        
        let stoppedCount = 0;
        const sessionIds = Array.from(this.activeWatchers.keys());
        
        for (const sessionId of sessionIds) {
            if (await this.stopWatchingSession(sessionId)) {
                stoppedCount++;
            }
        }
        
        console.log(`SESSION_WATCHER_MANAGER: 📊 Stopped ${stoppedCount}/${sessionIds.length} watchers`);
        return stoppedCount;
    }

    /**
     * Obtiene información básica de watchers activos
     */
    getActiveWatchersInfo(): { sessionId: string, count: number }[] {
        const info: { sessionId: string, count: number }[] = [];
        
        for (const [sessionId, orchestrator] of this.activeWatchers) {
            let count = 1; // Default para file watcher
            
            // Si es DirectoryWatcherOrchestrator, obtener el número de archivos
            if ('getWatchedFilesCount' in orchestrator) {
                count = orchestrator.getWatchedFilesCount();
            }
            
            info.push({
                sessionId: sessionId,
                count: count
            });
        }
        
        return info;
    }

    /**
     * Cleanup al cerrar la extensión
     */
    dispose(): void {
        console.log(`SESSION_WATCHER_MANAGER: 🧹 Disposing Session Watcher Manager`);
        this.stopAllWatchers();
    }
}
