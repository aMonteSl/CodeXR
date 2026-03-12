/**
 * File Hash Tracker
 * Manages a directory → fileName → hash lookup structure.
 * Detects real file changes by comparing SHA-256 hashes, and filters out
 * non-essential filesystem events (temp files, IDE files, unsupported extensions).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SHA256Generator } from '../../../utils/sha256Generator';

/** Represents a file with its path and hash, as stored in the session. */
export interface FileHashEntry {
    filePath: string;
    hash: string;
}

export class FileHashTracker {
    /** directoryPath → (fileName → hash) */
    private directoryFileHashes: Map<string, Map<string, string>> = new Map();
    /** Set of directory paths being tracked */
    private watchedDirectories: Set<string> = new Set();

    private static readonly SUPPORTED_EXTENSIONS = new Set([
        '.py', '.pyw', '.pyi', '.rb', '.rbw', '.java', '.c', '.h', '.cpp', '.cxx', '.cc', '.hpp', '.hxx',
        '.cs', '.erl', '.hrl', '.f90', '.f95', '.f03', '.f08', '.f', '.gd', '.go', '.js', '.mjs', '.cjs',
        '.kt', '.kts', '.lua', '.m', '.mm', '.php', '.phtml', '.php3', '.php4', '.php5', '.pl', '.pm',
        '.scala', '.sc', '.sol', '.swift', '.ts', '.tsx', '.ttcn', '.ttcn3', '.vue', '.zig', '.rs',
        '.dart', '.r', '.sh', '.bash', '.ps1', '.jsx', '.css', '.scss', '.less', '.clj', '.cljs',
        '.hs', '.ml', '.mli', '.pas',
    ]);

    private static readonly SKIP_PATTERNS: RegExp[] = [
        /^\..*$/,          // Hidden files
        /.*~$/,            // Backup files
        /.*\.tmp$/,        // Temporary files
        /.*\.log$/,        // Log files
        /.*\.swp$/,        // Vim swap files
        /.*\.swo$/,        // Vim swap files
        /.*\.bak$/,        // Backup files
        /.*\.orig$/,       // Original files
        /^#.*#$/,          // Emacs auto-save files
        /.*\.lock$/,       // Lock files
        /.*\.pid$/,        // Process ID files
        /.*\.cache$/,      // Cache files
        /.*\.DS_Store$/,   // macOS files
        /^Thumbs\.db$/,    // Windows files
        /.*\.pyc$/,        // Python bytecode
        /.*\.pyo$/,        // Python optimized bytecode
        /.*\.class$/,      // Java class files
        /.*\.o$/,          // Object files
        /.*\.obj$/,        // Object files
        /.*\.exe$/,        // Executable files
        /.*\.dll$/,        // Dynamic libraries
        /.*\.so$/,         // Shared libraries
        /.*\.a$/,          // Static libraries
        /.*\.lib$/,        // Library files
    ];

    /**
     * Initialize hash tracking from the session's filesToHash array.
     */
    constructor(filesToHash?: FileHashEntry[]) {
        if (!filesToHash || filesToHash.length === 0) {
            console.log(`FILE_HASH_TRACKER: No filesToHash provided  nothing to track`);
            return;
        }

        console.log(`FILE_HASH_TRACKER: Initializing with ${filesToHash.length} files`);

        for (const entry of filesToHash) {
            const dirPath = path.dirname(entry.filePath);
            const fileName = path.basename(entry.filePath);

            if (!this.directoryFileHashes.has(dirPath)) {
                this.directoryFileHashes.set(dirPath, new Map());
                this.watchedDirectories.add(dirPath);
            }

            this.directoryFileHashes.get(dirPath)!.set(fileName, entry.hash);
        }

        console.log(`FILE_HASH_TRACKER: Tracking ${this.watchedDirectories.size} directories`);
    }

    /** Returns the set of directories that contain tracked files. */
    getWatchedDirectories(): Set<string> {
        return this.watchedDirectories;
    }

    /** Look up the directory-level file map. */
    getDirectoryFiles(dirPath: string): Map<string, string> | undefined {
        return this.directoryFileHashes.get(dirPath);
    }

    /** Whether a filename belongs to a tracked directory. */
    isTrackedFile(dirPath: string, fileName: string): boolean {
        return this.directoryFileHashes.get(dirPath)?.has(fileName) ?? false;
    }

    /**
     * Check whether a single file's hash has changed from the stored value.
     * @returns true if the file's hash differs from the stored hash.
     */
    async hasFileChanged(dirPath: string, fileName: string, fullPath: string): Promise<boolean> {
        try {
            const dirFiles = this.directoryFileHashes.get(dirPath);
            const originalHash = dirFiles?.get(fileName);
            if (!originalHash) { return true; }

            const currentHash = await SHA256Generator.generateFileHash(fullPath);
            if (currentHash !== originalHash) {
                console.log(`FILE_HASH_TRACKER: Hash changed for ${fileName}  old: ${originalHash.substring(0, 12)}... new: ${currentHash.substring(0, 12)}...`);
                return true;
            }
            return false;
        } catch {
            // In case of error, assume changed
            return true;
        }
    }

    /**
     * For a batch of file paths, return only those whose hash actually changed.
     * Also updates the stored hash to the new value.
     */
    async filterActuallyChanged(filePaths: Iterable<string>): Promise<string[]> {
        const changed: string[] = [];

        for (const filePath of filePaths) {
            try {
                const dirPath = path.dirname(filePath);
                const fileName = path.basename(filePath);

                const currentHash = await SHA256Generator.generateFileHash(filePath);
                const dirFiles = this.directoryFileHashes.get(dirPath);
                const originalHash = dirFiles?.get(fileName);

                if (!originalHash || currentHash !== originalHash) {
                    changed.push(filePath);
                    // Update stored hash
                    dirFiles?.set(fileName, currentHash);
                }
            } catch {
                changed.push(filePath);
            }
        }

        console.log(`FILE_HASH_TRACKER: ${changed.length}/${[...filePaths].length} files actually changed`);
        return changed;
    }

    /**
     * Start tracking a new file (e.g. a file that was just added to the directory).
     */
    trackNewFile(filePath: string, hash: string): void {
        const dirPath = path.dirname(filePath);
        const fileName = path.basename(filePath);

        if (!this.directoryFileHashes.has(dirPath)) {
            this.directoryFileHashes.set(dirPath, new Map());
        }
        this.directoryFileHashes.get(dirPath)!.set(fileName, hash);
    }

    /**
     * Stop tracking a file (e.g. it was deleted).
     */
    untrackFile(dirPath: string, fileName: string): void {
        this.directoryFileHashes.get(dirPath)?.delete(fileName);
    }

    /** Whether this file's extension is in the analyzable set. */
    isAnalyzableExtension(filePath: string): boolean {
        return FileHashTracker.SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
    }

    /** Whether a filesystem event for this filename should be ignored (temp/IDE files). */
    shouldSkipEvent(filename: string): boolean {
        return FileHashTracker.SKIP_PATTERNS.some(p => p.test(filename));
    }
}
