/**
 * Active Analyses Subsection Provider
 * Manages the Active Analyses subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { NewCodeAnalysisTreeItem } from '../../items/newCodeAnalysisItems';
import { ActiveAnalysesDataService } from './services/activeAnalysesDataService';
import { ActiveAnalysisModelMapper } from './model/activeAnalysisModel';
import { ActiveAnalysisItemFactory } from './items/activeAnalysisItems';
import { ActiveAnalysesCommands } from './commands/activeAnalysesCommands';

export class ActiveAnalysesSubsectionProvider {
    private dataService: ActiveAnalysesDataService;
    private commands: ActiveAnalysesCommands;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('NEW_CODE_ANALYSIS: Initializing Active Analyses subsection provider');
        
        this.dataService = ActiveAnalysesDataService.getInstance();
        this.commands = new ActiveAnalysesCommands();
        
        // Register commands
        this.registerCommands();
    }

    /**
     * Get the subsection header item
     */
    getSubsectionItem(): NewCodeAnalysisTreeItem {
        const statusCounts = this.dataService.getAnalysisCountByStatus();
        const activeCount = statusCounts.creating + statusCounts.analyzing;
        
        let label = 'Active Analyses';
        let description = '';
        let icon = 'play-circle';
        let iconColor = 'charts.foreground';
        
        if (statusCounts.total > 0) {
            label = `Active Analyses (${statusCounts.total})`;
            if (activeCount > 0) {
                description = `${activeCount} running`;
                icon = 'beaker';
                iconColor = 'charts.green';
            } else {
                description = `${statusCounts.completed} completed, ${statusCounts.failed} failed`;
                icon = 'beaker';
                iconColor = 'charts.green';
            }
        } else {
            description = 'No active sessions';
            icon = 'beaker';
            iconColor = 'descriptionForeground';
        }
        
        return new NewCodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Expanded,
            'subsection',
            {
                command: 'newCodeAnalysis.activeAnalyses.refreshAll',
                title: 'Refresh Active Analyses'
            },
            new vscode.ThemeIcon(icon, new vscode.ThemeColor(iconColor)),
            'Currently running and recent analysis processes. Click to refresh.',
            description,
            'activeAnalysesSubsection'
        );
    }

    /**
     * Get children for this subsection
     */
    async getChildren(): Promise<NewCodeAnalysisTreeItem[]> {
        try {
            console.log('ACTIVE_ANALYSES_PROVIDER: Getting children for Active Analyses');
            
            // Get all active analyses
            const activeAnalyses = this.dataService.getActiveAnalyses();
            console.log(`ACTIVE_ANALYSES_PROVIDER: Found ${activeAnalyses.length} active analyses`);
            
            const items: NewCodeAnalysisTreeItem[] = [];
            
            if (activeAnalyses.length === 0) {
                // Show empty state
                const emptyItem = ActiveAnalysisItemFactory.createEmptyStateItem();
                items.push(emptyItem);
            } else {
                // Convert analyses to UI models and sort them
                const uiItems = activeAnalyses.map(analysis => 
                    ActiveAnalysisModelMapper.toUIItem(analysis)
                );
                const sortedUIItems = ActiveAnalysisModelMapper.sortAnalysisItems(uiItems);
                
                // Create tree items
                const analysisItems = ActiveAnalysisItemFactory.createTreeItems(sortedUIItems);
                items.push(...analysisItems);
            }
            
            console.log(`ACTIVE_ANALYSES_PROVIDER: Returning ${items.length} items`);
            return items;
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_PROVIDER: Error getting children:', error);
            
            // Return error item
            return [
                new NewCodeAnalysisTreeItem(
                    'Error loading analyses',
                    vscode.TreeItemCollapsibleState.None,
                    'error',
                    undefined,
                    new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red')),
                    `Failed to load active analyses: ${error}`,
                    'Error occurred',
                    'activeAnalysesError'
                )
            ];
        }
    }

    /**
     * Handle refresh for this subsection
     */
    refresh(): void {
        console.log('NEW_CODE_ANALYSIS: Refreshing Active Analyses subsection');
        this.dataService.refresh();
    }
    
    /**
     * Register all commands for active analyses
     */
    private registerCommands(): void {
        try {
            console.log('ACTIVE_ANALYSES_PROVIDER: Registering commands');
            
            const refreshCallback = () => {
                // Refresh this subsection specifically
                this.refresh();
                // Also refresh the entire tree (this will be called by the main provider)
                vscode.commands.executeCommand('codexr.tree.refresh');
            };
            
            const commandRegistrations = this.commands.getCommandRegistrations(refreshCallback);
            
            for (const reg of commandRegistrations) {
                const disposable = vscode.commands.registerCommand(reg.commandId, reg.callback);
                this.context.subscriptions.push(disposable);
                console.log(`ACTIVE_ANALYSES_PROVIDER: Registered command: ${reg.commandId}`);
            }
            
            console.log(`ACTIVE_ANALYSES_PROVIDER: Registered ${commandRegistrations.length} commands`);
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_PROVIDER: Error registering commands:', error);
        }
    }
}
