/**
 * Centralized Error Handler
 * 
 * Provides consistent error classification, formatting and reporting
 * across the entire extension. Replaces inconsistent patterns of
 * console.error / showErrorMessage / silent swallowing.
 * 
 * Usage:
 *   import { handleError, ErrorSeverity, ErrorDomain } from '../utils/errorHandler';
 *   
 *   try { ... } catch (error) {
 *       handleError(ErrorDomain.Server, 'Failed to start HTTPS server', error, ErrorSeverity.User);
 *   }
 */

import * as vscode from 'vscode';

/** Error severity determines how the error is surfaced */
export enum ErrorSeverity {
    /** Show to user via showErrorMessage — user can act on it */
    User = 'user',
    /** Log via console.error — internal/recoverable issue */
    Log = 'log',
    /** Log as warning — expected/non-critical failure */
    Warn = 'warn',
    /** Silently ignore — intentional no-op on failure */
    Silent = 'silent',
}

/** Error domain for categorization and structured logging */
export enum ErrorDomain {
    PythonEnv = 'PYTHON_ENV',
    Server = 'SERVER',
    ActiveServers = 'ACTIVE_SERVERS',
    Analysis = 'ANALYSIS',
    FileIO = 'FILE_IO',
    Config = 'CONFIG',
    Template = 'TEMPLATE',
    UI = 'UI',
    SSE = 'SSE',
    Watcher = 'WATCHER',
    Command = 'COMMAND',
    Visualization = 'VISUALIZATION',
}

/**
 * Extract a human-readable message from any thrown value.
 */
export function formatErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Centralized error handler with consistent formatting and severity routing.
 *
 * @param domain   The area of the extension where the error occurred
 * @param operation  A short description of what was being done
 * @param error    The caught error (any type)
 * @param severity How to surface the error (default: Log)
 */
export function handleError(
    domain: ErrorDomain,
    operation: string,
    error: unknown,
    severity: ErrorSeverity = ErrorSeverity.Log,
): void {
    const message = formatErrorMessage(error);
    const prefix = `${domain}: ${operation}`;

    switch (severity) {
        case ErrorSeverity.User:
            console.error(`${prefix}:`, error);
            vscode.window.showErrorMessage(`${prefix}: ${message}`);
            break;
        case ErrorSeverity.Log:
            console.error(`${prefix}:`, error);
            break;
        case ErrorSeverity.Warn:
            console.warn(`${prefix}:`, error);
            break;
        case ErrorSeverity.Silent:
            // Intentional no-op
            break;
    }
}

/**
 * Convenience wrapper for async operations with consistent error handling.
 * Returns the result or undefined on failure.
 *
 * @param domain    Error domain
 * @param operation Operation description
 * @param fn        Async function to execute
 * @param severity  Error severity (default: Log)
 */
export async function withErrorHandler<T>(
    domain: ErrorDomain,
    operation: string,
    fn: () => Promise<T>,
    severity: ErrorSeverity = ErrorSeverity.Log,
): Promise<T | undefined> {
    try {
        return await fn();
    } catch (error) {
        handleError(domain, operation, error, severity);
        return undefined;
    }
}
