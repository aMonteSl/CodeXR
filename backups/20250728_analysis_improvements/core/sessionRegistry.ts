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
import { filterDirectoriesForAnalysis } from '../utils/directoryFilter';
import { SUPPORTED_LANGUAGES } from '../../../utils/supportedLanguages';
import { SHA256Generator } from '../../../utils/sha256Generator';


export class UnifiedSessionRegistry {
    private static instance: UnifiedSessionRegistry;
    private sessions: Map<string, UnifiedAnalysisSession> = new Map();
    private _onSessionChanged = new vscode.EventEmitter<UnifiedAnalysisSession>();
    public readonly onSessionChanged = this._onSessionChanged.event;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        console.log('UNIFIED_REGISTRY: Initializing Simplified Session Registry');
        this.context = context;
    }

    static getInstance(context: vscode.ExtensionContext): UnifiedSessionRegistry {
        if (!UnifiedSessionRegistry.instance) {
            UnifiedSessionRegistry.instance = new UnifiedSessionRegistry(context);
        }
        return UnifiedSessionRegistry.instance;
    }

    /**
     * Create a new unified analysis session - SIMPLIFIED
     */
    async createSession(params: SessionCreationParams): Promise<UnifiedAnalysisSession> {
        try {
            const id = generateNonce();
            const targetName = path.basename(params.targetPath);
            
            // Generate output directory
            const storageUri = params.context.storageUri;
            if (!storageUri) {
                throw new Error('Workspace storage URI is not available');
            }
            
            const outputDirectory = `${path.parse(targetName).name}_${params.analysisMode}_${params.targetType}_${id}`;
            
            // Use appropriate base directory based on target type
            const baseDirectory = params.targetType === 'file' ? 'fileAnalysis' : 'directoryAnalysis';
            
            const outputPath = path.join(storageUri.fsPath, baseDirectory, outputDirectory);

            // Calculate hash based on target type
            let calculatedHash = '';
            if (params.targetType === 'file') {
                console.log(`UNIFIED_REGISTRY: Calculating SHA256 hash for file: ${params.targetPath}`);
                try {
                    calculatedHash = await SHA256Generator.generateFileHash(params.targetPath);
                    console.log(`UNIFIED_REGISTRY: File hash calculated: ${calculatedHash.substring(0, 12)}...`);
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
                hash256: calculatedHash, // Now calculated during session creation for files
                outputDirectory,
                outputPath,
                requiredFiles: new Map<string, string>(),
                templatePaths: new Map<string, string>(),
                metadata: {}
            };

            // If it's directory analysis, we need to discover and filter directories to analyze
            if (params.targetType === 'directory') {
                console.log(`UNIFIED_REGISTRY: Discovering directories and files for analysis in: ${params.targetPath}`);
                
                // Discover directories
                session.directoriesToAnalyze = await this.discoverDirectoriesToAnalyze(params.targetPath, params.isDeep || false);
                console.log(`UNIFIED_REGISTRY: Found ${session.directoriesToAnalyze?.length || 0} directories to analyze (without duplicates)`);
                
                // Discover files in those directories
                session.filesToHash = await this.discoverFilesToAnalyze(session.directoriesToAnalyze || []);
                console.log(`UNIFIED_REGISTRY: Discovered ${session.filesToHash?.length || 0} supported files`);
                
                if ((session.directoriesToAnalyze?.length || 0) === 0) {
                    console.warn(`UNIFIED_REGISTRY: No directories found to analyze in: ${params.targetPath}`);
                }
                
                if ((session.filesToHash?.length || 0) === 0) {
                    console.warn(`UNIFIED_REGISTRY: No supported files found to analyze in directories`);
                }
            }

            this.sessions.set(id, session);
            this._onSessionChanged.fire(session);
            
            console.log(`UNIFIED_REGISTRY: Created basic session ${id} for ${targetName} (ready for launcher processing)`);
            
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
        console.log(`UNIFIED_REGISTRY: 🔍 DEBUG - Registering port ${port} for session ${sessionId}`);
        
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`UNIFIED_REGISTRY: ❌ Session ${sessionId} not found for port registration`);
            return false;
        }

        console.log(`UNIFIED_REGISTRY: 🔍 DEBUG - Session before port assignment:`, {
            id: session.id,
            targetPath: session.targetPath,
            targetName: session.targetName,
            analysisMode: session.analysisMode,
            currentPort: session.port,
            currentAssignedPort: session.assignedPort,
            status: session.status
        });

        // Assign the port to both fields for compatibility
        session.port = port;
        session.assignedPort = port;

        console.log(`UNIFIED_REGISTRY: ✅ Successfully registered port ${port} for session ${sessionId}`);
        console.log(`UNIFIED_REGISTRY: 🔍 DEBUG - Session after port assignment:`, {
            id: session.id,
            targetPath: session.targetPath,
            targetName: session.targetName,
            analysisMode: session.analysisMode,
            assignedPort: session.assignedPort,
            port: session.port,
            status: session.status
        });

        // Fire change event
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
     * Descubre los directorios que deben ser analizados dentro de un directorio base
     */
    private async discoverDirectoriesToAnalyze(basePath: string, isDeep: boolean): Promise<string[]> {
        try {
            console.log(`UNIFIED_REGISTRY: Discovering directories in: ${basePath} (deep: ${isDeep})`);
            
            const allDirectories = new Set<string>();
            allDirectories.add(basePath); // Incluir el directorio base
            
            if (isDeep) {
                // Análisis profundo: busca recursivamente en subdirectorios
                await this.traverseDirectoryRecursive(basePath, allDirectories);
            }
            
            const directoriesArray = Array.from(allDirectories);
            console.log(`UNIFIED_REGISTRY: Found ${directoriesArray.length} directories before filtering`);
            
            // Filtrar directorios usando el directoryFilter
            const filteredDirectories = filterDirectoriesForAnalysis(directoriesArray);
            
            console.log(`UNIFIED_REGISTRY: Filtered to ${filteredDirectories.length} directories for analysis`);
            return filteredDirectories;
            
        } catch (error) {
            console.error(`UNIFIED_REGISTRY: Error discovering directories in ${basePath}:`, error);
            return [];
        }
    }

    /**
     * Traversa directorios recursivamente agregando a un Set
     */
    private async traverseDirectoryRecursive(basePath: string, directories: Set<string>): Promise<void> {
        try {
            const entries = await fs.readdir(basePath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const fullPath = path.join(basePath, entry.name);
                    
                    // Solo agregar si no lo tenemos
                    if (!directories.has(fullPath)) {
                        directories.add(fullPath);
                        
                        // Recursivamente traversar subdirectorios
                        await this.traverseDirectoryRecursive(fullPath, directories);
                    }
                }
            }
        } catch (error) {
            console.error(`UNIFIED_REGISTRY: Error reading directory ${basePath}:`, error);
        }
    }

    /**
     * Descubre archivos soportados en los directorios especificados
     */
    private async discoverFilesToAnalyze(directories: string[]): Promise<{ filePath: string; hash: string }[]> {
        const filesToHash: { filePath: string; hash: string }[] = [];
        
        console.log(`UNIFIED_REGISTRY: Discovering files in ${directories.length} directories`);
        
        // Obtener todas las extensiones soportadas
        const supportedExtensions = this.getSupportedExtensions();
        console.log(`UNIFIED_REGISTRY: Supported extensions: ${supportedExtensions.join(', ')}`);
        
        for (const directory of directories) {
            try {
                const entries = await fs.readdir(directory, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.isFile()) {
                        const filePath = path.join(directory, entry.name);
                        const extension = path.extname(entry.name).toLowerCase();
                        
                        // Verificar si la extensión es soportada
                        if (supportedExtensions.includes(extension)) {
                            try {
                                // Usar SHA256Generator para hash real del archivo
                                const fileHash = await SHA256Generator.generateFileHash(filePath);
                                
                                filesToHash.push({
                                    filePath,
                                    hash: fileHash
                                });
                                
                                console.log(`UNIFIED_REGISTRY: Found supported file: ${filePath} (${extension})`);
                            } catch (hashError) {
                                console.error(`UNIFIED_REGISTRY: Error generating hash for ${filePath}:`, hashError);
                                // Continuar con el siguiente archivo si falla el hash
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`UNIFIED_REGISTRY: Error reading files in directory ${directory}:`, error);
            }
        }
        
        console.log(`UNIFIED_REGISTRY: Discovered ${filesToHash.length} supported files`);
        return filesToHash;
    }

    /**
     * Obtiene todas las extensiones soportadas por el plugin
     */
    private getSupportedExtensions(): string[] {
        const extensions: string[] = [];
        
        for (const languageConfig of Object.values(SUPPORTED_LANGUAGES)) {
            extensions.push(...languageConfig.extensions);
        }
        
        // Eliminar duplicados y retornar
        return [...new Set(extensions)];
    }

    /**
     * Dispose of registry - SIMPLIFIED
     */
    dispose(): void {
        console.log('UNIFIED_REGISTRY: 🧹 Disposing Simplified Session Registry');
        
        this._onSessionChanged.dispose();
        this.sessions.clear();
    }
}
