/**
 * URI Path Converter Utility
 * Handles conversion between VS Code URIs and file system paths
 */

import * as vscode from 'vscode';

/**
 * Convert VS Code URI or file path to a standard file system path
 * Handles various input types that VS Code commands can receive
 */
export function convertToFileSystemPath(input: any): string | null {
    try {
        // Handle null/undefined
        if (!input) {
            return null;
        }

        console.log('URI_PATH_CONVERTER: Processing input:', typeof input, input);

        // If it's already a string path
        if (typeof input === 'string') {
            // Check if it's a URI string
            if (input.startsWith('file://') || input.startsWith('vscode-')) {
                const uri = vscode.Uri.parse(input);
                console.log('URI_PATH_CONVERTER: Converted URI string to path:', uri.fsPath);
                return uri.fsPath;
            }
            // It's already a file system path
            console.log('URI_PATH_CONVERTER: Input is already a file system path:', input);
            return input;
        }

        // If it's a VS Code URI object
        if (input && typeof input === 'object') {
            // Check if it has fsPath property (VS Code URI)
            if ('fsPath' in input && typeof input.fsPath === 'string') {
                console.log('URI_PATH_CONVERTER: Extracted fsPath from URI object:', input.fsPath);
                return input.fsPath;
            }

            // Check if it has scheme and path properties (URI-like object)
            if ('scheme' in input && 'path' in input) {
                const uri = vscode.Uri.from(input);
                console.log('URI_PATH_CONVERTER: Created URI from object and extracted path:', uri.fsPath);
                return uri.fsPath;
            }

            // Try to convert object to string and parse as URI
            const stringified = String(input);
            if (stringified.startsWith('file://') || stringified.startsWith('vscode-')) {
                const uri = vscode.Uri.parse(stringified);
                console.log('URI_PATH_CONVERTER: Converted stringified object to path:', uri.fsPath);
                return uri.fsPath;
            }
        }

        console.warn('URI_PATH_CONVERTER: Could not convert input to file system path:', input);
        return null;

    } catch (error) {
        console.error('URI_PATH_CONVERTER: Error converting input to file system path:', error);
        return null;
    }
}

/**
 * Get file system path from active editor or provided input
 */
export function getFileSystemPathFromEditorOrInput(input?: any): string | null {
    try {
        // First try to convert the provided input
        if (input) {
            const convertedPath = convertToFileSystemPath(input);
            if (convertedPath) {
                return convertedPath;
            }
        }

        // Fallback to active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const editorPath = activeEditor.document.uri.fsPath;
            console.log('URI_PATH_CONVERTER: Using active editor path:', editorPath);
            return editorPath;
        }

        console.warn('URI_PATH_CONVERTER: No valid file path found from input or active editor');
        return null;

    } catch (error) {
        console.error('URI_PATH_CONVERTER: Error getting file system path:', error);
        return null;
    }
}

/**
 * Validate that a path is a valid file system path
 */
export function isValidFileSystemPath(path: string): boolean {
    try {
        if (!path || typeof path !== 'string') {
            return false;
        }

        // Basic validation - path should not contain URI schemes
        if (path.includes('://')) {
            return false;
        }

        // Should contain file separators (/ or \)
        if (!path.includes('/') && !path.includes('\\')) {
            return false;
        }

        return true;

    } catch (error) {
        console.error('URI_PATH_CONVERTER: Error validating file system path:', error);
        return false;
    }
}
