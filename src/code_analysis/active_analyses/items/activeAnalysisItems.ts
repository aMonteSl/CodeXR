import * as vscode from 'vscode';
import * as path from 'path';
import { ActiveAnalysis, ActiveAnalysisTreeItemType } from '../model/activeAnalysisModel';

/**
 * Tree item representing an active analysis in the VS Code tree view
 */
export class ActiveAnalysisTreeItem extends vscode.TreeItem {
    public readonly type: ActiveAnalysisTreeItemType;
    public readonly analysis?: ActiveAnalysis;

    constructor(
        labelOrUri: string | vscode.Uri,
        collapsibleState: vscode.TreeItemCollapsibleState,
        type: ActiveAnalysisTreeItemType,
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri },
        tooltip?: string,
        description?: string,
        contextValue?: string,
        analysis?: ActiveAnalysis
    ) {
        // Call super() first with the appropriate arguments
        if (labelOrUri instanceof vscode.Uri) {
            super(labelOrUri, collapsibleState);
            this.label = path.basename(labelOrUri.fsPath);
        } else {
            super(labelOrUri, collapsibleState);
        }
        
        // Assign properties after super() call
        this.type = type;
        this.analysis = analysis;
        
        if (iconPath !== undefined) {
            this.iconPath = iconPath;
        }
        if (command !== undefined) {
            this.command = command;
        }
        if (tooltip !== undefined) {
            this.tooltip = tooltip;
        }
        if (description !== undefined) {
            this.description = description;
        }
        if (contextValue !== undefined) {
            this.contextValue = contextValue;
        }
    }
}

/**
 * Factory for creating active analysis tree items
 */
export class ActiveAnalysisItemFactory {
    
    /**
     * Create tree items for active analyses
     */
    static createActiveAnalysisItems(analyses: ActiveAnalysis[]): ActiveAnalysisTreeItem[] {
        console.log(`[ACTIVE_ANALYSIS_ITEMS] 🏗️ Creating ${analyses.length} active analysis items`);
        
        if (analyses.length === 0) {
            console.log('[ACTIVE_ANALYSIS_ITEMS] 📝 No analyses, creating placeholder item');
            return [this.createNoAnalysesItem()];
        }
        
        const treeItems = analyses.map(analysis => {
            console.log(`[ACTIVE_ANALYSIS_ITEMS] 🔧 Creating item for analysis:`, {
                id: analysis.id,
                path: analysis.path,
                status: analysis.status,
                mode: analysis.mode,
                language: analysis.language
            });
            return this.createAnalysisItem(analysis);
        });
        
        console.log(`[ACTIVE_ANALYSIS_ITEMS] ✅ Created ${treeItems.length} tree items successfully`);
        return treeItems;
    }
    
    /**
     * Create a tree item for a single active analysis
     */
    private static createAnalysisItem(analysis: ActiveAnalysis): ActiveAnalysisTreeItem {
        const fileName = path.basename(analysis.path);
        const isDirectory = analysis.id.startsWith('dir-');
        
        // Determine label based on status and progress
        let label = fileName;
        if (analysis.progress !== undefined && analysis.status === 'running') {
            label = `${fileName} (${analysis.progress}%)`;
        }
        
        // Determine icon based on status
        let iconPath: vscode.ThemeIcon;
        switch (analysis.status) {
            case 'running':
                iconPath = new vscode.ThemeIcon('loading~spin');
                break;
            case 'completed':
                iconPath = new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green'));
                break;
            case 'failed':
                iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
                break;
            case 'paused':
                iconPath = new vscode.ThemeIcon('debug-pause', new vscode.ThemeColor('charts.yellow'));
                break;
            default:
                iconPath = new vscode.ThemeIcon('pulse');
        }
        
        // Create description
        let description = `${analysis.mode} analysis`;
        if (analysis.language) {
            description += ` • ${analysis.language}`;
        }
        
        // Create tooltip
        let tooltip = `Path: ${analysis.path}\\n`;
        tooltip += `Mode: ${analysis.mode}\\n`;
        tooltip += `Status: ${analysis.status}\\n`;
        tooltip += `Started: ${analysis.timestamp.toLocaleString()}`;
        if (analysis.error) {
            tooltip += `\\nError: ${analysis.error}`;
        }
        if (analysis.metadata) {
            if (analysis.metadata.totalLines) {
                tooltip += `\\nLines: ${analysis.metadata.totalLines}`;
            }
            if (analysis.metadata.totalFunctions) {
                tooltip += `\\nFunctions: ${analysis.metadata.totalFunctions}`;
            }
        }
        
        const type: ActiveAnalysisTreeItemType = isDirectory ? 'active-analysis-directory' : 'active-analysis-file';
        
        return new ActiveAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            type,
            {
                command: 'codexr.activeAnalysis.openAnalysis',
                title: 'Open Analysis',
                arguments: [analysis.id]
            },
            iconPath,
            tooltip,
            description,
            `active-analysis-${analysis.status}`,
            analysis
        );
    }
    
    /**
     * Create a placeholder item when no analyses are active
     */
    private static createNoAnalysesItem(): ActiveAnalysisTreeItem {
        return new ActiveAnalysisTreeItem(
            'No active analyses',
            vscode.TreeItemCollapsibleState.None,
            'active-analysis-placeholder',
            undefined,
            new vscode.ThemeIcon('info'),
            'No analyses are currently running or tracked',
            'Start an analysis to see it here',
            'no-active-analyses'
        );
    }
    
    /**
     * Create summary items showing analysis statistics
     */
    static createSummaryItems(summary: {
        total: number;
        running: number;
        completed: number;
        failed: number;
    }): ActiveAnalysisTreeItem[] {
        const items: ActiveAnalysisTreeItem[] = [];
        
        if (summary.total === 0) {
            return [this.createNoAnalysesItem()];
        }
        
        // Running analyses
        if (summary.running > 0) {
            items.push(new ActiveAnalysisTreeItem(
                `${summary.running} Running`,
                vscode.TreeItemCollapsibleState.None,
                'active-analysis-section',
                undefined,
                new vscode.ThemeIcon('loading~spin'),
                `${summary.running} analyses currently in progress`,
                'In progress',
                'running-analyses'
            ));
        }
        
        // Completed analyses
        if (summary.completed > 0) {
            items.push(new ActiveAnalysisTreeItem(
                `${summary.completed} Completed`,
                vscode.TreeItemCollapsibleState.None,
                'active-analysis-section',
                undefined,
                new vscode.ThemeIcon('check-all', new vscode.ThemeColor('charts.green')),
                `${summary.completed} analyses completed successfully`,
                'Finished',
                'completed-analyses'
            ));
        }
        
        // Failed analyses
        if (summary.failed > 0) {
            items.push(new ActiveAnalysisTreeItem(
                `${summary.failed} Failed`,
                vscode.TreeItemCollapsibleState.None,
                'active-analysis-section',
                undefined,
                new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
                `${summary.failed} analyses failed`,
                'Errors',
                'failed-analyses'
            ));
        }
        
        return items;
    }
}
