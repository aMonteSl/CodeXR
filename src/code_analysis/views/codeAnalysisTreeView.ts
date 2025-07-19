import * as vscode from 'vscode';
import { CodeAnalysisTreeItem, CodeAnalysisItemFactory, CodeAnalysisTreeItemType } from './items/analysisTreeItems';
import { FileScanner, FilesByLanguage } from '../utils/fileScanner';
import { ActiveAnalysesTreeDataProvider } from '../active_analyses/views/activeAnalysesTreeView';
import { ActiveAnalysesCommands } from '../active_analyses/commands/activeAnalysesCommands';
import { FileWatcherManager } from '../runtime/fileWatcherManager';

/**
 * Code Analysis tree data provider that manages the analysis sections
 * 
 * Architecture Notes:
 * - This view provides code analysis functionality
 * - Displays active analyses, settings, and file organization
 * - Follows the same patterns as other sections in the unified view
 */
export class CodeAnalysisTreeDataProvider implements vscode.TreeDataProvider<CodeAnalysisTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CodeAnalysisTreeItem | undefined | null | void> = 
        new vscode.EventEmitter<CodeAnalysisTreeItem | undefined | null | void>();
    
    readonly onDidChangeTreeData: vscode.Event<CodeAnalysisTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    private filesByLanguage: FilesByLanguage | null = null;
    private isScanning = false;
    private activeAnalysesProvider: ActiveAnalysesTreeDataProvider;
    private activeAnalysesCommands: ActiveAnalysesCommands;
    private fileWatcherManager: FileWatcherManager;

    constructor(private context: vscode.ExtensionContext) {
        console.log('[CODE_ANALYSIS] Code analysis tree data provider initialized');
        
        // Initialize the active analyses provider and commands
        this.activeAnalysesProvider = new ActiveAnalysesTreeDataProvider(context);
        this.activeAnalysesCommands = new ActiveAnalysesCommands(context);
        this.fileWatcherManager = FileWatcherManager.getInstance(context);
        
        // Listen to Active Analyses changes to refresh the main tree
        this.activeAnalysesProvider.onDidChangeTreeData(() => {
            console.log('[CODE_ANALYSIS] 🔄 Active Analyses changed, refreshing main tree view');
            this.refresh();
        });
        
        // Start file scanning in the background for better UX
        this.initializeFileScanning();
    }

    /**
     * Initialize file scanning in background for better user experience
     */
    private async initializeFileScanning(): Promise<void> {
        try {
            console.log('[CODE_ANALYSIS] Starting initial background file scanning...');
            this.isScanning = true;
            
            // Scan files in background
            this.filesByLanguage = await FileScanner.scanWorkspaceFiles();
            this.isScanning = false;
            
            const status = this.getScanningStatus();
            console.log(`[CODE_ANALYSIS] Initial background file scan completed - Found ${status.fileCount} files in ${status.languageCount} languages`);
            
            // Refresh the tree to show updated counts
            this.refresh();
        } catch (error) {
            console.error('[CODE_ANALYSIS] Error during initial background file scanning:', error);
            this.isScanning = false;
        }
    }

    /**
     * Force refresh file scan data (clears existing data and rescans)
     */
    async forceRefreshFilesScan(): Promise<void> {
        console.log('[CODE_ANALYSIS] Force refreshing files scan');
        this.filesByLanguage = null;
        this.isScanning = false;
        
        // Trigger a new scan
        await this.initializeFileScanning();
    }

    /**
     * Get current scanning status
     */
    isCurrentlyScanning(): boolean {
        return this.isScanning;
    }

    /**
     * Check if files have been scanned
     */
    hasScannedFiles(): boolean {
        return this.filesByLanguage !== null;
    }

    /**
     * Get scanning status for debugging
     */
    getScanningStatus(): { isScanning: boolean; hasData: boolean; fileCount: number; languageCount: number } {
        const fileCount = this.filesByLanguage ? 
            Object.values(this.filesByLanguage).reduce((total, files) => total + files.length, 0) : 0;
        const languageCount = this.filesByLanguage ? Object.keys(this.filesByLanguage).length : 0;
        
        return {
            isScanning: this.isScanning,
            hasData: this.filesByLanguage !== null,
            fileCount,
            languageCount
        };
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        console.log('[CODE_ANALYSIS] Refreshing code analysis tree view');
        this._onDidChangeTreeData.fire();
    }

    /**
     * Get tree item representation
     */
    getTreeItem(element: CodeAnalysisTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for the tree view
     */
    getChildren(element?: CodeAnalysisTreeItem): Thenable<CodeAnalysisTreeItem[]> {
        if (!element) {
            // Root level - return the main analysis sections with file counts if available
            console.log('[CODE_ANALYSIS] Loading root analysis sections');
            return Promise.resolve(CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(
                this.filesByLanguage || undefined, 
                this.isScanning,
                this.activeAnalysesProvider.getActiveAnalysesSummary()
            ));
        }

        // Handle expanding sections
        switch (element.type) {
            case 'active-analyses':
                console.log('[CODE_ANALYSIS] Loading Active Analyses children');
                return Promise.resolve(this.activeAnalysesProvider.getActiveAnalysesTreeItems());
                
            case 'analysis-settings':
                console.log('[CODE_ANALYSIS] Loading Analysis Settings children');
                return CodeAnalysisItemFactory.createPlaceholderItems('analysis-settings', this.context);
                
            case 'project-structure':
                console.log('[CODE_ANALYSIS] Loading Project Structure children');
                return CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
                
            case 'files-by-language':
                console.log('[CODE_ANALYSIS] Loading Files by Language children');
                return this.getFilesByLanguageChildren();
                
            case 'language-group':
                console.log(`[CODE_ANALYSIS] Loading files for language: ${element.languageName}`);
                return this.getLanguageGroupChildren(element.languageName!);
                
            case 'dimension-mapping-file':
                console.log('[CODE_ANALYSIS] Loading Dimension Mapping (File) children');
                return CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
                
            default:
                console.log('[CODE_ANALYSIS] No children available for this item type');
                return Promise.resolve([]);
        }
    }

    /**
     * Get the main code analysis sections for integration with unified view
     */
    getCodeAnalysisSections(): CodeAnalysisTreeItem[] {
        console.log('[CODE_ANALYSIS] Getting code analysis sections for unified view');
        return CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(
            this.filesByLanguage || undefined, 
            this.isScanning,
            this.activeAnalysesProvider.getActiveAnalysesSummary()
        );
    }

    /**
     * Get children for a specific section type (used by unified view)
     */
    getSectionChildren(sectionType: CodeAnalysisTreeItemType): Promise<CodeAnalysisTreeItem[]> {
        console.log(`[CODE_ANALYSIS] Getting children for section: ${sectionType}`);
        
        if (sectionType === 'files-by-language') {
            return this.getFilesByLanguageChildren();
        }
        
        if (sectionType === 'project-structure') {
            return CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
        }
        
        if (sectionType === 'dimension-mapping-file') {
            return CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
        }
        
        return CodeAnalysisItemFactory.createPlaceholderItems(sectionType, this.context);
    }

    /**
     * Get children for Files by Language section - triggers file scanning
     */
    private async getFilesByLanguageChildren(): Promise<CodeAnalysisTreeItem[]> {
        console.log('[CODE_ANALYSIS] Getting Files by Language children');
        
        // Prevent multiple concurrent scans
        if (this.isScanning) {
            console.log('[CODE_ANALYSIS] Scan already in progress, returning scanning indicator');
            return [new CodeAnalysisTreeItem(
                'Scanning files...',
                vscode.TreeItemCollapsibleState.None,
                'analysis-item',
                undefined,
                new vscode.ThemeIcon('loading~spin'),
                'File scan in progress',
                'Please wait',
                'scanning'
            )];
        }

        try {
            // Trigger file scan if not already done
            if (!this.filesByLanguage) {
                console.log('ANALYSIS: Scanning files for language analysis...');
                this.isScanning = true;
                
                this.filesByLanguage = await FileScanner.scanWorkspaceFiles();
                this.isScanning = false;
                
                console.log('[CODE_ANALYSIS] File scan completed, refreshing tree view');
                // Refresh the entire tree to update the root label with counts
                this.refresh();
            }
            
            // Create language group items
            const languageItems = CodeAnalysisItemFactory.createLanguageGroupItems(this.filesByLanguage, this.context);
            
            if (languageItems.length === 0) {
                return [new CodeAnalysisTreeItem(
                    'No files found',
                    vscode.TreeItemCollapsibleState.None,
                    'analysis-item',
                    undefined,
                    new vscode.ThemeIcon('info'),
                    'No files detected in workspace',
                    '',
                    'no-files'
                )];
            }
            
            console.log(`[CODE_ANALYSIS] Returning ${languageItems.length} language groups`);
            return languageItems;
            
        } catch (error) {
            console.error('[CODE_ANALYSIS] Error getting Files by Language children:', error);
            this.isScanning = false;
            
            return [new CodeAnalysisTreeItem(
                'Error scanning files',
                vscode.TreeItemCollapsibleState.None,
                'analysis-item',
                undefined,
                new vscode.ThemeIcon('error'),
                `Failed to scan workspace files: ${error}`,
                'Error',
                'scan-error'
            )];
        }
    }

    /**
     * Get children for a specific language group
     */
    private getLanguageGroupChildren(languageName: string): Promise<CodeAnalysisTreeItem[]> {
        console.log(`[CODE_ANALYSIS] Getting children for language group: ${languageName}`);
        
        if (!this.filesByLanguage) {
            console.warn('[CODE_ANALYSIS] No file data available for language group');
            return Promise.resolve([]);
        }
        
        // ✅ Pass context for colored language icons
        const fileItems = CodeAnalysisItemFactory.createFileItems(languageName, this.filesByLanguage, this.context);
        return Promise.resolve(fileItems);
    }

    /**
     * Legacy method for backward compatibility - use forceRefreshFilesScan instead
     * @deprecated Use forceRefreshFilesScan() instead
     */
    async refreshFilesScan(): Promise<void> {
        console.log('[CODE_ANALYSIS] Legacy refreshFilesScan called, delegating to forceRefreshFilesScan');
        await this.forceRefreshFilesScan();
    }

    /**
     * Get the active analyses provider for external access
     */
    getActiveAnalysesProvider(): ActiveAnalysesTreeDataProvider {
        return this.activeAnalysesProvider;
    }

    /**
     * Get the file watcher manager for external access
     */
    getFileWatcherManager(): FileWatcherManager {
        return this.fileWatcherManager;
    }

    /**
     * Start tracking a file analysis
     */
    startFileAnalysis(filePath: string, mode: 'Static' | 'XR', language?: string): string {
        console.log(`[CODE_ANALYSIS] Starting file analysis tracking for ${filePath}`);
        return this.activeAnalysesProvider.startFileAnalysis(filePath, mode, language);
    }

    /**
     * Start tracking a directory analysis
     */
    startDirectoryAnalysis(directoryPath: string, mode: 'Static' | 'XR'): string {
        console.log(`[CODE_ANALYSIS] Starting directory analysis tracking for ${directoryPath}`);
        return this.activeAnalysesProvider.startDirectoryAnalysis(directoryPath, mode);
    }

    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId: string, metadata?: any): void {
        this.activeAnalysesProvider.completeAnalysis(analysisId, metadata);
    }

    /**
     * Fail an analysis
     */
    failAnalysis(analysisId: string, error: string): void {
        this.activeAnalysesProvider.failAnalysis(analysisId, error);
    }
}
