/**
 * File Hash Utility
 * Handles calculation of SHA256 hashes for files in directory analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isSupportedExtension } from '../../../utils/supportedLanguages';

/**
 * Tuple representing a file path and its SHA256 hash
 */
export interface FileHash {
    filePath: string;
    hash: string;
    size?: number;
    mtimeMs?: number;
}

/**
 * Calculate SHA256 hash for a single file
 * @param filePath Absolute path to the file
 * @returns Promise resolving to the SHA256 hash string
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => {
            hash.update(data);
        });
        
        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });
        
        stream.on('error', (error) => {
            console.error(`FILE_HASH: Error calculating hash for ${filePath}:`, error);
            reject(error);
        });
    });
}

/**
 * Recursively get all supported files from directories
 * @param directories List of directory paths to scan
 * @returns Promise resolving to array of file paths
 */
export async function getAllSupportedFiles(directories: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    console.log(`FILE_HASH: Scanning ${directories.length} directories for supported files`);
    
    for (const directory of directories) {
        console.log(`FILE_HASH: Scanning directory: ${directory}`);
        try {
            const files = await getSupportedFilesFromDirectory(directory);
            console.log(`FILE_HASH: Found ${files.length} supported files in ${directory}`);
            allFiles.push(...files);
        } catch (error) {
            console.error(`FILE_HASH: Error scanning directory ${directory}:`, error);
            // Continue with other directories even if one fails
        }
    }
    
    console.log(`FILE_HASH: Total supported files found: ${allFiles.length}`);
    
    // Deduplicate files (in case of any overlap)
    const uniqueFiles = [...new Set(allFiles)];
    if (uniqueFiles.length !== allFiles.length) {
        console.log(`FILE_HASH: Removed ${allFiles.length - uniqueFiles.length} duplicate file paths`);
        console.log(`FILE_HASH: Final unique files count: ${uniqueFiles.length}`);
    }
    
    return uniqueFiles;
}

/**
 * Recursively get supported files from a single directory
 * @param dirPath Directory path to scan
 * @returns Promise resolving to array of file paths
 */
async function getSupportedFilesFromDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    console.log(`FILE_HASH: Processing directory: ${dirPath}`);
    
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        console.log(`FILE_HASH: Found ${entries.length} entries in ${dirPath}`);
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                console.log(`FILE_HASH: Found subdirectory: ${fullPath} - SKIPPING (should be processed separately)`);
                // DON'T recurse here! The directories should already be included 
                // in the list passed to calculateFilesHashes
            } else if (entry.isFile()) {
                console.log(`FILE_HASH: Checking file: ${fullPath}`);
                const fileExtension = path.extname(fullPath).toLowerCase();
                if (isSupportedExtension(fileExtension)) {
                    console.log(`FILE_HASH:  Supported file: ${fullPath} (${fileExtension})`);
                    files.push(fullPath);
                } else {
                    console.log(`FILE_HASH:  Unsupported file: ${fullPath} (${fileExtension})`);
                }
            }
        }
    } catch (error) {
        console.error(`FILE_HASH: Error reading directory ${dirPath}:`, error);
        throw error;
    }
    
    console.log(`FILE_HASH: Returning ${files.length} files from ${dirPath}`);
    return files;
}

/**
 * Calculate hashes for all files in the given directories
 * @param directories List of filtered directory paths (should already be filtered by directoryFilter)
 * @returns Promise resolving to array of FileHash tuples
 */
export async function calculateFilesHashes(directories: string[]): Promise<FileHash[]> {
    console.log(`FILE_HASH: Starting hash calculation for ${directories.length} directories`);
    console.log(`FILE_HASH: Directories to process:`, directories);
    
    try {
        // Get all supported files from the directories
        const allFiles = await getAllSupportedFiles(directories);
        console.log(`FILE_HASH: Found ${allFiles.length} supported files to hash`);
        
        if (allFiles.length === 0) {
            console.warn(`FILE_HASH: No supported files found in directories:`, directories);
            return [];
        }
        
        // Calculate hashes for all files
        const fileHashes: FileHash[] = [];
        
        for (const filePath of allFiles) {
            try {
                const hash = await calculateFileHash(filePath);
                fileHashes.push({ filePath, hash });
                
                if (fileHashes.length % 50 === 0) {
                    console.log(`FILE_HASH: Processed ${fileHashes.length}/${allFiles.length} files`);
                }
            } catch (error) {
                console.error(`FILE_HASH: Failed to hash file ${filePath}, skipping:`, error);
                // Continue with other files even if one fails
            }
        }
        
        console.log(`FILE_HASH: Successfully calculated hashes for ${fileHashes.length} files`);
        return fileHashes;
        
    } catch (error) {
        console.error('FILE_HASH: Error calculating files hashes:', error);
        throw error;
    }
}

