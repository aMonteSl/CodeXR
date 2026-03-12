import * as vscode from 'vscode';

export type PythonEnvUiStatus = 'idle' | 'installing' | 'ready' | 'error';

export interface PythonEnvUiState {
    status: PythonEnvUiStatus;
    message: string;
    detail?: string;
    isUiRestricted: boolean;
    updatedAt: string;
}

/**
 * Shared UI state for Python environment setup.
 * Allows the tree view and command handlers to react consistently.
 */
export class PythonEnvUiStateService {
    private static instance: PythonEnvUiStateService | undefined;

    private readonly emitter = new vscode.EventEmitter<PythonEnvUiState>();
    private state: PythonEnvUiState = {
        status: 'idle',
        message: 'Python environment has not been configured yet.',
        isUiRestricted: false,
        updatedAt: new Date().toISOString(),
    };

    private constructor() {
        void this.syncContextKeys();
    }

    public static getInstance(): PythonEnvUiStateService {
        if (!this.instance) {
            this.instance = new PythonEnvUiStateService();
        }

        return this.instance;
    }

    public getState(): PythonEnvUiState {
        return { ...this.state };
    }

    public onDidChangeState(listener: (state: PythonEnvUiState) => void): vscode.Disposable {
        return this.emitter.event(listener);
    }

    public beginInstallation(message: string, detail?: string): void {
        this.updateState({
            status: 'installing',
            message,
            detail,
            isUiRestricted: true,
        });
    }

    public reportProgress(message: string, detail?: string): void {
        this.updateState({
            status: 'installing',
            message,
            detail: detail ?? this.state.detail,
            isUiRestricted: true,
        });
    }

    public setReady(message: string, detail?: string): void {
        this.updateState({
            status: 'ready',
            message,
            detail,
            isUiRestricted: false,
        });
    }

    public setError(message: string, detail?: string): void {
        this.updateState({
            status: 'error',
            message,
            detail,
            isUiRestricted: true,
        });
    }

    public setIdle(message: string, detail?: string): void {
        this.updateState({
            status: 'idle',
            message,
            detail,
            isUiRestricted: false,
        });
    }

    private updateState(next: Omit<PythonEnvUiState, 'updatedAt'>): void {
        this.state = {
            ...next,
            updatedAt: new Date().toISOString(),
        };

        void this.syncContextKeys();
        this.emitter.fire(this.getState());
    }

    private async syncContextKeys(): Promise<void> {
        try {
            await vscode.commands.executeCommand('setContext', 'codeXR.pythonEnv.uiLocked', this.state.isUiRestricted);
            await vscode.commands.executeCommand('setContext', 'codeXR.pythonEnv.retryAvailable', this.state.status === 'error');
        } catch (error) {
            console.warn('PYTHON_ENV: Failed to update VS Code context keys:', error);
        }
    }
}
