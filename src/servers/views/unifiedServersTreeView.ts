import * as vscode from 'vscode';
import { getCurrentServerConfig, LegacyServerConfig } from '../commands/serverCommands';
import { createConfigurationItems, getServerConfig } from './items/configurationItems';
import { ServerNodeIcons } from './items/serverNodeIcons';
import { ActiveServer } from '../../active_servers/model/activeServerModel';
import { getActiveServerRegistry } from '../../active_servers/registry/activeServerRegistry';
import { ExampleLauncher } from '../../babia_examples/runtime/exampleLauncher';
import { BabiaExample } from '../../babia_examples/model/babiaExampleModel';
import { ExampleIcons } from '../../babia_examples/views/items/exampleItems';
import { VisualizeDataItemFactory, VisualizeDataTreeItem } from '../../visualize_data/views/items/visualizeDataItems';
import { VisualizeDataStateManager } from '../../visualize_data/state/visualizeDataState';
import { VisualizationRestorer, StoredVisualization } from '../../visualize_data/runtime/visualizationRestorer';
import { BrowseVisualizationItemFactory } from '../../visualize_data/views/items/visualizationItem';
import { VisualizationSettingsItemFactory, VisualizationSettingsTreeItem } from '../../visualization_settings/views/items/visualizationSettingsItems';
import { VisualizationSettingsStorage } from '../../visualization_settings/storage/settingsStorage';
import { CodeAnalysisTreeDataProvider } from '../../code_analysis/views/codeAnalysisTreeView';
import { CodeAnalysisTreeItem } from '../../code_analysis/views/items/analysisTreeItems';

type UnifiedTreeItemType = 'section' | 'group' | 'option' | 'config-group' | 'config-option' | 'active-server' | 'babia-example' | 'visualize-data-item' | 'visualize-data-dimension-mapping' | 'visualize-data-dimension-item' | 'visualize-data-browse-visualizations' | 'visualization-settings-item' | 'code-analysis-item';

/**
 * Unified tree item that represents server configuration, active servers, Babia examples, visualize data, code analysis, and visualization settings
 */
export class UnifiedServerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: UnifiedTreeItemType,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        public readonly tooltip?: string,
        public readonly description?: string,
        public readonly contextValue?: string,
        public readonly activeServer?: ActiveServer,
        public readonly babiaExample?: BabiaExample,
        public readonly visualizeDataItem?: VisualizeDataTreeItem,
        public readonly visualizationSettingsItem?: VisualizationSettingsTreeItem,
        public readonly codeAnalysisItem?: CodeAnalysisTreeItem
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip || this.label;
        this.iconPath = iconPath;
        this.description = description;
        this.contextValue = contextValue;
    }
}

/**
 * Unified tree data provider that combines SERVERS, ACTIVE SERVERS, BABIA EXAMPLES, VISUALIZE DATA, CODE ANALYSIS, and VISUALIZATION SETTINGS sections
 * 
 * Architecture Notes:
 * - This view is read-only from the active servers registry
 * - Server launches are handled by launcher services that use ServerRegistrar
 * - Registry changes trigger UI updates via event listeners
 * - UI does not directly modify server state or call server launch functions
 */
