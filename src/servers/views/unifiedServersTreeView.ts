import * as vscode from 'vscode';
import { getServerConfig } from './items/configurationItems';
import { createConfigurationItems } from './items/configurationItems';
import { ServerNodeIcons } from './items/serverNodeIcons';

type ServerTreeItemType = 'section' | 'config-group' | 'config-option' | 'launch-option';

/**
 * Server tree item that represents server configuration and launch options
 * This class is specific to the servers section only
 */
export class ServerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: ServerTreeItemType,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string,
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Servers tree data provider that handles only the SERVERS section
 *
 * Architecture Notes:
 * - This view is specific to server configuration and launch
 * - Follows the modular architecture pattern with items/ and interactions/ directories
 * - Delegates to appropriate handlers for user interactions
 * - Refresh commands are registered centrally through src/commands/index.ts
 */
export class ServersTreeDataProvider implements vscode.TreeDataProvider<ServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ServerTreeItem | undefined | null | void> =
        new vscode.EventEmitter<ServerTreeItem | undefined | null | void>();

    readonly onDidChangeTreeData: vscode.Event<ServerTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext) {
        console.log('SERVERS_TREE: Servers tree data provider initialized');
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        console.log('SERVERS_TREE: Refreshing servers tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: ServerTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the tree view
     */
    getChildren(element?: ServerTreeItem): Thenable<ServerTreeItem[]> {
        if (!element) {
            // Root level - return the SERVERS section
            console.log('SERVERS_TREE: Loading root SERVERS section');

            return Promise.resolve([
                new ServerTreeItem(
                    'SERVERS',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('server-environment'),
                    'Server configuration and launch options',
                ),
            ]);
        }

        switch (element.type) {
            case 'section':
                if (element.label === 'SERVERS') {
                    return this.getServersChildren();
                }
                break;

            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getServerConfigChildren();
                }
                break;

            default:
                return Promise.resolve([]);
        }

        return Promise.resolve([]);
    }

    /**
     * Get children for the SERVERS section
     */
    private getServersChildren(): Thenable<ServerTreeItem[]> {
        console.log('SERVERS_TREE: Loading servers section children');
        const config = getServerConfig();

        return Promise.resolve([
            new ServerTreeItem(
                'Server Configuration',
                vscode.TreeItemCollapsibleState.Collapsed,
                'config-group',
                undefined,
                ServerNodeIcons.configuration,
                'Configure server settings',
            ),
            new ServerTreeItem(
                'Start Local Server',
                vscode.TreeItemCollapsibleState.None,
                'launch-option',
                {
                    command: 'codexr.server.launch',
                    title: 'Start Local Server',
                },
                ServerNodeIcons.startServer,
                `Start server on port ${config.port} (${config.httpMode})`,
            ),
        ]);
    }

    /**
     * Get children for the server configuration group
     */
    private getServerConfigChildren(): Thenable<ServerTreeItem[]> {
        console.log('SERVERS_TREE: Loading server configuration children');
        const configItems = createConfigurationItems();

        const children: ServerTreeItem[] = configItems.map(item =>
            new ServerTreeItem(
                item.label,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                item.command,
                item.iconPath,
                item.tooltip,
                item.description,
            ),
        );

        return Promise.resolve(children);
    }
}
