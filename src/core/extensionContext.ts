/**
 * Extension Context Holder
 * 
 * Lightweight singleton that stores the VS Code ExtensionContext once
 * during activation, eliminating the need to thread `context` through
 * every `getInstance(context)` call across the codebase.
 * 
 * Usage:
 *   // In extension.ts activate():
 *   initializeExtensionContext(context);
 * 
 *   // In any consumer (no context parameter needed):
 *   import { getExtensionContext } from '../core/extensionContext';
 *   const ctx = getExtensionContext();
 */

import * as vscode from 'vscode';

let _context: vscode.ExtensionContext | null = null;

/**
 * Store the extension context. Must be called once during activate().
 * Subsequent calls are ignored (idempotent).
 */
export function initializeExtensionContext(context: vscode.ExtensionContext): void {
    if (!_context) {
        _context = context;
        console.log('CORE: Extension context initialized');
    }
}

/**
 * Retrieve the stored extension context.
 * @throws if called before initializeExtensionContext()
 */
export function getExtensionContext(): vscode.ExtensionContext {
    if (!_context) {
        throw new Error(
            'Extension context not initialized. Call initializeExtensionContext(context) in activate() first.'
        );
    }
    return _context;
}
