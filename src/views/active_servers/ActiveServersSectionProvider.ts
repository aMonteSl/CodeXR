import * as vscode from 'vscode';
import { SectionProvider } from '../common/baseInterfaces';
import { ActiveServerTreeItem, ActiveServerItemFactory } from './items/activeServerItems';
import { ActiveServerClickHandler } from './interactions/handleActiveServerClicks';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ActiveServer } from '../../active_servers/model/activeServerModel';
import { ConnectedParticipantSummary } from '../../collaboration';

interface ParticipantAwareServer {
    getConnectedParticipants(): ConnectedParticipantSummary[];
    onConnectedParticipantsChanged(
        listener: (participants: ConnectedParticipantSummary[]) => void,
    ): () => void;
}

/**
 * Active Servers section provider - manages running servers display and control
 */
export class ActiveServersSectionProvider implements SectionProvider<ActiveServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ActiveServerTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<ActiveServerTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<ActiveServerTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private clickHandler: ActiveServerClickHandler;
    private readonly participantSubscriptions = new Map<string, () => void>();
    private readonly registrySubscription: vscode.Disposable;

    constructor(private context: vscode.ExtensionContext) {
        console.log('ACTIVE_SERVERS_MODULAR: Initializing Active Servers section provider');
        this.clickHandler = new ActiveServerClickHandler(context);
        
        // Listen to registry changes for active servers
        const registry = getActiveServerRegistry();
        console.log(`ACTIVE_SERVERS_MODULAR: Connected to active server registry, current servers: ${registry.getAllServers().length}`);
        
        this.registrySubscription = registry.onRegistryChange(() => {
            console.log('ACTIVE_SERVERS_MODULAR: Active servers registry changed, refreshing section');
            this.reconcileParticipantSubscriptions();
            this.refresh();
        });
        this.reconcileParticipantSubscriptions();
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
        if (element) {
            const server = element.activeServer;
            if (!server) {
                return [];
            }
            const participants = this.getParticipants(server);
            if (element.activeServerItemType === 'server-item') {
                return ActiveServerItemFactory.createServerChildren(server, participants);
            }
            if (element.activeServerItemType === 'participants-group') {
                return ActiveServerItemFactory.createParticipantItems(server, participants);
            }
            if (element.activeServerItemType === 'actions-group') {
                return ActiveServerItemFactory.createActionItems(server);
            }
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

    dispose(): void {
        this.registrySubscription.dispose();
        for (const dispose of this.participantSubscriptions.values()) {
            dispose();
        }
        this.participantSubscriptions.clear();
        this._onDidChangeTreeData.dispose();
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

    private getParticipants(server: ActiveServer): ConnectedParticipantSummary[] {
        const runtime = this.asParticipantAwareServer(server);
        return runtime?.getConnectedParticipants() || [];
    }

    private reconcileParticipantSubscriptions(): void {
        const servers = getActiveServerRegistry().getAllServers();
        const activeIds = new Set(servers.map((server) => server.id));
        for (const [serverId, dispose] of this.participantSubscriptions) {
            if (!activeIds.has(serverId)) {
                dispose();
                this.participantSubscriptions.delete(serverId);
            }
        }
        for (const server of servers) {
            if (this.participantSubscriptions.has(server.id)) {
                continue;
            }
            const runtime = this.asParticipantAwareServer(server);
            if (!runtime) {
                continue;
            }
            const dispose = runtime.onConnectedParticipantsChanged(() => this.refresh());
            this.participantSubscriptions.set(server.id, dispose);
        }
    }

    private asParticipantAwareServer(server: ActiveServer): ParticipantAwareServer | null {
        const runtime = server.serverInstance as Partial<ParticipantAwareServer> | undefined;
        return runtime
            && typeof runtime.getConnectedParticipants === 'function'
            && typeof runtime.onConnectedParticipantsChanged === 'function'
            ? runtime as ParticipantAwareServer
            : null;
    }
}
