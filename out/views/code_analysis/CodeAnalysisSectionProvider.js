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
exports.CodeAnalysisSectionProvider = void 0;
const vscode = __importStar(require("vscode"));
const codeAnalysisItems_1 = require("./items/codeAnalysisItems");
const handleCodeAnalysisClicks_1 = require("./interactions/handleCodeAnalysisClicks");
const codeAnalysisTreeView_1 = require("../../code_analysis/views/codeAnalysisTreeView");
const projectStructureAdapter_1 = require("./adapters/projectStructureAdapter");
/**
 * Code Analysis section provider - manages code analysis and file organization
 */
class CodeAnalysisSectionProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    clickHandler;
    codeAnalysisProvider;
    projectStructureAdapter;
    constructor(context) {
        this.context = context;
        console.log('CODE_ANALYSIS_MODULAR: Initializing Code Analysis section provider');
        this.clickHandler = new handleCodeAnalysisClicks_1.CodeAnalysisClickHandler(context);
        this.codeAnalysisProvider = new codeAnalysisTreeView_1.CodeAnalysisTreeDataProvider(context);
        this.projectStructureAdapter = new projectStructureAdapter_1.ProjectStructureModularAdapter(context);
        // Listen to changes from the original code analysis provider
        this.codeAnalysisProvider.onDidChangeTreeData(() => {
            console.log('CODE_ANALYSIS_MODULAR: Code analysis data changed, refreshing section');
            this.refresh();
        });
    }
    /**
     * Get the section name for identification
     */
    getSectionName() {
        return 'codeAnalysis';
    }
    /**
     * Get the section header item
     */
    getSectionItem() {
        return new codeAnalysisItems_1.CodeAnalysisModularTreeItem('CODE ANALYSIS', vscode.TreeItemCollapsibleState.Expanded, // Expanded by default
        'section', undefined, new vscode.ThemeIcon('search-details'), 'Code analysis tools and metrics', undefined, 'codeAnalysisSection');
    }
    /**
     * Get children items for the Code Analysis section
     */
    async getChildren(element) {
        if (!element) {
            // Root level - return main code analysis sections
            console.log('CODE_ANALYSIS_MODULAR: Loading code analysis section children');
            try {
                // Get current state from the original provider
                const filesByLanguage = this.codeAnalysisProvider.filesByLanguage;
                const isScanning = this.codeAnalysisProvider.isScanning || false;
                return codeAnalysisItems_1.CodeAnalysisModularItemFactory.createCodeAnalysisSections(filesByLanguage, isScanning, this.context);
            }
            catch (error) {
                console.error('CODE_ANALYSIS_MODULAR: Error loading code analysis sections:', error);
                return [codeAnalysisItems_1.CodeAnalysisModularItemFactory.createErrorItem()];
            }
        }
        // Handle sub-items for collapsible sections
        if (element.originalCodeAnalysisItem) {
            console.log(`CODE_ANALYSIS_MODULAR: Loading sub-items for: ${element.label}`);
            // Special handling for project structure
            if (element.originalCodeAnalysisItem.type === 'project-structure') {
                console.log('CODE_ANALYSIS_MODULAR: Loading project structure children');
                const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureChildren();
                // Convert to modular items
                return projectStructureChildren.map(child => {
                    const iconPath = typeof child.iconPath === 'string'
                        ? new vscode.ThemeIcon(child.iconPath)
                        : child.iconPath;
                    const tooltip = typeof child.tooltip === 'string'
                        ? child.tooltip
                        : child.tooltip?.value || undefined;
                    const description = typeof child.description === 'string'
                        ? child.description
                        : undefined;
                    return new codeAnalysisItems_1.CodeAnalysisModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, 'file-item', child.command, iconPath, tooltip, description, child.contextValue, child);
                });
            }
            // Check if this is a project structure item that needs expansion
            if (this.projectStructureAdapter.isProjectStructureItem(element.originalCodeAnalysisItem)) {
                const projectStructureItem = this.projectStructureAdapter.getProjectStructureItem(element.originalCodeAnalysisItem);
                if (projectStructureItem) {
                    console.log(`CODE_ANALYSIS_MODULAR: Loading project structure item children for: ${projectStructureItem.name}`);
                    const projectStructureChildren = await this.projectStructureAdapter.getProjectStructureItemChildren(projectStructureItem);
                    // Convert to modular items
                    return projectStructureChildren.map(child => {
                        const iconPath = typeof child.iconPath === 'string'
                            ? new vscode.ThemeIcon(child.iconPath)
                            : child.iconPath;
                        const tooltip = typeof child.tooltip === 'string'
                            ? child.tooltip
                            : child.tooltip?.value || undefined;
                        const description = typeof child.description === 'string'
                            ? child.description
                            : undefined;
                        return new codeAnalysisItems_1.CodeAnalysisModularTreeItem(typeof child.label === 'string' ? child.label : child.label?.label || 'Unknown', child.collapsibleState || vscode.TreeItemCollapsibleState.None, 'file-item', child.command, iconPath, tooltip, description, child.contextValue, child);
                    });
                }
            }
            return codeAnalysisItems_1.CodeAnalysisModularItemFactory.createCodeAnalysisSubItems(element.originalCodeAnalysisItem, this.codeAnalysisProvider);
        }
        // No sub-items for this element
        return [];
    }
    /**
     * Refresh the section
     */
    refresh() {
        console.log('CODE_ANALYSIS_MODULAR: Refreshing Code Analysis section');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Handle item clicks (additional method for interaction)
     */
    async handleClick(item) {
        await this.clickHandler.handleCodeAnalysisClick(item);
    }
    /**
     * Handle context menu actions (additional method for interaction)
     */
    async handleContextMenu(action, item) {
        await this.clickHandler.handleContextMenuAction(action, item);
    }
    /**
     * Get the underlying code analysis provider (for backward compatibility)
     */
    getCodeAnalysisProvider() {
        return this.codeAnalysisProvider;
    }
    /**
     * Force refresh the file scanning
     */
    async refreshFileScanning() {
        console.log('CODE_ANALYSIS_MODULAR: Force refreshing file scanning');
        // Delegate to the original provider
        if (typeof this.codeAnalysisProvider.forceRefresh === 'function') {
            await this.codeAnalysisProvider.forceRefresh();
        }
        else {
            // Fallback to regular refresh
            this.codeAnalysisProvider.refresh();
        }
    }
}
exports.CodeAnalysisSectionProvider = CodeAnalysisSectionProvider;
//# sourceMappingURL=CodeAnalysisSectionProvider.js.map