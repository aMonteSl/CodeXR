/**
 * Active Analyses Data Service
 * Provides data for the Active Analyses TreeView
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedSessionRegistry } from '../../../../new_engine/core/sessionRegistry';

export interface ActiveAnalysisItem {
    id: string;
    label: string;
    description?: string;
    analysisType: string;
    status: string;
    filePath?: string;
    resourceUri?: vscode.Uri;
    contextValue: string;
    iconPath?: vscode.ThemeIcon;
    children?: ActiveAnalysisItem[];
    // Additional properties for command compatibility
    sessionId?: string;
    serverUrl?: string;
    targetPath?: string;
    assignedPort?: number;
}

export class ActiveAnalysesDataService {
    private static instance: ActiveAnalysesDataService;
    private _onDidChangeTreeData: vscode.EventEmitter<ActiveAnalysisItem | undefined | null | void> = new vscode.EventEmitter<ActiveAnalysisItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ActiveAnalysisItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private sessionRegistry: UnifiedSessionRegistry | null = null;

    private constructor() {
        console.log('ACTIVE_ANALYSES_DATA_SERVICE: Initialized');
    }

    public static getInstance(): ActiveAnalysesDataService {
        if (!ActiveAnalysesDataService.instance) {
            ActiveAnalysesDataService.instance = new ActiveAnalysesDataService();
        }
        return ActiveAnalysesDataService.instance;
    }

    public initialize(context: vscode.ExtensionContext): void {
        if (!this.sessionRegistry) {
            this.sessionRegistry = UnifiedSessionRegistry.getInstance(context);
            
            // Listen to session changes
            this.sessionRegistry.onSessionChanged(() => {
                this.refresh();
            });
        }
    }

    /**
     * Refresh the tree view
     */
    public refresh(): void {
        console.log('ACTIVE_ANALYSES_DATA_SERVICE: Refreshing tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree children
     */
    public getChildren(element?: ActiveAnalysisItem): Promise<ActiveAnalysisItem[]> {
        if (!element) {
            // Root level - return all active analyses
            return Promise.resolve(this.getAllActiveAnalyses());
        } else {
            // Return children if any
            return Promise.resolve(element.children || []);
        }
    }

    /**
     * Get tree item
     */
    public getTreeItem(element: ActiveAnalysisItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label);
        item.description = element.description;
        item.contextValue = element.contextValue;
        item.resourceUri = element.resourceUri;
        item.iconPath = element.iconPath;
        
        // Add command to show details when clicked
        item.command = {
            command: 'codeXR.new_code_analysis.activeAnalyses.showDetails',
            title: 'Show Details',
            arguments: [element] // Pass the full element as argument
        };
        
        if (element.children && element.children.length > 0) {
            item.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        } else {
            item.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        
        return item;
    }

    /**
     * Get all active analyses
     */
    private getAllActiveAnalyses(): ActiveAnalysisItem[] {
        const analyses: ActiveAnalysisItem[] = [];

        try {
            if (!this.sessionRegistry) {
                console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Session registry not initialized');
                return analyses;
            }

            // Get all sessions
            const allSessions = this.sessionRegistry.getAllSessions();
            console.log(`ACTIVE_ANALYSES_DATA_SERVICE: Found ${allSessions.length} sessions`);
            
            for (const session of allSessions) {
                if (session.status !== 'closed') {
                    // Determine type based on session properties
                    const type = session.targetType === 'directory' ? 'directory' : 'file';
                    analyses.push(this.createAnalysisItem(session, type));
                }
            }

        } catch (error) {
            console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error getting analyses:', error);
        }

        console.log(`ACTIVE_ANALYSES_DATA_SERVICE: Returning ${analyses.length} active analyses`);
        return analyses;
    }

    /**
     * Create analysis item for tree view
     */
    private createAnalysisItem(session: any, type: 'file' | 'directory'): ActiveAnalysisItem {
        // Use analysis type icon instead of status icon for better visual differentiation
        const analysisIcon = this.getAnalysisTypeIcon(session.analysisMode, type);
        const analysisTypeLabel = this.getAnalysisTypeLabel(session.analysisMode);
        
        return {
            id: session.id,
            sessionId: session.id, // For command compatibility
            label: `${session.targetName || path.basename(session.targetPath || '')}`,
            description: `${analysisTypeLabel} - ${this.getStatusLabel(session.status)}`,
            analysisType: session.analysisMode,
            status: session.status,
            filePath: session.targetPath,
            targetPath: session.targetPath,
            serverUrl: session.serverUrl,
            assignedPort: session.assignedPort,
            resourceUri: session.targetPath ? vscode.Uri.file(session.targetPath) : undefined,
            // Fix contextValue to match package.json patterns - remove type from the middle
            contextValue: `activeAnalysis.${session.status}`,
            iconPath: analysisIcon
        };
    }

    /**
     * Get status icon
     */
    private getStatusIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'creating':
                return new vscode.ThemeIcon('sync~spin');
            case 'analyzing':
                return new vscode.ThemeIcon('loading~spin');
            case 'monitoring':
            case 'completed':
                return new vscode.ThemeIcon('check');
            case 'error':
            case 'failed':
                return new vscode.ThemeIcon('error');
            case 'closed':
            case 'closing':
                return new vscode.ThemeIcon('close');
            default:
                return new vscode.ThemeIcon('file');
        }
    }

    /**
     * Get analysis type icon based on analysis mode and target type
     */
    private getAnalysisTypeIcon(analysisMode: string, targetType: 'file' | 'directory'): vscode.ThemeIcon {
        if (targetType === 'file') {
            switch (analysisMode) {
                case 'LivePanel':
                case 'FileLivePanel':
                    // Verde para LivePanel de archivos
                    return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.green'));
                case 'XR':
                case 'FileXRAnalysis':
                    // Morado para XR de archivos
                    return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.purple'));
                case 'VisualizeDOM':
                case 'FileVisualizeDOM':
                    // Naranja para VisualizeDOM de archivos
                    return new vscode.ThemeIcon('file', new vscode.ThemeColor('charts.orange'));
                default:
                    return new vscode.ThemeIcon('file');
            }
        } else { // directory
            switch (analysisMode) {
                case 'LivePanel':
                case 'DirectoryLivePanel':
                case 'DeepDirectoryLivePanel':
                    // Verde para LivePanel de directorios
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.green'));
                case 'XR':
                case 'DirectoryXRAnalysis':
                case 'DeepDirectoryXRAnalysis':
                    // Morado para XR de directorios
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.purple'));
                case 'VisualizeDOM':
                    // Naranja para VisualizeDOM de directorios (poco común pero por si acaso)
                    return new vscode.ThemeIcon('folder', new vscode.ThemeColor('charts.orange'));
                default:
                    return new vscode.ThemeIcon('folder');
            }
        }
    }

    /**
     * Get status label
     */
    private getStatusLabel(status: string): string {
        switch (status) {
            case 'creating':
                return 'Creating...';
            case 'analyzing':
                return 'Analyzing...';
            case 'monitoring':
                return 'Monitoring';
            case 'completed':
                return 'Ready';
            case 'error':
                return 'Error';
            case 'failed':
                return 'Failed';
            case 'closed':
                return 'Closed';
            case 'closing':
                return 'Closing...';
            default:
                return status;
        }
    }

    /**
     * Get analysis type label
     */
    private getAnalysisTypeLabel(analysisType: string): string {
        switch (analysisType) {
            // New engine modes
            case 'LivePanel':
                return 'Live Panel';
            case 'XR':
                return 'XR Analysis';
            case 'VisualizeDOM':
                return 'Visualize DOM';
            // Legacy modes
            case 'FileLivePanel':
                return 'Live Panel';
            case 'FileVisualizeDOM':
                return 'Visualize DOM';
            case 'FileXRAnalysis':
                return 'XR Analysis';
            case 'DirectoryLivePanel':
                return 'Directory Live Panel';
            case 'DeepDirectoryLivePanel':
                return 'Deep Directory Live Panel';
            case 'DirectoryXRAnalysis':
                return 'Directory XR Analysis';
            case 'DeepDirectoryXRAnalysis':
                return 'Deep Directory XR Analysis';
            default:
                return analysisType;
        }
    }

    /**
     * Get analysis by ID
     */
    public getAnalysisById(id: string): any | null {
        try {
            if (!this.sessionRegistry) {
                console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Session registry not initialized');
                return null;
            }

            return this.sessionRegistry.getSession(id);
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_DATA_SERVICE: Error getting analysis ${id}:`, error);
            return null;
        }
    }

    /**
     * Get analysis count by status
     */
    public getAnalysisCountByStatus(): { creating: number; analyzing: number; monitoring: number; completed: number; error: number; failed: number; closed: number; closing: number; total: number } {
        const analyses = this.getAllActiveAnalyses();
        
        const counts = {
            creating: 0,
            analyzing: 0,
            monitoring: 0,
            completed: 0,
            error: 0,
            failed: 0,
            closed: 0,
            closing: 0,
            total: analyses.length
        };

        for (const analysis of analyses) {
            switch (analysis.status) {
                case 'creating':
                    counts.creating++;
                    break;
                case 'analyzing':
                    counts.analyzing++;
                    break;
                case 'monitoring':
                    counts.monitoring++;
                    break;
                case 'completed':
                    counts.completed++;
                    break;
                case 'error':
                    counts.error++;
                    break;
                case 'failed':
                    counts.failed++;
                    break;
                case 'closed':
                    counts.closed++;
                    break;
                case 'closing':
                    counts.closing++;
                    break;
            }
        }

        return counts;
    }

    /**
     * Get active analyses (alias for getAllActiveAnalyses for compatibility)
     */
    public getActiveAnalyses(): ActiveAnalysisItem[] {
        return this.getAllActiveAnalyses();
    }
}
