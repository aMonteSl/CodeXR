/**
 * Directory Validator Utility
 * Validates if a directory should be analyzed or skipped
 */

import * as path from 'path';

export class DirectoryValidator {
    
    /**
     * Directory patterns that should be excluded from analysis
     * Using glob-like patterns for better matching
     */
    private static readonly EXCLUDED_PATTERNS = [
        // Python environments (any level)
        '**/.venv/**',
        '**/venv/**',
        '**/__pycache__/**',
        '**/.env/**',
        '**/env/**',
        
        // Node.js (any level)
        '**/node_modules/**',
        '**/.npm/**',
        '**/.yarn/**',
        
        // Version control (any level)
        '**/.git/**',
        '**/.svn/**',
        '**/.hg/**',
        '**/.bzr/**',
        
        // IDE/Editor files (any level)
        '**/.vscode/**',
        '**/.idea/**',
        '**/.vs/**',
        
        // Build outputs (any level)
        '**/dist/**',
        '**/build/**',
        '**/out/**',
        '**/target/**',
        '**/bin/**',
        '**/obj/**',
        
        // Temporary files (any level)
        '**/tmp/**',
        '**/temp/**',
        '**/.tmp/**',
        '**/.temp/**',
        
        // Package managers (any level)
        '**/.nuget/**',
        '**/packages/**',
        '**/bower_components/**',
        
        // Other common excludes (any level)
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/.cache/**',
        '**/.pytest_cache/**',
        '**/.mypy_cache/**',
        '**/.tox/**',
        '**/logs/**'
    ];

    /**
     * Directory names that should be excluded (exact match)
     */
    private static readonly EXCLUDED_DIRECTORY_NAMES = [
        '.venv', 'venv', '__pycache__', '.env', 'env',
        'node_modules', '.npm', '.yarn',
        '.git', '.svn', '.hg', '.bzr',
        '.vscode', '.idea', '.vs',
        'dist', 'build', 'out', 'target', 'bin', 'obj',
        'tmp', 'temp', '.tmp', '.temp',
        '.nuget', 'packages', 'bower_components',
        'coverage', '.nyc_output', '.cache', '.pytest_cache', 
        '.mypy_cache', '.tox', 'logs'
    ];

    /**
     * Check if a path should be excluded from analysis
     * This is the main filtering method that checks the complete path
     */
    static shouldExcludePath(relativePath: string): boolean {
        // Normalize path separators to forward slashes
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        // Check if any part of the path contains excluded directory names
        const pathParts = normalizedPath.split('/');
        for (const part of pathParts) {
            if (this.EXCLUDED_DIRECTORY_NAMES.includes(part)) {
                return true;
            }
            
            // Also check for hidden directories (except allowed ones)
            if (part.startsWith('.') && part.length > 1) {
                const allowedDotDirs = ['.github', '.gitlab', '.circleci'];
                if (!allowedDotDirs.includes(part)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Check if a directory should be analyzed (legacy method for compatibility)
     */
    static shouldAnalyzeDirectory(directoryPath: string): { valid: boolean; reason?: string } {
        const dirName = path.basename(directoryPath);
        
        if (this.shouldExcludePath(dirName)) {
            return {
                valid: false,
                reason: `Directory "${dirName}" is excluded from analysis`
            };
        }
        
        return { valid: true };
    }

    /**
     * Get user-friendly warning message for excluded directory
     */
    static getExclusionWarning(directoryPath: string): string {
        const validation = this.shouldAnalyzeDirectory(directoryPath);
        if (validation.valid) {
            return '';
        }
        
        const dirName = path.basename(directoryPath);
        return `⚠️ CodeXR: Cannot analyze "${dirName}" - ${validation.reason}. Please select a source code directory instead.`;
    }

    /**
     * Get list of excluded directory patterns for user reference
     */
    static getExcludedPatterns(): string[] {
        return [...this.EXCLUDED_PATTERNS];
    }

    /**
     * Check if a directory name should be excluded (public method for registry use)
     */
    static isExcludedDirectoryName(dirName: string): boolean {
        return this.EXCLUDED_DIRECTORY_NAMES.includes(dirName) || 
               (dirName.startsWith('.') && dirName.length > 1 && 
                !['.github', '.gitlab', '.circleci'].includes(dirName));
    }

    /**
     * Pre-filter paths before scanning to avoid scanning excluded directories entirely
     * This is the most efficient approach - check before entering directories
     */
    static shouldScanPath(relativePath: string, basePath: string): boolean {
        // If this is the base path itself, always scan
        if (relativePath === '' || relativePath === '.') {
            return true;
        }
        
        return !this.shouldExcludePath(relativePath);
    }

    /**
     * Filter a list of files and directories, removing excluded ones
     * Returns filtered maps and logs what was removed
     */
    static filterFilesAndDirectories(
        filesList: Map<string, string>,
        subDirectoriesList: Map<string, string>,
        basePath: string
    ): {
        filteredFiles: Map<string, string>;
        filteredDirectories: Map<string, string>;
        removedFiles: string[];
        removedDirectories: string[];
    } {
        const filteredFiles = new Map<string, string>();
        const filteredDirectories = new Map<string, string>();
        const removedFiles: string[] = [];
        const removedDirectories: string[] = [];

        // Filter files
        for (const [relativePath, absolutePath] of filesList) {
            if (!this.shouldExcludePath(relativePath)) {
                filteredFiles.set(relativePath, absolutePath);
            } else {
                removedFiles.push(relativePath);
            }
        }

        // Filter directories
        for (const [relativePath, absolutePath] of subDirectoriesList) {
            if (!this.shouldExcludePath(relativePath)) {
                filteredDirectories.set(relativePath, absolutePath);
            } else {
                removedDirectories.push(relativePath);
            }
        }

        // Enhanced logging with categorization
        if (removedDirectories.length > 0) {
            const categorizedDirs = this.categorizeExcludedPaths(removedDirectories);
            console.log(`FILTERING: Removed ${removedDirectories.length} directories from analysis:`);
            
            for (const [category, paths] of categorizedDirs) {
                console.log(`FILTERING: - ${category}: ${paths.length} directories`);
                // Only show first few examples to avoid spam
                const examples = paths.slice(0, 2);
                examples.forEach(dir => {
                    console.log(`FILTERING:   • ${dir}`);
                });
                if (paths.length > 2) {
                    console.log(`FILTERING:   • ... and ${paths.length - 2} more`);
                }
            }
        }

        if (removedFiles.length > 0) {
            const categorizedFiles = this.categorizeExcludedPaths(removedFiles);
            console.log(`FILTERING: Removed ${removedFiles.length} files from analysis:`);
            
            for (const [category, paths] of categorizedFiles) {
                console.log(`FILTERING: - ${category}: ${paths.length} files`);
                // Only show first few examples to avoid spam
                const examples = paths.slice(0, 1);
                examples.forEach(file => {
                    console.log(`FILTERING:   • ${file}`);
                });
                if (paths.length > 1) {
                    console.log(`FILTERING:   • ... and ${paths.length - 1} more`);
                }
            }
        }

        console.log(`FILTERING: Results - Files: ${filteredFiles.size}/${filesList.size} kept, Directories: ${filteredDirectories.size}/${subDirectoriesList.size} kept`);

        return {
            filteredFiles,
            filteredDirectories,
            removedFiles,
            removedDirectories
        };
    }

    /**
     * Categorize excluded paths by their exclusion reason for better logging
     */
    private static categorizeExcludedPaths(paths: string[]): Map<string, string[]> {
        const categories = new Map<string, string[]>();
        
        for (const path of paths) {
            let category = 'Other';
            
            if (path.includes('.venv') || path.includes('venv') || path.includes('__pycache__')) {
                category = 'Python environments';
            } else if (path.includes('node_modules') || path.includes('.npm') || path.includes('.yarn')) {
                category = 'Node.js dependencies';
            } else if (path.includes('.git') || path.includes('.svn')) {
                category = 'Version control';
            } else if (path.includes('.vscode') || path.includes('.idea')) {
                category = 'IDE files';
            } else if (path.includes('dist') || path.includes('build') || path.includes('out')) {
                category = 'Build outputs';
            } else if (path.startsWith('.')) {
                category = 'Hidden files/directories';
            }
            
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(path);
        }
        
        return categories;
    }
}
