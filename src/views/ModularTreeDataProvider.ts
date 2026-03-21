import * as vscode from 'vscode';
import { SectionProvider, ModularTreeItem } from './common/baseInterfaces';
import { ServersSectionProvider } from './servers';
import { ActiveServersSectionProvider } from './active_servers';
import { BabiaExamplesSectionProvider } from './babia_examples';
import { VisualizeDataSectionProvider } from './visualize_data';
import { PythonEnvSectionProvider } from './python_env';
import { AnalysisSectionProvider } from '../code_analysis/views/AnalysisSectionProvider';
import { VisualizationSettingsSectionProvider } from './visualization_settings';
import { LearnMoreSectionProvider } from './learn_more';
import { PythonEnvUiStateService } from '../python_env/runtime/pythonEnvUiState';
import { VenvManager } from '../python_env/runtime/venvManager';
import { PythonEnvItems } from '../python_env/views/items/pythonEnvItems';
import { getActiveServerRegistry } from '../active_servers/registry/activeServerRegistry';
import { CodeXRLogger } from '../core/logging/logger';

interface LazySectionDefinition {
    sectionName: string;
    createHeader: () => ModularTreeItem;
    createProvider: () => SectionProvider<any>;
    interactiveWhenRestricted?: boolean;
}

const logger = CodeXRLogger.getLogger('MODULAR_TREE');

/**
 * Main modular tree data provider that orchestrates all section providers.
 */
