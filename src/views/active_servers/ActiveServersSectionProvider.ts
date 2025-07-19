import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { ActiveServerTreeItem, ActiveServerItemFactory } from './items/activeServerItems';
import { ActiveServerClickHandler } from './interactions/handleActiveServerClicks';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';

/**
 * Active Servers section provider - manages running servers display and control
 */
export class ActiveServersSectionProvider implements SectionProvider<ActiveServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ActiveServerTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<ActiveServerTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<ActiveServerTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: ActiveServerClickHandler;

    constructor(private context: vscode.ExtensionContext) {
        console.log('ACTIVE_SERVERS_MODULAR: Initializing Active Servers section provider');
        this.clickHandler = new ActiveServerClickHandler(context);
        
        // Listen to registry changes for active servers
        const registry = getActiveServerRegistry();
        console.log(`ACTIVE_SERVERS_MODULAR: Connected to active server registry, current servers: ${registry.getAllServers().length}`);
        
        registry.onRegistryChange(() => {
            console.log('ACTIVE_SERVERS_MODULAR: Active servers registry changed, refreshing section');
            this.refresh();
        });
    }

    /**
     * Get the section name for identification
     */
    getSectionName(): string {
        return 'activeServers';
    }

    /**
     * Get the section header item
     */
    getSectionItem(): ActiveServerTreeItem {
        const registry = getActiveServerRegistry();
        const activeServers = registry.getAllServers();
        const runningCount = activeServers.filter(server => server.status === 'running').length;
        
        const title = runningCount > 0 
            ? `ACTIVE SERVERS (${runningCount} running)` 
            : 'ACTIVE SERVERS';
        
        return new ActiveServerTreeItem(
            title,
            vscode.TreeItemCollapsibleState.Expanded,
            'no-servers', // Using this as section header type
            undefined,
            new vscode.ThemeIcon('server-process'),
            'Currently running servers',
            undefined,
            'activeServersSection'
        );
    }

    /**
     * Get children items for the Active Servers section
     */
    async getChildren(element?: ActiveServerTreeItem): Promise<ActiveServerTreeItem[]> {
        // If element is provided, it means we're getting children for a specific item
        // For the Active Servers section, we only have flat items, so return empty for sub-items
        if (element) {
            return [];
        }

        console.log('ACTIVE_SERVERS_MODULAR: Loading active servers section children');
        
        const registry = getActiveServerRegistry();
        const activeServers = registry.getAllServers();
        const runningServers = activeServers.filter(server => server.status === 'running');

        console.log(`ACTIVE_SERVERS_MODULAR: Found ${activeServers.length} total servers, ${runningServers.length} running`);
        
        // Show "No active servers" message if no servers exist
        if (activeServers.length === 0) {
            console.log('ACTIVE_SERVERS_MODULAR: No servers found, showing "No active servers" message');
            return [ActiveServerItemFactory.createNoServersItem()];
        }

        const children: ActiveServerTreeItem[] = [];

        // Add "Stop All Servers" option if there are 2 or more running servers
        if (runningServers.length >= 2) {
            console.log(`ACTIVE_SERVERS_MODULAR: Adding "Stop All Servers" option for ${runningServers.length} running servers`);
            children.push(ActiveServerItemFactory.createStopAllServersItem(runningServers.length));
        }

        // Add individual server items
        console.log(`ACTIVE_SERVERS_MODULAR: Creating ${activeServers.length} individual server items`);
        const serverItems = activeServers.map(server => 
            ActiveServerItemFactory.createServerItem(server)
        );

        children.push(...serverItems);
        
        console.log(`ACTIVE_SERVERS_MODULAR: Returning ${children.length} children for Active Servers section`);
        return children;
    }

    /**
     * Refresh the section
     */
    refresh(): void {
        console.log('ACTIVE_SERVERS_MODULAR: Refreshing Active Servers section');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item: ActiveServerTreeItem): Promise<void> {
        await this.clickHandler.handleActiveServerClick(item);
    }

    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action: string, item: ActiveServerTreeItem): Promise<void> {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
}
