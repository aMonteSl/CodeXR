import * as vscode from 'vscode';

/**
 * Handle server-related click interactions
 */
export class ServerClickHandler {
    
    /**
     * Handle configuration group expansion
     */
    static async handleConfigGroupClick(item: any): Promise<void> {
        console.log('SERVERS: Configuration group clicked, expanding...');
        // Configuration groups are handled automatically by tree expansion
        // Additional logic can be added here if needed
    }
    
    /**
     * Handle server launch option click
     */
    static async handleLaunchServerClick(): Promise<void> {
        console.log('SERVERS: Start Local Server clicked');
        
        try {
            // Execute the server launch command
            await vscode.commands.executeCommand('codexr.server.launch');
            console.log('SERVERS: Server launch command executed successfully');
        } catch (error) {
            console.error('SERVERS: Error launching server:', error);
            vscode.window.showErrorMessage(`Failed to launch server: ${error}`);
        }
    }
    
    /**
     * Handle configuration option clicks
     */
    static async handleConfigOptionClick(optionType: string): Promise<void> {
        console.log(`SERVERS: Configuration option clicked: ${optionType}`);
        
        switch (optionType) {
            case 'http':
            case 'httpMode':
                await vscode.commands.executeCommand('codexr.server.config.httpMode');
                break;
            case 'port':
                await vscode.commands.executeCommand('codexr.server.config.port');
                break;
            case 'autoOpen':
                await vscode.commands.executeCommand('codexr.server.config.autoOpen');
                break;
            case 'openMode':
                await vscode.commands.executeCommand('codexr.server.config.openMode');
                break;
            case 'remoteAccess':
                await vscode.commands.executeCommand('codexr.server.config.remoteAccess');
                break;
            case 'reset':
                await vscode.commands.executeCommand('codexr.server.config.resetToDefault');
                break;
            default:
                console.warn(`SERVERS: Unknown configuration option: ${optionType}`);
        }
    }
}
