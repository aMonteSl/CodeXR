import * as vscode from 'vscode';
import { PythonEnvCommands } from '../../python_env/commands/pythonEnvCommands';
import { ExtensionCommandRegistration } from '../shared';

let pythonEnvCommands: PythonEnvCommands | undefined;

export function getPythonEnvCommandRegistrations(
    context: vscode.ExtensionContext,
): ExtensionCommandRegistration[] {
    pythonEnvCommands = new PythonEnvCommands(context);
    return pythonEnvCommands.getCommandRegistrations();
}

export async function initializePythonEnvOnStartup(): Promise<void> {
    if (!pythonEnvCommands) {
        return;
    }

    await pythonEnvCommands.initializeOnStartup();
}

export function getPythonEnvCommands(): PythonEnvCommands | undefined {
    return pythonEnvCommands;
}

export function deactivatePythonEnvCommands(): void {
    pythonEnvCommands = undefined;
}