export class ModularTreeDataProvider implements vscode.TreeDataProvider<ModularTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModularTreeItem | undefined | null | void> =
        new vscode.EventEmitter<ModularTreeItem | undefined | null | void>();

    readonly onDidChangeTreeData: vscode.Event<ModularTreeItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private readonly sectionDefinitions = new Map<string, LazySectionDefinition>();
    private readonly sectionOrder: string[] = [];
    private readonly sectionProviders = new Map<string, SectionProvider<any>>();
    private readonly sectionSubscriptions = new Map<string, vscode.Disposable>();
    private readonly sectionHeaders = new Map<string, ModularTreeItem>();
    private readonly pythonEnvUiState = PythonEnvUiStateService.getInstance();
    private readonly pythonEnvUiStateSubscription: vscode.Disposable;
    private readonly pythonEnvManager: VenvManager;
    private refreshTimer: NodeJS.Timeout | undefined;
    private refreshAllRequested = false;
    private readonly pendingSectionRefreshes = new Set<string>();

    constructor(private context: vscode.ExtensionContext) {
        this.pythonEnvManager = new VenvManager(context);
        this.initializeSectionDefinitions();
        this.pythonEnvUiStateSubscription = this.pythonEnvUiState.onDidChangeState(() => {
            this.refreshSection('pythonEnv');
        });
    }

    private initializeSectionDefinitions(): void {
        this.registerSection({
            sectionName: 'SERVERS',
            createHeader: () => this.createStaticSectionHeader(
                'SERVERS',
                'SERVERS',
                vscode.TreeItemCollapsibleState.Expanded,
                'section',
                new vscode.ThemeIcon('server-environment'),
                'Server configuration and launch options',
            ),
            createProvider: () => new ServersSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'activeServers',
            createHeader: () => {
                const activeServers = getActiveServerRegistry().getAllServers();
                const runningCount = activeServers.filter((server) => server.status === 'running').length;
                const title = runningCount > 0
                    ? `ACTIVE SERVERS (${runningCount} running)`
                    : 'ACTIVE SERVERS';

                return this.createStaticSectionHeader(
                    title,
                    'activeServers',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'section',
                    new vscode.ThemeIcon('server-process'),
                    'Currently running servers',
                    undefined,
                    'activeServersSection',
                );
            },
            createProvider: () => new ActiveServersSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'babiaExamples',
            createHeader: () => this.createStaticSectionHeader(
                'BABIA EXAMPLES',
                'babiaExamples',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section',
                new vscode.ThemeIcon('library'),
                'Interactive visualization examples',
                undefined,
                'babiaExamplesSection',
            ),
            createProvider: () => new BabiaExamplesSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'visualizeData',
            createHeader: () => this.createStaticSectionHeader(
                'VISUALIZE DATA',
                'visualizeData',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section',
                new vscode.ThemeIcon('open-preview', new vscode.ThemeColor('charts.foreground')),
                'Data visualization configuration and launch',
                undefined,
                'visualizeDataSection',
            ),
            createProvider: () => new VisualizeDataSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'analysis',
            createHeader: () => this.createStaticSectionHeader(
                'ANALYSIS',
                'analysis',
                vscode.TreeItemCollapsibleState.Expanded,
                'section',
                new vscode.ThemeIcon('beaker'),
                'Analysis tools and settings',
                undefined,
                'codeXR.analysis.section.main',
            ),
            createProvider: () => new AnalysisSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'pythonEnv',
            createHeader: () => {
                const sectionItem = PythonEnvItems.createSectionItem(
                    this.pythonEnvManager.getEnvironmentStatus(),
                    this.pythonEnvUiState.getState(),
                );

                return new ModularTreeItem(
                    sectionItem.label,
                    sectionItem.collapsibleState,
                    'pythonEnv',
                    'section',
                    sectionItem.command,
                    sectionItem.iconPath,
                    sectionItem.tooltip,
                    sectionItem.description,
                    sectionItem.contextValue,
                );
            },
            createProvider: () => new PythonEnvSectionProvider(this.context),
            interactiveWhenRestricted: true,
        });

        this.registerSection({
            sectionName: 'visualizationSettings',
            createHeader: () => this.createStaticSectionHeader(
                'VISUALIZATION SETTINGS',
                'visualizationSettings',
                vscode.TreeItemCollapsibleState.Collapsed,
                'section',
                new vscode.ThemeIcon('settings-gear'),
                'Configure visualization rendering preferences',
                undefined,
                'visualizationSettingsSection',
            ),
            createProvider: () => new VisualizationSettingsSectionProvider(this.context),
        });

        this.registerSection({
            sectionName: 'learnMore',
            createHeader: () => this.createStaticSectionHeader(
                'LEARN MORE & SUPPORT',
                'learnMore',
                vscode.TreeItemCollapsibleState.Expanded,
                'section',
                new vscode.ThemeIcon('book', new vscode.ThemeColor('charts.foreground')),
                'Access CodeXR documentation, tutorials, examples, and support options',
                'Docs, tutorials & support',
                'learnMoreSection',
            ),
            createProvider: () => new LearnMoreSectionProvider(this.context),
            interactiveWhenRestricted: true,
        });
    }

    getTreeItem(element: ModularTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ModularTreeItem): Promise<ModularTreeItem[]> {
        if (!element) {
            return this.getRootSections();
        }

        return this.getSectionChildren(element);
    }

    public refresh(): void {
        this.scheduleRefresh();
    }

    public refreshSection(sectionName: string): void {
        this.scheduleRefresh(sectionName);
    }

    public getSectionProvider(sectionName: string): SectionProvider<any> | undefined {
        return this.ensureSectionProvider(sectionName);
    }

    async handleItemClick(item: ModularTreeItem): Promise<void> {
        const provider = this.ensureSectionProvider(item.sectionType);

        if (provider && typeof (provider as any).handleClick === 'function') {
            const sectionItem = this.convertToSectionItem(item);
            await (provider as any).handleClick(sectionItem);
        }
    }

    async handleContextMenu(action: string, item: ModularTreeItem): Promise<void> {
        const provider = this.ensureSectionProvider(item.sectionType);

        if (provider && typeof (provider as any).handleContextMenu === 'function') {
            const sectionItem = this.convertToSectionItem(item);
            await (provider as any).handleContextMenu(action, sectionItem);
        }
    }

    dispose(): void {
        this.pythonEnvUiStateSubscription.dispose();

        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }

        for (const subscription of this.sectionSubscriptions.values()) {
            subscription.dispose();
        }

        for (const provider of this.sectionProviders.values()) {
            if (typeof (provider as any).dispose === 'function') {
                (provider as any).dispose();
            }
        }

        this.sectionSubscriptions.clear();
        this.sectionProviders.clear();
        this.sectionHeaders.clear();
    }

    private registerSection(definition: LazySectionDefinition): void {
        this.sectionDefinitions.set(definition.sectionName, definition);
        this.sectionOrder.push(definition.sectionName);
    }

    private getRootSections(): ModularTreeItem[] {
        return this.sectionOrder.map((sectionName) => {
            const definition = this.sectionDefinitions.get(sectionName);
            if (!definition) {
                return new ModularTreeItem(
                    `${sectionName.toUpperCase()} (Error)`,
                    vscode.TreeItemCollapsibleState.None,
                    sectionName,
                    'error',
                    undefined,
                    new vscode.ThemeIcon('error'),
                    `Error loading ${sectionName} section`,
                );
            }

            const header = this.cacheSectionHeader(sectionName, definition.createHeader());
            const uiState = this.pythonEnvUiState.getState();

            if (uiState.isUiRestricted && !this.isSectionInteractive(sectionName)) {
                header.description = uiState.status === 'error'
                    ? 'Disabled until Python environment setup is retried'
                    : 'Disabled while Python environment setup is running';
                header.tooltip = uiState.detail
                    ? `${header.label}\n\n${uiState.detail}`
                    : `${header.label} is temporarily unavailable while CodeXR prepares the Python environment.`;
                header.iconPath = new vscode.ThemeIcon(
                    uiState.status === 'error' ? 'lock' : 'loading~spin',
                );
            }

            return header;
        });
    }

    private async getSectionChildren(element: ModularTreeItem): Promise<ModularTreeItem[]> {
        const sectionName = element.sectionType;
        const uiState = this.pythonEnvUiState.getState();

        if (uiState.isUiRestricted && !this.isSectionInteractive(sectionName)) {
            return [this.createRestrictedItem(sectionName, uiState)];
        }

        const provider = this.ensureSectionProvider(sectionName);
        if (!provider) {
            return [];
        }

        try {
            let sectionElement: any = undefined;
            if (element.itemType !== 'section') {
                sectionElement = this.convertToSectionItem(element);
            }

            const sectionChildren = await provider.getChildren(sectionElement);
            return sectionChildren.map((child: any) => this.createModularChild(sectionName, child));
        } catch (error) {
            logger.error(() => `Error getting children for section ${sectionName}.`, error);
            return [new ModularTreeItem(
                'Error loading items',
                vscode.TreeItemCollapsibleState.None,
                sectionName,
                'error',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to load ${sectionName} items`,
            )];
        }
    }

    private ensureSectionProvider(sectionName: string): SectionProvider<any> | undefined {
        const existingProvider = this.sectionProviders.get(sectionName);
        if (existingProvider) {
            return existingProvider;
        }

        const definition = this.sectionDefinitions.get(sectionName);
        if (!definition) {
            return undefined;
        }

        const provider = definition.createProvider();
        this.sectionProviders.set(sectionName, provider);

        if ((provider as any).onDidChangeTreeData) {
            const subscription = (provider as any).onDidChangeTreeData(() => {
                this.refreshSection(sectionName);
            });
            this.sectionSubscriptions.set(sectionName, subscription);
        }

        logger.debug(() => `Instantiated lazy section provider for ${sectionName}.`);
        return provider;
    }

    private createStaticSectionHeader(
        label: string,
        sectionType: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        itemType: string,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
    ): ModularTreeItem {
        return new ModularTreeItem(
            label,
            collapsibleState,
            sectionType,
            itemType,
            undefined,
            iconPath,
            tooltip,
            description,
            contextValue,
        );
    }

    private cacheSectionHeader(sectionName: string, nextItem: ModularTreeItem): ModularTreeItem {
        const cachedItem = this.sectionHeaders.get(sectionName);
        if (!cachedItem) {
            this.sectionHeaders.set(sectionName, nextItem);
            return nextItem;
        }

        cachedItem.label = nextItem.label;
        cachedItem.collapsibleState = nextItem.collapsibleState;
        cachedItem.command = nextItem.command;
        cachedItem.iconPath = nextItem.iconPath;
        cachedItem.tooltip = nextItem.tooltip;
        cachedItem.description = nextItem.description;
        cachedItem.contextValue = nextItem.contextValue;
        return cachedItem;
    }

    private createModularChild(sectionName: string, child: any): ModularTreeItem {
        const modularItem = new ModularTreeItem(
            typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown',
            child.collapsibleState || vscode.TreeItemCollapsibleState.None,
            sectionName,
            child.serverItemType ||
            child.activeServerItemType ||
            child.babiaItemType ||
            child.visualizeDataItemType ||
            child.analysisItemType ||
            child.pythonEnvItemType ||
            child.visualizationSettingsItemType ||
            child.learnMoreItemType ||
            child.type ||
            'item',
            child.command,
            child.iconPath,
            child.tooltip,
            child.description,
            child.contextValue,
        );

        if (child.serverItemType) {
            modularItem.serverItemType = child.serverItemType;
        }
        if (child.activeServerItemType) {
            (modularItem as any).activeServerItemType = child.activeServerItemType;
            (modularItem as any).activeServer = child.activeServer;
        }
        if (child.babiaItemType) {
            (modularItem as any).babiaItemType = child.babiaItemType;
            (modularItem as any).babiaExample = child.babiaExample;
        }
        if (child.visualizeDataItemType) {
            (modularItem as any).visualizeDataItemType = child.visualizeDataItemType;
            (modularItem as any).visualizeDataItem = child.visualizeDataItem;
        }
        if (child.analysisItemType) {
            (modularItem as any).analysisItemType = child.analysisItemType;
            (modularItem as any).originalAnalysisItem = child.originalAnalysisItem;
        }
        if (child.pythonEnvItemType) {
            (modularItem as any).pythonEnvItemType = child.pythonEnvItemType;
        }
        if (child.visualizationSettingsItemType) {
            (modularItem as any).visualizationSettingsItemType = child.visualizationSettingsItemType;
            (modularItem as any).originalSettingsItem = child.originalSettingsItem;
        }
        if (child.learnMoreItemType) {
            (modularItem as any).learnMoreItemType = child.learnMoreItemType;
            (modularItem as any).originalLearnMoreItem = child.originalLearnMoreItem;
        }

        return modularItem;
    }

    private convertToSectionItem(element: ModularTreeItem): any {
        const sectionName = element.sectionType;

        switch (sectionName) {
            case 'SERVERS': {
                const { ServerTreeItem } = require('./servers/items/serverItems');
                return new ServerTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    element.serverItemType || 'config-option',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                );
            }
            case 'activeServers': {
                const { ActiveServerTreeItem } = require('./active_servers/items/activeServerItems');
                return new ActiveServerTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).activeServerItemType || 'server-item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).activeServer,
                );
            }
            case 'babiaExamples': {
                const { BabiaExampleTreeItem } = require('./babia_examples/items/babiaExampleItems');
                return new BabiaExampleTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).babiaItemType || 'example-item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).babiaExample,
                );
            }
            case 'visualizeData': {
                const { VisualizeDataModularTreeItem } = require('./visualize_data/items/visualizeDataItems');
                return new VisualizeDataModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).visualizeDataItemType || 'error',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).visualizeDataItem,
                );
            }
            case 'analysis': {
                const { CodeAnalysisTreeItem } = require('../code_analysis/views/items/analysisItems');
                return new CodeAnalysisTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).analysisItemType || (element as any).type || 'item',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                );
            }
            case 'pythonEnv': {
                const { PythonEnvModularTreeItem } = require('../python_env/views/items/pythonEnvItems');
                return new PythonEnvModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).pythonEnvItemType || 'info',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                );
            }
            case 'visualizationSettings': {
                const { VisualizationSettingsModularTreeItem } = require('./visualization_settings/items/visualizationSettingsItems');
                return new VisualizationSettingsModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).visualizationSettingsItemType || 'error',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                    (element as any).originalSettingsItem,
                );
            }
            case 'learnMore': {
                const { LearnMoreModularTreeItem } = require('./learn_more/items/learnMoreItems');
                return new LearnMoreModularTreeItem(
                    typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown',
                    element.collapsibleState || vscode.TreeItemCollapsibleState.None,
                    (element as any).learnMoreItemType || 'action',
                    element.command,
                    element.iconPath,
                    element.tooltip,
                    element.description,
                    element.contextValue,
                );
            }
            default:
                return element;
        }
    }

    private scheduleRefresh(sectionName?: string): void {
        if (sectionName) {
            this.pendingSectionRefreshes.add(sectionName);
        } else {
            this.refreshAllRequested = true;
        }

        if (this.refreshTimer) {
            return;
        }

        this.refreshTimer = setTimeout(() => {
            this.refreshTimer = undefined;
            this.flushRefreshes();
        }, 40);
    }

    private flushRefreshes(): void {
        const shouldRefreshAll = this.refreshAllRequested || this.pendingSectionRefreshes.size === 0;
        const sectionsToRefresh = Array.from(this.pendingSectionRefreshes);

        this.refreshAllRequested = false;
        this.pendingSectionRefreshes.clear();

        if (shouldRefreshAll) {
            this._onDidChangeTreeData.fire(undefined);
            return;
        }

        for (const sectionName of sectionsToRefresh) {
            this._onDidChangeTreeData.fire(this.sectionHeaders.get(sectionName));
        }
    }

    private isSectionInteractive(sectionName: string): boolean {
        return this.sectionDefinitions.get(sectionName)?.interactiveWhenRestricted === true;
    }

    private createRestrictedItem(sectionName: string, uiState: ReturnType<PythonEnvUiStateService['getState']>): ModularTreeItem {
        const message = uiState.status === 'error'
            ? 'Disabled until Python environment setup is retried'
            : 'Disabled while Python environment setup is running';

        return new ModularTreeItem(
            message,
            vscode.TreeItemCollapsibleState.None,
            sectionName,
            'info',
            undefined,
            new vscode.ThemeIcon(uiState.status === 'error' ? 'lock' : 'loading~spin'),
            uiState.detail ?? uiState.message,
            uiState.message,
            'pythonEnv.uiRestricted',
        );
    }
}



