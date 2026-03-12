/**
 * Centralized Error Handler
 *
 * Provides consistent error classification, formatting and reporting
 * across the entire extension.
 */

import * as vscode from 'vscode';
import { CodeXRLogger } from '../core/logging/logger';

const logger = CodeXRLogger.getLogger('ERROR_HANDLER');

/** Error severity determines how the error is surfaced */
export enum ErrorSeverity {
    User = 'user',
    Log = 'log',
    Warn = 'warn',
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
            logger.error(prefix, error);
            void vscode.window.showErrorMessage(`${prefix}: ${message}`);
            break;
        case ErrorSeverity.Log:
            logger.error(prefix, error);
            break;
        case ErrorSeverity.Warn:
            logger.warn(prefix, error);
            break;
        case ErrorSeverity.Silent:
            break;
    }
}

/**
 * Convenience wrapper for async operations with consistent error handling.
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
