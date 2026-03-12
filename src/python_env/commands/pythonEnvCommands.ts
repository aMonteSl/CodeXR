import * as vscode from 'vscode';
import { VenvManager } from '../runtime/venvManager';
import { ExtensionCommandRegistration } from '../../commands/shared';
import { CodeXRLogger } from '../../core/logging/logger';

const logger = CodeXRLogger.getLogger('PYTHON_ENV_COMMANDS');

/**
 * Python environment command registration and handlers.
 */
export class PythonEnvCommands {
    private readonly venvManager: VenvManager;

    constructor(context: vscode.ExtensionContext) {
        this.venvManager = new VenvManager(context);
        logger.debug('Python environment commands initialized.');
    }

    public getCommandRegistrations(): ExtensionCommandRegistration[] {
        return [
            {
                id: 'codeXR.pythonEnv.create',
                module: 'PYTHON_ENV',
                description: 'Create Python environment',
                handler: () => this.createEnvironment(),
                errorMessage: 'Failed to create Python environment',
            },
            {
                id: 'codeXR.pythonEnv.delete',
                module: 'PYTHON_ENV',
                description: 'Delete Python environment',
                handler: () => this.deleteEnvironment(),
                errorMessage: 'Failed to delete Python environment',
            },
            {
                id: 'codeXR.pythonEnv.status',
                module: 'PYTHON_ENV',
                description: 'Show Python environment status',
                handler: () => this.showStatus(),
                errorMessage: 'Failed to get Python environment status',
            },
            {
                id: 'codeXR.pythonEnv.reinitialize',
                module: 'PYTHON_ENV',
                description: 'Reinitialize Python environment',
                handler: () => this.reinitializeEnvironment(),
                errorMessage: 'Failed to reinitialize Python environment',
            },
            {
                id: 'codeXR.pythonEnv.verifyInstallation',
                module: 'PYTHON_ENV',
                description: 'Verify Python environment installation',
                handler: () => this.verifyInstallation(),
                errorMessage: 'Failed to verify Python environment installation',
            },
            {
                id: 'codeXR.pythonEnv.debugFailInstallation',
                module: 'PYTHON_ENV',
                description: 'Force a Python environment installation failure for debugging',
                handler: () => this.debugFailInstallation(),
                errorMessage: 'Failed to simulate Python environment installation failure',
            },
        ];
    }

    public async initializeOnStartup(): Promise<void> {
        logger.info('Initializing Python environment in deferred startup.');

        try {
            await this.venvManager.initializeEnvironment();
            logger.info('Python environment startup verification completed.');
        } catch (error) {
            logger.error('Python environment startup initialization failed.', error);
            await this.showEnvironmentFailure(
                'Python environment initialization failed',
                error,
                true,
            );
        }
    }

    public getVenvManager(): VenvManager {
        return this.venvManager;
    }

    private async createEnvironment(): Promise<void> {
        logger.info('Create environment command triggered.');

        try {
            const status = this.venvManager.getEnvironmentStatus();

            if (status.exists && status.isValid) {
                const result = await vscode.window.showWarningMessage(
                    'A Python virtual environment already exists. Do you want to recreate it?',
                    'Recreate Environment',
                    'Cancel',
                );

                if (result !== 'Recreate Environment') {
                    return;
                }

                await this.venvManager.deleteEnvironment();
            }

            await this.venvManager.createEnvironment();
        } catch (error) {
            logger.error('Create environment command failed.', error);
            await this.showEnvironmentFailure('Failed to create environment', error, true);
        }
    }

    private async deleteEnvironment(): Promise<void> {
        logger.info('Delete environment command triggered.');

        try {
            const status = this.venvManager.getEnvironmentStatus();

            if (!status.exists) {
                vscode.window.showInformationMessage('No Python virtual environment exists to delete.');
                return;
            }

            await this.venvManager.deleteEnvironment();
        } catch (error) {
            logger.error('Delete environment command failed.', error);
            await this.showEnvironmentFailure('Failed to delete environment', error, false);
        }
    }

    private async showStatus(): Promise<void> {
        logger.debug('Status command triggered.');

        try {
            let status = this.venvManager.getEnvironmentStatus();

            if (status.exists && status.isValid) {
                await this.venvManager.refreshEnvironmentMetadata();
                status = this.venvManager.getEnvironmentStatus();
            }

            let message = 'Python Virtual Environment Status:\n\n';

            if (!status.exists) {
                message += 'No environment exists\n';
                message += 'Use "Create Python Environment" to set up a new environment.';
            } else {
                message += status.isValid ? 'Environment is valid and ready\n\n' : 'Environment exists but is invalid\n\n';

                if (status.metadata) {
                    message += `Location: ${status.metadata.venvPath}\n`;
                    message += `Python Version: ${status.metadata.pythonVersion || 'Unknown'}\n`;
                    message += `Created: ${new Date(status.metadata.createdAt).toLocaleString()}\n`;
                    message += `Last Validated: ${new Date(status.metadata.lastValidated).toLocaleString()}\n`;
                    message += `Installed Packages: ${status.metadata.dependencies.length}\n`;
                }

                if (status.stats.venvSize !== undefined) {
                    message += `Environment Size: ~${status.stats.venvSize} MB\n`;
                }

                const pythonPath = this.venvManager.getPythonExecutablePath();
                message += pythonPath
                    ? 'Python Executable: Available\n'
                    : 'Python Executable: Not available\n';

                if (!status.isValid) {
                    message += '\nEnvironment is invalid. Consider recreating it.';
                }
            }

            const result = await vscode.window.showInformationMessage(
                message,
                { modal: true },
                'Show Details',
            );

            if (result === 'Show Details') {
                this.showDetailedStatus(status);
            }
        } catch (error) {
            logger.error('Status command failed.', error);
            await this.showEnvironmentFailure('Failed to get environment status', error, false);
        }
    }

