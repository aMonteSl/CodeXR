/**
 * SHA256 Generator Utility
 * Generates SHA256 hash for files to track changes and ensure integrity
 */

import * as crypto from 'crypto';
import * as fs from 'fs';

export class SHA256Generator {
    
    /**
     * Generate SHA256 hash from file path
     */
    static async generateFileHash(filePath: string): Promise<string> {
        try {
            const fileBuffer = await fs.promises.readFile(filePath);
            const hash = crypto.createHash('sha256');
            hash.update(fileBuffer);
            return hash.digest('hex');
        } catch (error) {
            console.error(`SHA256_GENERATOR: Error generating hash for file ${filePath}:`, error);
            throw new Error(`Failed to generate SHA256 hash: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Generate SHA256 hash from string content
     */
    static generateStringHash(content: string): string {
        try {
            const hash = crypto.createHash('sha256');
            hash.update(content, 'utf8');
            return hash.digest('hex');
        } catch (error) {
            console.error(`SHA256_GENERATOR: Error generating hash for string content:`, error);
            throw new Error(`Failed to generate SHA256 hash: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Verify if file content matches expected hash
     */
    static async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
        try {
            const currentHash = await SHA256Generator.generateFileHash(filePath);
            return currentHash === expectedHash;
        } catch (error) {
            console.error(`SHA256_GENERATOR: Error verifying hash for file ${filePath}:`, error);
            return false;
        }
    }

    /**
     * Generate short hash (first 8 characters) for display purposes
     */
    static async generateShortFileHash(filePath: string): Promise<string> {
        const fullHash = await SHA256Generator.generateFileHash(filePath);
        return fullHash.substring(0, 8);
    }
}
