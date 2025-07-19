import * as vscode from 'vscode';
import { VenvManager } from '../runtime/venvManager';

/**
 * Python environment command registration and handlers
 */
export class PythonEnvCommands {
    private venvManager: VenvManager;

    constructor(context: vscode.ExtensionContext) {
        this.venvManager = new VenvManager(context);
        console.log('PYTHON_ENV: Commands module initialized');
    }

    /**
     * Register all Python environment commands
     */
    public register(context: vscode.ExtensionContext): void {
        console.log('PYTHON_ENV: Registering commands...');

        const commands = [
            vscode.commands.registerCommand('codeXR.pythonEnv.create', () => this.createEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.delete', () => this.deleteEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.status', () => this.showStatus()),
            vscode.commands.registerCommand('codeXR.pythonEnv.installPackage', () => this.installPackage()),
            vscode.commands.registerCommand('codeXR.pythonEnv.reinitialize', () => this.reinitializeEnvironment()),
            vscode.commands.registerCommand('codeXR.pythonEnv.verifyLizard', () => this.verifyLizard())
        ];

        commands.forEach(command => context.subscriptions.push(command));
        
        console.log(`PYTHON_ENV: Registered ${commands.length} commands`);
    }

    /**
     * Initialize the environment (called on extension startup)
     */
    public async initializeOnStartup(): Promise<void> {
        console.log('PYTHON_ENV: Initializing environment on startup...');
        
        try {
            await this.venvManager.initializeEnvironment();
            console.log('PYTHON_ENV: Startup initialization completed successfully');
        } catch (error) {
            console.error('PYTHON_ENV: Startup initialization failed:', error);
            // Don't show error to user on startup - just log it
        }
    }

    /**
     * Get the VenvManager instance for external use
     */
    public getVenvManager(): VenvManager {
        return this.venvManager;
    }

    /**
     * Command handler: Create new environment
     */
    private async createEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Create environment command triggered');

        try {
            const status = this.venvManager.getEnvironmentStatus();
            
            if (status.exists && status.isValid) {
                const result = await vscode.window.showWarningMessage(
                    'A Python virtual environment already exists. Do you want to recreate it?',
                    'Recreate Environment',
                    'Cancel'
                );

                if (result !== 'Recreate Environment') {
                    return;
                }

                // Delete existing environment first
                await this.venvManager.deleteEnvironment();
            }

            await this.venvManager.createEnvironment();

        } catch (error) {
            console.error('PYTHON_ENV: Create environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to create environment: ${error}`);
        }
    }

    /**
     * Command handler: Delete environment
     */
    private async deleteEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Delete environment command triggered');

        try {
            const status = this.venvManager.getEnvironmentStatus();
            
            if (!status.exists) {
                vscode.window.showInformationMessage('No Python virtual environment exists to delete.');
                return;
            }

            await this.venvManager.deleteEnvironment();

        } catch (error) {
            console.error('PYTHON_ENV: Delete environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
        }
    }

    /**
     * Command handler: Show environment status
     */
    private async showStatus(): Promise<void> {
        console.log('PYTHON_ENV: Status command triggered');

        try {
            const status = this.venvManager.getEnvironmentStatus();
            
            let message = 'Python Virtual Environment Status:\n\n';
            
            if (!status.exists) {
                message += '❌ No environment exists\n';
                message += 'Use "Create Python Environment" command to set up a new environment.';
            } else {
                message += status.isValid ? '✅ Environment is valid and ready\n\n' : '❌ Environment exists but is invalid\n\n';
                
                if (status.metadata) {
                    message += `📍 Location: ${status.metadata.venvPath}\n`;
                    message += `🐍 Python Version: ${status.metadata.pythonVersion || 'Unknown'}\n`;
                    message += `📅 Created: ${new Date(status.metadata.createdAt).toLocaleString()}\n`;
                    message += `🔄 Last Validated: ${new Date(status.metadata.lastValidated).toLocaleString()}\n`;
                    message += `📦 Installed Packages: ${status.metadata.dependencies.length}\n`;
                }

                if (status.stats.venvSize !== undefined) {
                    message += `💾 Environment Size: ~${status.stats.venvSize} MB\n`;
                }

                // Check lizard availability
                const lizardCommand = this.venvManager.getLizardCommand();
                if (lizardCommand) {
                    message += `🦎 Lizard: Available\n`;
                } else {
                    message += `🦎 Lizard: Not available\n`;
                }

                if (!status.isValid) {
                    message += '\n⚠️ Environment is invalid. Consider recreating it.';
                }
            }

            // Show in information message with option to open output channel for details
            const result = await vscode.window.showInformationMessage(
                message,
                { modal: true },
                'Show Details'
            );

            if (result === 'Show Details') {
                this.showDetailedStatus(status);
            }

        } catch (error) {
            console.error('PYTHON_ENV: Status command failed:', error);
            vscode.window.showErrorMessage(`Failed to get environment status: ${error}`);
        }
    }

