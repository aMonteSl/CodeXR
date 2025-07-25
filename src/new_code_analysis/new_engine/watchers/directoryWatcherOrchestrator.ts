/**
 * Directory Watcher Orchestrator
 * Coordina el watching de múltiples archivos de directorio, detección de cambios por hash,
 * debounce y re-análisis selectivo para sesiones de análisis de directorios
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { DebounceManager } from './debounceManager';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { ConfigurationConverter } from './configurationConverter';
import { ExecutePython } from '../utils/executePython';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { SessionServerManager } from '../servers/sessionServerManager';

export class DirectoryWatcherOrchestrator {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private debounceManager: DebounceManager | null = null;
    private watcherId: string | null = null;
    private isWatching: boolean = false;
    private configurationStorage: AnalysisConfigurationStorage;
    private executePython: ExecutePython;
    private sessionServerManager: SessionServerManager;
    private changedFiles: Set<string> = new Set();

    constructor(
        private session: UnifiedAnalysisSession,
        private context: vscode.ExtensionContext
    ) {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Initializing orchestrator for session ${session.id}`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Target directory: ${session.targetPath}`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Files to watch: ${session.filesToHash?.length || 0}`);
        
        this.configurationStorage = AnalysisConfigurationStorage.getInstance(context);
        this.executePython = new ExecutePython(context);
        this.sessionServerManager = new SessionServerManager(context);
    }

    /**
     * Carga la configuración de debounce del usuario
     */
    private async loadDebounceConfiguration(): Promise<number> {
        try {
            const config = await this.configurationStorage.loadConfiguration();
            const delayMs = ConfigurationConverter.convertToMilliseconds(config.autoAnalysisDelay);
            
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: Loaded debounce config - ${ConfigurationConverter.getDisplayName(config.autoAnalysisDelay)} (${delayMs}ms)`);
            
            return delayMs;
        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: Error loading configuration, using default 3s:`, error);
            return 3000; // Default fallback
        }
    }

    /**
     * Inicia el watching de todos los archivos del directorio
     */
    public async startWatching(): Promise<string | null> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🚀 Starting directory watching for session ${this.session.id}`);

            if (!this.session.filesToHash || this.session.filesToHash.length === 0) {
                console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ No files to watch in session ${this.session.id}`);
                return null;
            }

            // Validar que todos los archivos existen
            const existingFiles = this.session.filesToHash?.filter(fileHash => {
                const exists = fs.existsSync(fileHash.filePath);
                if (!exists) {
                    console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ File does not exist: ${fileHash.filePath}`);
                }
                return exists;
            }) || [];

            if (existingFiles.length === 0) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ No valid files to watch`);
                return null;
            }

            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📁 Watching ${existingFiles.length} files`);

            // Cargar configuración de debounce
            const debounceDelayMs = await this.loadDebounceConfiguration();

            // Crear debounce manager
            this.debounceManager = new DebounceManager(
                debounceDelayMs,
                this.handleDebounceCallback.bind(this),
                `Directory (${existingFiles.length} files)`
            );

            // Generar ID único para este watcher
            this.watcherId = `directory_watcher_${this.session.id}_${Date.now()}`;

            // Crear watchers para cada archivo
            for (const fileHash of existingFiles) {
                try {
                    const watcher = fs.watch(fileHash.filePath, (eventType) => {
                        this.handleFileChange(fileHash.filePath, eventType);
                    });

                    this.watchers.set(fileHash.filePath, watcher);
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 👀 Watching: ${path.basename(fileHash.filePath)}`);

                } catch (watchError) {
                    console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to watch ${fileHash.filePath}:`, watchError);
                }
            }

            this.isWatching = true;
            
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Directory watcher started successfully with ID: ${this.watcherId}`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Watching ${this.watchers.size} files with ${debounceDelayMs}ms debounce`);
            
            return this.watcherId;

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error starting directory watcher:`, error);
            this.cleanup();
            return null;
        }
    }

    /**
     * Maneja el cambio de un archivo específico
     */
    private handleFileChange(filePath: string, eventType: string): void {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 File changed: ${path.basename(filePath)} (${eventType})`);
        
        // Agregar archivo a la lista de cambios
        this.changedFiles.add(filePath);

        // Activar debounce
        if (this.debounceManager) {
            this.debounceManager.start();
        }
    }

    /**
     * Callback ejecutado cuando termina el debounce
     */
    private async handleDebounceCallback(): Promise<void> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⏰ Debounce completed, processing ${this.changedFiles.size} changed files`);

            if (this.changedFiles.size === 0) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 No files to process`);
                return;
            }

            // Detectar qué archivos realmente cambiaron su hash
            const actuallyChangedFiles = await this.detectHashChanges();

            if (actuallyChangedFiles.length === 0) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 No files actually changed hash, skipping re-analysis`);
                this.changedFiles.clear();
                return;
            }

            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 ${actuallyChangedFiles.length} files actually changed hash, starting re-analysis`);

            // Re-analizar archivos cambiados
            await this.reAnalyzeChangedFiles(actuallyChangedFiles);

            // Limpiar lista de cambios
            this.changedFiles.clear();

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error during debounce callback:`, error);
            this.changedFiles.clear();
        }
    }

    /**
     * Detecta qué archivos realmente cambiaron comparando hashes
     */
    private async detectHashChanges(): Promise<string[]> {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 Detecting hash changes for ${this.changedFiles.size} files`);
        
        const changedFiles: string[] = [];

        for (const filePath of this.changedFiles) {
            try {
                // Calcular hash actual del archivo
                const currentHash = await SHA256Generator.generateFileHash(filePath);

                // Buscar el hash original en la sesión
                let originalHash: string | undefined;

                // Buscar en filesToHash array
                if (this.session.filesToHash) {
                    const fileHashEntry = this.session.filesToHash.find(fh => fh.filePath === filePath);
                    originalHash = fileHashEntry?.hash;
                } else if (this.session.targetPath === filePath) {
                    // Fallback: si es análisis de archivo único, usar el hash de la sesión
                    originalHash = this.session.hash256;
                }

                if (!originalHash) {
                    console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ No original hash found for ${filePath}, assuming changed`);
                    changedFiles.push(filePath);
                    continue;
                }

                // Comparar hashes
                if (currentHash !== originalHash) {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 Hash changed for ${path.basename(filePath)}`);
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 Old: ${originalHash.substring(0, 12)}... -> New: ${currentHash.substring(0, 12)}...`);
                    changedFiles.push(filePath);

                    // Actualizar hash en la sesión
                    if (this.session.filesToHash) {
                        const fileHashEntry = this.session.filesToHash.find(fh => fh.filePath === filePath);
                        if (fileHashEntry) {
                            fileHashEntry.hash = currentHash;
                        }
                    } else if (this.session.targetPath === filePath) {
                        this.session.hash256 = currentHash;
                    }
                } else {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Hash unchanged for ${path.basename(filePath)}`);
                }

            } catch (error) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error checking hash for ${filePath}:`, error);
                // En caso de error, asumir que cambió
                changedFiles.push(filePath);
            }
        }

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Hash detection complete: ${changedFiles.length}/${this.changedFiles.size} files actually changed`);
        
        return changedFiles;
    }

    /**
     * Re-analiza archivos específicos que cambiaron
     */
    private async reAnalyzeChangedFiles(changedFiles: string[]): Promise<void> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔄 Starting re-analysis of ${changedFiles.length} changed files`);

            // Usar el file_reanalysis_coordinator.py para analizar solo los archivos cambiados
            const reAnalysisResult = await this.executePython.executeFileReanalysis(changedFiles);

            if (!reAnalysisResult || !Array.isArray(reAnalysisResult)) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Invalid re-analysis result:`, reAnalysisResult);
                return;
            }

            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Re-analysis completed, received ${reAnalysisResult.length} file summaries`);

            // Actualizar data.json con los nuevos datos
            await this.updateDataJsonWithChanges(reAnalysisResult);

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error during re-analysis:`, error);
        }
    }

    /**
     * Actualiza el data.json existente con los datos de archivos re-analizados
     */
    private async updateDataJsonWithChanges(reAnalysisResults: any[]): Promise<void> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Updating data.json with ${reAnalysisResults.length} changed files`);

            if (!this.session.savedFilesPath) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ No saved files path in session`);
                return;
            }

            // Leer data.json actual
            const dataJsonPath = path.join(this.session.savedFilesPath, 'data.json');
            
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ data.json not found at ${dataJsonPath}`);
                return;
            }

            const currentData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📖 Current data.json has ${currentData.files?.length || 0} files`);

            // Crear mapa de archivos actuales por filePath para búsqueda rápida
            const currentFilesMap = new Map();
            if (currentData.files) {
                currentData.files.forEach((file: any, index: number) => {
                    currentFilesMap.set(file.filePath, { file, index });
                });
            }

            // Actualizar archivos que cambiaron
            let updatedCount = 0;
            for (const reAnalyzedFile of reAnalysisResults) {
                const currentFileData = currentFilesMap.get(reAnalyzedFile.filePath);
                
                if (currentFileData) {
                    // Reemplazar datos del archivo
                    currentData.files[currentFileData.index] = reAnalyzedFile;
                    updatedCount++;
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Updated ${reAnalyzedFile.fileName}`);
                } else {
                    console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ File not found in current data: ${reAnalyzedFile.filePath}`);
                    // Agregar nuevo archivo
                    currentData.files.push(reAnalyzedFile);
                    updatedCount++;
                }
            }

            // Recalcular summary
            this.recalculateSummary(currentData);

            // Actualizar timestamp
            currentData.summary.analyzedAt = new Date().toISOString();

            // Guardar data.json actualizado
            fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');

            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Successfully updated data.json with ${updatedCount} files`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 New summary:`, {
                totalFiles: currentData.summary?.totalFiles || 0,
                totalFilesAnalyzed: currentData.summary?.totalFilesAnalyzed || 0,
                totalLines: currentData.summary?.totalLines || 0
            });

            // 🔔 ENVIAR NOTIFICACIÓN SSE para actualizar el cliente (mismo patrón que File Analysis)
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔔 Sending SSE notification for data.json update...`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Session details:`, {
                sessionId: this.session.id,
                targetPath: this.session.targetPath,
                assignedPort: this.session.assignedPort,
                serverUrl: this.session.serverUrl
            });
            
            try {
                // 🎯 SOLUCIÓN: Usar el mismo patrón que FileWatcherOrchestrator con ReAnalysisManager
                // Importar SSEManager directamente para consistencia con File Analysis
                const { SSEManager } = require('../../../servers/runtime/sse/SSEManager');
                const sseManager = SSEManager.getInstance();
                
                // Usar targetPath directamente como en File Analysis
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📡 Sending update for targetPath: ${this.session.targetPath}`);
                sseManager.sendUpdate(this.session.targetPath);
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ SSE notification sent successfully using direct SSEManager`);
            } catch (sseError) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to send SSE notification via direct SSEManager:`, sseError);
                
                // Fallback: usar el método original
                try {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔄 Attempting fallback via SessionServerManager...`);
                    await this.sessionServerManager.notifyAnalysisUpdated(this.session.id);
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ SSE notification sent via fallback method`);
                } catch (fallbackError) {
                    console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Fallback SSE notification also failed:`, fallbackError);
                }
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error updating data.json:`, error);
        }
    }

    /**
     * Recalcula el summary basado en los archivos actuales
     */
    private recalculateSummary(data: any): void {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🧮 Recalculating summary for ${data.files?.length || 0} files`);

        if (!data.files || !Array.isArray(data.files)) {
            console.warn(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ No files array found for summary calculation`);
            return;
        }

        // Inicializar contadores
        const summary = {
            totalFiles: data.files.length,
            totalFilesAnalyzed: 0,
            totalFilesNotAnalyzed: 0,
            totalLines: 0,
            totalLinesOfCode: 0,
            totalComments: 0,
            totalBlankLines: 0,
            totalFunctions: 0,
            totalClasses: 0,
            averageComplexity: 0,
            languages: {} as Record<string, number>
        };

        let totalComplexity = 0;
        let filesWithComplexity = 0;

        // Sumar datos de todos los archivos
        for (const file of data.files) {
            if (file.status === 'success') {
                summary.totalFilesAnalyzed++;
                summary.totalLines += file.totalLines || 0;
                summary.totalLinesOfCode += file.codeLines || 0;
                summary.totalComments += file.commentLines || 0;
                summary.totalBlankLines += file.blankLines || 0;
                summary.totalFunctions += file.functionCount || 0;
                summary.totalClasses += file.classCount || 0;

                // Complejidad
                const complexity = file.cyclomaticComplexityNumber || file.maxComplexity || 0;
                if (complexity > 0) {
                    totalComplexity += complexity;
                    filesWithComplexity++;
                }

                // Idiomas
                const language = file.language || 'Unknown';
                summary.languages[language] = (summary.languages[language] || 0) + 1;
            } else {
                summary.totalFilesNotAnalyzed++;
            }
        }

        // Calcular promedio de complejidad
        summary.averageComplexity = filesWithComplexity > 0 
            ? Math.round((totalComplexity / filesWithComplexity) * 100) / 100 
            : 0;

        // Actualizar data con nuevo summary
        data.summary = { ...data.summary, ...summary };

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Summary recalculated:`, {
            totalFiles: summary.totalFiles,
            totalFilesAnalyzed: summary.totalFilesAnalyzed,
            totalFilesNotAnalyzed: summary.totalFilesNotAnalyzed,
            averageComplexity: summary.averageComplexity
        });
    }

    /**
     * Para el watching y limpia recursos
     */
    public async stopWatching(): Promise<void> {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🛑 Stopping directory watcher for session ${this.session.id}`);
        
        this.cleanup();
        
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Directory watcher stopped successfully`);
    }

    /**
     * Limpia todos los recursos
     */
    private cleanup(): void {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🧹 Cleaning up directory watcher resources`);

        // Cerrar todos los watchers
        for (const [filePath, watcher] of this.watchers) {
            try {
                watcher.close();
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🗂️ Closed watcher for ${path.basename(filePath)}`);
            } catch (error) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error closing watcher for ${filePath}:`, error);
            }
        }
        this.watchers.clear();

        // Limpiar debounce manager
        if (this.debounceManager) {
            this.debounceManager.dispose();
            this.debounceManager = null;
        }

        // Limpiar estado
        this.changedFiles.clear();
        this.isWatching = false;
        this.watcherId = null;

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Cleanup completed`);
    }

    /**
     * Getters para información del watcher
     */
    public getWatcherId(): string | null {
        return this.watcherId;
    }

    public isActive(): boolean {
        return this.isWatching;
    }

    public getWatchedFilesCount(): number {
        return this.watchers.size;
    }

    public getChangedFilesCount(): number {
        return this.changedFiles.size;
    }
}
