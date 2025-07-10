"use strict";
/**
 * Shared directory scanning utilities for all directory analysis types
 * Provides consistent file discovery logic across static, XR, shallow, and deep modes
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoryScanner = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const hash_1 = require("../../utils/hash");
const languageUtils_1 = require("../../utils/languageUtils");
/**
 * Shared directory scanner class
 */
class DirectoryScanner {
    /**
     * Scans a directory based on the provided configuration
     * @param config Scanner configuration
     * @returns Promise with scan results
     */
    static async scanDirectory(config) {
        const { directoryPath, filters, progressCallback, logPrefix = 'SCANNER' } = config;
        const startTime = Date.now();
        console.log(`${logPrefix}: Starting directory scan - ${directoryPath}`);
        console.log(`${logPrefix}: Max depth: ${filters.maxDepth}`);
        console.log(`${logPrefix}: Exclude patterns: ${filters.excludePatterns?.length || 0}`);
        const analyzableFiles = [];
        let totalFiles = 0;
        // Determine scan strategy based on maxDepth
        if (filters.maxDepth === 1) {
            console.log(`${logPrefix}: Using SHALLOW scan (maxDepth=1)`);
            const result = await this.scanShallow(directoryPath, filters, progressCallback, logPrefix);
            return {
                ...result,
                scanDuration: Date.now() - startTime
            };
        }
        else {
            console.log(`${logPrefix}: Using DEEP scan (maxDepth=${filters.maxDepth})`);
            const result = await this.scanDeep(directoryPath, filters, progressCallback, logPrefix);
            return {
                ...result,
                scanDuration: Date.now() - startTime
            };
        }
    }
    /**
     * Performs shallow scanning (immediate children only)
     */
    static async scanShallow(directoryPath, filters, progressCallback, logPrefix = 'SCANNER') {
        const analyzableFiles = [];
        let totalFiles = 0;
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(directoryPath));
            const fileEntries = entries.filter(([name, type]) => type === vscode.FileType.File);
            console.log(`${logPrefix}: Found ${entries.length} entries, ${fileEntries.length} files`);
            for (let i = 0; i < fileEntries.length; i++) {
                const [fileName] = fileEntries[i];
                const filePath = path.join(directoryPath, fileName);
                totalFiles++;
                // Report progress
                if (progressCallback) {
                    progressCallback(i + 1, fileEntries.length, fileName);
                }
                // Check if file should be analyzed
                if (this.shouldAnalyzeFile(filePath, filters)) {
                    const fileInfo = await this.createFileInfo(filePath, directoryPath);
                    if (fileInfo) {
                        analyzableFiles.push(fileInfo);
                    }
                }
            }
        }
        catch (error) {
            console.error(`${logPrefix}: Error scanning directory ${directoryPath}:`, error);
        }
        const totalAnalyzableFiles = analyzableFiles.length;
        const totalNonAnalyzableFiles = totalFiles - totalAnalyzableFiles;
        console.log(`${logPrefix}: Scan complete - ${totalAnalyzableFiles}/${totalFiles} analyzable files`);
        return {
            analyzableFiles,
            totalFiles,
            totalAnalyzableFiles,
            totalNonAnalyzableFiles
        };
    }
    /**
     * Performs deep recursive scanning
     */
    static async scanDeep(directoryPath, filters, progressCallback, logPrefix = 'SCANNER') {
        const analyzableFiles = [];
        let totalFiles = 0;
        let processedFiles = 0;
        const scanRecursive = async (currentPath, currentDepth = 0) => {
            if (filters.maxDepth > 0 && currentDepth >= filters.maxDepth) {
                return;
            }
            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(currentPath));
                for (const [entryName, entryType] of entries) {
                    const entryPath = path.join(currentPath, entryName);
                    if (entryType === vscode.FileType.File) {
                        totalFiles++;
                        processedFiles++;
                        // Report progress
                        if (progressCallback) {
                            progressCallback(processedFiles, totalFiles, entryName);
                        }
                        // Check if file should be analyzed
                        if (this.shouldAnalyzeFile(entryPath, filters)) {
                            const fileInfo = await this.createFileInfo(entryPath, directoryPath);
                            if (fileInfo) {
                                analyzableFiles.push(fileInfo);
                            }
                        }
                    }
                    else if (entryType === vscode.FileType.Directory) {
                        // Check if directory should be ignored
                        if (!this.shouldIgnoreDirectory(entryName, filters)) {
                            await scanRecursive(entryPath, currentDepth + 1);
                        }
                        else {
                            console.log(`${logPrefix}: Skipping ignored directory: ${entryName}`);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`${logPrefix}: Could not scan directory ${currentPath}:`, error);
            }
        };
        await scanRecursive(directoryPath);
        const totalAnalyzableFiles = analyzableFiles.length;
        const totalNonAnalyzableFiles = totalFiles - totalAnalyzableFiles;
        console.log(`${logPrefix}: Deep scan complete - ${totalAnalyzableFiles}/${totalFiles} analyzable files`);
        return {
            analyzableFiles,
            totalFiles,
            totalAnalyzableFiles,
            totalNonAnalyzableFiles
        };
    }
    /**
     * Checks if a file should be analyzed
     */
    static shouldAnalyzeFile(filePath, filters) {
        // Check if file extension is supported
        if (!(0, languageUtils_1.isSupportedLanguage)(filePath)) {
            return false;
        }
        // Check file size limit
        try {
            const stats = require('fs').statSync(filePath);
            if (filters.maxFileSize && stats.size > filters.maxFileSize) {
                return false;
            }
        }
        catch (error) {
            return false;
        }
        // Check exclude patterns
        if (filters.excludePatterns && filters.excludePatterns.length > 0) {
            const relativePath = path.relative(process.cwd(), filePath);
            for (const pattern of filters.excludePatterns) {
                if (this.matchesPattern(relativePath, pattern)) {
                    return false;
                }
            }
        }
        return true;
    }
    /**
     * Checks if a directory should be ignored
     */
    static shouldIgnoreDirectory(dirName, filters) {
        // Common ignored directories
        const ignoredDirs = [
            '.git', '.svn', '.hg',
            'node_modules', '__pycache__', '.venv', 'venv',
            '.idea', '.vscode',
            'build', 'dist', 'target', 'bin', 'obj',
            'coverage', '.coverage', '.next', '.nuxt',
            'vendor', 'Pods'
        ];
        if (ignoredDirs.includes(dirName) || dirName.startsWith('.')) {
            return true;
        }
        // Check custom exclude patterns for directories
        if (filters.excludePatterns && filters.excludePatterns.length > 0) {
            for (const pattern of filters.excludePatterns) {
                if (this.matchesPattern(dirName, pattern)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Simple pattern matching for exclusion patterns
     */
    static matchesPattern(filePath, pattern) {
        // Simple glob-like pattern matching
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath) || regex.test(path.basename(filePath));
    }
    /**
     * Creates FileInfo object for a file
     */
    static async createFileInfo(filePath, baseDirectoryPath) {
        try {
            const stats = require('fs').statSync(filePath);
            const relativePath = path.relative(baseDirectoryPath, filePath);
            const fileName = path.basename(filePath);
            const extension = path.extname(filePath);
            const language = (0, languageUtils_1.getLanguageName)(filePath);
            const hash = await (0, hash_1.calculateFileHash)(filePath);
            return {
                filePath,
                relativePath,
                fileName,
                extension,
                language,
                sizeBytes: stats.size,
                hash
            };
        }
        catch (error) {
            console.warn(`Failed to create FileInfo for ${filePath}:`, error);
            return null;
        }
    }
}
exports.DirectoryScanner = DirectoryScanner;
//# sourceMappingURL=directoryScanner.js.map