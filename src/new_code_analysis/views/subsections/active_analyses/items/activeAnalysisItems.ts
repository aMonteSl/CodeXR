/**
 * Active Analysis Tree Items
 * UI items for displaying active analysis sessions in the tree view
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../../items/newCodeAnalysisItems';
import { ActiveAnalysisUIItem, ActiveAnalysisData } from '../model/activeAnalysisModel';

export class ActiveAnalysisTreeItem extends NewCodeAnalysisTreeItem {
    public readonly sessionData: ActiveAnalysisData;
    
    constructor(uiItem: ActiveAnalysisUIItem) {
        // Create the tree item with all the UI data
        super(
            uiItem.label,                                    // label
            vscode.TreeItemCollapsibleState.None,            // collapsibleState
            'analysis-result',                               // itemType
            undefined,                                       // command
            new vscode.ThemeIcon(                           // iconPath
                uiItem.iconName, 
                uiItem.iconColor ? new vscode.ThemeColor(uiItem.iconColor) : undefined
            ),
            uiItem.tooltip,                                 // tooltip
            uiItem.description,                             // description
            uiItem.contextValue                             // contextValue
        );
        
        this.sessionData = uiItem.sessionData;
        
        // Set up the command to view details when clicked
        this.command = {
            command: 'newCodeAnalysis.activeAnalyses.viewDetails',
            title: 'View Analysis Details',
            arguments: [this.sessionData.sessionId]
        };
    }
    
    /**
     * Get context menu commands for this analysis item
     */
    getContextMenuCommands(): Array<{
        commandId: string;
        label: string;
        icon?: string;
    }> {
        const commands = [
            {
                commandId: 'newCodeAnalysis.activeAnalyses.viewDetails',
                label: 'View Details',
                icon: 'info'
            }
        ];
        
        // Add server-related commands if server is available
        if (this.sessionData.serverUrl) {
            commands.push({
                commandId: 'newCodeAnalysis.activeAnalyses.openInBrowser',
                label: 'Open in Browser',
                icon: 'globe'
            });
        }
        
        // Add stop command for active analyses
        if (['creating', 'analyzing'].includes(this.sessionData.status)) {
            commands.push({
                commandId: 'newCodeAnalysis.activeAnalyses.stopAnalysis',
                label: 'Stop Analysis',
                icon: 'stop-circle'
            });
        }
        
        commands.push({
            commandId: 'newCodeAnalysis.activeAnalyses.openOutputFolder',
            label: 'Open Output Folder',
            icon: 'folder-opened'
        });
        
        return commands;
    }
}

export class ActiveAnalysisItemFactory {
    
    /**
     * Create tree item from UI model
     */
    static createTreeItem(uiItem: ActiveAnalysisUIItem): ActiveAnalysisTreeItem {
        return new ActiveAnalysisTreeItem(uiItem);
    }
    
    /**
     * Create multiple tree items from UI models
     */
    static createTreeItems(uiItems: ActiveAnalysisUIItem[]): ActiveAnalysisTreeItem[] {
        return uiItems.map(uiItem => this.createTreeItem(uiItem));
    }
    
    /**
     * Create empty state item when no analyses are active
     */
    static createEmptyStateItem(): NewCodeAnalysisTreeItem {
        return new NewCodeAnalysisTreeItem(
            'No active analyses',
            vscode.TreeItemCollapsibleState.None,
            'analysis-result',
            undefined,
            new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('descriptionForeground')),
            'No analysis sessions are currently running. Start an analysis to see it here.',
            'Start analyzing files to see active sessions',
            'activeAnalysesEmpty'
        );
    }
    
    /**
     * Create status summary item
     */
    static createStatusSummaryItem(statusCounts: {
        creating: number;
        analyzing: number;
        completed: number;
        failed: number;
        total: number;
    }): NewCodeAnalysisTreeItem {
        const { creating, analyzing, completed, failed, total } = statusCounts;
        
        let label = `Analysis Summary (${total} total)`;
        let description = '';
        let icon = 'pulse';
        let iconColor = 'charts.foreground';
        
        if (total === 0) {
            description = 'No active analyses';
            icon = 'circle-slash';
            iconColor = 'descriptionForeground';
        } else {
            const parts = [];
            if (creating > 0) {
                parts.push(`${creating} creating`);
            }
            if (analyzing > 0) {
                parts.push(`${analyzing} analyzing`);
            }
            if (completed > 0) {
                parts.push(`${completed} completed`);
            }
            if (failed > 0) {
                parts.push(`${failed} failed`);
            }
            
            description = parts.join(', ');
            
            // Choose icon based on predominant status
            if (analyzing > 0) {
                icon = 'sync~spin';
                iconColor = 'charts.blue';
            } else if (creating > 0) {
                icon = 'loading~spin';
                iconColor = 'charts.yellow';
            } else if (failed > 0) {
                icon = 'error';
                iconColor = 'charts.red';
            } else if (completed > 0) {
                icon = 'check-all';
                iconColor = 'charts.green';
            }
        }
        
        const tooltip = `Active Analysis Summary:\n` +
                       `• Creating: ${creating}\n` +
                       `• Analyzing: ${analyzing}\n` +
                       `• Completed: ${completed}\n` +
                       `• Failed: ${failed}\n` +
                       `• Total: ${total}`;
        
        return new NewCodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'analysis-result',
            {
                command: 'newCodeAnalysis.activeAnalyses.refreshAll',
                title: 'Refresh Active Analyses'
            },
            new vscode.ThemeIcon(icon, new vscode.ThemeColor(iconColor)),
            tooltip,
            description,
            'activeAnalysesStatusSummary'
        );
    }
}
