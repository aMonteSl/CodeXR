"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModularTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const baseInterfaces_1 = require("./common/baseInterfaces");
const servers_1 = require("./servers");
const active_servers_1 = require("./active_servers");
const babia_examples_1 = require("./babia_examples");
const visualize_data_1 = require("./visualize_data");
const code_analysis_1 = require("./code_analysis");
const visualization_settings_1 = require("./visualization_settings");
/**
 * Main modular tree data provider that orchestrates all section providers
 */
class ModularTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    sectionProviders = new Map();
    constructor(context) {
        this.context = context;
        console.log('MODULAR_TREE: Initializing modular tree data provider');
        // Initialize all section providers
        this.initializeSectionProviders();
    }
    /**
     * Initialize all section providers
     */
    initializeSectionProviders() {
        console.log('MODULAR_TREE: Initializing section providers');
        // Create and register all section providers
        const providers = [
            new servers_1.ServersSectionProvider(this.context),
            new active_servers_1.ActiveServersSectionProvider(this.context),
            new babia_examples_1.BabiaExamplesSectionProvider(this.context),
            new visualize_data_1.VisualizeDataSectionProvider(this.context),
            new code_analysis_1.CodeAnalysisSectionProvider(this.context),
            new visualization_settings_1.VisualizationSettingsSectionProvider(this.context)
        ];
        // Register providers and listen to their changes
        providers.forEach(provider => {
            const sectionName = provider.getSectionName();
            this.sectionProviders.set(sectionName, provider);
            // Listen to provider changes and propagate them
            if (provider.onDidChangeTreeData) {
                provider.onDidChangeTreeData(() => {
                    console.log(`MODULAR_TREE: Section ${sectionName} changed, refreshing tree`);
                    this.refresh();
                });
            }
            console.log(`MODULAR_TREE: Registered section provider: ${sectionName}`);
        });
        console.log(`MODULAR_TREE: Initialized ${providers.length} section providers`);
    }
    /**
     * Get tree item
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return section headers
            console.log('MODULAR_TREE: Loading root sections');
            return this.getRootSections();
        }
        // Get children from the appropriate section provider
        return this.getSectionChildren(element);
    }
    /**
     * Get root sections
     */
    getRootSections() {
        const sections = [];
        // Create section headers from each provider
        this.sectionProviders.forEach((provider, sectionName) => {
            try {
                const sectionItem = provider.getSectionItem();
                // Convert to ModularTreeItem
                const modularItem = new baseInterfaces_1.ModularTreeItem(typeof sectionItem.label === 'string' ? sectionItem.label : sectionItem.label?.label || sectionName.toUpperCase(), sectionItem.collapsibleState || vscode.TreeItemCollapsibleState.Collapsed, sectionName, 'section', sectionItem.command, sectionItem.iconPath, sectionItem.tooltip, sectionItem.description, sectionItem.contextValue);
                sections.push(modularItem);
            }
            catch (error) {
                console.error(`MODULAR_TREE: Error creating section header for ${sectionName}:`, error);
                // Create error section
                sections.push(new baseInterfaces_1.ModularTreeItem(`${sectionName.toUpperCase()} (Error)`, vscode.TreeItemCollapsibleState.None, sectionName, 'error', undefined, new vscode.ThemeIcon('error'), `Error loading ${sectionName} section`));
            }
        });
        console.log(`MODULAR_TREE: Created ${sections.length} root sections`);
        return sections;
    }
    /**
     * Get children for a specific section
     */
    async getSectionChildren(element) {
        const sectionName = element.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (!provider) {
            console.error(`MODULAR_TREE: No provider found for section: ${sectionName}`);
            return [];
        }
        try {
            console.log(`MODULAR_TREE: Getting children for section: ${sectionName}`);
            // Convert ModularTreeItem back to the section-specific item type
            let sectionElement = undefined;
            if (element.itemType !== 'section') {
                // Create a section-specific item with the preserved properties
                sectionElement = this.convertToSectionItem(element);
            }
            // Get children from the section provider
            const sectionChildren = await provider.getChildren(sectionElement);
            // Convert to ModularTreeItems
            const modularChildren = sectionChildren.map((child) => {
                // Preserve the original item properties for proper delegation
                const modularItem = new baseInterfaces_1.ModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, sectionName, child.serverItemType || child.activeServerItemType || child.babiaItemType || child.visualizeDataItemType || child.codeAnalysisItemType || child.visualizationSettingsItemType || child.type || 'item', child.command, child.iconPath, child.tooltip, child.description, child.contextValue);
                // Copy over section-specific properties
                if (child.serverItemType) {
                    modularItem.serverItemType = child.serverItemType;
                }
                if (child.activeServerItemType) {
                    modularItem.activeServerItemType = child.activeServerItemType;
                    modularItem.activeServer = child.activeServer;
                }
                if (child.babiaItemType) {
                    modularItem.babiaItemType = child.babiaItemType;
                    modularItem.babiaExample = child.babiaExample;
                }
                if (child.visualizeDataItemType) {
                    modularItem.visualizeDataItemType = child.visualizeDataItemType;
                    modularItem.visualizeDataItem = child.visualizeDataItem;
                }
                if (child.codeAnalysisItemType) {
                    modularItem.codeAnalysisItemType = child.codeAnalysisItemType;
                    modularItem.originalCodeAnalysisItem = child.originalCodeAnalysisItem;
                }
                if (child.visualizationSettingsItemType) {
                    modularItem.visualizationSettingsItemType = child.visualizationSettingsItemType;
                    modularItem.originalSettingsItem = child.originalSettingsItem;
                }
                return modularItem;
            });
            console.log(`MODULAR_TREE: Retrieved ${modularChildren.length} children for section: ${sectionName}`);
            return modularChildren;
        }
        catch (error) {
            console.error(`MODULAR_TREE: Error getting children for section ${sectionName}:`, error);
            return [new baseInterfaces_1.ModularTreeItem('Error loading items', vscode.TreeItemCollapsibleState.None, sectionName, 'error', undefined, new vscode.ThemeIcon('error'), `Failed to load ${sectionName} items`)];
        }
    }
    /**
     * Convert ModularTreeItem back to section-specific item type
     */
    convertToSectionItem(element) {
        const sectionName = element.sectionType;
        // Create section-specific items based on section type
        switch (sectionName) {
            case 'SERVERS':
                // Import and create ServerTreeItem
                const { ServerTreeItem } = require('./servers/items/serverItems');
                const serverItem = new ServerTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.serverItemType || 'config-option', element.command, element.iconPath, element.tooltip, element.description, element.contextValue);
                return serverItem;
            case 'activeServers':
                // Import and create ActiveServerTreeItem
                const { ActiveServerTreeItem } = require('./active_servers/items/activeServerItems');
                const activeServerItem = new ActiveServerTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.activeServerItemType || 'server-item', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.activeServer);
                return activeServerItem;
            case 'babiaExamples':
                // Import and create BabiaExampleTreeItem
                const { BabiaExampleTreeItem } = require('./babia_examples/items/babiaExampleItems');
                const babiaItem = new BabiaExampleTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.babiaItemType || 'example-item', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.babiaExample);
                return babiaItem;
            case 'visualizeData':
                // Import and create VisualizeDataModularTreeItem
                const { VisualizeDataModularTreeItem } = require('./visualize_data/items/visualizeDataItems');
                const visualizeItem = new VisualizeDataModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.visualizeDataItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.visualizeDataItem);
                return visualizeItem;
            case 'codeAnalysis':
                // Import and create CodeAnalysisModularTreeItem
                const { CodeAnalysisModularTreeItem } = require('./code_analysis/items/codeAnalysisItems');
                const codeAnalysisItem = new CodeAnalysisModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.codeAnalysisItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.originalCodeAnalysisItem);
                return codeAnalysisItem;
            case 'visualizationSettings':
                // Import and create VisualizationSettingsModularTreeItem
                const { VisualizationSettingsModularTreeItem } = require('./visualization_settings/items/visualizationSettingsItems');
                const settingsItem = new VisualizationSettingsModularTreeItem(typeof element.label === 'string' ? element.label : element.label?.label || 'Unknown', element.collapsibleState || vscode.TreeItemCollapsibleState.None, element.visualizationSettingsItemType || 'error', element.command, element.iconPath, element.tooltip, element.description, element.contextValue, element.originalSettingsItem);
                return settingsItem;
            default:
                // Return the element as-is for other sections
                return element;
        }
    }
    /**
     * Refresh the tree
     */
    refresh() {
        console.log('MODULAR_TREE: Refreshing modular tree');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get section provider by name
     */
    getSectionProvider(sectionName) {
        return this.sectionProviders.get(sectionName);
    }
    /**
     * Handle clicks on items
     */
    async handleItemClick(item) {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (provider && typeof provider.handleClick === 'function') {
            console.log(`MODULAR_TREE: Delegating click to section provider: ${sectionName}`);
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await provider.handleClick(sectionItem);
        }
        else {
            console.log(`MODULAR_TREE: No click handler for section: ${sectionName}`);
        }
    }
    /**
     * Handle context menu actions
     */
    async handleContextMenu(action, item) {
        const sectionName = item.sectionType;
        const provider = this.sectionProviders.get(sectionName);
        if (provider && typeof provider.handleContextMenu === 'function') {
            console.log(`MODULAR_TREE: Delegating context menu to section provider: ${sectionName}`);
            // Convert back to section-specific item for proper handling
            const sectionItem = this.convertToSectionItem(item);
            await provider.handleContextMenu(action, sectionItem);
        }
        else {
            console.log(`MODULAR_TREE: No context menu handler for section: ${sectionName}`);
        }
    }
}
exports.ModularTreeDataProvider = ModularTreeDataProvider;
//# sourceMappingURL=ModularTreeDataProvider.js.map