    /**
     * Command handler: Install package
     */
    private async installPackage(): Promise<void> {
        console.log('PYTHON_ENV: Install package command triggered');

        try {
            const status = this.venvManager.getEnvironmentStatus();
            
            if (!status.exists || !status.isValid) {
                vscode.window.showErrorMessage('No valid Python environment exists. Create one first.');
                return;
            }

            const packageName = await vscode.window.showInputBox({
                prompt: 'Enter the name of the Python package to install',
                placeHolder: 'e.g., numpy, pandas, matplotlib',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Package name cannot be empty';
                    }
                    // Basic validation for package name
                    if (!/^[a-zA-Z0-9\-_.]+$/.test(value.trim())) {
                        return 'Invalid package name. Use letters, numbers, hyphens, underscores, and dots only.';
                    }
                    return null;
                }
            });

            if (!packageName) {
                return;
            }

            await this.venvManager.installPackage(packageName.trim());

        } catch (error) {
            console.error('PYTHON_ENV: Install package command failed:', error);
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }

    /**
     * Command handler: Reinitialize environment
     */
    private async reinitializeEnvironment(): Promise<void> {
        console.log('PYTHON_ENV: Reinitialize environment command triggered');

        try {
            const result = await vscode.window.showInformationMessage(
                'This will validate and potentially recreate the Python environment. Continue?',
                'Reinitialize',
                'Cancel'
            );

            if (result !== 'Reinitialize') {
                return;
            }

            await this.venvManager.initializeEnvironment();
            vscode.window.showInformationMessage('Python environment reinitialized successfully!');

        } catch (error) {
            console.error('PYTHON_ENV: Reinitialize command failed:', error);
            vscode.window.showErrorMessage(`Failed to reinitialize environment: ${error}`);
        }
    }

    /**
     * Command handler: Verify lizard installation
     */
    private async verifyLizard(): Promise<void> {
        console.log('PYTHON_ENV: Verify lizard command triggered');

        try {
            const status = this.venvManager.getEnvironmentStatus();
            
            if (!status.exists || !status.isValid) {
                vscode.window.showErrorMessage('No valid Python environment exists. Create one first.');
                return;
            }

            const isLizardWorking = await this.venvManager.verifyLizardInstallation();
            
            if (isLizardWorking) {
                const lizardCommand = this.venvManager.getLizardCommand();
                vscode.window.showInformationMessage(
                    `Lizard is installed and working correctly!\n\nCommand: ${lizardCommand}`
                );
            } else {
                const result = await vscode.window.showWarningMessage(
                    'Lizard is not working correctly. Would you like to reinstall it?',
                    'Reinstall Lizard',
                    'Cancel'
                );

                if (result === 'Reinstall Lizard') {
                    await this.venvManager.installPackage('lizard');
                }
            }

        } catch (error) {
            console.error('PYTHON_ENV: Verify lizard command failed:', error);
            vscode.window.showErrorMessage(`Failed to verify lizard: ${error}`);
        }
    }

    /**
     * Show detailed status in output channel
     */
    private showDetailedStatus(status: any): void {
        const outputChannel = vscode.window.createOutputChannel('Python Environment Details');
        
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
                status.metadata.dependencies.forEach((dep: string) => {
                    outputChannel.appendLine(`  ${dep}`);
                });
            } else {
                outputChannel.appendLine('  No packages recorded');
            }
        }
        
        const pythonPath = this.venvManager.getPythonExecutablePath();
        if (pythonPath) {
            outputChannel.appendLine(`\n=== Python Executable ===`);
            outputChannel.appendLine(`Path: ${pythonPath}`);
        }
        
        outputChannel.show();
    }
}
