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
 * 
 * IMPORTANT: This list should NOT include standard source code directories like:
 * - src, source, lib, app (source code)
 * - test, tests, spec (test code)
 * - docs, doc (documentation source)
 * - examples, samples (example code)
 */
const EXCLUDED_DIRECTORIES = [
    // Node.js
    'node_modules',
    
    // Build outputs (but NOT source directories!)
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    
    // Dependencies and package managers
    'bower_components',
    'jspm_packages',
    
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
    
    // Python virtual environments
    'venv',
    'env',
    '.venv',
    '.env',
    'site-packages',
    
    // Java build outputs (but NOT src!)
    'target',
    
    // C/C++ build outputs
    'obj',
    
    // Logs
    'logs',
    'log',
    
    // Coverage
    'coverage',
    '.nyc_output',
    
    // Documentation builds (but NOT docs source!)
    'docs/_build',
    '_site',
];

/**
 * Check if a directory should be excluded from analysis
 * Now checks the entire path hierarchy, but NEVER excludes the root directory chosen by user
 */
export function isDirectoryExcluded(dirPath: string, rootDirectory?: string): boolean {
    // NEVER exclude the root directory that the user explicitly selected
    if (rootDirectory && path.resolve(dirPath) === path.resolve(rootDirectory)) {
        console.log(`DIRECTORY_FILTER: 🚫 NEVER excluding root directory: ${dirPath}`);
        return false;
    }
    
    // 🔥 TEMPORARY FIX: Only exclude very specific problematic directories
    // to diagnose the issue with directory filtering
    const pathComponents = dirPath.split(path.sep);
    
    for (const component of pathComponents) {
        if (!component) {
            continue; // Skip empty components
        }
        
        // Only exclude these CRITICAL directories that should never be analyzed
        const criticalExclusions = [
            'node_modules',  // Dependencies
            '.git',          // Version control
            'build',         // Build output
            'dist',          // Build output
            '__pycache__'    // Python cache
        ];
        
        if (criticalExclusions.includes(component)) {
            console.log(`DIRECTORY_FILTER: 🚫 Excluding critical directory: ${dirPath} (component: ${component})`);
            return true;
        }
        
        // Allow hidden directories for now to debug
        if (component.startsWith('.') && component !== '.' && component !== '..' && component !== '.git') {
            // Allow all hidden directories temporarily except .git
            console.log(`DIRECTORY_FILTER: ✅ TEMPORARILY allowing hidden directory: ${dirPath} (component: ${component})`);
        }
    }
    
    console.log(`DIRECTORY_FILTER: ✅ ALLOWING directory: ${dirPath}`);
    return false;
}

/**
 * Filter a list of directories, removing those that should not be analyzed
 * @param directories List of directory paths to filter
 * @param rootDirectory The root directory chosen by user (never excluded)
 * @returns Filtered list of directories that are safe to analyze
 */
export function filterDirectoriesForAnalysis(directories: string[], rootDirectory?: string): string[] {
    console.log(`DIRECTORY_FILTER: Filtering ${directories.length} directories`);
    if (rootDirectory) {
        console.log(`DIRECTORY_FILTER: Root directory (never excluded): ${rootDirectory}`);
    }
    
    const filtered = directories.filter(dir => {
        const shouldExclude = isDirectoryExcluded(dir, rootDirectory);
        
        if (shouldExclude) {
            console.log(`DIRECTORY_FILTER: Excluding directory (contains excluded component): ${dir}`);
        } else {
            console.log(`DIRECTORY_FILTER: Including directory: ${dir}`);
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
