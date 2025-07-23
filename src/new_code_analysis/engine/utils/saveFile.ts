/**
 * Save File Utility
 * Provides safe file saving operations with overwrite confirmation
 */

import * as fs from 'fs';
import * as path from 'path';

export interface SaveOptions {
    createDirectories?: boolean;
    overwrite?: boolean;
    backup?: boolean;
    encoding?: BufferEncoding;
}

export interface SaveResult {
    success: boolean;
    filePath: string;
    operation: 'created' | 'overwritten' | 'backed_up' | 'skipped';
    backupPath?: string;
    error?: string;
    size?: number;
}

export class SaveFile {

    /**
     * Save content to a file with configurable options
     * @param filePath Path where to save the file
     * @param content Content to write
     * @param options Save options
     * @returns Result of the save operation
     */
    static async saveToFile(
        filePath: string,
        content: string,
        options: SaveOptions = {}
    ): Promise<SaveResult> {
        const defaultOptions: Required<SaveOptions> = {
            createDirectories: true,
            overwrite: true,
            backup: false,
            encoding: 'utf-8'
        };

        const opts = { ...defaultOptions, ...options };
        
        console.log(`SAVE_FILE: Attempting to save to: ${filePath}`);
        console.log(`SAVE_FILE: Options:`, opts);

        const result: SaveResult = {
            success: false,
            filePath,
            operation: 'created'
        };

        try {
            // Ensure the directory exists
            if (opts.createDirectories) {
                const directory = path.dirname(filePath);
                if (!fs.existsSync(directory)) {
                    fs.mkdirSync(directory, { recursive: true });
                    console.log(`SAVE_FILE: Created directory: ${directory}`);
                }
            }

            // Check if file exists
            const fileExists = fs.existsSync(filePath);
            
            if (fileExists) {
                console.log(`SAVE_FILE: File already exists: ${filePath}`);
                
                if (!opts.overwrite) {
                    result.operation = 'skipped';
                    result.error = 'File exists and overwrite is disabled';
                    console.log(`SAVE_FILE: Skipping save - overwrite disabled`);
                    return result;
                }

                // Create backup if requested
                if (opts.backup) {
                    const backupPath = SaveFile.createBackupPath(filePath);
                    try {
                        fs.copyFileSync(filePath, backupPath);
                        result.backupPath = backupPath;
                        result.operation = 'backed_up';
                        console.log(`SAVE_FILE: Created backup: ${backupPath}`);
                    } catch (backupError) {
                        console.warn(`SAVE_FILE: Failed to create backup:`, backupError);
                        // Continue with save even if backup fails
                    }
                }

                result.operation = result.operation === 'backed_up' ? 'backed_up' : 'overwritten';
            }

            // Write the file
            fs.writeFileSync(filePath, content, { encoding: opts.encoding });
            
            // Get file size
            try {
                const stats = fs.statSync(filePath);
                result.size = stats.size;
            } catch (statsError) {
                console.warn(`SAVE_FILE: Could not get file stats:`, statsError);
            }

            result.success = true;
            console.log(`SAVE_FILE: Successfully saved file: ${filePath} (${result.size || 'unknown'} bytes)`);
            
            return result;

        } catch (error) {
            console.error(`SAVE_FILE: Error saving file:`, error);
            result.error = error instanceof Error ? error.message : String(error);
            return result;
        }
    }

    /**
     * Save JSON data to a file
     * @param filePath Path where to save the JSON file
     * @param data Data to serialize as JSON
     * @param options Save options
     * @returns Result of the save operation
     */
    static async saveJsonToFile(
        filePath: string,
        data: any,
        options: SaveOptions = {}
    ): Promise<SaveResult> {
        console.log(`SAVE_FILE: Saving JSON data to: ${filePath}`);
        
        try {
            const jsonContent = JSON.stringify(data, null, 2);
            const result = await SaveFile.saveToFile(filePath, jsonContent, options);
            
            if (result.success) {
                console.log(`SAVE_FILE: Successfully saved JSON with ${Object.keys(data).length} top-level keys`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`SAVE_FILE: Error serializing JSON data:`, error);
            return {
                success: false,
                filePath,
                operation: 'created',
                error: `JSON serialization error: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Safely append content to an existing file
     * @param filePath Path to the file
     * @param content Content to append
     * @param options Save options
     * @returns Result of the append operation
     */
    static async appendToFile(
        filePath: string,
        content: string,
        options: SaveOptions = {}
    ): Promise<SaveResult> {
        const opts = { createDirectories: true, encoding: 'utf-8' as BufferEncoding, ...options };
        
        console.log(`SAVE_FILE: Appending to file: ${filePath}`);

        const result: SaveResult = {
            success: false,
            filePath,
            operation: 'created'
        };

        try {
            // Ensure the directory exists
            if (opts.createDirectories) {
                const directory = path.dirname(filePath);
                if (!fs.existsSync(directory)) {
                    fs.mkdirSync(directory, { recursive: true });
                    console.log(`SAVE_FILE: Created directory for append: ${directory}`);
                }
            }

            // Check if file exists
            const fileExists = fs.existsSync(filePath);
            result.operation = fileExists ? 'overwritten' : 'created';

            // Append the content
            fs.appendFileSync(filePath, content, { encoding: opts.encoding });

            // Get final file size
            try {
                const stats = fs.statSync(filePath);
                result.size = stats.size;
            } catch (statsError) {
                console.warn(`SAVE_FILE: Could not get file stats after append:`, statsError);
            }

            result.success = true;
            console.log(`SAVE_FILE: Successfully appended to file: ${filePath}`);
            
            return result;

        } catch (error) {
            console.error(`SAVE_FILE: Error appending to file:`, error);
            result.error = error instanceof Error ? error.message : String(error);
            return result;
        }
    }

    /**
     * Create a timestamped backup path for a file
     */
    private static createBackupPath(originalPath: string): string {
        const directory = path.dirname(originalPath);
        const extension = path.extname(originalPath);
        const basename = path.basename(originalPath, extension);
        
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .replace('T', '_')
            .slice(0, -5); // Remove milliseconds
        
        return path.join(directory, `${basename}.backup_${timestamp}${extension}`);
    }

    /**
     * Check if a file path is writable
     */
    static isWritable(filePath: string): boolean {
        try {
            const directory = path.dirname(filePath);
            
            // Check if directory exists and is writable
            if (fs.existsSync(directory)) {
                fs.accessSync(directory, fs.constants.W_OK);
            } else {
                // Check if we can create the directory
                const parentDir = path.dirname(directory);
                if (fs.existsSync(parentDir)) {
                    fs.accessSync(parentDir, fs.constants.W_OK);
                }
            }

            // If file exists, check if it's writable
            if (fs.existsSync(filePath)) {
                fs.accessSync(filePath, fs.constants.W_OK);
            }

            return true;
        } catch (error) {
            console.warn(`SAVE_FILE: Path not writable: ${filePath}`, error);
            return false;
        }
    }

    /**
     * Get file information
     */
    static getFileInfo(filePath: string): { exists: boolean; size?: number; modified?: Date } {
        try {
            if (!fs.existsSync(filePath)) {
                return { exists: false };
            }

            const stats = fs.statSync(filePath);
            return {
                exists: true,
                size: stats.size,
                modified: stats.mtime
            };
        } catch (error) {
            console.warn(`SAVE_FILE: Could not get file info for: ${filePath}`, error);
            return { exists: false };
        }
    }
}
