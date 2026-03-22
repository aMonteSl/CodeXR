/**
 * Command Builder
 * Centralized utility for registering VS Code commands with consistent
 * error handling, logging, and lifecycle management.
 *
 * Eliminates repeated try-catch / console.error / showErrorMessage boilerplate
 * across 56+ commands.
 */

import * as vscode from 'vscode';
import type { ExtensionCommandRegistration } from '../commands/shared';
import { handleError, ErrorDomain, ErrorSeverity } from './errorHandler';

export type CommandConfig<TArgs extends any[] = any[]> = ExtensionCommandRegistration<TArgs>;

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
        const disposables = configs.map(config => this.register(context, config));
        console.log(`COMMAND_BUILDER: Registered ${configs.length} commands`);
        return disposables;
    }
}
