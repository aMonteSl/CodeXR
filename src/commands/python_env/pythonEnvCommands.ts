import * as vscode from 'vscode';
import { PythonEnvCommands } from '../../python_env/commands/pythonEnvCommands';

/**
 * Python Environment Commands Wrapper
 * Re-exports python environment commands for centralized command registration
 */

let pythonEnvCommands: PythonEnvCommands | undefined;

/**
 * Registers all Python environment related commands
 */
export function registerPythonEnvCommands(context: vscode.ExtensionContext): void {
    console.log('PYTHON_ENV: Registering Python environment commands...');

    try {
        // Initialize commands
        pythonEnvCommands = new PythonEnvCommands(context);
        pythonEnvCommands.register(context);

        // Initialize environment on startup
        pythonEnvCommands.initializeOnStartup()
            .then(() => {
                console.log('PYTHON_ENV: Commands registration and initialization completed successfully');
            })
            .catch((error) => {
                console.error('PYTHON_ENV: Initialization failed during command registration:', error);
            });

        console.log('PYTHON_ENV: Python environment commands registered successfully');

    } catch (error) {
        console.error('PYTHON_ENV: Failed to register Python environment commands:', error);
        vscode.window.showErrorMessage(`Failed to initialize Python environment commands: ${error}`);
    }
}

/**
 * Get the PythonEnvCommands instance for external access
 */
export function getPythonEnvCommands(): PythonEnvCommands | undefined {
    return pythonEnvCommands;
}

/**
 * Clean up resources when extension is deactivated
 */
export function deactivatePythonEnvCommands(): void {
    console.log('PYTHON_ENV: Deactivating Python environment commands');
    pythonEnvCommands = undefined;
}
