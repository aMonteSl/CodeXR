import * as vscode from 'vscode';
import { CodeXRLogger } from '../core/logging/logger';

const logger = CodeXRLogger.getLogger('COMMON_COMMANDS');

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
    }

    /**
     * Refresh the entire tree view
     * This replaces the legacy 'codexr.servers.refresh' command
     */
    static refreshTreeView(): void {
        if (this.modularTreeProvider && typeof this.modularTreeProvider.refresh === 'function') {
            this.modularTreeProvider.refresh();
            return;
        }

        logger.warn('No modular tree provider available for refresh. Falling back to command execution.');
        try {
            void vscode.commands.executeCommand('codeXR.modularTree.refresh');
        } catch (error) {
            logger.error('Failed to refresh tree view.', error);
        }
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use refreshTreeView() instead
     */
    static refreshServers(): void {
        this.refreshTreeView();
    }
}
