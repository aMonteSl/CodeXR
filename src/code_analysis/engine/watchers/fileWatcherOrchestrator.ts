/**
 * File Watcher Orchestrator
 * Coordina el file watching, debounce y re-análisis para una sesión específica
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
import { ReAnalysisManager } from './reAnalysisManager';
import { DebounceManager, DebounceStatus } from './debounceManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { ConfigurationConverter } from './configurationConverter';

export class FileWatcherOrchestrator {
    private watcher: fs.FSWatcher | null = null;
    private debounceManager: DebounceManager | null = null;
    private reAnalysisManager: ReAnalysisManager;
    private watcherId: string | null = null;
    private isWatching: boolean = false;
    private configurationStorage: AnalysisConfigurationStorage;

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext
    ) {
        console.log(`FILE_WATCHER_ORCHESTRATOR: Initializing orchestrator for session ${session.id}`);
        console.log(`FILE_WATCHER_ORCHESTRATOR: Target file: ${session.targetPath}`);
        
        this.reAnalysisManager = new ReAnalysisManager(context);
        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
    }

    /**
     * Carga la configuración de debounce del usuario
     */
    private async loadDebounceConfiguration(): Promise<number> {
        try {
            const config = await this.configurationStorage.loadConfiguration();
            console.log(`FILE_WATCHER_ORCHESTRATOR:  DEBUG - Loading configuration for auto-analysis`);
            
            // Verificar si auto-analysis está habilitado
            const autoAnalysisEnabled = await this.configurationStorage.getAutoAnalysisEnabled();
            console.log(`FILE_WATCHER_ORCHESTRATOR:  DEBUG - Auto-Analysis Enabled: ${autoAnalysisEnabled}`);
            
            if (!autoAnalysisEnabled) {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  Auto-Analysis is DISABLED - Watchers will not be activated`);
                return -1; // Return -1 to indicate disabled state
            }
            
            const delayMs = ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
            
            console.log(`FILE_WATCHER_ORCHESTRATOR: Loaded debounce config - ${ConfigurationConverter.getDisplayName(config.autoAnalysisDelay)} (${delayMs}ms)`);
            
            return delayMs;
        } catch (error) {
            console.error(`FILE_WATCHER_ORCHESTRATOR: Error loading configuration, using default 3s:`, error);
            return 3000; // Default fallback
        }
    }

    /**
     * Inicia el file watcher para la sesión
     */
    async startWatching(): Promise<string | null> {
        if (this.isWatching) {
            console.log(`FILE_WATCHER_ORCHESTRATOR: Already watching session ${this.session.id}`);
            return this.watcherId;
        }

        try {
            const targetPath = this.session.targetPath;
            
            // Verificar que el archivo existe
            if (!fs.existsSync(targetPath)) {
                console.error(`FILE_WATCHER_ORCHESTRATOR:  Target file does not exist: ${targetPath}`);
                return null;
            }

            console.log(`FILE_WATCHER_ORCHESTRATOR:  Starting file watcher for: ${targetPath}`);

            // Crear watcher usando fs.watch
            this.watcher = fs.watch(targetPath, (eventType, filename) => {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  File change detected: ${eventType} for ${filename || targetPath}`);
                this.onFileChanged();
            });

            this.isWatching = true;
            this.watcherId = `watcher_${this.session.id}_${Date.now()}`;

            console.log(`FILE_WATCHER_ORCHESTRATOR:  Successfully started watching ${targetPath}`);
            console.log(`FILE_WATCHER_ORCHESTRATOR: Watcher ID: ${this.watcherId}`);

            return this.watcherId;

        } catch (error) {
            console.error(`FILE_WATCHER_ORCHESTRATOR:  Error starting file watcher:`, error);
            this.isWatching = false;
            return null;
        }
    }

    /**
     * Maneja los cambios de archivo
     */
    private async onFileChanged(): Promise<void> {
        try {
            console.log(`FILE_WATCHER_ORCHESTRATOR:  Processing file change for ${this.session.targetPath}`);

            // CRITICAL: Check if session still exists before processing
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const currentSession = sessionRegistry.getSession(this.session.id);
            
            if (!currentSession) {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  Session ${this.session.id} no longer exists, stopping watcher`);
                this.stopWatching();
                return;
            }
            
            console.log(`FILE_WATCHER_ORCHESTRATOR:  Session ${this.session.id} still exists, proceeding with file change processing`);

            // Cargar configuración de debounce del usuario
            const delayMs = await this.loadDebounceConfiguration();
            
            // Verificar si auto-analysis está habilitado
            if (delayMs === -1) {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  Auto-Analysis is DISABLED - Skipping re-analysis`);
                return; // No procesar cambios si está deshabilitado
            }
            
            const fileName = path.basename(this.session.targetPath);

            // Cancelar debounce previo si existe
            if (this.debounceManager) {
                this.debounceManager.dispose();
            }

            // Crear nuevo debounce manager
            this.debounceManager = new DebounceManager(
                delayMs,
                () => this.executeReAnalysis(),
                fileName
            );

            // Iniciar el debounce
            this.debounceManager.start();

        } catch (error) {
            console.error(`FILE_WATCHER_ORCHESTRATOR:  Error processing file change:`, error);
        }
    }

    /**
     * Ejecuta el re-análisis cuando el debounce se completa
     */
    private async executeReAnalysis(): Promise<void> {
        try {
            console.log(`FILE_WATCHER_ORCHESTRATOR:  Executing re-analysis for session ${this.session.id}`);
            console.log(`FILE_WATCHER_ORCHESTRATOR: Target: ${this.session.targetPath}`);

            // CRITICAL: Double-check that session still exists before executing re-analysis
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const currentSession = sessionRegistry.getSession(this.session.id);
            
            if (!currentSession) {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  Session ${this.session.id} no longer exists, aborting re-analysis`);
                this.stopWatching();
                return;
            }
            
            console.log(`FILE_WATCHER_ORCHESTRATOR:  Session ${this.session.id} still exists, proceeding with re-analysis`);

            // Usar ReAnalysisManager para regenerar solo el data.json
            const success = await this.reAnalysisManager.executeDataJsonRegeneration(this.session);

            if (success) {
                console.log(`FILE_WATCHER_ORCHESTRATOR:  Re-analysis completed successfully`);
                
                // Mostrar notificación sutil
                const fileName = path.basename(this.session.targetPath);
                vscode.window.setStatusBarMessage(
                    `$(check) Analysis updated for ${fileName}`, 
                    2000 // 2 segundos
                );
            } else {
                console.error(`FILE_WATCHER_ORCHESTRATOR:  Re-analysis failed`);
                vscode.window.showErrorMessage(`Failed to update analysis for ${path.basename(this.session.targetPath)}`);
            }
        } catch (error) {
            console.error(`FILE_WATCHER_ORCHESTRATOR:  Error during re-analysis:`, error);
            vscode.window.showErrorMessage(`Error updating analysis: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Para el file watcher
     */
    stopWatching(): void {
        try {
            console.log(`FILE_WATCHER_ORCHESTRATOR:  Stopping file watcher for session ${this.session.id}`);

            if (this.watcher) {
                this.watcher.close();
                this.watcher = null;
                console.log(`FILE_WATCHER_ORCHESTRATOR: File watcher closed`);
            }

            if (this.debounceManager) {
                this.debounceManager.dispose();
                this.debounceManager = null;
                console.log(`FILE_WATCHER_ORCHESTRATOR: Debounce manager disposed`);
            }

            this.isWatching = false;
            this.watcherId = null;

            console.log(`FILE_WATCHER_ORCHESTRATOR:  Successfully stopped watching`);

        } catch (error) {
            console.error(`FILE_WATCHER_ORCHESTRATOR:  Error stopping file watcher:`, error);
        }
    }

    /**
     * Obtiene el estado actual del watcher
     */
    getStatus(): WatcherStatus {
        return {
            isWatching: this.isWatching,
            watcherId: this.watcherId,
            targetPath: this.session.targetPath,
            sessionId: this.session.id,
            debounceStatus: this.debounceManager?.getStatus() || null
        };
    }

    /**
     * Limpia recursos
     */
    dispose(): void {
        console.log(`FILE_WATCHER_ORCHESTRATOR:  Disposing orchestrator for session ${this.session.id}`);
        this.stopWatching();
    }
}

/**
 * Interfaz para el estado del watcher
 */
export interface WatcherStatus {
    isWatching: boolean;
    watcherId: string | null;
    targetPath: string;
    sessionId: string;
    debounceStatus: DebounceStatus | null;
}

export default FileWatcherOrchestrator;
