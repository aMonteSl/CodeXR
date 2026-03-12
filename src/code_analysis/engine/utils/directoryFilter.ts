/**
 * Directory Filter Utility
 * Handles filtering of directories that should not be watched or analyzed.
 */

import * as path from 'path';

const EXCLUDED_DIRECTORIES = [
    'node_modules',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'bower_components',
    'jspm_packages',
    '.git',
    '.svn',
    '.hg',
    '.bzr',
    '.vscode',
    '.idea',
    '.vs',
    '.tmp',
    'tmp',
    'temp',
    '.cache',
    'cache',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    'venv',
    'env',
    '.venv',
    '.env',
    'site-packages',
    'target',
    'obj',
    'logs',
    'log',
    'coverage',
    '.nyc_output',
    '_site',
];

const EXCLUDED_DIRECTORY_SET = new Set(EXCLUDED_DIRECTORIES);

export function isDirectoryExcluded(dirPath: string, rootDirectory?: string): boolean {
    if (rootDirectory && path.resolve(dirPath) === path.resolve(rootDirectory)) {
        return false;
    }

    const pathComponents = path.resolve(dirPath).split(path.sep);
    for (const component of pathComponents) {
        if (!component) {
            continue;
        }

        if (EXCLUDED_DIRECTORY_SET.has(component)) {
            return true;
        }

        if (component.startsWith('.') && component !== '.' && component !== '..') {
            return true;
        }
    }

    return false;
}

export function filterDirectoriesForAnalysis(directories: string[], rootDirectory?: string): string[] {
    return directories.filter(dir => !isDirectoryExcluded(dir, rootDirectory));
}

export function getExcludedDirectoryPatterns(): readonly string[] {
    return EXCLUDED_DIRECTORIES;
}
