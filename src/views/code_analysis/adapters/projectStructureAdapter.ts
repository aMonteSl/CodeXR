import * as vscode from 'vscode';
import { 
    ProjectStructureTreeDataProvider, 
    ProjectStructureTreeItem, 
    ProjectStructureCommands 
} from '../../../code_analysis/views/projectStructureTreeView';
import { CodeAnalysisTreeItem } from '../../../code_analysis/views/items/analysisTreeItems';
import { ProjectStructureItem } from '../../../code_analysis/runtime/directoryScanner';
import { FileDisplayUtils } from '../../../utils/fileDisplayUtils';

/**
 * Adapter to integrate Project Structure Tree View with the modular Code Analysis system
 */
export class ProjectStructureModularAdapter {
    private projectStructureProvider: ProjectStructureTreeDataProvider;
    private commands: ProjectStructureCommands;

    constructor(private context: vscode.ExtensionContext) {
        this.projectStructureProvider = new ProjectStructureTreeDataProvider(context);
        this.commands = new ProjectStructureCommands(this.projectStructureProvider);
        
        // Register commands
        ProjectStructureCommands.registerCommands(context, this.projectStructureProvider);
        
        console.log('PROJECT_STRUCTURE_ADAPTER: Initialized project structure adapter for modular system');
    }

    /**
     * Get project structure children as CodeAnalysisTreeItem for integration
     */
    async getProjectStructureChildren(): Promise<CodeAnalysisTreeItem[]> {
        console.log('PROJECT_STRUCTURE_ADAPTER: Getting project structure children for modular view');
        
        try {
            // Get the actual project structure
            const projectStructure = this.projectStructureProvider.getProjectStructure();
            
            if (projectStructure.length === 0) {
                return [new CodeAnalysisTreeItem(
                    'Loading project structure...',
                    vscode.TreeItemCollapsibleState.None,
                    'analysis-item',
                    undefined,
                    new vscode.ThemeIcon('loading~spin'),
                    'Project structure is being scanned',
                    'Please wait',
                    'loading'
                )];
            }

            // Convert ProjectStructureItem to CodeAnalysisTreeItem
            return this.convertProjectStructureItems(projectStructure);
            
        } catch (error) {
            console.error('PROJECT_STRUCTURE_ADAPTER: Error getting project structure children:', error);
            return [new CodeAnalysisTreeItem(
                'Error loading project structure',
                vscode.TreeItemCollapsibleState.None,
                'analysis-item',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to load project structure: ${error}`,
                'Error',
                'error'
            )];
        }
    }

    /**
     * Convert ProjectStructureItem to CodeAnalysisTreeItem
     */
    private convertProjectStructureItems(items: ProjectStructureItem[]): CodeAnalysisTreeItem[] {
        return items.map(item => this.convertSingleProjectStructureItem(item));
    }

    /**
     * Convert a single ProjectStructureItem to CodeAnalysisTreeItem
     */
    private convertSingleProjectStructureItem(item: ProjectStructureItem): CodeAnalysisTreeItem {
        const collapsibleState = item.type === 'directory' && item.children && item.children.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;

        // For files, use the shared utility for consistent display
        if (item.type === 'file') {
            const fileProperties = FileDisplayUtils.createFileTreeItemProperties(
                item.name,
                item.fullPath,
                'project',
                item.size,
                this.context
            );
            
            // Create the tree item with file-specific properties
            const treeItem = new CodeAnalysisTreeItem(
                item.name,
                collapsibleState,
                'analysis-item',
                fileProperties.command,
                fileProperties.iconPath,
                fileProperties.tooltip,
                fileProperties.description,
                'project-structure-file'
            );
            
            // Add custom properties to identify this as a project structure item
            (treeItem as any).projectStructureItem = item;
            (treeItem as any).isProjectStructureItem = true;
            
            return treeItem;
        }
        
        // Directory handling
        const childCounts = item.children ? this.getChildCounts(item.children) : { directories: 0, files: 0 };
        const total = childCounts.directories + childCounts.files;
        
        let description = '';
        if (total === 0) {
            description = 'empty';
        } else if (total === 1) {
            description = '1 item';
        } else {
            description = `${total} items`;
        }

        // Create tooltip for directory
        const tooltipLines: string[] = [];
        tooltipLines.push(`**${item.name}**`);
        tooltipLines.push(`Type: ${item.type}`);
        tooltipLines.push(`Path: ${item.relativePath || '/'}`);
        
        if (item.children && (childCounts.directories > 0 || childCounts.files > 0)) {
            tooltipLines.push(`Contents: ${childCounts.directories} folders, ${childCounts.files} files`);
        }

        // Create the tree item for directory
        const treeItem = new CodeAnalysisTreeItem(
            item.name,
            collapsibleState,
            'analysis-item',
            undefined,
            vscode.ThemeIcon.Folder,
            tooltipLines.join('\n'),
            description,
            'project-structure-directory'
        );

        // Add custom properties to identify this as a project structure item
        (treeItem as any).projectStructureItem = item;
        (treeItem as any).isProjectStructureItem = true;

        return treeItem;
    }

    /**
     * Get children for a project structure directory item
     */
    async getProjectStructureItemChildren(item: ProjectStructureItem): Promise<CodeAnalysisTreeItem[]> {
        if (item.type === 'directory' && item.children) {
            return this.convertProjectStructureItems(item.children);
        }
        return [];
    }

    /**
     * Check if a CodeAnalysisTreeItem is a project structure item
     */
    isProjectStructureItem(item: CodeAnalysisTreeItem): boolean {
        return (item as any).isProjectStructureItem === true;
    }

    /**
     * Get the project structure item from a CodeAnalysisTreeItem
     */
    getProjectStructureItem(item: CodeAnalysisTreeItem): ProjectStructureItem | undefined {
        return (item as any).projectStructureItem;
    }

    /**
     * Refresh the project structure
     */
    async refresh(): Promise<void> {
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
    private getChildCounts(children: ProjectStructureItem[]): { directories: number; files: number } {
        let directories = 0;
        let files = 0;
        
        for (const child of children) {
            if (child.type === 'directory') {
                directories++;
            } else if (child.type === 'file') {
                files++;
            }
        }
        
        return { directories, files };
    }
}
