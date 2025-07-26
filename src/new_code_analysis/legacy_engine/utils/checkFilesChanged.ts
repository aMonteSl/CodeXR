/**
 * Check Files Changed Utility
 * Efficiently checks which files have changed by comparing SHA256 hashes
 */

import * as fs from 'fs';
import * as path from 'path';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { DirectoryAnalysisSession } from '../registry/directoryAnalysisSessionRegistry';
import { getAllSupportedExtensions } from '../../../utils/supportedLanguages';

export interface FileChangeResult {
    filePath: string;
    relativePath: string; 
    hasChanged: boolean;
    changeType: 'modified' | 'added' | 'deleted';
    oldHash?: string;
    newHash?: string;
    error?: string;
}

export interface FilesChangeReport {
    changedFiles: FileChangeResult[];
    unchangedFiles: FileChangeResult[];
    errorFiles: FileChangeResult[];
    totalFiles: number;
    changedCount: number;
}

export class CheckFilesChanged {

    /**
     * Check which files have changed since last analysis by comparing SHA256 hashes
     * @param session Directory analysis session containing file list and hashes
     * @returns Report with files that have changed, unchanged, and errors
     */
    static async checkChangedFiles(session: DirectoryAnalysisSession): Promise<FilesChangeReport> {
        console.log(`FILES_CHANGED: Starting hash comparison for session ${session.id}`);
        console.log(`FILES_CHANGED: Directory: ${session.filePath}`);
        console.log(`FILES_CHANGED: Total files to check: ${session.filesList.size}`);

        const changedFiles: FileChangeResult[] = [];
        const unchangedFiles: FileChangeResult[] = [];
        const errorFiles: FileChangeResult[] = [];

        let processedCount = 0;

        // Step 1: Check existing files for changes or deletions
        for (const [relativePath, absolutePath] of session.filesList.entries()) {
            processedCount++;
            
            try {
                console.log(`FILES_CHANGED: [${processedCount}/${session.filesList.size}] Checking: ${relativePath}`);

                // Check if file still exists
                if (!fs.existsSync(absolutePath)) {
                    console.log(`FILES_CHANGED: File DELETED: ${relativePath}`);
                    
                    const result: FileChangeResult = {
                        filePath: absolutePath,
                        relativePath: relativePath,
                        hasChanged: true,
                        changeType: 'deleted',
                        error: 'File no longer exists'
                    };
                    
                    changedFiles.push(result); // Put deleted files in changed files, not errors
                    continue;
                }

                // Calculate current hash
                const newHash = await SHA256Generator.generateFileHash(absolutePath);
                
                // Get stored hash from session
                // Note: We need to extract the hash from the session's hash256 field
                // For now, we'll calculate old hash from stored session data
                // In the future, we should store individual file hashes in the session
                const oldHash = await CheckFilesChanged.extractFileHashFromSession(session, relativePath);

                const hasChanged = oldHash !== newHash;

                const result: FileChangeResult = {
                    filePath: absolutePath,
                    relativePath: relativePath,
                    hasChanged: hasChanged,
                    changeType: hasChanged ? 'modified' : 'modified', // Will be determined later
                    oldHash: oldHash,
                    newHash: newHash
                };

                if (hasChanged) {
                    console.log(`FILES_CHANGED: MODIFIED - ${relativePath}`);
                    console.log(`FILES_CHANGED:   Old hash: ${oldHash}`);
                    console.log(`FILES_CHANGED:   New hash: ${newHash}`);
                    result.changeType = 'modified';
                    changedFiles.push(result);
                } else {
                    console.log(`FILES_CHANGED: unchanged - ${relativePath}`);
                    result.changeType = 'modified'; // Doesn't matter since unchanged
                    unchangedFiles.push(result);
                }

            } catch (error) {
                console.error(`FILES_CHANGED: Error processing ${relativePath}:`, error);
                
                const result: FileChangeResult = {
                    filePath: absolutePath,
                    relativePath: relativePath,
                    hasChanged: false,
                    changeType: 'modified', // Error case, doesn't matter
                    error: error instanceof Error ? error.message : String(error)
                };
                
                errorFiles.push(result);
            }
        }

        // Step 2: Check for new files in the directory
        const newFiles = await CheckFilesChanged.detectNewFiles(session);
        if (newFiles.length > 0) {
            console.log(`FILES_CHANGED: Found ${newFiles.length} new files`);
            changedFiles.push(...newFiles);
        }

        const report: FilesChangeReport = {
            changedFiles,
            unchangedFiles,
            errorFiles,
            totalFiles: session.filesList.size,
            changedCount: changedFiles.length
        };

        console.log(`FILES_CHANGED: Completed hash comparison for session ${session.id}`);
        console.log(`FILES_CHANGED: Results: ${changedFiles.length} changed, ${unchangedFiles.length} unchanged, ${errorFiles.length} errors`);

        return report;
    }

