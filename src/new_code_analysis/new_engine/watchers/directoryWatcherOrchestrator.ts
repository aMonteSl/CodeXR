/**
 * Directory Watcher Orchestrator
 * Coordina el watching de múltiples archivos de directorio, detección de cambios por hash,
 * debounce y re-análisis selectivo para sesiones de análisis de directorios
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { UnifiedSessionRegistry } from '../core/sessionRegistry';
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
    private directoryWatcher: fs.FSWatcher | null = null;
    private addedFiles: Set<string> = new Set();
    private deletedFiles: Set<string> = new Set();

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

            // Crear watcher para el directorio completo para detectar archivos añadidos/eliminados
            try {
                this.directoryWatcher = fs.watch(this.session.targetPath, { recursive: this.session.isDeep }, (eventType, filename) => {
                    if (filename) {
                        this.handleDirectoryChange(eventType, filename);
                    }
                });
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📂 Watching directory: ${this.session.targetPath} (recursive: ${this.session.isDeep})`);
            } catch (watchError) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to watch directory ${this.session.targetPath}:`, watchError);
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
     * Maneja cambios en el directorio (archivos añadidos/eliminados)
     */
    private handleDirectoryChange(eventType: string, filename: string): void {
        const fullPath = path.join(this.session.targetPath, filename);
        
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📂 Directory change: ${filename} (${eventType})`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📂 Full path: ${fullPath}`);
        
        // Verificar si es un archivo que debemos analizar (por extensión)
        if (!this.shouldAnalyzeFile(fullPath)) {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⏭️ Skipping file with unsupported extension: ${filename}`);
            return;
        }

        // Verificar el estado actual del archivo
        const fileExists = fs.existsSync(fullPath);
        const wasWatched = this.watchers.has(fullPath);
        
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📂 File state - exists: ${fileExists}, was watched: ${wasWatched}`);

        if (eventType === 'rename') {
            // 'rename' puede ser tanto adición como eliminación
            if (fileExists) {
                // Archivo añadido
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ File added: ${filename}`);
                this.addedFiles.add(fullPath);
                
                // Remover de deletedFiles si estaba ahí (caso de rename)
                this.deletedFiles.delete(fullPath);
            } else {
                // Archivo eliminado
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➖ File deleted: ${filename}`);
                this.deletedFiles.add(fullPath);
                
                // Remover de addedFiles y changedFiles si estaban ahí
                this.addedFiles.delete(fullPath);
                this.changedFiles.delete(fullPath);
            }
        } else if (eventType === 'change') {
            // Verificar si es realmente un cambio o una adición tardía
            if (fileExists) {
                if (!wasWatched) {
                    // Es un archivo nuevo que no teníamos en el watcher
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ New file detected via change event: ${filename}`);
                    this.addedFiles.add(fullPath);
                } else {
                    // Es un cambio en un archivo existente - déjalo que lo maneje el file watcher individual
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 File change delegated to individual watcher: ${filename}`);
                }
            } else {
                // Archivo eliminado detectado via change
                if (wasWatched) {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➖ File deletion detected via change event: ${filename}`);
                    this.deletedFiles.add(fullPath);
                    this.addedFiles.delete(fullPath);
                    this.changedFiles.delete(fullPath);
                }
            }
        }

        // Activar debounce
        const totalChanges = this.changedFiles.size + this.addedFiles.size + this.deletedFiles.size;
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⏰ Directory changes summary: ${this.changedFiles.size} changed, ${this.addedFiles.size} added, ${this.deletedFiles.size} deleted (total: ${totalChanges})`);
        
        if (totalChanges > 0 && this.debounceManager) {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🚀 Starting debounce for directory changes...`);
            this.debounceManager.start();
        }
    }

    /**
     * Verifica si un archivo debe ser analizado según su extensión
     */
    private shouldAnalyzeFile(filePath: string): boolean {
        const supportedExtensions = [
            '.py', '.pyw', '.pyi', '.rb', '.rbw', '.java', '.c', '.h', '.cpp', '.cxx', '.cc', '.hpp', '.hxx',
            '.cs', '.erl', '.hrl', '.f90', '.f95', '.f03', '.f08', '.f', '.gd', '.go', '.js', '.mjs', '.cjs',
            '.kt', '.kts', '.lua', '.m', '.mm', '.php', '.phtml', '.php3', '.php4', '.php5', '.pl', '.pm',
            '.scala', '.sc', '.sol', '.swift', '.ts', '.tsx', '.ttcn', '.ttcn3', '.vue', '.zig', '.rs',
            '.dart', '.r', '.sh', '.bash', '.ps1', '.jsx', '.css', '.scss', '.less', '.clj', '.cljs',
            '.hs', '.ml', '.mli', '.pas'
        ];

        const ext = path.extname(filePath).toLowerCase();
        return supportedExtensions.includes(ext);
    }

    /**
     * Callback ejecutado cuando termina el debounce
     */
    private async handleDebounceCallback(): Promise<void> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⏰ Debounce completed`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Processing changes: ${this.changedFiles.size} modified, ${this.addedFiles.size} added, ${this.deletedFiles.size} deleted`);

            // CRITICAL: Check if session still exists before processing any changes
            const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
            const currentSession = sessionRegistry.getSession(this.session.id);
            
            if (!currentSession) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ Session ${this.session.id} no longer exists, stopping all watchers`);
                this.stopWatching();
                return;
            }
            
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Session ${this.session.id} still exists, proceeding with directory change processing`);

            let hasChanges = false;

            // 1. PROCESAR ARCHIVOS MODIFICADOS
            if (this.changedFiles.size > 0) {
                // Detectar qué archivos realmente cambiaron su hash
                const actuallyChangedFiles = await this.detectHashChanges();

                if (actuallyChangedFiles.length > 0) {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: � ${actuallyChangedFiles.length} files actually changed hash, starting re-analysis`);
                    await this.reAnalyzeChangedFiles(actuallyChangedFiles);
                    hasChanges = true;
                }
            }

            // 2. PROCESAR ARCHIVOS AÑADIDOS
            if (this.addedFiles.size > 0) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ Processing ${this.addedFiles.size} added files`);
                await this.processAddedFiles(Array.from(this.addedFiles));
                hasChanges = true;
            }

            // 3. PROCESAR ARCHIVOS ELIMINADOS
            if (this.deletedFiles.size > 0) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➖ Processing ${this.deletedFiles.size} deleted files`);
                await this.processDeletedFiles(Array.from(this.deletedFiles));
                hasChanges = true;
            }

            // Limpiar todas las listas de cambios
            this.changedFiles.clear();
            this.addedFiles.clear();
            this.deletedFiles.clear();

            if (!hasChanges) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📝 No actual changes detected, skipping update`);
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error during debounce callback:`, error);
            // Limpiar listas en caso de error
            this.changedFiles.clear();
            this.addedFiles.clear();
            this.deletedFiles.clear();
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
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 Analysis mode: ${this.session.analysisMode}`);

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

            // DETECTAR FORMATO: XR vs LivePanel
            if (this.session.analysisMode === 'XR') {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🥽 Using XR format (direct array)`);
                await this.updateXRDataJson(currentData, reAnalysisResults, dataJsonPath);
            } else {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: � Using LivePanel format (with summary wrapper)`);
                await this.updateLivePanelDataJson(currentData, reAnalysisResults, dataJsonPath);
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error updating data.json:`, error);
        }
    }

    /**
     * Actualiza data.json en formato XR (array directo de archivos)
     */
    private async updateXRDataJson(currentData: any[], reAnalysisResults: any[], dataJsonPath: string): Promise<void> {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🥽 Updating XR data.json with ${reAnalysisResults.length} files`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📖 Current XR data has ${currentData.length} files`);

        // Para XR: currentData es directamente un array de archivos
        const currentFilesMap = new Map();
        currentData.forEach((file: any, index: number) => {
            currentFilesMap.set(file.filePath, { file, index });
        });

        // Actualizar archivos que cambiaron
        let updatedCount = 0;
        for (const reAnalyzedFile of reAnalysisResults) {
            const currentFileData = currentFilesMap.get(reAnalyzedFile.filePath);
            
            if (currentFileData) {
                // Reemplazar datos del archivo en el array
                currentData[currentFileData.index] = reAnalyzedFile;
                updatedCount++;
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Updated XR file ${reAnalyzedFile.fileName}`);
            } else {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ Adding new XR file: ${reAnalyzedFile.fileName}`);
                // Agregar nuevo archivo al array
                currentData.push(reAnalyzedFile);
                updatedCount++;
            }
        }

        // Guardar data.json actualizado (formato XR: array directo)
        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Successfully updated XR data.json with ${updatedCount} files`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 New XR array has ${currentData.length} files`);

        // Enviar notificación SSE
        await this.sendSSENotification();
    }

    /**
     * Actualiza data.json en formato LivePanel (con wrapper de summary)
     */
    private async updateLivePanelDataJson(currentData: any, reAnalysisResults: any[], dataJsonPath: string): Promise<void> {
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📺 Updating LivePanel data.json with ${reAnalysisResults.length} files`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📖 Current LivePanel data has ${currentData.files?.length || 0} files`);

        // Para LivePanel: currentData tiene estructura {summary: {...}, files: [...]}
        if (!currentData.files) {
            currentData.files = [];
        }

        // Crear mapa de archivos actuales por filePath para búsqueda rápida
        const currentFilesMap = new Map();
        currentData.files.forEach((file: any, index: number) => {
            currentFilesMap.set(file.filePath, { file, index });
        });

        // Actualizar archivos que cambiaron
        let updatedCount = 0;
        for (const reAnalyzedFile of reAnalysisResults) {
            const currentFileData = currentFilesMap.get(reAnalyzedFile.filePath);
            
            if (currentFileData) {
                // Reemplazar datos del archivo
                currentData.files[currentFileData.index] = reAnalyzedFile;
                updatedCount++;
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Updated LivePanel file ${reAnalyzedFile.fileName}`);
            } else {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ Adding new LivePanel file: ${reAnalyzedFile.fileName}`);
                // Agregar nuevo archivo
                currentData.files.push(reAnalyzedFile);
                updatedCount++;
            }
        }

        // Recalcular summary para LivePanel
        this.recalculateSummary(currentData);

        // Actualizar timestamp
        if (!currentData.summary) {
            currentData.summary = {};
        }
        currentData.summary.analyzedAt = new Date().toISOString();

        // Guardar data.json actualizado (formato LivePanel: con wrapper)
        fs.writeFileSync(dataJsonPath, JSON.stringify(currentData, null, 2), 'utf8');

        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Successfully updated LivePanel data.json with ${updatedCount} files`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 New LivePanel summary:`, {
            totalFiles: currentData.summary?.totalFiles || 0,
            totalFilesAnalyzed: currentData.summary?.totalFilesAnalyzed || 0,
            totalLines: currentData.summary?.totalLines || 0
        });

        // Enviar notificación SSE
        await this.sendSSENotification();
    }

    /**
     * Envía notificación SSE para actualizar el cliente
     */
    private async sendSSENotification(): Promise<void> {
        // 🔔 ENVIAR NOTIFICACIÓN SSE para actualizar el cliente (mismo patrón que File Analysis)
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔔 Sending SSE notification for data.json update...`);
        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📊 Session details:`, {
            sessionId: this.session.id,
            targetPath: this.session.targetPath,
            assignedPort: this.session.assignedPort,
            serverUrl: this.session.serverUrl
        });
        
        try {
            // 🎯 SOLUCIÓN: Agregar debugging para entender el problema de registro SSE
            const { SSEManager } = require('../../../servers/runtime/sse/SSEManager');
            const sseManager = SSEManager.getInstance();
            
            // Obtener información detallada del registry
            const { fileToServerMap } = require('../../../utils/fileToServerMap');
            
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 DEBUG - fileToServerMap status:`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 📋 All file URIs: ${fileToServerMap.getAllFileUris().join(', ')}`);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔎 Looking for port: ${this.session.assignedPort}`);
            
            if (this.session.assignedPort) {
                const foundFileUri = fileToServerMap.findFileByPort(this.session.assignedPort);
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🎯 Found file URI for port ${this.session.assignedPort}: ${foundFileUri}`);
            }
            
            // Enviar usando el método correcto según el tipo de análisis
            if (this.session.analysisMode === 'XR') {
                // Para análisis XR, usar sendDataRefresh como en fileXR
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🥽 Sending dataRefresh event for XR directory analysis`);
                sseManager.sendDataRefresh(this.session.targetPath);
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ dataRefresh event sent for XR directory analysis`);
            } else {
                // Para LivePanel u otros análisis, usar sendUpdate estándar
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🖥️ Sending standard update for LivePanel directory analysis`);
                sseManager.sendUpdate(this.session.targetPath);
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Standard SSE notification sent for LivePanel directory analysis`);
            }
            
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
     * Procesa archivos añadidos al directorio
     */
    private async processAddedFiles(addedFiles: string[]): Promise<void> {
        try {
            const dataJsonPath = path.join(this.session.savedFilesPath!, 'data.json');
            
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ data.json not found at ${dataJsonPath}`);
                return;
            }

            // Leer el data.json actual
            const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
            const data = JSON.parse(dataJsonContent);

            let hasChanges = false;

            for (const filePath of addedFiles) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➕ Processing added file: ${filePath}`);
                
                // Verificar si el archivo ya existe en el data.json
                const existingFile = data.files.find((file: any) => 
                    file.file_path === filePath || file.filePath === filePath
                );
                
                if (existingFile) {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ File already exists in data.json: ${filePath}`);
                    continue;
                }

                try {
                    // Analizar el archivo nuevo usando análisis de archivo individual
                    // Crear una sesión temporal para el archivo nuevo
                    const tempSession = {
                        ...this.session,
                        analysisMode: 'LivePanel' as const,
                        targetType: 'file' as const,
                        targetPath: filePath
                    };

                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔍 Analyzing new file: ${filePath}`);
                    const fileAnalysisResult = await this.executePython.executeAnalysis(tempSession);
                    
                    if (fileAnalysisResult && fileAnalysisResult.success !== false) {
                        // Añadir el archivo analizado al array de files
                        data.files.push(fileAnalysisResult);
                        hasChanges = true;
                        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Added new file to data.json: ${filePath}`);
                        
                        // Agregar el archivo al watcher individual para futuros cambios
                        this.addFileWatcher(filePath);
                        
                        // Actualizar hash en la sesión para el nuevo archivo
                        if (this.session.filesToHash) {
                            const fileHash = await SHA256Generator.generateFileHash(filePath);
                            this.session.filesToHash.push({
                                filePath: filePath,
                                hash: fileHash
                            });
                        }
                    } else {
                        console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to analyze new file: ${filePath}`, fileAnalysisResult);
                    }
                } catch (analysisError) {
                    console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error analyzing new file ${filePath}:`, analysisError);
                }
            }

            // Guardar cambios si hubo adiciones
            if (hasChanges) {
                fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 💾 Updated data.json after adding ${addedFiles.length} files`);

                // Recalcular el resumen después de añadir archivos
                await this.recalculateSummaryFromDataJson();
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error processing added files:`, error);
        }
    }

    /**
     * Agrega un watcher para un archivo específico
     */
    private addFileWatcher(filePath: string): void {
        try {
            if (this.watchers.has(filePath)) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ Watcher already exists for: ${filePath}`);
                return;
            }

            const watcher = fs.watch(filePath, (eventType) => {
                this.handleFileChange(filePath, eventType);
            });

            this.watchers.set(filePath, watcher);
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 👀 Added watcher for: ${path.basename(filePath)}`);

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to add watcher for ${filePath}:`, error);
        }
    }

    /**
     * Procesa archivos eliminados del directorio
     */
    private async processDeletedFiles(deletedFiles: string[]): Promise<void> {
        try {
            const dataJsonPath = path.join(this.session.savedFilesPath!, 'data.json');
            
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ data.json not found at ${dataJsonPath}`);
                return;
            }

            // Leer el data.json actual
            const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
            const data = JSON.parse(dataJsonContent);

            let hasChanges = false;

            for (const deletedPath of deletedFiles) {
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ➖ Processing deleted file: ${deletedPath}`);
                
                // Encontrar y eliminar el archivo del array files
                const fileIndex = data.files.findIndex((file: any) => file.file_path === deletedPath || file.filePath === deletedPath);
                
                if (fileIndex !== -1) {
                    data.files.splice(fileIndex, 1);
                    hasChanges = true;
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🗑️ Removed from data.json: ${deletedPath}`);
                } else {
                    console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ⚠️ File not found in data.json: ${deletedPath}`);
                }
                
                // Eliminar watcher individual del archivo eliminado
                if (this.watchers.has(deletedPath)) {
                    try {
                        this.watchers.get(deletedPath)?.close();
                        this.watchers.delete(deletedPath);
                        console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🗂️ Removed watcher for deleted file: ${deletedPath}`);
                    } catch (error) {
                        console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error removing watcher for ${deletedPath}:`, error);
                    }
                }
            }

            // Guardar cambios si hubo eliminaciones
            if (hasChanges) {
                fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 💾 Updated data.json after deleting ${deletedFiles.length} files`);

                // Recalcular el resumen después de eliminar archivos
                await this.recalculateSummaryFromDataJson();
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error processing deleted files:`, error);
        }
    }

    /**
     * Recalcula el resumen del data.json basado en los archivos actuales
     */
    private async recalculateSummaryFromDataJson(): Promise<void> {
        try {
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔄 Recalculating summary from data.json...`);
            
            const dataJsonPath = path.join(this.session.savedFilesPath!, 'data.json');
            
            if (!fs.existsSync(dataJsonPath)) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ data.json not found at ${dataJsonPath}`);
                return;
            }
            
            // Leer data.json actual y recalcular summary
            const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf8');
            const data = JSON.parse(dataJsonContent);
            
            // Usar el método existente para recalcular
            this.recalculateSummary(data);
            
            // Guardar data.json con el nuevo summary
            fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2), 'utf8');
            
            console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: ✅ Summary recalculated successfully`);

            // Enviar notificación SSE
            try {
                const { SSEManager } = require('../../../servers/runtime/sse/SSEManager');
                const sseManager = SSEManager.getInstance();
                sseManager.sendUpdate(this.session.targetPath);
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🔔 SSE notification sent for summary update`);
            } catch (sseError) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Failed to send SSE notification:`, sseError);
            }

        } catch (error) {
            console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error recalculating summary:`, error);
        }
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

        // Cerrar directoryWatcher si existe
        if (this.directoryWatcher) {
            try {
                this.directoryWatcher.close();
                console.log(`DIRECTORY_WATCHER_ORCHESTRATOR: 🗂️ Closed directory watcher`);
            } catch (error) {
                console.error(`DIRECTORY_WATCHER_ORCHESTRATOR: ❌ Error closing directory watcher:`, error);
            }
            this.directoryWatcher = null;
        }

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
        this.addedFiles.clear();
        this.deletedFiles.clear();
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
