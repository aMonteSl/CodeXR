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
exports.CodeAnalysisTreeDataProvider = void 0;
const vscode = __importStar(require("vscode"));
const analysisTreeItems_1 = require("./items/analysisTreeItems");
const fileScanner_1 = require("../utils/fileScanner");
const activeAnalysesTreeView_1 = require("../active_analyses/views/activeAnalysesTreeView");
const activeAnalysesCommands_1 = require("../active_analyses/commands/activeAnalysesCommands");
const fileWatcherManager_1 = require("../runtime/fileWatcherManager");
/**
 * Code Analysis tree data provider that manages the analysis sections
 *
 * Architecture Notes:
 * - This view provides code analysis functionality
 * - Displays active analyses, settings, and file organization
 * - Follows the same patterns as other sections in the unified view
 */
class CodeAnalysisTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    filesByLanguage = null;
    isScanning = false;
    activeAnalysesProvider;
    activeAnalysesCommands;
    fileWatcherManager;
    constructor(context) {
        this.context = context;
        console.log('[CODE_ANALYSIS] Code analysis tree data provider initialized');
        // Initialize the active analyses provider and commands
        this.activeAnalysesProvider = new activeAnalysesTreeView_1.ActiveAnalysesTreeDataProvider(context);
        this.activeAnalysesCommands = new activeAnalysesCommands_1.ActiveAnalysesCommands(context);
        this.fileWatcherManager = fileWatcherManager_1.FileWatcherManager.getInstance(context);
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
    async initializeFileScanning() {
        try {
            console.log('[CODE_ANALYSIS] Starting initial background file scanning...');
            this.isScanning = true;
            // Scan files in background
            this.filesByLanguage = await fileScanner_1.FileScanner.scanWorkspaceFiles();
            this.isScanning = false;
            const status = this.getScanningStatus();
            console.log(`[CODE_ANALYSIS] Initial background file scan completed - Found ${status.fileCount} files in ${status.languageCount} languages`);
            // Refresh the tree to show updated counts
            this.refresh();
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error during initial background file scanning:', error);
            this.isScanning = false;
        }
    }
    /**
     * Force refresh file scan data (clears existing data and rescans)
     */
    async forceRefreshFilesScan() {
        console.log('[CODE_ANALYSIS] Force refreshing files scan');
        this.filesByLanguage = null;
        this.isScanning = false;
        // Trigger a new scan
        await this.initializeFileScanning();
    }
    /**
     * Get current scanning status
     */
    isCurrentlyScanning() {
        return this.isScanning;
    }
    /**
     * Check if files have been scanned
     */
    hasScannedFiles() {
        return this.filesByLanguage !== null;
    }
    /**
     * Get scanning status for debugging
     */
    getScanningStatus() {
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
    refresh() {
        console.log('[CODE_ANALYSIS] Refreshing code analysis tree view');
        this._onDidChangeTreeData.fire();
    }
    /**
     * Get tree item representation
     */
    getTreeItem(element) {
        return element;
    }
    /**
     * Get children for the tree view
     */
    getChildren(element) {
        if (!element) {
            // Root level - return the main analysis sections with file counts if available
            console.log('[CODE_ANALYSIS] Loading root analysis sections');
            return Promise.resolve(analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(this.filesByLanguage || undefined, this.isScanning, this.activeAnalysesProvider.getActiveAnalysesSummary()));
        }
        // Handle expanding sections
        switch (element.type) {
            case 'active-analyses':
                console.log('[CODE_ANALYSIS] Loading Active Analyses children');
                return Promise.resolve(this.activeAnalysesProvider.getActiveAnalysesTreeItems());
            case 'analysis-settings':
                console.log('[CODE_ANALYSIS] Loading Analysis Settings children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('analysis-settings', this.context);
            case 'project-structure':
                console.log('[CODE_ANALYSIS] Loading Project Structure children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
            case 'files-by-language':
                console.log('[CODE_ANALYSIS] Loading Files by Language children');
                return this.getFilesByLanguageChildren();
            case 'language-group':
                console.log(`[CODE_ANALYSIS] Loading files for language: ${element.languageName}`);
                return this.getLanguageGroupChildren(element.languageName);
            case 'dimension-mapping-file':
                console.log('[CODE_ANALYSIS] Loading Dimension Mapping (File) children');
                return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
            default:
                console.log('[CODE_ANALYSIS] No children available for this item type');
                return Promise.resolve([]);
        }
    }
    /**
     * Get the main code analysis sections for integration with unified view
     */
    getCodeAnalysisSections() {
        console.log('[CODE_ANALYSIS] Getting code analysis sections for unified view');
        return analysisTreeItems_1.CodeAnalysisItemFactory.createCodeAnalysisSectionsWithCounts(this.filesByLanguage || undefined, this.isScanning, this.activeAnalysesProvider.getActiveAnalysesSummary());
    }
    /**
     * Get children for a specific section type (used by unified view)
     */
    getSectionChildren(sectionType) {
        console.log(`[CODE_ANALYSIS] Getting children for section: ${sectionType}`);
        if (sectionType === 'files-by-language') {
            return this.getFilesByLanguageChildren();
        }
        if (sectionType === 'project-structure') {
            return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('project-structure', this.context);
        }
        if (sectionType === 'dimension-mapping-file') {
            return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems('dimension-mapping-file', this.context);
        }
        return analysisTreeItems_1.CodeAnalysisItemFactory.createPlaceholderItems(sectionType, this.context);
    }
    /**
     * Get children for Files by Language section - triggers file scanning
     */
    async getFilesByLanguageChildren() {
        console.log('[CODE_ANALYSIS] Getting Files by Language children');
        // Prevent multiple concurrent scans
        if (this.isScanning) {
            console.log('[CODE_ANALYSIS] Scan already in progress, returning scanning indicator');
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Scanning files...', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('loading~spin'), 'File scan in progress', 'Please wait', 'scanning')];
        }
        try {
            // Trigger file scan if not already done
            if (!this.filesByLanguage) {
                console.log('ANALYSIS: Scanning files for language analysis...');
                this.isScanning = true;
                this.filesByLanguage = await fileScanner_1.FileScanner.scanWorkspaceFiles();
                this.isScanning = false;
                console.log('[CODE_ANALYSIS] File scan completed, refreshing tree view');
                // Refresh the entire tree to update the root label with counts
                this.refresh();
            }
            // Create language group items
            const languageItems = analysisTreeItems_1.CodeAnalysisItemFactory.createLanguageGroupItems(this.filesByLanguage, this.context);
            if (languageItems.length === 0) {
                return [new analysisTreeItems_1.CodeAnalysisTreeItem('No files found', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('info'), 'No files detected in workspace', '', 'no-files')];
            }
            console.log(`[CODE_ANALYSIS] Returning ${languageItems.length} language groups`);
            return languageItems;
        }
        catch (error) {
            console.error('[CODE_ANALYSIS] Error getting Files by Language children:', error);
            this.isScanning = false;
            return [new analysisTreeItems_1.CodeAnalysisTreeItem('Error scanning files', vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), `Failed to scan workspace files: ${error}`, 'Error', 'scan-error')];
        }
    }
    /**
     * Get children for a specific language group
     */
    getLanguageGroupChildren(languageName) {
        console.log(`[CODE_ANALYSIS] Getting children for language group: ${languageName}`);
        if (!this.filesByLanguage) {
            console.warn('[CODE_ANALYSIS] No file data available for language group');
            return Promise.resolve([]);
        }
        // ✅ Pass context for colored language icons
        const fileItems = analysisTreeItems_1.CodeAnalysisItemFactory.createFileItems(languageName, this.filesByLanguage, this.context);
        return Promise.resolve(fileItems);
    }
    /**
     * Legacy method for backward compatibility - use forceRefreshFilesScan instead
     * @deprecated Use forceRefreshFilesScan() instead
     */
    async refreshFilesScan() {
        console.log('[CODE_ANALYSIS] Legacy refreshFilesScan called, delegating to forceRefreshFilesScan');
        await this.forceRefreshFilesScan();
    }
    /**
     * Get the active analyses provider for external access
     */
    getActiveAnalysesProvider() {
        return this.activeAnalysesProvider;
    }
    /**
     * Get the file watcher manager for external access
     */
    getFileWatcherManager() {
        return this.fileWatcherManager;
    }
    /**
     * Start tracking a file analysis
     */
    startFileAnalysis(filePath, mode, language) {
        console.log(`[CODE_ANALYSIS] Starting file analysis tracking for ${filePath}`);
        return this.activeAnalysesProvider.startFileAnalysis(filePath, mode, language);
    }
    /**
     * Start tracking a directory analysis
     */
    startDirectoryAnalysis(directoryPath, mode) {
        console.log(`[CODE_ANALYSIS] Starting directory analysis tracking for ${directoryPath}`);
        return this.activeAnalysesProvider.startDirectoryAnalysis(directoryPath, mode);
    }
    /**
     * Complete an analysis
     */
    completeAnalysis(analysisId, metadata) {
        this.activeAnalysesProvider.completeAnalysis(analysisId, metadata);
    }
    /**
     * Fail an analysis
     */
    failAnalysis(analysisId, error) {
        this.activeAnalysesProvider.failAnalysis(analysisId, error);
    }
}
exports.CodeAnalysisTreeDataProvider = CodeAnalysisTreeDataProvider;
//# sourceMappingURL=codeAnalysisTreeView.js.map