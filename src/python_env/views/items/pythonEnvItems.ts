import * as vscode from 'vscode';
import { PythonEnvUiState } from '../../runtime/pythonEnvUiState';

export type PythonEnvItemType = 'section' | 'status' | 'action' | 'warning' | 'error' | 'loading' | 'info';

interface PythonEnvStatusSnapshot {
    exists: boolean;
    isValid: boolean;
    metadata: unknown;
    stats: unknown;
}

/**
 * Tree item for Python environment UI elements.
 */
export class PythonEnvModularTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pythonEnvItemType: PythonEnvItemType,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri,
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string,
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.iconPath = iconPath;
        this.tooltip = tooltip ?? label;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Factory helpers for Python environment tree items.
 */
export class PythonEnvItems {
    public static createSectionItem(
        status: PythonEnvStatusSnapshot,
        uiState: PythonEnvUiState,
    ): PythonEnvModularTreeItem {
        const icon = this.getSectionIcon(status, uiState);
        const description = this.getSectionDescription(status, uiState);
        const tooltip = uiState.detail
            ? `${uiState.message}\n\n${uiState.detail}`
            : uiState.message;

        return new PythonEnvModularTreeItem(
            'PYTHON ENV',
            uiState.status === 'installing' || uiState.status === 'error'
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed,
            'section',
            undefined,
            icon,
            tooltip,
            description,
            'pythonEnv.section',
        );
    }

    public static createEnvironmentStatusItems(
        status: PythonEnvStatusSnapshot,
        uiState: PythonEnvUiState,
    ): PythonEnvModularTreeItem[] {
        if (uiState.status === 'installing') {
            return [
                new PythonEnvModularTreeItem(
                    'Installing virtual environment...',
                    vscode.TreeItemCollapsibleState.None,
                    'loading',
                    undefined,
                    new vscode.ThemeIcon('loading~spin'),
                    uiState.message,
                    'In progress',
                    'pythonEnv.installing',
                ),
                new PythonEnvModularTreeItem(
                    uiState.message,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    uiState.detail ?? uiState.message,
                    'CodeXR is preparing the Python environment',
                    'pythonEnv.installingInfo',
                ),
            ];
        }

        if (uiState.status === 'error') {
            return [
                new PythonEnvModularTreeItem(
                    'Python environment setup failed',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    undefined,
                    new vscode.ThemeIcon('error'),
                    uiState.detail ?? uiState.message,
                    'Retry required',
                    'pythonEnv.error',
                ),
                new PythonEnvModularTreeItem(
                    'Retry Python environment installation',
                    vscode.TreeItemCollapsibleState.None,
                    'action',
                    {
                        command: 'codeXR.pythonEnv.reinitialize',
                        title: 'Retry Python environment installation',
                    },
                    new vscode.ThemeIcon('refresh'),
                    'Retry the CodeXR virtual environment installation',
                    'Retry setup',
                    'pythonEnv.retry',
                ),
                new PythonEnvModularTreeItem(
                    'Show Python environment status',
                    vscode.TreeItemCollapsibleState.None,
                    'action',
                    {
                        command: 'codeXR.pythonEnv.status',
                        title: 'Show Python environment status',
                    },
                    new vscode.ThemeIcon('info'),
                    'Open detailed information about the CodeXR virtual environment',
                    'View details',
                    'pythonEnv.status',
                ),
            ];
        }

        if (!status.exists) {
            return [
                new PythonEnvModularTreeItem(
                    'No Python environment configured',
                    vscode.TreeItemCollapsibleState.None,
                    'warning',
                    undefined,
                    new vscode.ThemeIcon('warning'),
                    'Create the CodeXR virtual environment to enable code analysis.',
                    'Environment missing',
                    'pythonEnv.notExists',
                ),
                new PythonEnvModularTreeItem(
                    'Create Python environment',
                    vscode.TreeItemCollapsibleState.None,
                    'action',
                    {
                        command: 'codeXR.pythonEnv.create',
                        title: 'Create Python environment',
                    },
                    new vscode.ThemeIcon('add'),
                    'Create the CodeXR virtual environment in global storage',
                    'Create environment',
                    'pythonEnv.create',
                ),
            ];
        }

        if (!status.isValid) {
            return [
                new PythonEnvModularTreeItem(
                    'Python environment exists but is invalid',
                    vscode.TreeItemCollapsibleState.None,
                    'warning',
                    undefined,
                    new vscode.ThemeIcon('warning'),
                    'Reinitialize the CodeXR virtual environment to repair it.',
                    'Needs attention',
                    'pythonEnv.invalid',
                ),
                new PythonEnvModularTreeItem(
                    'Repair Python environment',
                    vscode.TreeItemCollapsibleState.None,
                    'action',
                    {
                        command: 'codeXR.pythonEnv.reinitialize',
                        title: 'Repair Python environment',
                    },
                    new vscode.ThemeIcon('tools'),
                    'Validate and rebuild the virtual environment if needed',
                    'Repair setup',
                    'pythonEnv.repair',
                ),
            ];
        }

        return [
            new PythonEnvModularTreeItem(
                'Python environment ready',
                vscode.TreeItemCollapsibleState.None,
                'status',
                undefined,
                new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen')),
                'The CodeXR Python environment is ready to use.',
                'Ready',
                'pythonEnv.ready',
            ),
            new PythonEnvModularTreeItem(
                'Show Python environment status',
                vscode.TreeItemCollapsibleState.None,
                'action',
                {
                    command: 'codeXR.pythonEnv.status',
                    title: 'Show Python environment status',
                },
                new vscode.ThemeIcon('info'),
                'Open detailed information about the current environment',
                'View details',
                'pythonEnv.status',
            ),
            new PythonEnvModularTreeItem(
                'Verify installation',
                vscode.TreeItemCollapsibleState.None,
                'action',
                {
                    command: 'codeXR.pythonEnv.verifyInstallation',
                    title: 'Verify installation',
                },
                new vscode.ThemeIcon('check'),
                'Run a health check for the CodeXR virtual environment and refresh the installed packages snapshot',
                'Health check',
                'pythonEnv.verifyInstallation',
            ),
            new PythonEnvModularTreeItem(
                'Reinitialize Python environment',
                vscode.TreeItemCollapsibleState.None,
                'action',
                {
                    command: 'codeXR.pythonEnv.reinitialize',
                    title: 'Reinitialize Python environment',
                },
                new vscode.ThemeIcon('refresh'),
                'Validate and recreate the environment if something is missing',
                'Rebuild if needed',
                'pythonEnv.reinitialize',
            ),
        ];
    }

    private static getSectionIcon(
        status: PythonEnvStatusSnapshot,
        uiState: PythonEnvUiState,
    ): vscode.ThemeIcon {
        switch (uiState.status) {
            case 'installing':
                return new vscode.ThemeIcon('loading~spin');
            case 'error':
                return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
            case 'ready':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiGreen'));
            default:
                if (!status.exists || !status.isValid) {
                    return new vscode.ThemeIcon('warning');
                }
                return new vscode.ThemeIcon('package');
        }
    }

    private static getSectionDescription(
        status: PythonEnvStatusSnapshot,
        uiState: PythonEnvUiState,
    ): string {
        switch (uiState.status) {
            case 'installing':
                return 'Setting up CodeXR virtual environment';
            case 'error':
                return 'Retry required';
            case 'ready':
                return 'Ready';
            default:
                if (!status.exists) {
                    return 'Environment missing';
                }
                return status.isValid ? 'Ready' : 'Needs repair';
        }
    }
}
