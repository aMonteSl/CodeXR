"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonEnvCommands = void 0;
const vscode = __importStar(require("vscode"));
const venvManager_1 = require("../runtime/venvManager");
/**
 * Python environment command registration and handlers
 */
class PythonEnvCommands {
    venvManager;
    constructor(context) {
        this.venvManager = new venvManager_1.VenvManager(context);
        console.log('PYTHON_ENV: Commands module initialized');
    }
    /**
     * Register all Python environment commands
     */
    register(context) {
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
    async initializeOnStartup() {
        console.log('PYTHON_ENV: Initializing environment on startup...');
        try {
            await this.venvManager.initializeEnvironment();
            console.log('PYTHON_ENV: Startup initialization completed successfully');
        }
        catch (error) {
            console.error('PYTHON_ENV: Startup initialization failed:', error);
            // Don't show error to user on startup - just log it
        }
    }
    /**
     * Get the VenvManager instance for external use
     */
    getVenvManager() {
        return this.venvManager;
    }
    /**
     * Command handler: Create new environment
     */
    async createEnvironment() {
        console.log('PYTHON_ENV: Create environment command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (status.exists && status.isValid) {
                const result = await vscode.window.showWarningMessage('A Python virtual environment already exists. Do you want to recreate it?', 'Recreate Environment', 'Cancel');
                if (result !== 'Recreate Environment') {
                    return;
                }
                // Delete existing environment first
                await this.venvManager.deleteEnvironment();
            }
            await this.venvManager.createEnvironment();
        }
        catch (error) {
            console.error('PYTHON_ENV: Create environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to create environment: ${error}`);
        }
    }
    /**
     * Command handler: Delete environment
     */
    async deleteEnvironment() {
        console.log('PYTHON_ENV: Delete environment command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            if (!status.exists) {
                vscode.window.showInformationMessage('No Python virtual environment exists to delete.');
                return;
            }
            await this.venvManager.deleteEnvironment();
        }
        catch (error) {
            console.error('PYTHON_ENV: Delete environment command failed:', error);
            vscode.window.showErrorMessage(`Failed to delete environment: ${error}`);
        }
    }
    /**
     * Command handler: Show environment status
     */
    async showStatus() {
        console.log('PYTHON_ENV: Status command triggered');
        try {
            const status = this.venvManager.getEnvironmentStatus();
            let message = 'Python Virtual Environment Status:\n\n';
            if (!status.exists) {
                message += '❌ No environment exists\n';
                message += 'Use "Create Python Environment" command to set up a new environment.';
            }
            else {
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
                }
                else {
                    message += `🦎 Lizard: Not available\n`;
                }
                if (!status.isValid) {
                    message += '\n⚠️ Environment is invalid. Consider recreating it.';
                }
            }
            // Show in information message with option to open output channel for details
            const result = await vscode.window.showInformationMessage(message, { modal: true }, 'Show Details');
            if (result === 'Show Details') {
                this.showDetailedStatus(status);
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Status command failed:', error);
            vscode.window.showErrorMessage(`Failed to get environment status: ${error}`);
        }
    }
    /**
     * Command handler: Install package
     */
    async installPackage() {
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
        }
        catch (error) {
            console.error('PYTHON_ENV: Install package command failed:', error);
            vscode.window.showErrorMessage(`Failed to install package: ${error}`);
        }
    }
    /**
     * Command handler: Reinitialize environment
     */
    async reinitializeEnvironment() {
        console.log('PYTHON_ENV: Reinitialize environment command triggered');
        try {
            const result = await vscode.window.showInformationMessage('This will validate and potentially recreate the Python environment. Continue?', 'Reinitialize', 'Cancel');
            if (result !== 'Reinitialize') {
                return;
            }
            await this.venvManager.initializeEnvironment();
            vscode.window.showInformationMessage('Python environment reinitialized successfully!');
        }
        catch (error) {
            console.error('PYTHON_ENV: Reinitialize command failed:', error);
            vscode.window.showErrorMessage(`Failed to reinitialize environment: ${error}`);
        }
    }
    /**
     * Command handler: Verify lizard installation
     */
    async verifyLizard() {
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
                vscode.window.showInformationMessage(`Lizard is installed and working correctly!\n\nCommand: ${lizardCommand}`);
            }
            else {
                const result = await vscode.window.showWarningMessage('Lizard is not working correctly. Would you like to reinstall it?', 'Reinstall Lizard', 'Cancel');
                if (result === 'Reinstall Lizard') {
                    await this.venvManager.installPackage('lizard');
                }
            }
        }
        catch (error) {
            console.error('PYTHON_ENV: Verify lizard command failed:', error);
            vscode.window.showErrorMessage(`Failed to verify lizard: ${error}`);
        }
    }
    /**
     * Show detailed status in output channel
     */
    showDetailedStatus(status) {
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
                status.metadata.dependencies.forEach((dep) => {
                    outputChannel.appendLine(`  ${dep}`);
                });
            }
            else {
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
exports.PythonEnvCommands = PythonEnvCommands;
//# sourceMappingURL=pythonEnvCommands.js.map