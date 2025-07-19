import * as vscode from 'vscode';
import { PythonEnvCommands } from './commands/pythonEnvCommands';

/**
 * Entry point for the Python environment module
 */

let pythonEnvCommands: PythonEnvCommands | undefined;

/**
 * Register Python environment functionality
 */
export function register(context: vscode.ExtensionContext): void {
    console.log('PYTHON_ENV: Registering Python environment module...');

    try {
        // Initialize commands
        pythonEnvCommands = new PythonEnvCommands(context);
        pythonEnvCommands.register(context);

        // Initialize environment on startup
        pythonEnvCommands.initializeOnStartup()
            .then(() => {
                console.log('PYTHON_ENV: Module registration and initialization completed successfully');
            })
            .catch((error) => {
                console.error('PYTHON_ENV: Initialization failed during registration:', error);
            });

        console.log('PYTHON_ENV: Python environment module registered successfully');

    } catch (error) {
        console.error('PYTHON_ENV: Failed to register Python environment module:', error);
        vscode.window.showErrorMessage(`Failed to initialize Python environment module: ${error}`);
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
export function deactivate(): void {
    console.log('PYTHON_ENV: Deactivating Python environment module');
    pythonEnvCommands = undefined;
}
