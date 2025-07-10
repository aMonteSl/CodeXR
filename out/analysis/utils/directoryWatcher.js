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
exports.SharedDirectoryWatcherManager = exports.SharedDirectoryWatcher = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const debounceUtils_1 = require("../../utils/debounceUtils");
const directoryAnalysisManager_1 = require("../static/directory/directoryAnalysisManager");
const directoryAnalysisConfig_1 = require("../static/directory/common/directoryAnalysisConfig");
const hashBasedChangeDetector_1 = require("../shared/hashBasedChangeDetector");
/**
 * Shared directory watcher that handles file system changes for all analysis types
 */
class SharedDirectoryWatcher {
    directoryPath;
    options;
    watcher;
    lastAnalysisResult;
    debouncedAnalysisFunction;
    statusMessage;
    countdownInterval;
    autoAnalysisEnabled = true;
    constructor(directoryPath, options) {
        console.log(`RE-ANALYSIS: Creating SharedDirectoryWatcher for ${directoryPath} (mode: ${options.mode})`);
        console.log(`RE-ANALYSIS: Constructor options:`, options);
        this.directoryPath = directoryPath;
        this.options = {
            includeSubdirectories: false,
            isProject: false,
            ...options
            // Don't set default debounceDelay here - let loadConfiguration handle it
        };
        console.log(`RE-ANALYSIS: Options after merge:`, this.options);
        this.loadConfiguration();
        this.createDebouncedAnalysisFunction();
        this.setupConfigurationListener();
        console.log(`RE-ANALYSIS: SharedDirectoryWatcher construction complete for ${directoryPath}`);
    }
    /**
     * Loads configuration from VS Code settings
     */
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration();
        this.autoAnalysisEnabled = config.get('codexr.analysis.autoAnalysis', true);
        // Always load debounce delay from user configuration (override any previous value)
        const newDebounceDelay = config.get('codexr.analysis.debounceDelay', 2000);
        const previousDelay = this.options.debounceDelay;
        this.options.debounceDelay = newDebounceDelay;
        if (previousDelay !== newDebounceDelay) {
            console.log(`📊 Directory watcher (${this.options.mode}) debounce delay updated: ${previousDelay}ms → ${newDebounceDelay}ms`);
        }
        else {
            console.log(`📊 Directory watcher (${this.options.mode}) using debounce delay: ${newDebounceDelay}ms`);
        }
    }
    /**
     * Creates a debounced analysis function
     */
    createDebouncedAnalysisFunction() {
        console.log(`RE-ANALYSIS: Creating debounced analysis function for ${this.options.mode} with delay ${this.options.debounceDelay}ms`);
        this.debouncedAnalysisFunction = (0, debounceUtils_1.debounce)(async () => {
            console.log(`RE-ANALYSIS: Debounce timer expired - starting analysis`);
            if (!this.autoAnalysisEnabled) {
                console.log(`RE-ANALYSIS: Aborting - auto-analysis disabled during debounce period`);
                return;
            }
            try {
                await this.performIncrementalAnalysis();
            }
            catch (error) {
                console.error(`RE-ANALYSIS: Error during auto directory analysis:`, error);
                this.options.onAnalysisError?.(error instanceof Error ? error : new Error(String(error)));
                this.clearStatusMessage();
                this.showErrorMessage(error);
            }
        }, this.options.debounceDelay);
        console.log(`RE-ANALYSIS: Debounced function created successfully`);
    }
    /**
     * Performs incremental analysis with intelligent change detection
     */
    async performIncrementalAnalysis() {
        this.clearStatusMessage();
        const dirName = path.basename(this.directoryPath);
        // Show analyzing message
        this.options.onAnalysisStart?.(this.directoryPath);
        this.statusMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: Detecting changes in ${dirName}/...`);
        console.log(`🔄 Auto-analyzing directory (${this.options.mode}): ${this.directoryPath}`);
        // Perform analysis with intelligent change detection
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${this.options.mode.toUpperCase()} Directory Re-analysis`,
            cancellable: false
        }, async (progress) => {
            progress.report({
                increment: 10,
                message: 'Detecting file changes...'
            });
            // Get current files with their hashes
            const currentFiles = await hashBasedChangeDetector_1.HashBasedChangeDetector.getCurrentFileListWithHashes(this.directoryPath, this.options.includeSubdirectories || false);
            // Convert previous analysis result to FileWithHash format if available
            const previousFiles = this.lastAnalysisResult
                ? hashBasedChangeDetector_1.HashBasedChangeDetector.convertFromFileMetrics(this.lastAnalysisResult.files)
                : [];
            // Perform hash-based change detection
            const changeDetection = hashBasedChangeDetector_1.HashBasedChangeDetector.detectChanges(this.directoryPath, currentFiles, previousFiles);
            // Log detailed change information
            console.log(`RE-ANALYSIS: Change detection completed:`);
            console.log(`RE-ANALYSIS: Total current files: ${currentFiles.length}`);
            console.log(`RE-ANALYSIS: Total previous files: ${previousFiles.length}`);
            console.log(`RE-ANALYSIS: Added files: ${changeDetection.added.length}`);
            console.log(`RE-ANALYSIS: Modified files: ${changeDetection.modified.length}`);
            console.log(`RE-ANALYSIS: Deleted files: ${changeDetection.deleted.length}`);
            console.log(`RE-ANALYSIS: Unchanged files: ${changeDetection.unchanged.length}`);
            if (changeDetection.added.length > 0) {
                console.log(`RE-ANALYSIS: Added files:`, changeDetection.added.map(f => f.relativePath));
            }
            if (changeDetection.modified.length > 0) {
                console.log(`RE-ANALYSIS: Modified files:`, changeDetection.modified.map(f => f.relativePath));
            }
            if (changeDetection.deleted.length > 0) {
                console.log(`RE-ANALYSIS: Deleted files:`, changeDetection.deleted.map(f => f.relativePath));
            }
            // Log unchanged files (limited to first 10 for readability)
            if (changeDetection.unchanged.length > 0) {
                const unchangedToShow = changeDetection.unchanged.slice(0, 10).map(f => f.relativePath);
                const additionalCount = Math.max(0, changeDetection.unchanged.length - 10);
                console.log(`RE-ANALYSIS: Skipping unchanged files: ${unchangedToShow.join(', ')}${additionalCount > 0 ? ` (and ${additionalCount} more)` : ''}`);
            }
            // If no changes detected, return the existing result
            if (!changeDetection.hasChanges) {
                progress.report({
                    increment: 100,
                    message: 'No changes detected'
                });
                console.log(`✅ No changes detected in ${dirName}, skipping re-analysis`);
                console.log(`RE-ANALYSIS: Analysis complete - no changes`);
                return this.lastAnalysisResult;
            }
            progress.report({
                increment: 30,
                message: `Found ${changeDetection.added.length + changeDetection.modified.length} files to analyze...`
            });
            // Only re-analyze changed and new files
            const filesToAnalyze = [...changeDetection.added.map(f => f.relativePath), ...changeDetection.modified.map(f => f.relativePath)];
            console.log(`RE-ANALYSIS: These files to re-analysis: ${filesToAnalyze.join(', ')}`);
            if (filesToAnalyze.length === 0) {
                // Only deletions, update the result by removing deleted files
                const updatedResult = this.removeDeletedFiles(this.lastAnalysisResult, changeDetection.deleted.map(f => f.relativePath));
                progress.report({
                    increment: 100,
                    message: `Removed ${changeDetection.deleted.length} deleted files`
                });
                return updatedResult;
            }
            // Set up analysis using static analysis manager
            const analysisManager = new directoryAnalysisManager_1.DirectoryAnalysisManager();
            // Use appropriate filters based on mode and subdirectory inclusion
            const filters = this.options.includeSubdirectories
                ? { ...directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS, maxDepth: 10 } // Deep analysis
                : { ...directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS, maxDepth: 1 }; // Shallow analysis
            progress.report({
                increment: 50,
                message: `Analyzing ${filesToAnalyze.length} changed files...`
            });
            // Set up progress callback for incremental analysis
            const progressCallback = (current, total, currentFile) => {
                const percentage = 50 + Math.round((current / total) * 40);
                progress.report({
                    increment: Math.max(0, percentage - 50),
                    message: `Analyzing file ${current}/${total}: ${path.basename(currentFile)}`
                });
            };
            // Set progress callback
            analysisManager.setProgressCallback(progressCallback);
            // Perform analysis using static analysis manager (with hash-based incremental updates)
            const fullAnalysisResult = await analysisManager.analyzeDirectory(this.directoryPath, filters, this.lastAnalysisResult // Pass previous result for incremental analysis
            );
            // Clear progress callback
            analysisManager.clearProgressCallback();
            progress.report({
                increment: 95,
                message: 'Merging results...'
            });
            // Merge the results: keep unchanged files from previous analysis, 
            // add/update new and modified files from current analysis
            const mergedResult = this.mergeAnalysisResults(this.lastAnalysisResult, fullAnalysisResult, changeDetection);
            progress.report({
                increment: 100,
                message: 'Analysis complete'
            });
            return mergedResult;
        });
        // Update stored result
        this.lastAnalysisResult = result;
        // Notify callback
        if (this.options.onAnalysisUpdate) {
            await this.options.onAnalysisUpdate(result);
        }
        // Clear analyzing message and show completion
        this.clearStatusMessage();
        this.options.onAnalysisComplete?.(result);
        this.statusMessage = vscode.window.setStatusBarMessage(`$(check) CodeXR: ${dirName}/ re-analysis completed (${result.summary.totalFilesAnalyzed} files)`);
        // Clear completion message after 3 seconds
        setTimeout(() => {
            this.clearStatusMessage();
        }, 3000);
    }
    /**
     * Starts watching the directory
     */
    startWatching(initialResult) {
        console.log(`RE-ANALYSIS: Starting directory watch for ${this.options.mode}: ${this.directoryPath}`);
        if (this.watcher) {
            console.log(`👁️⚠️ Already watching directory: ${this.directoryPath}`);
            return;
        }
        this.lastAnalysisResult = initialResult;
        console.log(`👁️✅ Starting directory watch (${this.options.mode}): ${this.directoryPath}`);
        console.log(`RE-ANALYSIS: Include subdirectories: ${this.options.includeSubdirectories}`);
        console.log(`RE-ANALYSIS: Auto-analysis enabled: ${this.autoAnalysisEnabled}`);
        console.log(`RE-ANALYSIS: Debounce delay: ${this.options.debounceDelay}ms`);
        // Create file system watcher
        const pattern = this.options.includeSubdirectories
            ? new vscode.RelativePattern(this.directoryPath, '**/*')
            : new vscode.RelativePattern(this.directoryPath, '*');
        console.log(`RE-ANALYSIS: File watcher pattern: ${pattern.pattern} (base: ${pattern.baseUri?.fsPath || 'none'})`);
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
        // Handle file creation
        this.watcher.onDidCreate((uri) => {
            console.log(`📁➕ File created in watched directory (${this.options.mode}): ${uri.fsPath}`);
            console.log(`RE-ANALYSIS: File creation detected - triggering analysis`);
            this.triggerAnalysis();
        });
        // Handle file changes
        this.watcher.onDidChange((uri) => {
            console.log(`📁✏️ File changed in watched directory (${this.options.mode}): ${uri.fsPath}`);
            console.log(`RE-ANALYSIS: File change detected - triggering analysis`);
            this.triggerAnalysis();
        });
        // Handle file deletion
        this.watcher.onDidDelete((uri) => {
            console.log(`📁🗑️ File deleted in watched directory (${this.options.mode}): ${uri.fsPath}`);
            console.log(`RE-ANALYSIS: File deletion detected - triggering analysis`);
            this.triggerAnalysis();
        });
        console.log(`RE-ANALYSIS: File system watcher successfully initialized for ${this.directoryPath}`);
    }
    /**
     * Triggers debounced analysis
     */
    triggerAnalysis() {
        console.log(`RE-ANALYSIS: File system change detected for ${this.options.mode} analysis`);
        console.log(`RE-ANALYSIS: Auto-analysis enabled: ${this.autoAnalysisEnabled}`);
        console.log(`RE-ANALYSIS: Debounced function exists: ${!!this.debouncedAnalysisFunction}`);
        console.log(`RE-ANALYSIS: Debounce delay: ${this.options.debounceDelay}ms`);
        if (!this.autoAnalysisEnabled) {
            console.log(`RE-ANALYSIS: Skipping analysis - auto-analysis is disabled`);
            return;
        }
        if (this.debouncedAnalysisFunction) {
            console.log(`RE-ANALYSIS: Debounce timer started (${this.options.debounceDelay}ms)`);
            // Show countdown status message
            this.updateStatusMessage();
            this.debouncedAnalysisFunction();
        }
        else {
            console.log(`RE-ANALYSIS: ERROR - Debounced function not available`);
        }
    }
    /**
     * Updates status message with countdown and progress bar (matching other analysis types)
     */
    updateStatusMessage() {
        this.clearStatusMessage();
        const dirName = path.basename(this.directoryPath);
        const totalTime = this.options.debounceDelay || 2000;
        let remaining = totalTime;
        let lastDisplayedSeconds = -1;
        const updateMessage = () => {
            const remainingSeconds = Math.ceil(remaining / 1000);
            // Update display only when seconds change
            if (remainingSeconds !== lastDisplayedSeconds && remaining > 0) {
                lastDisplayedSeconds = remainingSeconds;
                // Clear previous message
                if (this.statusMessage) {
                    this.statusMessage.dispose();
                }
                // Create progress bar effect (same as FileWatchManager and DirectoryWatchManager)
                const progress = Math.round(((totalTime - remaining) / totalTime) * 10);
                const progressBar = '█'.repeat(progress) + '░'.repeat(10 - progress);
                // Show updated countdown with progress bar
                this.statusMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: ${dirName}/ re-analysis in ${remainingSeconds}s ${progressBar}`);
            }
            // Clear countdown when time is up
            if (remaining <= 0) {
                this.clearStatusMessage();
                // Show "analyzing now" message (like other analysis types)
                this.statusMessage = vscode.window.setStatusBarMessage(`$(sync~spin) CodeXR: Re-analyzing ${dirName}/ now...`);
            }
            remaining -= 100; // Update every 100ms for smooth progress bar
        };
        updateMessage();
        this.countdownInterval = setInterval(updateMessage, 100); // Update every 100ms for smooth progress
    }
    /**
     * Clears status message and countdown
     */
    clearStatusMessage() {
        if (this.statusMessage) {
            this.statusMessage.dispose();
            this.statusMessage = undefined;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = undefined;
        }
    }
    /**
     * Shows error message
     */
    showErrorMessage(error) {
        const dirName = path.basename(this.directoryPath);
        this.statusMessage = vscode.window.setStatusBarMessage(`$(error) CodeXR: ${dirName}/ re-analysis failed`);
        setTimeout(() => {
            this.clearStatusMessage();
        }, 5000);
    }
    /**
     * Stops watching the directory
     */
    stopWatching() {
        if (this.watcher) {
            console.log(`👁️❌ Stopping directory watch (${this.options.mode}): ${this.directoryPath}`);
            this.watcher.dispose();
            this.watcher = undefined;
        }
        this.clearStatusMessage();
    }
    /**
     * Checks if currently watching
     */
    isWatching() {
        return this.watcher !== undefined;
    }
    /**
     * Gets the last analysis result
     */
    getLastAnalysisResult() {
        return this.lastAnalysisResult;
    }
    /**
     * Disposes of all resources
     */
    dispose() {
        this.stopWatching();
    }
    /**
     * Remove deleted files from analysis result
     */
    removeDeletedFiles(previousResult, deletedFiles) {
        if (deletedFiles.length === 0) {
            return previousResult;
        }
        const deletedSet = new Set(deletedFiles);
        const updatedFiles = previousResult.files.filter(file => !deletedSet.has(file.relativePath));
        // Recalculate summary
        const updatedSummary = this.calculateSummary(previousResult.summary.directoryPath, updatedFiles);
        return {
            ...previousResult,
            files: updatedFiles,
            summary: updatedSummary
        };
    }
    /**
     * Merge analysis results keeping unchanged files from previous result
     * and using new analysis for changed/added files
     */
    mergeAnalysisResults(previousResult, newResult, changeDetection) {
        const changedSet = new Set([...changeDetection.added.map(f => f.relativePath), ...changeDetection.modified.map(f => f.relativePath)]);
        const deletedSet = new Set(changeDetection.deleted.map(f => f.relativePath));
        // Create a map of new results by relative path
        const newFileMap = new Map();
        for (const file of newResult.files) {
            newFileMap.set(file.relativePath, file);
        }
        // Start with unchanged files from previous result
        const mergedFiles = previousResult.files
            .filter(file => !changedSet.has(file.relativePath) &&
            !deletedSet.has(file.relativePath));
        // Add changed and new files from new result
        for (const changedFile of changedSet) {
            const newFileData = newFileMap.get(changedFile);
            if (newFileData) {
                mergedFiles.push(newFileData);
            }
        }
        // Sort files by relative path for consistency
        mergedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        // Recalculate summary
        const updatedSummary = this.calculateSummary(previousResult.summary.directoryPath, mergedFiles);
        return {
            ...previousResult,
            files: mergedFiles,
            summary: updatedSummary
        };
    }
    /**
     * Calculate directory analysis summary from file list
     */
    calculateSummary(directoryPath, files) {
        const totalFiles = files.length;
        const totalLines = files.reduce((sum, file) => sum + file.totalLines, 0);
        const totalCommentLines = files.reduce((sum, file) => sum + (file.commentLines || 0), 0);
        const totalFunctions = files.reduce((sum, file) => sum + file.functionCount, 0);
        const totalClasses = files.reduce((sum, file) => sum + file.classCount, 0);
        // Calculate averages
        const averageComplexity = totalFiles > 0
            ? files.reduce((sum, file) => sum + file.meanComplexity, 0) / totalFiles
            : 0;
        const averageDensity = totalFiles > 0
            ? files.reduce((sum, file) => sum + file.meanDensity, 0) / totalFiles
            : 0;
        const averageParameters = totalFiles > 0
            ? files.reduce((sum, file) => sum + file.meanParameters, 0) / totalFiles
            : 0;
        // Calculate language distribution
        const languageDistribution = {};
        for (const file of files) {
            languageDistribution[file.language] = (languageDistribution[file.language] || 0) + 1;
        }
        // Calculate file size distribution
        const fileSizeDistribution = {
            small: 0, // < 1KB
            medium: 0, // 1KB - 10KB
            large: 0, // 10KB - 100KB
            huge: 0 // > 100KB
        };
        for (const file of files) {
            const sizeKB = file.fileSizeBytes / 1024;
            if (sizeKB < 1) {
                fileSizeDistribution.small++;
            }
            else if (sizeKB < 10) {
                fileSizeDistribution.medium++;
            }
            else if (sizeKB < 100) {
                fileSizeDistribution.large++;
            }
            else {
                fileSizeDistribution.huge++;
            }
        }
        // Calculate complexity distribution
        const complexityDistribution = {
            low: 0, // 1-5
            medium: 0, // 6-10
            high: 0, // 11-20
            critical: 0 // > 20
        };
        for (const file of files) {
            const complexity = file.meanComplexity;
            if (complexity <= 5) {
                complexityDistribution.low++;
            }
            else if (complexity <= 10) {
                complexityDistribution.medium++;
            }
            else if (complexity <= 20) {
                complexityDistribution.high++;
            }
            else {
                complexityDistribution.critical++;
            }
        }
        return {
            directoryPath,
            totalFiles: totalFiles, // We don't have non-analyzed files count in incremental
            totalFilesAnalyzed: totalFiles,
            totalFilesNotAnalyzed: 0, // Assume all files we track are analyzed
            totalLines,
            totalCommentLines,
            totalFunctions,
            totalClasses,
            averageComplexity,
            averageDensity,
            averageParameters,
            languageDistribution,
            fileSizeDistribution,
            complexityDistribution,
            analyzedAt: new Date().toISOString(),
            totalDuration: 0 // We don't track duration in incremental updates
        };
    }
    /**
     * Sets up configuration change listener to reload settings when user changes them
     */
    setupConfigurationListener() {
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('codexr.analysis.debounceDelay') ||
                event.affectsConfiguration('codexr.analysis.autoAnalysis')) {
                console.log(`📊 Configuration changed, reloading directory watcher settings for ${this.options.mode}`);
                this.loadConfiguration();
                // Recreate the debounced function with new delay
                this.createDebouncedAnalysisFunction();
            }
        });
    }
}
exports.SharedDirectoryWatcher = SharedDirectoryWatcher;
/**
 * Shared directory watcher manager for all analysis types
 */
class SharedDirectoryWatcherManager {
    static instance;
    watchers = new Map();
    initialized = false;
    /**
     * Gets the singleton instance
     */
    static getInstance() {
        if (!SharedDirectoryWatcherManager.instance) {
            SharedDirectoryWatcherManager.instance = new SharedDirectoryWatcherManager();
        }
        return SharedDirectoryWatcherManager.instance;
    }
    /**
     * Initializes the shared directory watcher manager
     */
    initialize(context) {
        if (this.initialized) {
            console.log(`RE-ANALYSIS: SharedDirectoryWatcherManager already initialized`);
            return;
        }
        console.log(`RE-ANALYSIS: SharedDirectoryWatcherManager.initialize() called`);
        // Listen for configuration changes to update all watchers
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('codexr.analysis')) {
                console.log(`RE-ANALYSIS: Configuration changed, updating all SharedDirectoryWatchers`);
                this.updateAllWatcherConfigurations();
            }
        }));
        this.initialized = true;
        console.log(`RE-ANALYSIS: SharedDirectoryWatcherManager initialized successfully`);
    }
    /**
     * Updates configuration for all active watchers
     */
    updateAllWatcherConfigurations() {
        console.log(`RE-ANALYSIS: Updating configuration for ${this.watchers.size} active watchers`);
        for (const [directoryPath, watcher] of this.watchers) {
            console.log(`RE-ANALYSIS: Updating configuration for watcher: ${directoryPath}`);
            // The watcher will update its own configuration via its onDidChangeConfiguration listener
        }
    }
    /**
     * Starts watching a directory
     */
    startWatching(directoryPath, options, initialResult) {
        console.log(`RE-ANALYSIS: SharedDirectoryWatcherManager.startWatching() called for ${directoryPath} (mode: ${options.mode})`);
        console.log(`RE-ANALYSIS: Manager options:`, options);
        console.log(`RE-ANALYSIS: Initial result provided:`, !!initialResult);
        // Stop existing watcher if any
        const existingWatcher = this.watchers.get(directoryPath);
        if (existingWatcher) {
            console.log(`RE-ANALYSIS: Stopping existing watcher for ${directoryPath}`);
            this.stopWatching(directoryPath);
        }
        // Create new watcher
        console.log(`RE-ANALYSIS: Creating new SharedDirectoryWatcher for ${directoryPath}`);
        const watcher = new SharedDirectoryWatcher(directoryPath, options);
        console.log(`RE-ANALYSIS: Starting watcher for ${directoryPath}`);
        watcher.startWatching(initialResult);
        // Store watcher
        this.watchers.set(directoryPath, watcher);
        console.log(`RE-ANALYSIS: Watcher stored in manager for ${directoryPath}. Total watchers: ${this.watchers.size}`);
    }
    /**
     * Stops watching a directory
     */
    stopWatching(directoryPath) {
        const watcher = this.watchers.get(directoryPath);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(directoryPath);
        }
    }
    /**
     * Checks if a directory is being watched
     */
    isWatching(directoryPath) {
        const watcher = this.watchers.get(directoryPath);
        return watcher?.isWatching() || false;
    }
    /**
     * Gets the last analysis result for a directory
     */
    getLastAnalysisResult(directoryPath) {
        const watcher = this.watchers.get(directoryPath);
        return watcher?.getLastAnalysisResult();
    }
    /**
     * Disposes all watchers
     */
    dispose() {
        for (const watcher of this.watchers.values()) {
            watcher.dispose();
        }
        this.watchers.clear();
    }
}
exports.SharedDirectoryWatcherManager = SharedDirectoryWatcherManager;
//# sourceMappingURL=directoryWatcher.js.map