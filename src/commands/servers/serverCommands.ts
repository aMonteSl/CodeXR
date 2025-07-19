import * as vscode from 'vscode';
import { 
    configureServer, 
    startLocalServer, 
    configureHttpMode, 
    configurePort, 
    toggleAutoOpen, 
    configureOpenMode,
    resetToDefault,
    setExtensionContext 
} from '../../servers/commands/serverCommands';

/**
 * Registers all server-related commands
 */
export function registerServerCommands(context: vscode.ExtensionContext): void {
    console.log('SERVER: Registering server commands');
    
    // Set the extension context for server commands
    setExtensionContext(context);
    
    // Main server commands
    const configureServerCommand = vscode.commands.registerCommand('codexr.server.configure', configureServer);
    const startLocalServerCommand = vscode.commands.registerCommand('codexr.server.launch', startLocalServer);
    
    // Configuration option commands (UI stubs)
    const configureHttpModeCommand = vscode.commands.registerCommand('codexr.server.config.httpMode', configureHttpMode);
    const configurePortCommand = vscode.commands.registerCommand('codexr.server.config.port', configurePort);
    const toggleAutoOpenCommand = vscode.commands.registerCommand('codexr.server.config.autoOpen', toggleAutoOpen);
    const configureOpenModeCommand = vscode.commands.registerCommand('codexr.server.config.openMode', configureOpenMode);
    const resetToDefaultCommand = vscode.commands.registerCommand('codexr.server.config.resetToDefault', resetToDefault);
    
    context.subscriptions.push(
        configureServerCommand,
        startLocalServerCommand,
        configureHttpModeCommand,
        configurePortCommand,
        toggleAutoOpenCommand,
        configureOpenModeCommand,
        resetToDefaultCommand
    );
    
    console.log('SERVER: Server commands registered successfully');
}