    private async reinitializeEnvironment(): Promise<void> {
        logger.info('Reinitialize environment command triggered.');

        try {
            const result = await vscode.window.showInformationMessage(
                'This will validate and potentially recreate the Python environment. Continue?',
                'Reinitialize',
                'Cancel',
            );

            if (result !== 'Reinitialize') {
                return;
            }

            await this.venvManager.initializeEnvironment();
            vscode.window.showInformationMessage('Python environment reinitialized successfully!');
        } catch (error) {
            logger.error('Reinitialize command failed.', error);
            await this.showEnvironmentFailure('Failed to reinitialize environment', error, true);
        }
    }

    private async verifyInstallation(): Promise<void> {
        logger.info('Verify installation command triggered.');

        try {
            const verification = await this.venvManager.verifyEnvironmentInstallation();
            vscode.window.showInformationMessage(
                `CodeXR verified the Python environment successfully. ${verification.packageCount} package(s) recorded.`,
                { modal: false },
            );
        } catch (error) {
            logger.error('Verify installation command failed.', error);
            await this.showEnvironmentFailure('Failed to verify installation', error, true);
        }
    }

    private async debugFailInstallation(): Promise<void> {
        logger.warn('Debug fail installation command triggered.');

        try {
            const result = await vscode.window.showWarningMessage(
                'This will delete the current CodeXR Python environment and intentionally force the next installation to fail. Continue?',
                { modal: true },
                'Force Failure',
                'Cancel',
            );

            if (result !== 'Force Failure') {
                return;
            }

            await this.venvManager.debugForceInstallationFailure();
        } catch (error) {
            logger.error('Debug fail installation command failed.', error);
            await this.showEnvironmentFailure('Failed to simulate installation failure', error, false);
        }
    }

    private showDetailedStatus(status: ReturnType<VenvManager['getEnvironmentStatus']>): void {
        const outputChannel = vscode.window.createOutputChannel('CodeXR Python Environment Details');

        outputChannel.clear();
        outputChannel.appendLine('=== Python Virtual Environment Details ===\n');
        outputChannel.appendLine(`Environment Exists: ${status.exists}`);
        outputChannel.appendLine(`Environment Valid: ${status.isValid}`);
        outputChannel.appendLine(`State File Exists: ${status.stats.stateExists}`);
        outputChannel.appendLine(`Environment Directory Exists: ${status.stats.envExists}`);

        if (status.stats.venvSize !== undefined) {
            outputChannel.appendLine(`Environment Size: ~${status.stats.venvSize} MB`);
        }

        if (status.metadata) {
            outputChannel.appendLine('\n=== Environment Metadata ===');
            outputChannel.appendLine(`Path: ${status.metadata.venvPath}`);
            outputChannel.appendLine(`Python Version: ${status.metadata.pythonVersion || 'Unknown'}`);
            outputChannel.appendLine(`Created At: ${status.metadata.createdAt}`);
            outputChannel.appendLine(`Last Validated: ${status.metadata.lastValidated}`);
            outputChannel.appendLine(`Is Active: ${status.metadata.isActive}`);
            outputChannel.appendLine('\n=== Installed Packages ===');

            if (status.metadata.dependencies.length > 0) {
                status.metadata.dependencies.forEach((dependency: string) => {
                    outputChannel.appendLine(`  ${dependency}`);
                });
            } else {
                outputChannel.appendLine('  No packages recorded. Run "Verify Installation" to refresh the package snapshot.');
            }
        }

        const pythonPath = this.venvManager.getPythonExecutablePath();
        if (pythonPath) {
            outputChannel.appendLine('\n=== Python Executable ===');
            outputChannel.appendLine(`Path: ${pythonPath}`);
        }

        outputChannel.show();
    }

    private async showEnvironmentFailure(
        title: string,
        error: unknown,
        allowRetry: boolean,
    ): Promise<void> {
        const details = this.getErrorDetails(error);
        const summary = this.getErrorSummary(details);
        const actions = allowRetry
            ? ['Retry Installation', 'Show Details']
            : ['Show Details'];

        const choice = await vscode.window.showErrorMessage(`${title}: ${summary}`, ...actions);

        if (choice === 'Retry Installation') {
            await vscode.commands.executeCommand('codeXR.pythonEnv.reinitialize');
            return;
        }

        if (choice === 'Show Details') {
            await vscode.window.showInformationMessage(details, { modal: true });
        }
    }

    private getErrorDetails(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private getErrorSummary(details: string): string {
        const firstLine = details.split(/\r?\n/).find(line => line.trim().length > 0);
        return firstLine ?? details;
    }
}