    /**
     * Extract individual file hash from session data
     */
    private static async extractFileHashFromSession(session: DirectoryAnalysisSession, relativePath: string): Promise<string> {
        try {
            // Check if we have stored individual file hashes in metadata
            if (session.metadata && (session.metadata as any).fileHashes) {
                const fileHashes = (session.metadata as any).fileHashes as Map<string, string>;
                const storedHash = fileHashes.get(relativePath);
                if (storedHash) {
                    console.log(`FILES_CHANGED: Found stored hash for ${relativePath}: ${storedHash.substring(0, 16)}...`);
                    return storedHash;
                }
            }

            // If no stored hash found, log warning and return empty (will trigger re-analysis)
            console.log(`FILES_CHANGED: No stored hash found for ${relativePath}, will be considered as changed`);
            return ''; // Empty hash will always be different from current hash

        } catch (error) {
            console.error(`FILES_CHANGED: Error extracting hash for ${relativePath}:`, error);
            return ''; // Return empty hash to trigger re-analysis
        }
    }

    /**
     * Update session with new file hashes
     * This should be called after successful analysis to store new hashes
     */
    static updateSessionWithNewHashes(session: DirectoryAnalysisSession, changeReport: FilesChangeReport): void {
        try {
            console.log(`CHECK_FILES_CHANGED: Updating session ${session.id} with new file hashes`);

            // Initialize metadata if not exists
            if (!session.metadata) {
                session.metadata = {
                    directorySize: 0,
                    lastModified: new Date()
                };
            }

            // Initialize fileHashes in metadata
            let fileHashes = new Map<string, string>();
            if ((session.metadata as any).fileHashes) {
                fileHashes = (session.metadata as any).fileHashes;
            }

            // Update hashes for changed files
            for (const changedFile of changeReport.changedFiles) {
                if (changedFile.newHash) {
                    fileHashes.set(changedFile.relativePath, changedFile.newHash);
                }
            }

            // Store back in metadata
            (session.metadata as any).fileHashes = fileHashes;

            console.log(`CHECK_FILES_CHANGED: Updated ${changeReport.changedFiles.length} file hashes in session`);

        } catch (error) {
            console.error(`CHECK_FILES_CHANGED: Error updating session with new hashes:`, error);
        }
    }

    /**
     * Detect new files in the directory that are not in the session's file list
     */
    private static async detectNewFiles(session: DirectoryAnalysisSession): Promise<FileChangeResult[]> {
        const newFiles: FileChangeResult[] = [];
        
        try {
            const supportedExtensions = getAllSupportedExtensions();
            
            console.log(`FILES_CHANGED: Scanning directory for new files: ${session.filePath}`);
            
            // Recursively scan the directory for supported files
            const allCurrentFiles = await this.scanDirectoryForSupportedFiles(session.filePath, supportedExtensions);
            
            // Check which files are new (not in session.filesList)
            for (const currentFile of allCurrentFiles) {
                const relativePath = path.relative(session.filePath, currentFile);
                
                // Check if this file is already tracked in the session
                if (!session.filesList.has(relativePath)) {
                    console.log(`FILES_CHANGED: NEW file detected: ${relativePath}`);
                    
                    // Calculate hash for the new file
                    const newHash = await SHA256Generator.generateFileHash(currentFile);
                    
                    const result: FileChangeResult = {
                        filePath: currentFile,
                        relativePath: relativePath,
                        hasChanged: true,
                        changeType: 'added',
                        newHash: newHash
                    };
                    
                    newFiles.push(result);
                }
            }
            
        } catch (error) {
            console.error(`FILES_CHANGED: Error detecting new files:`, error);
        }
        
        return newFiles;
    }

    /**
     * Recursively scan directory for files with supported extensions
     */
    private static async scanDirectoryForSupportedFiles(dirPath: string, supportedExtensions: string[]): Promise<string[]> {
        const files: string[] = [];
        
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules, .git, and other common directories
                    if (!['node_modules', '.git', '.vscode', 'dist', 'build'].includes(entry.name)) {
                        const subFiles = await this.scanDirectoryForSupportedFiles(fullPath, supportedExtensions);
                        files.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (supportedExtensions.includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
            
        } catch (error) {
            console.error(`FILES_CHANGED: Error scanning directory ${dirPath}:`, error);
        }
        
        return files;
    }
}
