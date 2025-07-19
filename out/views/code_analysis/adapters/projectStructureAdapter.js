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
exports.ProjectStructureModularAdapter = void 0;
const vscode = __importStar(require("vscode"));
const projectStructureTreeView_1 = require("../../../code_analysis/views/projectStructureTreeView");
const analysisTreeItems_1 = require("../../../code_analysis/views/items/analysisTreeItems");
const fileDisplayUtils_1 = require("../../../utils/fileDisplayUtils");
/**
 * Adapter to integrate Project Structure Tree View with the modular Code Analysis system
 */
class ProjectStructureModularAdapter {
    context;
    projectStructureProvider;
    commands;
    constructor(context) {
        this.context = context;
        this.projectStructureProvider = new projectStructureTreeView_1.ProjectStructureTreeDataProvider(context);
        this.commands = new projectStructureTreeView_1.ProjectStructureCommands(this.projectStructureProvider);
        // Register commands
        projectStructureTreeView_1.ProjectStructureCommands.registerCommands(context, this.projectStructureProvider);
        console.log('PROJECT_STRUCTURE_ADAPTER: Initialized project structure adapter for modular system');
    }
    /**
     * Get project structure children as CodeAnalysisTreeItem for integration
     */
    async getProjectStructureChildren() {
        console.log('PROJECT_STRUCTURE_ADAPTER: Getting project structure children for modular view');
        try {
            // Get the actual project structure
            const projectStructure = this.projectStructureProvider.getProjectStructure();
            if (projectStructure.length === 0) {
                return [new analysisTreeItems_1.CodeAnalysisTreeItem('Loading project structure...', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('loading~spin'), 'Project structure is being scanned', 'Please wait', 'loading')];
            }
            // Convert ProjectStructureItem to CodeAnalysisTreeItem
            return this.convertProjectStructureItems(projectStructure);
        }
        catch (error) {
            console.error('PROJECT_STRUCTURE_ADAPTER: Error getting project structure children:', error);
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Error loading project structure', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), `Failed to load project structure: ${error}`, 'Error', 'error')];
        }
    }
    /**
     * Convert ProjectStructureItem to CodeAnalysisTreeItem
     */
    convertProjectStructureItems(items) {
        return items.map(item => this.convertSingleProjectStructureItem(item));
    }
    /**
     * Convert a single ProjectStructureItem to CodeAnalysisTreeItem
     */
    convertSingleProjectStructureItem(item) {
        const collapsibleState = item.type === 'directory' && item.children && item.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
        // For files, use the shared utility for consistent display
        if (item.type === 'file') {
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(item.name, item.fullPath, 'project', item.size, this.context);
            // Create the tree item with file-specific properties
            const treeItem = new analysisTreeItems_1.CodeAnalysisTreeItem(item.name, collapsibleState, 'analysis-item', fileProperties.command, fileProperties.iconPath, fileProperties.tooltip, fileProperties.description, 'project-structure-file');
            // Add custom properties to identify this as a project structure item
            treeItem.projectStructureItem = item;
            treeItem.isProjectStructureItem = true;
            return treeItem;
        }
        // Directory handling
        const childCounts = item.children ? this.getChildCounts(item.children) : { directories: 0, files: 0 };
        const total = childCounts.directories + childCounts.files;
        let description = '';
        if (total === 0) {
            description = 'empty';
        }
        else if (total === 1) {
            description = '1 item';
        }
        else {
            description = `${total} items`;
        }
        // Create tooltip for directory
        const tooltipLines = [];
        tooltipLines.push(`**${item.name}**`);
        tooltipLines.push(`Type: ${item.type}`);
        tooltipLines.push(`Path: ${item.relativePath || '/'}`);
        if (item.children && (childCounts.directories > 0 || childCounts.files > 0)) {
            tooltipLines.push(`Contents: ${childCounts.directories} folders, ${childCounts.files} files`);
        }
        // Create the tree item for directory
        const treeItem = new analysisTreeItems_1.CodeAnalysisTreeItem(item.name, collapsibleState, 'analysis-item', undefined, vscode.ThemeIcon.Folder, tooltipLines.join('\n'), description, 'project-structure-directory');
        // Add custom properties to identify this as a project structure item
        treeItem.projectStructureItem = item;
        treeItem.isProjectStructureItem = true;
        return treeItem;
    }
    /**
     * Get children for a project structure directory item
     */
    async getProjectStructureItemChildren(item) {
        if (item.type === 'directory' && item.children) {
            return this.convertProjectStructureItems(item.children);
        }
        return [];
    }
    /**
     * Check if a CodeAnalysisTreeItem is a project structure item
     */
    isProjectStructureItem(item) {
        return item.isProjectStructureItem === true;
    }
    /**
     * Get the project structure item from a CodeAnalysisTreeItem
     */
    getProjectStructureItem(item) {
        return item.projectStructureItem;
    }
    /**
     * Refresh the project structure
     */
    async refresh() {
        await this.projectStructureProvider.refresh();
    }
    /**
     * Get project statistics
     */
    getStatistics() {
        return this.projectStructureProvider.getStatistics();
    }
    /**
     * Get counts of child directories and files
     */
    getChildCounts(children) {
        let directories = 0;
        let files = 0;
        for (const child of children) {
            if (child.type === 'directory') {
                directories++;
            }
            else if (child.type === 'file') {
                files++;
            }
        }
        return { directories, files };
    }
}
exports.ProjectStructureModularAdapter = ProjectStructureModularAdapter;
//# sourceMappingURL=projectStructureAdapter.js.map