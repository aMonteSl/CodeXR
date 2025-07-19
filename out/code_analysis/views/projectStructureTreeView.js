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
exports.ProjectStructureCommands = exports.ProjectStructureTreeItem = exports.ProjectStructureTreeDataProvider = void 0;
exports.createProjectStructureModularItem = createProjectStructureModularItem;
const vscode = __importStar(require("vscode"));
const directoryScanner_1 = require("../runtime/directoryScanner");
const baseInterfaces_1 = require("../../views/common/baseInterfaces");
const fileDisplayUtils_1 = require("../../utils/fileDisplayUtils");
/**
 * Tree data provider for the Project Directory Tree View
 */
class ProjectStructureTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    projectStructure = [];
    scanOptions = {
        maxDepth: 10,
        includeHidden: false,
        calculateSizes: true,
        includeModificationDates: false
    };
    constructor(context) {
        this.context = context;
        // Initial scan
        this.refresh();
    }
    /**
     * Refresh the tree view by rescanning the project structure
     */
    async refresh() {
        console.log('PROJECT_STRUCTURE_TREE: Refreshing project structure');
        try {
            this.projectStructure = await directoryScanner_1.DirectoryScanner.scanProjectStructure(this.scanOptions);
            this._onDidChangeTreeData.fire();
            console.log('PROJECT_STRUCTURE_TREE: Tree view refreshed successfully');
        }
        catch (error) {
            console.error('PROJECT_STRUCTURE_TREE: Error refreshing tree view:', error);
            vscode.window.showErrorMessage(`Failed to refresh project structure: ${error}`);
        }
    }
    /**
     * Update scan options and refresh
     */
    async updateScanOptions(options) {
        this.scanOptions = { ...this.scanOptions, ...options };
        await this.refresh();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children of a tree item
     */
    getChildren(element) {
        if (!element) {
            // Root level - return top-level items
            return Promise.resolve(this.projectStructure.map(item => new ProjectStructureTreeItem(item, this.context)));
        }
        // Return children of the element
        if (element.item.children) {
            return Promise.resolve(element.item.children.map(child => new ProjectStructureTreeItem(child, this.context)));
        }
        return Promise.resolve([]);
    }
    /**
     * Get the project structure data
     */
    getProjectStructure() {
        return this.projectStructure;
    }
    /**
     * Find an item by its relative path
     */
    findItem(relativePath) {
        return directoryScanner_1.DirectoryScanner.findItemByPath(this.projectStructure, relativePath);
    }
    /**
     * Get project statistics
     */
    getStatistics() {
        return directoryScanner_1.DirectoryScanner.getProjectStatistics(this.projectStructure);
    }
}
exports.ProjectStructureTreeDataProvider = ProjectStructureTreeDataProvider;
/**
 * Tree item for project structure elements
 */
class ProjectStructureTreeItem extends vscode.TreeItem {
    item;
    context;
    collapsibleState;
    constructor(item, context, collapsibleState) {
        super(item.name, collapsibleState !== undefined
            ? collapsibleState
            : (item.type === 'directory' && item.children && item.children.length > 0)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None);
        this.item = item;
        this.context = context;
        this.collapsibleState = collapsibleState;
        this.setupTreeItem();
    }
    setupTreeItem() {
        // For files, use the shared utility for consistent display
        if (this.item.type === 'file') {
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(this.item.name, this.item.fullPath, 'project', this.item.size, this.context);
            this.iconPath = fileProperties.iconPath;
            this.description = fileProperties.description;
            this.tooltip = fileProperties.tooltip;
            this.command = fileProperties.command;
        }
        else {
            // Directory handling
            this.tooltip = this.createTooltip();
            this.description = this.createDescription();
            this.iconPath = vscode.ThemeIcon.Folder;
            // No command for directories
        }
        // Set context value for context menu commands
        this.contextValue = this.item.type;
        // Set resource URI for VS Code integration
        this.resourceUri = vscode.Uri.file(this.item.fullPath);
    }
    createTooltip() {
        const lines = [];
        lines.push(`**${this.item.name}**`);
        lines.push(`Type: ${this.item.type}`);
        lines.push(`Path: ${this.item.relativePath || '/'}`);
        if (this.item.language) {
            lines.push(`Language: ${this.item.language.name}`);
        }
        if (this.item.size !== undefined) {
            lines.push(`Size: ${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(this.item.size)}`);
        }
        if (this.item.lastModified) {
            lines.push(`Modified: ${this.item.lastModified.toLocaleString()}`);
        }
        if (this.item.type === 'directory' && this.item.children) {
            const childCounts = this.getChildCounts(this.item.children);
            if (childCounts.directories > 0 || childCounts.files > 0) {
                lines.push(`Contents: ${childCounts.directories} folders, ${childCounts.files} files`);
            }
        }
        return lines.join('\n');
    }
    createDescription() {
        if (this.item.type === 'file' && this.item.size !== undefined) {
            return fileDisplayUtils_1.FileDisplayUtils.formatFileSize(this.item.size);
        }
        if (this.item.type === 'directory' && this.item.children) {
            const childCounts = this.getChildCounts(this.item.children);
            const total = childCounts.directories + childCounts.files;
            if (total === 0) {
                return 'empty';
            }
            else if (total === 1) {
                return '1 item';
            }
            else {
                return `${total} items`;
            }
        }
        return '';
    }
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
exports.ProjectStructureTreeItem = ProjectStructureTreeItem;
/**
 * Create a modular tree item for the project structure section
 */
function createProjectStructureModularItem() {
    const item = new baseInterfaces_1.ModularTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'codeAnalysis', 'projectStructure', {
        command: 'codexr.codeanalysis.refreshProjectStructure',
        title: 'Refresh Project Structure'
    }, new vscode.ThemeIcon('folder-library'), 'Browse project structure', 'Browse project structure');
    // Set code analysis specific properties
    item.codeAnalysisItemType = 'section';
    item.originalCodeAnalysisItem = {
        id: 'project-structure',
        label: 'Project Directory Tree',
        description: 'Browse project structure',
        contextValue: 'codeAnalysis.projectStructure'
    };
    return item;
}
/**
 * Commands for project structure tree view
 */
