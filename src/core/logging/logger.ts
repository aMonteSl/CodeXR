import * as vscode from 'vscode';
import {
    CodeXRExtensionMode,
    CodeXRLogLevel,
    isVerboseLoggingEnabled,
    shouldEmitLog,
} from './logPolicy';

type MessageFactory = string | (() => string);

export interface ScopedLogger {
    debug(message: MessageFactory, metadata?: unknown): void;
    info(message: MessageFactory, metadata?: unknown): void;
    warn(message: MessageFactory, metadata?: unknown): void;
    error(message: MessageFactory, metadata?: unknown): void;
}

class LoggerImpl implements ScopedLogger {
    constructor(private readonly scope: string) {}

    debug(message: MessageFactory, metadata?: unknown): void {
        CodeXRLogger.write('debug', this.scope, message, metadata);
    }

    info(message: MessageFactory, metadata?: unknown): void {
        CodeXRLogger.write('info', this.scope, message, metadata);
    }

    warn(message: MessageFactory, metadata?: unknown): void {
        CodeXRLogger.write('warn', this.scope, message, metadata);
    }

    error(message: MessageFactory, metadata?: unknown): void {
        CodeXRLogger.write('error', this.scope, message, metadata);
    }
}

/**
 * Shared logger for CodeXR. Uses a dedicated VS Code output channel and keeps
 * verbose logging disabled in production unless the user opts in explicitly.
 */
export class CodeXRLogger {
    private static outputChannel: vscode.OutputChannel | undefined;
    private static verboseLoggingEnabled = false;
    private static initialized = false;

    public static initialize(context: vscode.ExtensionContext): void {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('CodeXR');
            context.subscriptions.push(this.outputChannel);
        }

        this.updateLoggingMode(context);

        if (this.initialized) {
            return;
        }

        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('codeXR.debug.verboseLogs')) {
                this.updateLoggingMode(context);
                this.write(
                    'info',
                    'LOGGER',
                    () => `Verbose logging ${this.verboseLoggingEnabled ? 'enabled' : 'disabled'}.`,
                );
            }
        }));

        this.initialized = true;
    }

    public static getLogger(scope: string): ScopedLogger {
        return new LoggerImpl(scope);
    }

    public static write(
        level: CodeXRLogLevel,
        scope: string,
        message: MessageFactory,
        metadata?: unknown,
    ): void {
        if (!shouldEmitLog(level, this.verboseLoggingEnabled)) {
            return;
        }

        const outputChannel = this.outputChannel;
        if (!outputChannel) {
            return;
        }

        const renderedMessage = typeof message === 'function' ? message() : message;
        const timestamp = new Date().toISOString();
        outputChannel.appendLine(`[${timestamp}] [${level.toUpperCase()}] [${scope}] ${renderedMessage}`);

        if (metadata !== undefined) {
            outputChannel.appendLine(this.formatMetadata(metadata));
        }
    }

    private static updateLoggingMode(context: vscode.ExtensionContext): void {
        const verboseSettingEnabled = vscode.workspace
            .getConfiguration()
            .get<boolean>('codeXR.debug.verboseLogs', false);

        const extensionMode: CodeXRExtensionMode = context.extensionMode === vscode.ExtensionMode.Development
            ? 'development'
            : 'production';

        this.verboseLoggingEnabled = isVerboseLoggingEnabled(extensionMode, verboseSettingEnabled);
    }

    private static formatMetadata(metadata: unknown): string {
        if (metadata instanceof Error) {
            return metadata.stack ?? metadata.message;
        }

        if (typeof metadata === 'string') {
            return metadata;
        }

        try {
            return JSON.stringify(metadata, null, 2);
        } catch (error) {
            return String(metadata);
        }
    }
}
