/**
 * Command Builder
 * Centralized utility for registering VS Code commands with consistent
 * error handling, logging, and lifecycle management.
 *
 * Eliminates repeated try-catch / console.error / showErrorMessage boilerplate
 * across 56+ commands.
 */

import * as vscode from 'vscode';
import { handleError, formatErrorMessage, ErrorDomain, ErrorSeverity } from './errorHandler';

/** Descriptor for a single VS Code command. */
export interface CommandConfig<TArgs extends any[] = any[]> {
    /** The full VS Code command identifier, e.g. `'codeXR.visualizeData.chartType'` */
    id: string;
    /** Short module tag for log messages, e.g. `'VISUALIZE_DATA'` */
    module: string;
    /** Human-readable description for log messages, e.g. `'Chart Type selection'` */
    description: string;
    /** The async handler that performs the actual work. */
    handler: (...args: TArgs) => Promise<void> | void;
    /** Custom error message prefix. If omitted, auto-generated from description. */
    errorMessage?: string;
    /** If true, errors are logged but NOT shown to the user via showErrorMessage. */
    silentErrors?: boolean;
}

export class CommandBuilder {
    /**
     * Register a single command with standardized logging + error handling.
     */
    static register<TArgs extends any[] = any[]>(
        context: vscode.ExtensionContext,
        config: CommandConfig<TArgs>,
    ): vscode.Disposable {
        const disposable = vscode.commands.registerCommand(
            config.id,
            async (...args: any[]) => {
                console.log(`${config.module}: ${config.description} command triggered`);
                try {
                    await config.handler(...(args as unknown as TArgs));
                } catch (error) {
                    const severity = config.silentErrors ? ErrorSeverity.Log : ErrorSeverity.User;
                    const operation = config.errorMessage ?? `Error in ${config.description}`;
                    handleError(ErrorDomain.Command, operation, error, severity);
                }
            },
        );
        context.subscriptions.push(disposable);
        return disposable;
    }

    /**
     * Register multiple commands at once.
     */
    static registerAll(
        context: vscode.ExtensionContext,
        configs: CommandConfig[],
    ): vscode.Disposable[] {
        const disposables = configs.map(c => this.register(context, c));
        console.log(`COMMAND_BUILDER: Registered ${configs.length} commands`);
        return disposables;
    }
}