class ProjectStructureCommands {
    treeDataProvider;
    constructor(treeDataProvider) {
        this.treeDataProvider = treeDataProvider;
    }
    /**
     * Register all project structure commands
     */
    static registerCommands(context, treeDataProvider) {
        const commands = new ProjectStructureCommands(treeDataProvider);
        // Refresh command
        const refreshDisposable = vscode.commands.registerCommand('codexr.codeanalysis.refreshProjectStructure', () => commands.refresh());
        // Reveal in explorer command
        const revealDisposable = vscode.commands.registerCommand('codexr.codeanalysis.revealInExplorer', (item) => commands.revealInExplorer(item));
        // Copy path command
        const copyPathDisposable = vscode.commands.registerCommand('codexr.codeanalysis.copyPath', (item) => commands.copyPath(item));
        // Copy relative path command
        const copyRelativePathDisposable = vscode.commands.registerCommand('codexr.codeanalysis.copyRelativePath', (item) => commands.copyRelativePath(item));
        // Show statistics command
        const showStatsDisposable = vscode.commands.registerCommand('codexr.codeanalysis.showProjectStatistics', () => commands.showStatistics());
        // Configure scan options command
        const configureDisposable = vscode.commands.registerCommand('codexr.codeanalysis.configureProjectScan', () => commands.configureScanOptions());
        context.subscriptions.push(refreshDisposable, revealDisposable, copyPathDisposable, copyRelativePathDisposable, showStatsDisposable, configureDisposable);
    }
    /**
     * Refresh the project structure
     */
    async refresh() {
        await this.treeDataProvider.refresh();
        vscode.window.showInformationMessage('Project structure refreshed');
    }
    /**
     * Reveal item in file explorer
     */
    async revealInExplorer(item) {
        const uri = vscode.Uri.file(item.item.fullPath);
        await vscode.commands.executeCommand('revealFileInOS', uri);
    }
    /**
     * Copy full path to clipboard
     */
    async copyPath(item) {
        await vscode.env.clipboard.writeText(item.item.fullPath);
        vscode.window.showInformationMessage(`Copied path: ${item.item.fullPath}`);
    }
    /**
     * Copy relative path to clipboard
     */
    async copyRelativePath(item) {
        const relativePath = item.item.relativePath || item.item.name;
        await vscode.env.clipboard.writeText(relativePath);
        vscode.window.showInformationMessage(`Copied relative path: ${relativePath}`);
    }
    /**
     * Show project statistics
     */
    async showStatistics() {
        const stats = this.treeDataProvider.getStatistics();
        const lines = [];
        lines.push(`**Project Structure Statistics**`);
        lines.push('');
        lines.push(`📁 Directories: ${stats.totalDirectories}`);
        lines.push(`📄 Files: ${stats.totalFiles}`);
        if (stats.totalSize !== undefined) {
            lines.push(`💾 Total Size: ${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(stats.totalSize)}`);
        }
        if (stats.largestFile) {
            lines.push(`🔥 Largest File: ${stats.largestFile.name} (${fileDisplayUtils_1.FileDisplayUtils.formatFileSize(stats.largestFile.size || 0)})`);
        }
        lines.push('');
        lines.push('**Files by Language:**');
        const sortedLanguages = Object.entries(stats.filesByLanguage)
            .sort(([, a], [, b]) => b - a);
        for (const [language, count] of sortedLanguages) {
            lines.push(`  ${language}: ${count} files`);
        }
        const content = lines.join('\n');
        // Show in a new document
        const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
    }
    /**
     * Configure scan options
     */
    async configureScanOptions() {
        const options = await this.showScanOptionsQuickPick();
        if (options) {
            await this.treeDataProvider.updateScanOptions(options);
            vscode.window.showInformationMessage('Scan options updated and structure refreshed');
        }
    }
    async showScanOptionsQuickPick() {
        const items = [
            {
                label: 'Include Hidden Files',
                description: 'Show files and folders starting with .',
                picked: false
            },
            {
                label: 'Calculate File Sizes',
                description: 'Show file sizes in tree (may be slower)',
                picked: true
            },
            {
                label: 'Include Modification Dates',
                description: 'Show last modified dates in tooltips',
                picked: false
            }
        ];
        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            title: 'Configure Project Structure Scan Options'
        });
        if (!selected) {
            return undefined;
        }
        const options = {};
        for (const item of selected) {
            switch (item.label) {
                case 'Include Hidden Files':
                    options.includeHidden = true;
                    break;
                case 'Calculate File Sizes':
                    options.calculateSizes = true;
                    break;
                case 'Include Modification Dates':
                    options.includeModificationDates = true;
                    break;
            }
        }
        return options;
    }
}
exports.ProjectStructureCommands = ProjectStructureCommands;
//# sourceMappingURL=projectStructureTreeView.js.map