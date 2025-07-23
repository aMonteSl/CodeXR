/**
 * Directory Analysis Session Registry
 * Central store for all directory analysis sessions and their states
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateNonce } from '../../../utils/nonceGenerator';
import { SHA256Generator } from '../../../utils/sha256Generator';

export type DirectoryAnalysisStatus = 'creating' | 'analyzing' | 'completed' | 'failed' | 'closing';
export type DirectoryAnalysisType = 'D_LivePanel' | 'D_DeepLivePanel' | 'D_XR' | 'D_XRDeep';

export interface DirectoryAnalysisSession {
    id: string;                    // Generated nonce
    nameDir: string;              // Directory name (e.g., "src")
    filePath: string;             // Full path to the directory
    outputDirectory: string;      // Directory name: {nameDir}_{analysisType}_{nonce}
    outputPath: string;           // Full path to analysis results directory
    analysisType: DirectoryAnalysisType; // Type of directory analysis being performed
    isXR: boolean;                // true if XR analysis, false if LivePanel
    isDeep: boolean;              // true if deep analysis (subdirectories), false if first-level only
    status: DirectoryAnalysisStatus;     // Current status
    hash256: string;              // SHA256 hash of the directory structure
    filesList: Map<string, string>; // Map of relative file paths -> absolute paths (e.g., "prueba.py" -> "/full/path/to/prueba.py")
    subDirectoriesList: Map<string, string>; // Map of relative subdirectory paths -> absolute paths (for future deep analysis)
    requiredFiles: Map<string, string>; // Map of filename -> file content (actual files for analysis, like data.json, index.html, etc.)
    port?: number;                // Port where analysis is being served (if applicable)
    startTime: Date;              // When analysis started
    endTime?: Date;               // When analysis completed/failed
    error?: string;               // Error message if failed
    progress?: number;            // Progress percentage (0-100)
    metadata?: {                  // Additional metadata
        directorySize: number;    // Total size of all files in directory
        debounceTime?: number;    // Debounce time used
        lastModified: Date;       // Last modification time of any file in directory
    };
}

export class DirectoryAnalysisSessionRegistry {
    private static instance: DirectoryAnalysisSessionRegistry;
    private sessions: Map<string, DirectoryAnalysisSession> = new Map();
    private _onSessionChanged = new vscode.EventEmitter<DirectoryAnalysisSession>();
    public readonly onSessionChanged = this._onSessionChanged.event;

    private constructor() {
        console.log('DIRECTORY_ANALYSIS_REGISTRY: Initializing Directory Analysis Session Registry');
    }

    static getInstance(): DirectoryAnalysisSessionRegistry {
        if (!DirectoryAnalysisSessionRegistry.instance) {
            DirectoryAnalysisSessionRegistry.instance = new DirectoryAnalysisSessionRegistry();
        }
        return DirectoryAnalysisSessionRegistry.instance;
    }

    /**
     * Create a new directory analysis session
     */
    async createSession(
        directoryPath: string,
        analysisType: DirectoryAnalysisType,
        context: vscode.ExtensionContext
    ): Promise<DirectoryAnalysisSession> {
        try {
            const id = generateNonce();
            const nameDir = path.basename(directoryPath);
            
            // Determine if this is a deep analysis
            const isDeepAnalysis = analysisType === 'D_DeepLivePanel' || analysisType === 'D_XRDeep';
            
            // Scan directory to get file list (filtered by analysis type)
            const filesList = await this.scanDirectoryFiles(directoryPath, isDeepAnalysis);
            
            // Only populate subDirectoriesList for deep analysis types
            let subDirectoriesList = new Map<string, string>();
            if (isDeepAnalysis) {
                subDirectoriesList = await this.scanSubDirectories(directoryPath);
                console.log(`DIRECTORY_ANALYSIS_REGISTRY: Scanning subdirectories for deep analysis (${analysisType}): ${subDirectoriesList.size} found`);
            } else {
                console.log(`DIRECTORY_ANALYSIS_REGISTRY: Skipping subdirectory scan for ${analysisType} (not needed)`);
            }
            
            const hash256 = await this.generateDirectoryHash(directoryPath, filesList);
            let metadata = await this.calculateDirectoryMetadata(filesList);
            
            // Calculate individual file hashes and store them in metadata
            console.log(`DIRECTORY_ANALYSIS_REGISTRY: Calculating individual file hashes for ${filesList.size} files...`);
            const fileHashes = await this.calculateAllFileHashes(filesList);
            
            // Store file hashes in metadata
            if (!metadata) {
                metadata = {
                    directorySize: 0,
                    lastModified: new Date()
                };
            }
            (metadata as any).fileHashes = fileHashes;
            
            console.log(`DIRECTORY_ANALYSIS_REGISTRY: Successfully calculated ${fileHashes.size} file hashes`);
            
            // Generate output directory name and full path
            const storageUri = context.storageUri;
            if (!storageUri) {
                throw new Error('Workspace storage URI is not available');
            }
            
            const outputDirectory = `${nameDir}_${analysisType}_${id}`;
            const outputPath = path.join(storageUri.fsPath, 'directory_analysis', outputDirectory);

            const session: DirectoryAnalysisSession = {
                id,
                nameDir,
                filePath: directoryPath,
                outputDirectory,
                outputPath,
                analysisType,
                isXR: analysisType === 'D_XR' || analysisType === 'D_XRDeep',
                isDeep: isDeepAnalysis,
                status: 'creating',
                hash256,
                filesList,
                subDirectoriesList,
                requiredFiles: new Map<string, string>(),
                startTime: new Date(),
                metadata
            };

            this.sessions.set(id, session);
            this._onSessionChanged.fire(session);
            
            console.log(`DIRECTORY_ANALYSIS_REGISTRY: Created session ${id} for ${nameDir} (${analysisType})`);
            console.log(`DIRECTORY_ANALYSIS_REGISTRY: Session details:`, {
                id: session.id,
                nameDir: session.nameDir,
                filePath: session.filePath,
                analysisType: session.analysisType,
                isXR: session.isXR,
                isDeep: session.isDeep,
                status: session.status,
                filesCount: session.filesList.size,
                directorySize: session.metadata?.directorySize || 0,
                hash256: session.hash256.substring(0, 16) + '...'
            });
            
            return session;

        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error creating session:', error);
            throw error;
        }
    }

    /**
     * Scan directory for all analyzable files
     * @param directoryPath The directory to scan
     * @param isDeepAnalysis Whether to scan recursively or only first level
     */
    private async scanDirectoryFiles(directoryPath: string, isDeepAnalysis: boolean): Promise<Map<string, string>> {
        const filesList = new Map<string, string>();
        
        try {
            if (isDeepAnalysis) {
                // Deep analysis: scan recursively
                await this.scanDirectoryRecursive(directoryPath, directoryPath, filesList);
                console.log(`DIRECTORY_ANALYSIS_REGISTRY: Deep scan found ${filesList.size} files (recursive)`);
            } else {
                // Non-deep analysis: scan only first level
                await this.scanDirectoryFirstLevel(directoryPath, filesList);
                console.log(`DIRECTORY_ANALYSIS_REGISTRY: Non-deep scan found ${filesList.size} files (first level only)`);
            }
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error scanning directory:', error);
        }
        
        return filesList;
    }

    /**
     * Scan directory for all subdirectories (for future deep analysis)
     */
    private async scanSubDirectories(directoryPath: string): Promise<Map<string, string>> {
        const subDirectoriesList = new Map<string, string>();
        
        try {
            await this.scanSubDirectoriesRecursive(directoryPath, directoryPath, subDirectoriesList);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error scanning subdirectories:', error);
        }
        
        return subDirectoriesList;
    }

    /**
     * Recursively scan directory for files
     */
    private async scanDirectoryRecursive(
        currentPath: string, 
        basePath: string, 
        filesList: Map<string, string>
    ): Promise<void> {
        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isFile() && this.isAnalyzableFile(entry.name)) {
                    // Create relative path from base directory
                    const relativePath = path.relative(basePath, fullPath);
                    filesList.set(relativePath, fullPath);
                } else if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                    // Recursively scan subdirectories
                    await this.scanDirectoryRecursive(fullPath, basePath, filesList);
                }
            }
        } catch (error) {
            console.error(`DIRECTORY_ANALYSIS_REGISTRY: Error scanning ${currentPath}:`, error);
        }
    }

    /**
     * Recursively scan directory for subdirectories
     */
    private async scanSubDirectoriesRecursive(
        currentPath: string, 
        basePath: string, 
        subDirectoriesList: Map<string, string>
    ): Promise<void> {
        try {
            const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                    // Add this subdirectory to the list
                    const relativePath = path.relative(basePath, fullPath);
                    if (relativePath !== '') { // Don't include the base directory itself
                        subDirectoriesList.set(relativePath, fullPath);
                    }
                    
                    // Recursively scan subdirectories
                    await this.scanSubDirectoriesRecursive(fullPath, basePath, subDirectoriesList);
                }
            }
        } catch (error) {
            console.error(`DIRECTORY_ANALYSIS_REGISTRY: Error scanning subdirectories in ${currentPath}:`, error);
        }
    }

    /**
     * Check if file is analyzable based on extension
     */
    private isAnalyzableFile(fileName: string): boolean {
        const analyzableExtensions = [
            '.py', '.js', '.ts', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.php',
            '.go', '.rs', '.kt', '.swift', '.scala', '.clj', '.hs', '.ml', '.f90',
            '.pas', '.pl', '.r', '.m', '.dart', '.lua', '.sh', '.ps1', '.vue', 
            '.jsx', '.tsx', '.html', '.htm', '.css', '.scss', '.less'
        ];
        
        const ext = path.extname(fileName).toLowerCase();
        return analyzableExtensions.includes(ext);
    }

    /**
     * Check if directory should be skipped
     */
    private shouldSkipDirectory(dirName: string): boolean {
        const skipDirs = [
            'node_modules', '.git', '.vscode', '__pycache__', '.pytest_cache',
            'venv', 'env', '.env', 'dist', 'build', '.next', '.nuxt',
            'coverage', '.coverage', 'tmp', 'temp', '.tmp'
        ];
        
        return skipDirs.includes(dirName) || dirName.startsWith('.');
    }

    /**
     * Generate hash for directory based on file structure and content
     */
    private async generateDirectoryHash(directoryPath: string, filesList: Map<string, string>): Promise<string> {
        try {
            // Create a string representation of the directory structure
            const fileStructure = Array.from(filesList.keys()).sort().join('|');
            
            // For now, use the structure as basis for hash (could be enhanced to include file content hashes)
            const directoryInfo = `${directoryPath}|${fileStructure}|${filesList.size}`;
            return await SHA256Generator.generateStringHash(directoryInfo);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error generating directory hash:', error);
            return 'hash-error-' + Date.now();
        }
    }

    /**
     * Calculate directory metadata
     */
    private async calculateDirectoryMetadata(filesList: Map<string, string>): Promise<{
        directorySize: number;
        lastModified: Date;
    }> {
        let totalSize = 0;
        let lastModified = new Date(0);

        try {
            for (const [relativePath, fullPath] of filesList) {
                try {
                    const stats = await fs.promises.stat(fullPath);
                    totalSize += stats.size;
                    
                    if (stats.mtime > lastModified) {
                        lastModified = stats.mtime;
                    }
                } catch (error) {
                    console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Could not stat file ${fullPath}:`, error);
                }
            }
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error calculating metadata:', error);
        }

        return {
            directorySize: totalSize,
            lastModified
        };
    }

    /**
     * Update session status
     */
    updateSessionStatus(sessionId: string, status: DirectoryAnalysisStatus, progress?: number, error?: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Session ${sessionId} not found for status update`);
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
        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Updated session ${sessionId} status to ${status}`);
        return true;
    }

    /**
     * Set session status to completed (when analysis finishes and port is available)
     */
    setSessionCompleted(sessionId: string, port?: number): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Session ${sessionId} not found for completion`);
            return false;
        }

        session.status = 'completed';
        session.endTime = new Date();
        session.progress = 100;
        
        if (port) {
            session.port = port;
        }

        this._onSessionChanged.fire(session);
        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Completed session ${sessionId}${port ? ` on port ${port}` : ''}`);
        return true;
    }

    /**
     * Add a file to the session's required files
     */
    addRequiredFile(sessionId: string, fileName: string, content: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Session ${sessionId} not found for adding file`);
            return false;
        }

        session.requiredFiles.set(fileName, content);
        this._onSessionChanged.fire(session);
        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Added file ${fileName} to session ${sessionId}`);
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
     * Get session by ID
     */
    getSession(sessionId: string): DirectoryAnalysisSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): DirectoryAnalysisSession[] {
        return Array.from(this.sessions.values()).filter(
            session => session.status === 'creating' || session.status === 'analyzing'
        );
    }

    /**
     * Get all sessions
     */
    getAllSessions(): DirectoryAnalysisSession[] {
        return Array.from(this.sessions.values());
    }

    /**
     * Get sessions by directory path
     */
    getSessionsByDirectoryPath(directoryPath: string): DirectoryAnalysisSession[] {
        return Array.from(this.sessions.values()).filter(
            session => session.filePath === directoryPath
        );
    }

    /**
     * Remove session
     */
    removeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Session ${sessionId} not found for removal`);
            return false;
        }

        this.sessions.delete(sessionId);
        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Removed session ${sessionId}`);
        return true;
    }

    /**
     * Close session
     */
    closeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`DIRECTORY_ANALYSIS_REGISTRY: Session ${sessionId} not found for closing`);
            return false;
        }

        session.status = 'closing';
        session.endTime = new Date();
        this._onSessionChanged.fire(session);
        
        // Schedule removal after delay
        setTimeout(() => {
            this.removeSession(sessionId);
        }, 2000);

        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Closing session ${sessionId}`);
        return true;
    }

    /**
     * Dispose of registry and clean up resources
     */
    dispose(): void {
        this._onSessionChanged.dispose();
        this.sessions.clear();
        console.log('DIRECTORY_ANALYSIS_REGISTRY: Registry disposed');
    }

    /**
     * Scan only the first level of a directory (non-deep analysis)
     * @param directoryPath The directory to scan
     * @param filesList Map to store the found files
     */
    private async scanDirectoryFirstLevel(directoryPath: string, filesList: Map<string, string>): Promise<void> {
        try {
            const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    const fullPath = path.join(directoryPath, entry.name);
                    
                    // Check if file is analyzable
                    if (this.isAnalyzableFile(fullPath)) {
                        const relativePath = path.relative(directoryPath, fullPath);
                        filesList.set(relativePath, fullPath);
                        console.log(`DIRECTORY_ANALYSIS_REGISTRY: Added first-level file: ${relativePath}`);
                    }
                }
                // Skip subdirectories for non-deep analysis
            }
        } catch (error) {
            console.error(`DIRECTORY_ANALYSIS_REGISTRY: Error scanning first level of ${directoryPath}:`, error);
        }
    }

    /**
     * Calculate SHA256 hashes for all files in the files list
     * @param filesList Map of relative path -> absolute path
     * @returns Map of relative path -> SHA256 hash
     */
    private async calculateAllFileHashes(filesList: Map<string, string>): Promise<Map<string, string>> {
        const fileHashes = new Map<string, string>();
        let processedCount = 0;
        
        try {
            for (const [relativePath, absolutePath] of filesList.entries()) {
                try {
                    processedCount++;
                    console.log(`DIRECTORY_ANALYSIS_REGISTRY: [${processedCount}/${filesList.size}] Calculating hash for: ${relativePath}`);
                    
                    const hash = await SHA256Generator.generateFileHash(absolutePath);
                    
                    fileHashes.set(relativePath, hash);
                } catch (error) {
                    console.error(`DIRECTORY_ANALYSIS_REGISTRY: Error calculating hash for ${relativePath}:`, error);
                    // Continue with other files
                }
            }
            
            console.log(`DIRECTORY_ANALYSIS_REGISTRY: Successfully calculated ${fileHashes.size}/${filesList.size} file hashes`);
        } catch (error) {
            console.error('DIRECTORY_ANALYSIS_REGISTRY: Error calculating file hashes:', error);
        }
        
        return fileHashes;
    }
}