export class UnifiedServersTreeDataProvider implements vscode.TreeDataProvider<UnifiedServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<UnifiedServerTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<UnifiedServerTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<UnifiedServerTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private exampleLauncher: ExampleLauncher;
    private visualizationSettingsStorage: VisualizationSettingsStorage;
    private visualizationRestorer: VisualizationRestorer;
    private codeAnalysisProvider: CodeAnalysisTreeDataProvider;

    constructor(private context: vscode.ExtensionContext) {
        console.log('UNIFIED_SERVERS: Unified tree data provider initialized');
        
        // Initialize example launcher
        this.exampleLauncher = new ExampleLauncher(context);
        console.log('UNIFIED_SERVERS: Example launcher initialized');
        
        // Initialize visualization settings storage
        this.visualizationSettingsStorage = new VisualizationSettingsStorage(context);
        console.log('UNIFIED_SERVERS: Visualization settings storage initialized');
        
        // Initialize visualization restorer
        this.visualizationRestorer = new VisualizationRestorer(context);
        console.log('UNIFIED_SERVERS: Visualization restorer initialized');
        
        // Initialize code analysis provider
        this.codeAnalysisProvider = new CodeAnalysisTreeDataProvider(context);
        console.log('UNIFIED_SERVERS: Code analysis provider initialized');
        
        // Listen to registry changes for active servers
        const registry = getActiveServerRegistry();
        console.log(`UNIFIED_SERVERS: Connected to active server registry, current servers: ${registry.getAllServers().length}`);
        
        registry.onRegistryChange(() => {
            console.log('UNIFIED_SERVERS: Active servers registry changed, refreshing tree view');
            this.refresh();
        });
        
        // Register refresh command (only if not already registered)
        try {
            vscode.commands.registerCommand('codexr.servers.refresh', () => {
                this.refresh();
            });
        } catch (error) {
            // Command might already be registered, ignore this error
            console.log('UNIFIED_SERVERS: Refresh command already registered');
        }
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        console.log('UNIFIED_SERVERS: Refreshing unified tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: UnifiedServerTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the tree view
     */
    getChildren(element?: UnifiedServerTreeItem): Thenable<UnifiedServerTreeItem[]> {
        if (!element) {
            // Root level - return the main sections including CODE ANALYSIS
            console.log('UNIFIED_SERVERS: Loading root sections including Babia Examples, Visualize Data, Code Analysis, and Visualization Settings');
            
            // Get active server count for dynamic title
            const registry = getActiveServerRegistry();
            const activeServers = registry.getAllServers();
            const runningCount = activeServers.filter(server => server.status === 'running').length;
            const activeServersTitle = runningCount > 0 
                ? `ACTIVE SERVERS (${runningCount} running)` 
                : 'ACTIVE SERVERS';
            
            return Promise.resolve([
                new UnifiedServerTreeItem(
                    'SERVERS',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('server-environment'),
                    'Server configuration and launch options'
                ),
                new UnifiedServerTreeItem(
                    activeServersTitle,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('server-process'),
                    'Currently running servers'
                ),
                new UnifiedServerTreeItem(
                    'BABIA EXAMPLES',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('library'),
                    'Interactive visualization examples'
                ),
                new UnifiedServerTreeItem(
                    'VISUALIZE DATA',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('chart-scatter'),
                    'Data visualization configuration and launch'
                ),
                new UnifiedServerTreeItem(
                    'CODE ANALYSIS',
                    vscode.TreeItemCollapsibleState.Expanded, // ✅ Expanded by default
                    'section',
                    undefined,
                    new vscode.ThemeIcon('search-details'),
                    'Code analysis tools and metrics'
                ),
                new UnifiedServerTreeItem(
                    'VISUALIZATION SETTINGS',
                    vscode.TreeItemCollapsibleState.Collapsed,
                    'section',
                    undefined,
                    new vscode.ThemeIcon('settings-gear'),
                    'Configure visualization rendering preferences'
                )
            ]);
        }

        switch (element.type) {
            case 'section':
                if (element.label === 'SERVERS') {
                    return this.getServersChildren();
                } else if (element.label?.includes('ACTIVE SERVERS')) {
                    return this.getActiveServersChildren();
                } else if (element.label === 'BABIA EXAMPLES') {
                    return this.getBabiaExamplesChildren();
                } else if (element.label === 'VISUALIZE DATA') {
                    return this.getVisualizeDataChildren();
                } else if (element.label === 'CODE ANALYSIS') {
                    return this.getCodeAnalysisChildren();
                } else if (element.label === 'VISUALIZATION SETTINGS') {
                    return this.getVisualizationSettingsChildren();
                }
                break;

            case 'config-group':
                if (element.label === 'Server Configuration') {
                    return this.getServerConfigChildren();
                }
                break;

            case 'visualize-data-dimension-mapping':
                if (element.label === 'Dimension Mapping') {
                    return this.getDimensionMappingChildren();
                }
                break;

            case 'visualize-data-browse-visualizations':
                if (element.label === 'Browse Visualizations') {
                    return this.getBrowseVisualizationsChildren();
                }
                break;

            case 'code-analysis-item':
                // Delegate to the code analysis provider for sub-items
                if (element.codeAnalysisItem) {
                    return this.getCodeAnalysisSubItems(element.codeAnalysisItem);
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
    private getServersChildren(): Thenable<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading servers section children');
        const config = getServerConfig();
        
        return Promise.resolve([
            new UnifiedServerTreeItem(
                'Server Configuration',
                vscode.TreeItemCollapsibleState.Collapsed,
                'config-group',
                undefined,
                ServerNodeIcons.configuration,
                'Configure server settings'
            ),
            new UnifiedServerTreeItem(
                'Start Local Server',
                vscode.TreeItemCollapsibleState.None,
                'option',
                {
                    command: 'codexr.server.launch',
                    title: 'Start Local Server'
                },
                ServerNodeIcons.startServer,
                `Start server on port ${config.port} (${config.httpMode})`
            )
        ]);
    }

    /**
     * Get children for the server configuration group
     */
    private getServerConfigChildren(): Thenable<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading server configuration children');
        const configItems = createConfigurationItems();

        const children: UnifiedServerTreeItem[] = configItems.map(item => 
            new UnifiedServerTreeItem(
                item.label,
                vscode.TreeItemCollapsibleState.None,
                'config-option',
                item.command,
                item.iconPath,
                item.tooltip,
                item.description
            )
        );

        return Promise.resolve(children);
    }

    /**
     * Get children for the ACTIVE SERVERS section
     */
    private getActiveServersChildren(): Thenable<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading active servers section children');
        const registry = getActiveServerRegistry();
        const activeServers = registry.getAllServers();
        const runningServers = activeServers.filter(server => server.status === 'running');

        console.log(`UNIFIED_SERVERS: Found ${activeServers.length} total servers, ${runningServers.length} running`);
        
        if (activeServers.length === 0) {
            console.log('UNIFIED_SERVERS: No servers found, showing "No active servers" message');
            return Promise.resolve([
                new UnifiedServerTreeItem(
                    'No active servers',
                    vscode.TreeItemCollapsibleState.None,
                    'option',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    'No servers are currently running'
                )
            ]);
        }

        const children: UnifiedServerTreeItem[] = [];

        // Add "Stop All Servers" option if there are 2 or more running servers
        if (runningServers.length >= 2) {
            console.log(`UNIFIED_SERVERS: Adding "Stop All Servers" option for ${runningServers.length} running servers`);
            children.push(
                new UnifiedServerTreeItem(
                    'Stop All Servers',
                    vscode.TreeItemCollapsibleState.None,
                    'option',
                    {
                        command: 'codeXR.activeServers.stopAllServers',
                        title: 'Stop All Servers'
                    },
                    ServerNodeIcons.stopAll,
                    `Stop all ${runningServers.length} running servers`,
                    undefined,
                    'stopAllServers'
                )
            );
        }

        // Add individual server items - create directly as UnifiedServerTreeItems
        console.log(`UNIFIED_SERVERS: Creating ${activeServers.length} individual server items`);
        const serverItems = activeServers.map(server => {
            // Use custom name if provided, otherwise fallback to localhost:port
            const label = server.customName?.trim() || `localhost:${server.port}`;
            console.log(`UNIFIED_SERVERS: Creating server item with label: "${label}" (customName: "${server.customName}", port: ${server.port})`);
            
            const description = this.getServerDescription(server);
            const icon = this.getServerIcon(server);
            const tooltip = this.getServerTooltip(server);
            
            console.log(`UNIFIED_SERVERS: Creating server item: ${label} (${description})`);
            
            // Create command to show server actions on left-click
            const command: vscode.Command = {
                command: 'codeXR.activeServers.showActions',
                title: 'Show Server Actions',
                arguments: [server.id]
            };
            
            // Set context value based on certificate mode for conditional menu items
            const contextValue = server.certMode === 'http' ? 'activeServerHttp' : 'activeServerHttps';
            
            return new UnifiedServerTreeItem(
                label,
                vscode.TreeItemCollapsibleState.None,
                'active-server',
                command,
                icon,
                tooltip,
                description,
                contextValue, // Context value for menu items
                server
            );
        });

        children.push(...serverItems);
        
        console.log(`UNIFIED_SERVERS: Returning ${children.length} children for ACTIVE SERVERS section`);
        return Promise.resolve(children);
    }

    /**
     * Get server description based on launch mode
     * @private
     */
    private getServerDescription(server: ActiveServer): string {
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status === 'running' ? '' : ` (${server.status})`;
        return `${mode}${status}`;
    }

    /**
     * Get server icon based on certificate mode and status
     * @private
     */
    private getServerIcon(server: ActiveServer): vscode.ThemeIcon {
        // Base icon selection based on cert mode
        let iconName: string;
        
        switch (server.certMode) {
            case 'https-default':
            case 'https-custom':
                iconName = 'shield';
                break;
            case 'http':
            default:
                iconName = 'globe';
                break;
        }

        // Add status indicator if not running
        if (server.status !== 'running') {
            iconName = 'error';
        }

        return new vscode.ThemeIcon(iconName);
    }

    /**
     * Get server tooltip with detailed information
     * @private
     */
    private getServerTooltip(server: ActiveServer): string {
        const protocol = server.certMode === 'http' ? 'HTTP' : 'HTTPS';
        const mode = server.launchMode === 'browser' ? 'Browser' : 'Panel';
        const status = server.status.charAt(0).toUpperCase() + server.status.slice(1);
        
        let tooltip = `${protocol} Server (${status})
URL: ${server.url}
Mode: ${mode}
Port: ${server.port}`;

        if (server.htmlFile) {
            const fileName = require('path').basename(server.htmlFile);
            tooltip += `\nFile: ${fileName}`;
        }

        if (server.metadata) {
            const metadata = server.metadata as any; // Type assertion for dynamic metadata
            if (metadata.serverType) {
                tooltip += `\nType: ${metadata.serverType}`;
            }
            if (metadata.portChanged) {
                tooltip += `\nOriginal port was in use`;
            }
            if (metadata.httpsOverridden) {
                tooltip += `\nHTTPS overridden for panel mode`;
            }
        }

        tooltip += `\n\nClick to show details`;
        
        return tooltip;
    }

    /**
     * Get children for the Babia Examples section
     */
    private async getBabiaExamplesChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading Babia examples children');

        try {
            const examples = await this.exampleLauncher.getExamples();
            
            if (examples.length === 0) {
                return [new UnifiedServerTreeItem(
                    'No examples found',
                    vscode.TreeItemCollapsibleState.None,
                    'babia-example',
                    undefined,
                    new vscode.ThemeIcon('warning'),
                    'No Babia examples are available'
                )];
            }

            // Sort examples by category and name
            const sortedExamples = examples.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category.localeCompare(b.category);
                }
                return a.name.localeCompare(b.name);
            });

            console.log(`UNIFIED_SERVERS: Creating tree items for ${sortedExamples.length} examples`);

            const children = sortedExamples.map(example => {
                const icon = this.getExampleIcon(example);
                const statusSuffix = example.isValid ? '' : ' (Invalid)';
                
                return new UnifiedServerTreeItem(
                    `${example.name}${statusSuffix}`,
                    vscode.TreeItemCollapsibleState.None,
                    'babia-example',
                    example.isValid ? {
                        command: 'codeXR.babiaExamples.launchExample',
                        title: 'Launch Example',
                        arguments: [example]
                    } : undefined,
                    icon,
                    example.isValid ? 
                        `${example.category} example - Click to launch` : 
                        `${example.category} example - Invalid configuration`,
                    example.category,
                    'babia-example',
                    undefined,
                    example
                );
            });

            return children;

        } catch (error) {
            console.error('UNIFIED_SERVERS: Error loading Babia examples:', error);
            return [new UnifiedServerTreeItem(
                'Error loading examples',
                vscode.TreeItemCollapsibleState.None,
                'babia-example',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load Babia examples'
            )];
        }
    }

    /**
     * Get the appropriate icon for a Babia example
     */
    private getExampleIcon(example: BabiaExample): vscode.ThemeIcon {
        // Use the existing ExampleIcons mapping
        return ExampleIcons.getExampleIcon(example.category);
    }

    /**
     * Get children for the Visualize Data section
     */
    private getVisualizeDataChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading visualize data children');

        try {
            const visualizeDataItems = VisualizeDataItemFactory.createVisualizeDataItems(this.context);
            
            const children = visualizeDataItems.map(item => {
                // Handle collapsible dimension mapping and browse visualizations
                let collapsibleState = vscode.TreeItemCollapsibleState.None;
                let itemType: UnifiedTreeItemType = 'visualize-data-item';
                
                if (item.type === 'dimension-mapping' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                    itemType = 'visualize-data-dimension-mapping';
                } else if (item.type === 'browse-visualizations' && item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
                    collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                    itemType = 'visualize-data-browse-visualizations';
                }
                
                return new UnifiedServerTreeItem(
                    item.label,
                    collapsibleState,
                    itemType,
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    undefined,
                    undefined,
                    item
                );
            });

            console.log(`UNIFIED_SERVERS: Created ${children.length} visualize data items`);
            return Promise.resolve(children);

        } catch (error) {
            console.error('UNIFIED_SERVERS: Error loading visualize data items:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading visualize data',
                vscode.TreeItemCollapsibleState.None,
                'visualize-data-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load visualize data items'
            )]);
        }
    }

    /**
     * Get children for the Dimension Mapping section
     */
    private getDimensionMappingChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading dimension mapping children');

        try {
            // Get state manager and current state
            if (!VisualizeDataStateManager.hasInstance()) {
                console.log('UNIFIED_SERVERS: State manager not initialized for dimension mapping');
                return Promise.resolve([]);
            }

            const stateManager = VisualizeDataStateManager.getInstance(this.context);
            const state = stateManager.getState();

            // Create dimension items
            const dimensionItems = VisualizeDataItemFactory.createDimensionItems(state);
            
            const children = dimensionItems.map(item => {
                return new UnifiedServerTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'visualize-data-dimension-item',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    undefined,
                    undefined,
                    item
                );
            });

            console.log(`UNIFIED_SERVERS: Created ${children.length} dimension mapping items`);
            return Promise.resolve(children);

        } catch (error) {
            console.error('UNIFIED_SERVERS: Error loading dimension mapping items:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading dimensions',
                vscode.TreeItemCollapsibleState.None,
                'visualize-data-dimension-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load dimension items'
            )]);
        }
    }

    /**
     * Get children for the Visualization Settings section
     */
    private async getVisualizationSettingsChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading visualization settings children with dynamic color icons');

        try {
            const currentSettings = this.visualizationSettingsStorage.getSettings();
            console.log(`COLOR-PICKER: Loading settings for dynamic icons: ${JSON.stringify(currentSettings)}`);
            
            const settingsItems = await VisualizationSettingsItemFactory.createVisualizationSettingsItems(
                currentSettings, 
                this.context
            );
            
            const children = settingsItems.map(item => {
                return new UnifiedServerTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'visualization-settings-item',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue,
                    undefined,
                    undefined,
                    undefined,
                    item
                );
            });

            console.log(`UNIFIED_SERVERS: Created ${children.length} visualization settings items with dynamic icons`);
            console.log(`COLOR-PICKER: Successfully loaded ${children.length} settings items with color icons`);
            return children;

        } catch (error) {
            console.error('UNIFIED_SERVERS: Error loading visualization settings items:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading settings',
                vscode.TreeItemCollapsibleState.None,
                'visualization-settings-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load visualization settings'
            )]);
        }
    }

    /**
     * Get children for Browse Visualizations section
     */
    private async getBrowseVisualizationsChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('UNIFIED_SERVERS: Loading browse visualizations children');

        try {
            // Scan for stored visualizations
            const visualizations = await this.visualizationRestorer.scanStoredVisualizations();
            
            // Create items for visualizations
            const visualizationItems = BrowseVisualizationItemFactory.createStoredVisualizationItems(visualizations);
            
            // Add reset button if there are visualizations
            if (visualizations.length > 0) {
                visualizationItems.push(BrowseVisualizationItemFactory.createResetAllItem());
            }
            
            // Convert to UnifiedServerTreeItem
            const children = visualizationItems.map(item => {
                return new UnifiedServerTreeItem(
                    item.label,
                    vscode.TreeItemCollapsibleState.None,
                    'visualize-data-item',
                    item.command,
                    item.iconPath,
                    item.tooltip,
                    item.description,
                    item.contextValue
                );
            });

            console.log(`UNIFIED_SERVERS: Created ${children.length} browse visualization items`);
            return children;

        } catch (error) {
            console.error('UNIFIED_SERVERS: Error loading browse visualizations:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading visualizations',
                vscode.TreeItemCollapsibleState.None,
                'visualize-data-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load stored visualizations'
            )]);
        }
    }

    /**
     * Get children for the Code Analysis section
     */
    private async getCodeAnalysisChildren(): Promise<UnifiedServerTreeItem[]> {
        console.log('[CODE_ANALYSIS] Loading code analysis children from unified view');

        try {
            const analysisItems = this.codeAnalysisProvider.getCodeAnalysisSections();
            
            const children = analysisItems.map(item => {
                // Handle iconPath type conversion
                const iconPath = typeof item.iconPath === 'string' 
                    ? new vscode.ThemeIcon(item.iconPath as string)
                    : item.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                
                // Handle tooltip type conversion
                const tooltip = typeof item.tooltip === 'string' 
                    ? item.tooltip 
                    : item.tooltip?.value || undefined;
                
                // Handle description type conversion
                const description = typeof item.description === 'string' 
                    ? item.description 
                    : undefined;
                
                return new UnifiedServerTreeItem(
                    typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown',
                    item.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    'code-analysis-item',
                    item.command,
                    iconPath,
                    tooltip,
                    description,
                    item.contextValue,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    item
                );
            });

            console.log(`[CODE_ANALYSIS] Created ${children.length} code analysis items for unified view`);
            return children;

        } catch (error) {
            console.error('[CODE_ANALYSIS] Error loading code analysis items:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading code analysis',
                vscode.TreeItemCollapsibleState.None,
                'code-analysis-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load code analysis items'
            )]);
        }
    }

    /**
     * Get children for code analysis sub-items (delegate to CodeAnalysisTreeDataProvider)
     */
    private async getCodeAnalysisSubItems(codeAnalysisItem: CodeAnalysisTreeItem): Promise<UnifiedServerTreeItem[]> {
        console.log(`[CODE_ANALYSIS] Getting sub-items for code analysis item: ${codeAnalysisItem.label}`);

        try {
            // Delegate to the code analysis provider
            const subItems = await this.codeAnalysisProvider.getChildren(codeAnalysisItem);
            
            const children = subItems.map(item => {
                // Handle iconPath type conversion
                const iconPath = typeof item.iconPath === 'string' 
                    ? new vscode.ThemeIcon(item.iconPath as string)
                    : item.iconPath as (vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined);
                
                // Handle tooltip type conversion
                const tooltip = typeof item.tooltip === 'string' 
                    ? item.tooltip 
                    : item.tooltip?.value || undefined;
                
                // Handle description type conversion
                const description = typeof item.description === 'string' 
                    ? item.description 
                    : undefined;
                
                return new UnifiedServerTreeItem(
                    typeof item.label === 'string' ? item.label : item.label?.label || 'Unknown',
                    item.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    'code-analysis-item',
                    item.command,
                    iconPath,
                    tooltip,
                    description,
                    item.contextValue,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    item
                );
            });

            console.log(`[CODE_ANALYSIS] Created ${children.length} sub-items for unified view`);
            return children;

        } catch (error) {
            console.error('[CODE_ANALYSIS] Error loading code analysis sub-items:', error);
            return Promise.resolve([new UnifiedServerTreeItem(
                'Error loading sub-items',
                vscode.TreeItemCollapsibleState.None,
                'code-analysis-item',
                undefined,
                new vscode.ThemeIcon('error'),
                'Failed to load code analysis sub-items'
            )]);
        }
    }

    /**
     * Get the code analysis provider instance
     */
    getCodeAnalysisProvider(): CodeAnalysisTreeDataProvider {
        return this.codeAnalysisProvider;
    }
}
