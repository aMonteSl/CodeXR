import * as vscode from 'vscode';
import { BaseSectionProvider } from '../common/baseInterfaces';
import { ServerTreeItem, ServerItemFactory } from './items/serverItems';
import { ServerClickHandler } from './interactions/handleServerClicks';
import { ServerSettingsManager } from '../../servers/storage/serverSettingsManager';

/**
 * Servers section provider for the modular tree view architecture
 */
export class ServersSectionProvider extends BaseSectionProvider<ServerTreeItem> {
    constructor(context: vscode.ExtensionContext) {
        super(context);
        console.log('SERVERS: Servers section provider initialized');
    }

    getSectionName(): string {
        return 'SERVERS';
    }

    getSectionItem(): ServerTreeItem {
        console.log('SERVERS: Creating main SERVERS section item');
        
        return new ServerTreeItem(
            'SERVERS',
            vscode.TreeItemCollapsibleState.Expanded,
            'config-group',
            undefined,
            new vscode.ThemeIcon('server-environment'),
            'Server configuration and launch options'
        );
    }

    /**
     * Get children for the servers section
     */
    async getChildren(element?: ServerTreeItem): Promise<ServerTreeItem[]> {
        if (!element) {
            // Return main section children
            console.log('SERVERS: Loading main servers section children');
            return this.getMainSectionChildren();
        }

        // Handle sub-items based on type
        switch (element.serverItemType) {
            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getConfigurationChildren();
                }
                break;
            default:
                return [];
        }

        return [];
    }

    /**
     * Get main section children
     */
    private getMainSectionChildren(): ServerTreeItem[] {
        console.log('SERVERS: Creating main section children');
        
        // Get current server configuration for the start server option
        const port = this.getServerPort();
        const httpMode = this.getHttpMode();
        
        return [
            ServerItemFactory.createConfigurationGroup(),
            ServerItemFactory.createStartServerOption(port, httpMode)
        ];
    }

    /**
     * Get configuration children
     */
    private getConfigurationChildren(): ServerTreeItem[] {
        console.log('SERVERS: Creating configuration children');
        return ServerItemFactory.createConfigurationOptions();
    }

    /**
     * Get current server port from configuration
     */
    private getServerPort(): number {
        const config = ServerSettingsManager.getInstance().getLegacyConfig();
        return config.port;
    }

    /**
     * Get current HTTP mode from configuration
     */
    private getHttpMode(): string {
        const config = ServerSettingsManager.getInstance().getLegacyConfig();
        return config.httpMode;
    }

    /**
     * Handle tree item clicks
     */
    async handleItemClick(item: ServerTreeItem): Promise<void> {
        console.log(`SERVERS: Item clicked: ${item.label} (type: ${item.serverItemType})`);
        
        switch (item.serverItemType) {
            case 'config-group':
                await ServerClickHandler.handleConfigGroupClick(item);
                break;
            case 'launch-option':
                await ServerClickHandler.handleLaunchServerClick();
                break;
            case 'config-option':
                const labelStr = typeof item.label === 'string' ? item.label : item.label?.label || '';
                const optionType = this.getConfigOptionType(labelStr);
                await ServerClickHandler.handleConfigOptionClick(optionType);
                break;
        }
    }

    /**
     * Determine configuration option type from label
     */
    private getConfigOptionType(label: string): string {
        if (label.includes('HTTP Mode')) {
            return 'httpMode';
        }
        if (label.includes('Port')) {
            return 'port';
        }
        if (label.includes('Auto-Open')) {
            return 'autoOpen';
        }
        if (label.includes('Open Mode')) {
            return 'openMode';
        }
        if (label.includes('Reset')) {
            return 'reset';
        }
        return 'unknown';
    }
}
