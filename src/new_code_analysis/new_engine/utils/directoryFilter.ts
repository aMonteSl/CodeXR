/**
 * Directory Filter Utility
 * Handles filtering of directories that should not be watched or analyzed
 */

import * as path from 'path';

/**
 * Directories that should be excluded from analysis and watching
 * These directories typically contain:
 * - Build artifacts
 * - Dependencies
 * - Temporary files
 * - System files
 * - Version control metadata
 */
const EXCLUDED_DIRECTORIES = [
    // Node.js
    'node_modules',
    
    // Build outputs
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    
    // Dependencies and package managers
    'bower_components',
    'jspm_packages',
    'vendor',
    
    // Version control
    '.git',
    '.svn',
    '.hg',
    '.bzr',
    
    // IDE and editor files
    '.vscode',
    '.idea',
    '.vs',
    
    // Temporary and cache
    '.tmp',
    'tmp',
    'temp',
    '.cache',
    'cache',
    
    // OS specific
    '.DS_Store',
    'Thumbs.db',
    '__pycache__',
    '.pytest_cache',
    
    // Python
    'venv',
    'env',
    '.venv',
    '.env',
    'site-packages',
    
    // Java
    'target',
    'bin',
    
    // C/C++
    'obj',
    
    // Logs
    'logs',
    'log',
    
    // Coverage
    'coverage',
    '.nyc_output',
    
    // Documentation builds
    'docs/_build',
    'site',
];

/**
 * Check if a directory should be excluded from analysis
 * Now checks the entire path hierarchy, not just the directory name
 */
export function isDirectoryExcluded(dirPath: string): boolean {
    // Split the path into components
    const pathComponents = dirPath.split(path.sep);
    
    // Check each component in the path
    for (const component of pathComponents) {
        if (!component) {
            continue; // Skip empty components
        }
        
        // Check against excluded directory names
        if (EXCLUDED_DIRECTORIES.includes(component)) {
            return true;
        }
        
        // Check for hidden directories (starting with .)
        if (component.startsWith('.') && component !== '.' && component !== '..') {
            // Allow some specific hidden directories that might be useful
            const allowedHiddenDirs = ['.github', '.vscode'];
            if (!allowedHiddenDirs.includes(component)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * Filter a list of directories, removing those that should not be analyzed
 * @param directories List of directory paths to filter
 * @returns Filtered list of directories that are safe to analyze
 */
export function filterDirectoriesForAnalysis(directories: string[]): string[] {
    console.log(`DIRECTORY_FILTER: Filtering ${directories.length} directories`);
    
    const filtered = directories.filter(dir => {
        const shouldExclude = isDirectoryExcluded(dir);
        
        if (shouldExclude) {
            console.log(`DIRECTORY_FILTER: Excluding directory (contains excluded component): ${dir}`);
        }
        
        return !shouldExclude;
    });
    
    console.log(`DIRECTORY_FILTER: Filtered to ${filtered.length} directories (excluded ${directories.length - filtered.length})`);
    console.log(`DIRECTORY_FILTER: Remaining directories:`, filtered);
    return filtered;
}

/**
 * Get a list of all excluded directory patterns
 * Useful for debugging or informational purposes
 */
export function getExcludedDirectoryPatterns(): readonly string[] {
    return EXCLUDED_DIRECTORIES;
}
