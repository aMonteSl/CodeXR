/**
 * File Hash Service
 * Manages SHA256 hashes for files to detect changes and optimize re-analysis
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface FileHashInfo {
    filePath: string;
    hash: string;
    lastModified: number;
    size: number;
}

export class FileHashService {
    private static instance: FileHashService;
    private fileHashes: Map<string, FileHashInfo> = new Map();

    private constructor() {
        console.log('FILE_HASH_SERVICE: Initializing File Hash Service');
    }

    static getInstance(): FileHashService {
        if (!FileHashService.instance) {
            FileHashService.instance = new FileHashService();
        }
        return FileHashService.instance;
    }

    /**
     * Calculate SHA256 hash for a file
     */
    async calculateFileHash(filePath: string): Promise<string> {
        try {
            const fileBuffer = await fs.promises.readFile(filePath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            
            console.log(`FILE_HASH_SERVICE: CALCULATING HASH FROM file ${path.basename(filePath)}: ${hash.substring(0, 16)}...`);
            
            return hash;
        } catch (error) {
            console.error(`FILE_HASH_SERVICE: Error calculating hash for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Get file stats (size, modified time)
     */
    async getFileStats(filePath: string): Promise<{ size: number; lastModified: number }> {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                lastModified: stats.mtime.getTime()
            };
        } catch (error) {
            console.error(`FILE_HASH_SERVICE: Error getting stats for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Update hash info for a file
     */
    async updateFileHash(filePath: string): Promise<FileHashInfo> {
        const [hash, stats] = await Promise.all([
            this.calculateFileHash(filePath),
            this.getFileStats(filePath)
        ]);

        const hashInfo: FileHashInfo = {
            filePath,
            hash,
            lastModified: stats.lastModified,
            size: stats.size
        };

        this.fileHashes.set(filePath, hashInfo);
        return hashInfo;
    }

    /**
     * Check if file has changed by comparing hashes
     */
    async hasFileChanged(filePath: string): Promise<boolean> {
        try {
            const existingHashInfo = this.fileHashes.get(filePath);
            
            if (!existingHashInfo) {
                console.log(`FILE_HASH_SERVICE: CHECKING HASH FROM file ${path.basename(filePath)}: NO PREVIOUS HASH - FIRST TIME ANALYSIS`);
                return true; // No previous hash, consider it changed
            }

            // Quick check: compare file stats first (faster than hash calculation)
            const currentStats = await this.getFileStats(filePath);
            
            if (currentStats.lastModified === existingHashInfo.lastModified && 
                currentStats.size === existingHashInfo.size) {
                console.log(`FILE_HASH_SERVICE: CHECKING HASH FROM file ${path.basename(filePath)}: SAME STATS - FILE NOT CHANGED`);
                return false; // Same stats, file hasn't changed
            }

            // File stats changed, calculate new hash to be sure
            const currentHash = await this.calculateFileHash(filePath);
            
            console.log(`FILE_HASH_SERVICE: CHECKING HASH COMPARING hash ${currentHash.substring(0, 16)}... with ${existingHashInfo.hash.substring(0, 16)}...`);
            
            const hasChanged = currentHash !== existingHashInfo.hash;
            
            if (hasChanged) {
                console.log(`FILE_HASH_SERVICE: CHECKING HASH - FILE ${path.basename(filePath)} HAS CHANGED`);
                // Update stored hash
                await this.updateFileHash(filePath);
            } else {
                console.log(`FILE_HASH_SERVICE: CHECKING HASH THE SAME FILE ${path.basename(filePath)} WE DONT ANALYZE`);
            }

            return hasChanged;
        } catch (error) {
            console.error(`FILE_HASH_SERVICE: Error checking if file changed:`, error);
            return true; // On error, assume it changed to be safe
        }
    }

    /**
     * Get files that have changed from a list of file paths
     */
    async getChangedFiles(filePaths: string[]): Promise<string[]> {
        console.log(`FILE_HASH_SERVICE: Checking ${filePaths.length} files for changes...`);
        
        const changedFiles: string[] = [];
        
        for (const filePath of filePaths) {
            try {
                const hasChanged = await this.hasFileChanged(filePath);
                if (hasChanged) {
                    changedFiles.push(filePath);
                }
            } catch (error) {
                console.warn(`FILE_HASH_SERVICE: Error checking file ${filePath}, including in changed list:`, error);
                changedFiles.push(filePath); // Include on error to be safe
            }
        }
        
        console.log(`FILE_HASH_SERVICE: Found ${changedFiles.length} changed files out of ${filePaths.length} total`);
        return changedFiles;
    }

    /**
     * Initialize hashes for a directory (first-time analysis)
     */
    async initializeDirectoryHashes(filePaths: string[]): Promise<void> {
        console.log(`FILE_HASH_SERVICE: Initializing hashes for ${filePaths.length} files...`);
        
        const promises = filePaths.map(filePath => this.updateFileHash(filePath).catch(error => {
            console.warn(`FILE_HASH_SERVICE: Failed to initialize hash for ${filePath}:`, error);
        }));
        
        await Promise.all(promises);
        console.log(`FILE_HASH_SERVICE: Hash initialization completed`);
    }

    /**
     * Get stored hash info for a file
     */
    getFileHashInfo(filePath: string): FileHashInfo | undefined {
        return this.fileHashes.get(filePath);
    }

    /**
     * Remove hash info for files (cleanup)
     */
    removeFileHashes(filePaths: string[]): void {
        for (const filePath of filePaths) {
            this.fileHashes.delete(filePath);
            console.log(`FILE_HASH_SERVICE: Removed hash info for ${path.basename(filePath)}`);
        }
    }

    /**
     * Clear all hash info (full cleanup)
     */
    clearAllHashes(): void {
        const count = this.fileHashes.size;
        this.fileHashes.clear();
        console.log(`FILE_HASH_SERVICE: Cleared all hash info (${count} entries)`);
    }

    /**
     * Get total number of tracked files
     */
    getTrackedFileCount(): number {
        return this.fileHashes.size;
    }

    /**
     * Export hash data for persistence (optional future feature)
     */
    exportHashData(): { [filePath: string]: FileHashInfo } {
        const data: { [filePath: string]: FileHashInfo } = {};
        for (const [filePath, hashInfo] of this.fileHashes) {
            data[filePath] = hashInfo;
        }
        return data;
    }

    /**
     * Import hash data from persistence (optional future feature)
     */
    importHashData(data: { [filePath: string]: FileHashInfo }): void {
        this.fileHashes.clear();
        for (const [filePath, hashInfo] of Object.entries(data)) {
            this.fileHashes.set(filePath, hashInfo);
        }
        console.log(`FILE_HASH_SERVICE: Imported hash data for ${Object.keys(data).length} files`);
    }
}
