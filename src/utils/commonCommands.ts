import * as vscode from 'vscode';

/**
 * Common commands utility for shared functionality across the extension
 */
export class CommonCommands {
    private static modularTreeProvider: any;
    
    /**
     * Set the modular tree provider for refresh operations
     */
    static setModularTreeProvider(provider: any): void {
        this.modularTreeProvider = provider;
        console.log('COMMON_COMMANDS: Modular tree provider set for refresh operations');
    }
    
    /**
     * Refresh the entire tree view
     * This replaces the legacy 'codexr.servers.refresh' command
     */
    static refreshTreeView(): void {
        console.log('COMMON_COMMANDS: Refreshing tree view');
        
        if (this.modularTreeProvider && typeof this.modularTreeProvider.refresh === 'function') {
            this.modularTreeProvider.refresh();
            console.log('COMMON_COMMANDS: Tree view refreshed successfully');
        } else {
            console.warn('COMMON_COMMANDS: No modular tree provider available for refresh');
            
            // Fallback: try to execute any existing refresh commands
            try {
                vscode.commands.executeCommand('codeXR.modularTree.refresh');
            } catch (error) {
                console.error('COMMON_COMMANDS: Failed to refresh tree view:', error);
            }
        }
    }
    
    /**
     * Legacy method for backward compatibility
     * @deprecated Use refreshTreeView() instead
     */
    static refreshServers(): void {
        console.log('COMMON_COMMANDS: Legacy refresh servers called, delegating to refreshTreeView');
        this.refreshTreeView();
    }
}
