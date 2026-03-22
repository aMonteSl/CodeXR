/**
 * Active Analyses Data Service
 * Provides data for the Active Analyses TreeView
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedSessionRegistry } from '../../../../engine/core/sessionRegistry';

export interface ActiveAnalysisItem {
    // Core session properties - SIMPLIFIED
    id: string;
    sessionId: string;
    label: string;
    description?: string;
    analysisType: string;
    status: string;
    filePath?: string;
    targetPath?: string;
    resourceUri?: vscode.Uri;
    contextValue: string;
    iconPath?: vscode.ThemeIcon;
    serverUrl?: string;
    assignedPort?: number;
    // Direct session reference for commands - NO MORE COMPLEX TRANSFORMATIONS
    session: any;
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
            // No children for analysis items - flat list
            return Promise.resolve([]);
        }
    }

    /**
     * Get tree item
     */
    public getTreeItem(element: ActiveAnalysisItem): vscode.TreeItem {
        try {
            if (!element) {
                console.error('ACTIVE_ANALYSES_DATA_SERVICE: getTreeItem called with null/undefined element');
                return new vscode.TreeItem('Error: Invalid item');
            }

            const item = new vscode.TreeItem(element.label || 'Unknown Analysis');
            item.description = element.description;
            item.contextValue = element.contextValue;
            
            // Safely set resourceUri
            if (element.resourceUri) {
                try {
                    item.resourceUri = element.resourceUri;
                } catch (uriError) {
                    console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Error setting resourceUri:', uriError);
                    item.resourceUri = undefined;
                }
            }
            
            item.iconPath = element.iconPath;
            
            // CRITICAL: Add sessionId to the TreeItem so commands can locate the session
            // VS Code passes the TreeItem object to context menu commands, not the original element
            (item as any).sessionId = element.sessionId;
            (item as any).id = element.id;
            (item as any).analysisType = element.analysisType;
            (item as any).status = element.status;
            (item as any).targetPath = element.targetPath;
            (item as any).serverUrl = element.serverUrl;
            (item as any).assignedPort = element.assignedPort;
            
            console.log('ACTIVE_ANALYSES_DATA_SERVICE: Created TreeItem with session info:', {
                sessionId: element.sessionId,
                id: element.id,
                label: element.label,
                targetPath: element.targetPath
            });
            
            item.tooltip = element.description
                ? `${element.description}\n\nLeft-click to show available actions.`
                : 'Left-click to show available actions.';

            // Add command to show available actions when clicked.
            item.command = {
                command: 'codeXR.analysis.activeAnalyses.showActions',
                title: 'Show Analysis Actions',
                arguments: element ? [element] : [] // Ensure arguments array is never undefined
            };
            
            // Analysis items are always leaf nodes (no children)
            item.collapsibleState = vscode.TreeItemCollapsibleState.None;
            
            return item;
        } catch (error) {
            console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error in getTreeItem:', error);
            return new vscode.TreeItem('Error: Failed to create tree item');
        }
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

            // Get all sessions with safety check
            let allSessions;
            try {
                allSessions = this.sessionRegistry.getAllSessions();
            } catch (error) {
                console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error getting sessions from registry:', error);
                return analyses;
            }

            if (!Array.isArray(allSessions)) {
                console.warn('ACTIVE_ANALYSES_DATA_SERVICE: getAllSessions() returned non-array:', typeof allSessions);
                return analyses;
            }

            console.log(`ACTIVE_ANALYSES_DATA_SERVICE: Found ${allSessions.length} sessions`);
            
            for (const session of allSessions) {
                if (!session) {
                    console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Found null/undefined session in registry');
                    continue;
                }
                
                if (session.status !== 'closed') {
                    try {
                        // Determine type based on session properties
                        const type = session.targetType === 'directory' ? 'directory' : 'file';
                        const analysisItem = this.createAnalysisItem(session, type);
                        if (analysisItem) {
                            analyses.push(analysisItem);
                        }
                    } catch (error) {
                        console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error creating analysis item for session:', session.id, error);
                    }
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
    private createAnalysisItem(session: any, type: 'file' | 'directory'): ActiveAnalysisItem | null {
        try {
            if (!session) {
                console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Cannot create analysis item - session is null/undefined');
                return null;
            }

            if (!session.id) {
                console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Cannot create analysis item - session has no ID');
                return null;
            }

            // Use analysis type icon instead of status icon for better visual differentiation
            const analysisIcon = this.getAnalysisTypeIcon(session.analysisMode, type);
            const analysisTypeLabel = this.getAnalysisTypeLabel(session.analysisMode);
            
            // Safe property access with fallbacks
            const targetName = session.targetName || (session.targetPath ? path.basename(session.targetPath) : 'Unknown');
            const status = session.status || 'unknown';
            const analysisMode = session.analysisMode || 'unknown';
            const targetPath = session.targetPath;
            
            // Create resourceUri safely with validation
            let resourceUri: vscode.Uri | undefined = undefined;
            if (targetPath && typeof targetPath === 'string' && targetPath.trim().length > 0) {
                try {
                    // Validate the path doesn't contain illegal URI characters
                    const normalizedPath = path.normalize(targetPath.trim());
                    resourceUri = vscode.Uri.file(normalizedPath);
                } catch (uriError) {
                    console.warn('ACTIVE_ANALYSES_DATA_SERVICE: Invalid path for URI creation:', targetPath, uriError);
                    resourceUri = undefined;
                }
            }
            
            console.log('ACTIVE_ANALYSES_DATA_SERVICE: Creating analysis item for session:', {
                sessionId: session.id,
                targetName: targetName,
                targetPath: targetPath
            });
            
            return {
                id: session.id,
                sessionId: session.id, // For command compatibility
                label: targetName,
                description: `${analysisTypeLabel} - ${this.getStatusLabel(status)}`,
                analysisType: analysisMode,
                status: status,
                filePath: targetPath || undefined,
                targetPath: targetPath || undefined,
                serverUrl: session.serverUrl || undefined,
                assignedPort: session.assignedPort || undefined,
                resourceUri: resourceUri,
                // Fix contextValue to match package.json patterns - remove type from the middle
                contextValue: `activeAnalysis.${status}`,
                iconPath: analysisIcon,
                // SIMPLIFIED: Direct session reference for commands
                session: session
            };
        } catch (error) {
            console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error creating analysis item:', error);
            return null;
        }
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

    /**
     * Get subsection item for the tree (SIMPLIFIED integration)
     */
    public getSubsectionItem(): any {
        try {
            const activeCount = this.getAllActiveAnalyses().length;
            return {
                label: `Active Analyses (${activeCount})`,
                collapsibleState: 1, // Expanded
                contextValue: 'activeAnalysesSubsection',
                analysisItemType: 'subsection',
                iconPath: new vscode.ThemeIcon(
                    'play-circle',
                    activeCount > 0 ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.gray')
                ),
                tooltip: `${activeCount} active analysis sessions`,
                description: activeCount > 0 ? `${activeCount} running` : 'No active sessions'
            };
        } catch (error) {
            console.error('ACTIVE_ANALYSES_DATA_SERVICE: Error creating subsection item:', error);
            return {
                label: 'Active Analyses (Error)',
                collapsibleState: 1,
                contextValue: 'activeAnalysesSubsection',
                analysisItemType: 'subsection',
                iconPath: new vscode.ThemeIcon('error'),
                tooltip: 'Error loading active analyses',
                description: 'Error'
            };
        }
    }
}

