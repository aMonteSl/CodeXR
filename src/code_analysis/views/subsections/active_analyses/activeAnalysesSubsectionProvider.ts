/**
 * Active Analyses Subsection Provider
 * Manages the Active Analyses subsection of New Code Analysis
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../items/analysisItems';
import { ActiveAnalysesDataService } from './services/activeAnalysesDataService';
import { ActiveAnalysisItemFactory } from './items/activeAnalysisItems';
import { ActiveAnalysesCommands } from './commands/activeAnalysesCommands';
import { UnifiedSessionRegistry } from '../../../engine/core/sessionRegistry';
import { ServerWatcherIntegration } from '../../../services/serverWatcherIntegration';

export class ActiveAnalysesSubsectionProvider {
    private dataService: ActiveAnalysesDataService;
    private commands: ActiveAnalysesCommands;
    
    constructor(private context: vscode.ExtensionContext) {
        console.log('ANALYSIS: Initializing Active Analyses subsection provider');
        
        this.dataService = ActiveAnalysesDataService.getInstance();
        this.dataService.initialize(this.context);
        
        // Get the session registry and server watcher for commands
        const sessionRegistry = UnifiedSessionRegistry.getInstance(this.context);
        const serverWatcher = ServerWatcherIntegration.getInstance(this.context);
        this.commands = ActiveAnalysesCommands.getInstance(sessionRegistry, serverWatcher, this.context);
        
        // Note: Commands are registered elsewhere in the nested dolls pattern
        // to avoid duplicate registration. See activeAnalysesCommands.ts
        console.log('ACTIVE_ANALYSES_PROVIDER: Commands will be registered by the main command system');
    }

    /**
     * Get the subsection header item
     */
    getSubsectionItem(): CodeAnalysisTreeItem {
        const statusCounts = this.dataService.getAnalysisCountByStatus();
        const activeCount = statusCounts.creating + statusCounts.analyzing + statusCounts.monitoring;
        
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
        
        return new CodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.Expanded,
            'subsection',
            {
                command: 'codeXR.analysis.activeAnalyses.refresh',
                title: 'Refresh Active Analyses'
            },
            new vscode.ThemeIcon(icon, new vscode.ThemeColor(iconColor)),
            'Currently running and recent analysis processes. Click to refresh.',
            description,
            'activeAnalysesSubsection'
        );
    }

    /**
     * Get children items for this subsection
     */
    async getChildren(): Promise<CodeAnalysisTreeItem[]> {
        try {
            console.log('ACTIVE_ANALYSES_PROVIDER: Getting children for Active Analyses');
            
            const items: CodeAnalysisTreeItem[] = [];
            
            // Get active analyses directly from data service
            const activeAnalyses = this.dataService.getActiveAnalyses();
            console.log(`ACTIVE_ANALYSES_PROVIDER: Found ${activeAnalyses.length} active analyses`);
            
            if (activeAnalyses.length === 0) {
                // Show empty state
                const emptyItem = ActiveAnalysisItemFactory.createEmptyStateItem();
                items.push(emptyItem);
            } else {
                // Create simple tree items directly from the analyses
                for (const analysis of activeAnalyses) {
                    const item = new CodeAnalysisTreeItem(
                        analysis.label,
                        vscode.TreeItemCollapsibleState.None,
                        'analysis-result',
                        {
                            command: 'codeXR.analysis.activeAnalyses.showActions',
                            title: 'Show Analysis Actions',
                            arguments: [analysis] // Pass the full analysis object, not just the ID
                        },
                        analysis.iconPath,
                        analysis.description,
                        analysis.description,
                        analysis.contextValue
                    );
                    
                    // CRITICAL: Add the original analysis item for command compatibility
                    // This will be accessible as 'originalAnalysisItem' in ModularTreeItem
                    (item as any).originalAnalysisItem = analysis;
                    
                    items.push(item);
                }
            }
            
            return items;
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_PROVIDER: Error getting children:', error);
            return [ActiveAnalysisItemFactory.createEmptyStateItem()];
        }
    }

    /**
     * Handle refresh for this subsection
     */
    refresh(): void {
        console.log('ANALYSIS: Refreshing Active Analyses subsection');
        this.dataService.refresh();
    }
    
    /**
     * Register all commands for active analyses
     * NOTE: This method is commented out to avoid duplicate registration.
     * Commands are registered in the nested dolls pattern from activeAnalysesCommands.ts
     */
    private registerCommands(): void {
        // Commands are registered elsewhere to avoid duplication
        console.log('ACTIVE_ANALYSES_PROVIDER: Command registration skipped (handled by main command system)');
        
        // Original code commented out:
        // try {
        //     console.log('ACTIVE_ANALYSES_PROVIDER: Registering commands');
        //     this.commands.registerCommands(this.context);
        //     console.log(`ACTIVE_ANALYSES_PROVIDER: Commands registered successfully`);
        // } catch (error) {
        //     console.error('ACTIVE_ANALYSES_PROVIDER: Error registering commands:', error);
        // }
    }
}

