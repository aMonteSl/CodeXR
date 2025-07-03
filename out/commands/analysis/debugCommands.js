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
exports.registerDebugCommands = registerDebugCommands;
exports.registerClearAnalysisCacheCommand = registerClearAnalysisCacheCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileWatchManager_1 = require("../../analysis/watchers/fileWatchManager");
const dataManager_1 = require("../../analysis/utils/dataManager");
/**
 * Commands for debugging and troubleshooting analysis operations
 */
/**
 * Registers debug related commands
 * @returns Array of disposables for the registered commands
 */
function registerDebugCommands() {
    const disposables = [];
    // File system watcher debug command
    disposables.push(registerDebugFileSystemWatcherCommand());
    // Analysis watchers debug command
    disposables.push(registerDebugAnalysisWatchersCommand());
    // Tree refresh commands
    disposables.push(registerForceRefreshAnalysisTreeCommand());
    disposables.push(registerRefreshAnalysisTreeCommand());
    // Analysis system status command
    disposables.push(registerAnalysisSystemStatusCommand());
    return disposables;
}
/**
 * Registers the file system watcher debug command
 * @returns Command disposable
 */
function registerDebugFileSystemWatcherCommand() {
    return vscode.commands.registerCommand('codexr.debugFileSystemWatcher', async () => {
        try {
            const treeDataProvider = global.treeDataProvider;
            if (treeDataProvider && typeof treeDataProvider.getFileSystemWatcherStatus === 'function') {
                const status = treeDataProvider.getFileSystemWatcherStatus();
                const statusMessage = `File System Watcher Status:
📊 Active: ${status.isActive ? '✅ Yes' : '❌ No'}
🔢 Watchers: ${status.watcherCount}
🔄 Has Callback: ${status.hasCallback ? '✅ Yes' : '❌ No'}
⏱️ Pending Refresh: ${status.hasPendingRefresh ? '⏳ Yes' : '✅ No'}

The file system watcher automatically refreshes the analysis tree when files are added, removed, or workspace folders change.

${status.isActive ?
                    '✅ Watcher is active and monitoring file changes.' :
                    '❌ Watcher is not active. Try refreshing the tree view manually.'}

💡 Tip: If the watcher isn't working, try reloading the VS Code window.`;
                await vscode.window.showInformationMessage(statusMessage, { modal: true }, 'OK');
                console.log('📊 File System Watcher Debug Info:', status);
            }
            else {
                vscode.window.showErrorMessage('File system watcher not available');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting watcher status: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Registers the analysis watchers debug command
 * @returns Command disposable
 */
function registerDebugAnalysisWatchersCommand() {
    return vscode.commands.registerCommand('codexr.debugWatchers', async () => {
        try {
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (!fileWatchManager) {
                vscode.window.showWarningMessage('FileWatchManager not initialized');
                return;
            }
            const watcherStatus = fileWatchManager.getWatcherStatus();
            const managerStatus = dataManager_1.analysisDataManager.getManagerStatus();
            const filesBeingAnalyzed = dataManager_1.analysisDataManager.getFilesBeingAnalyzed();
            // ✅ ENHANCED: Include countdown information
            const activeCountdowns = watcherStatus.activeTimerDetails.filter(detail => detail.hasCountdown);
            const debugInfo = `🔍 Analysis System Debug Info:

📁 File Watchers:
  • Total watchers: ${watcherStatus.totalWatchers}
  • Active timers: ${watcherStatus.activeTimers}
  • Auto-analysis: ${watcherStatus.autoAnalysisEnabled ? '✅ Enabled' : '❌ Disabled'}
  • Debounce delay: ${watcherStatus.debounceDelay}ms (${watcherStatus.delayCategory})

📊 Data Manager:
  • Analysis results: ${managerStatus.analysisResults}
  • Active panels: ${managerStatus.activePanels}
  • Function panels: ${managerStatus.functionPanels}
  • Function data: ${managerStatus.functionData}
  • Files being analyzed: ${managerStatus.filesBeingAnalyzed}

📝 Watched Files:
${watcherStatus.watchedFiles.length > 0
                ? watcherStatus.watchedFiles.map(file => `  • ${path.basename(file)}`).join('\n')
                : '  • No files being watched'}

⏱️ Active Timers:
${watcherStatus.activeTimerDetails.length > 0
                ? watcherStatus.activeTimerDetails.map(detail => `  • ${detail.file}: ${detail.remainingTime}${detail.hasCountdown ? ' 🕒' : ''}`).join('\n')
                : '  • No active timers'}

🕒 Live Countdowns:
${activeCountdowns.length > 0
                ? activeCountdowns.map(detail => `  • ${detail.file}: Visual countdown active`).join('\n')
                : '  • No active visual countdowns'}

🔄 Currently Analyzing:
${filesBeingAnalyzed.length > 0
                ? filesBeingAnalyzed.map(file => `  • ${path.basename(file)}`).join('\n')
                : '  • No files currently being analyzed'}

⚙️ Performance Settings:
  • Delay Category: ${watcherStatus.delayCategory}
  • Recommended for: ${getDelayRecommendation(watcherStatus.debounceDelay)}

💡 Visual Feedback Features:
  • Status bar countdown: ${activeCountdowns.length > 0 ? '✅ Active' : '❌ None'}
  • Progress bars: Shows analysis progress in real-time
  • Tree view indicators: Different icons for different file states
  • Live updates: Countdown updates every 100ms for smooth experience

🔧 Testing Tips:
  • Save a file to see countdown in action
  • Change delay settings to see immediate timer updates
  • Watch status bar for progress visualization
  • Check tree view for file state indicators`;
            console.log(debugInfo);
            await vscode.window.showInformationMessage(debugInfo, { modal: true }, 'OK');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting debug info: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * ✅ NEW: Get recommendation text for delay value
 * @param delay Delay in milliseconds
 * @returns Recommendation text
 */
function getDelayRecommendation(delay) {
    if (delay <= 500) {
        return 'Small files, fast systems';
    }
    else if (delay <= 1000) {
        return 'Most development scenarios';
    }
    else if (delay <= 2000) {
        return 'Large files, stable analysis';
    }
    else if (delay <= 3000) {
        return 'Very large files, slow systems';
    }
    else {
        return 'Maximum stability, slow response';
    }
}
/**
 * Registers the force refresh analysis tree command
 * @returns Command disposable
 */
function registerForceRefreshAnalysisTreeCommand() {
    return vscode.commands.registerCommand('codexr.forceRefreshAnalysisTree', async () => {
        try {
            console.log('🔄 Manual tree refresh triggered');
            const treeDataProvider = global.treeDataProvider;
            if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
                treeDataProvider.refresh();
                vscode.window.showInformationMessage('Analysis tree refreshed manually');
                console.log('✅ Manual tree refresh completed');
            }
            else {
                vscode.window.showErrorMessage('Tree data provider not available');
                console.error('❌ Tree data provider not found');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Error refreshing tree: ${errorMessage}`);
            console.error('❌ Error during manual refresh:', error);
        }
    });
}
/**
 * Registers the refresh analysis tree command
 * @returns Command disposable
 */
function registerRefreshAnalysisTreeCommand() {
    return vscode.commands.registerCommand('codexr.refreshAnalysisTree', async () => {
        console.log('Refreshing analysis tree view...');
        const treeDataProvider = global.treeDataProvider;
        if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
            treeDataProvider.refresh();
            vscode.window.showInformationMessage('Analysis tree refreshed');
        }
        else {
            vscode.window.showWarningMessage('Tree data provider not available');
        }
    });
}
/**
 * Registers the analysis system status command
 * @returns Command disposable
 */
function registerAnalysisSystemStatusCommand() {
    return vscode.commands.registerCommand('codexr.analysisSystemStatus', async () => {
        try {
            // Get current configuration
            const config = vscode.workspace.getConfiguration();
            const analysisMode = config.get('codexr.analysisMode', 'Static');
            const autoAnalysis = config.get('codexr.analysis.autoAnalysis', true);
            const debounceDelay = config.get('codexr.analysis.debounceDelay', 2000);
            const chartType = config.get('codexr.analysis.chartType', 'boats');
            // Get workspace info
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const workspaceCount = workspaceFolders ? workspaceFolders.length : 0;
            // Get file watch manager status
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            const watcherStatus = fileWatchManager ? fileWatchManager.getWatcherStatus() : null;
            // Get data manager status
            const managerStatus = dataManager_1.analysisDataManager.getManagerStatus();
            const statusInfo = `📊 CodeXR Analysis System Status:

🔧 Configuration:
  • Analysis Mode: ${analysisMode}
  • Auto-Analysis: ${autoAnalysis ? '✅ Enabled' : '❌ Disabled'}
  • Debounce Delay: ${debounceDelay}ms
  • Chart Type: ${chartType}

📁 Workspace:
  • Folders: ${workspaceCount}
  • Root: ${workspaceFolders?.[0]?.name || 'No workspace'}

⚡ Analysis Engine:
  • File Watchers: ${watcherStatus ? watcherStatus.totalWatchers : 'N/A'}
  • Active Timers: ${watcherStatus ? watcherStatus.activeTimers : 'N/A'}
  • Analysis Results Cached: ${managerStatus.analysisResults}
  • Active Panels: ${managerStatus.activePanels}

🎯 Performance:
  • Files Being Analyzed: ${managerStatus.filesBeingAnalyzed}
  • Function Data Cached: ${managerStatus.functionData}
  • Function Panels: ${managerStatus.functionPanels}

🔍 Debug Commands Available:
  • codexr.debugFileSystemWatcher
  • codexr.debugWatchers
  • codexr.forceRefreshAnalysisTree

✅ System Status: ${getSystemHealthStatus(managerStatus, watcherStatus)}`;
            console.log('📊 Analysis System Status:', {
                config: { analysisMode, autoAnalysis, debounceDelay, chartType },
                workspace: { workspaceCount, rootFolder: workspaceFolders?.[0]?.name },
                watcher: watcherStatus,
                manager: managerStatus
            });
            await vscode.window.showInformationMessage(statusInfo, { modal: true }, 'OK');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error getting system status: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * Determines system health status based on various metrics
 * @param managerStatus Data manager status
 * @param watcherStatus File watcher status
 * @returns Health status string
 */
function getSystemHealthStatus(managerStatus, watcherStatus) {
    const issues = [];
    // Check for potential issues
    if (managerStatus.filesBeingAnalyzed > 5) {
        issues.push('Many files being analyzed');
    }
    if (watcherStatus && watcherStatus.activeTimers > 10) {
        issues.push('Many active timers');
    }
    if (!watcherStatus || !watcherStatus.autoAnalysisEnabled) {
        issues.push('Auto-analysis disabled');
    }
    if (issues.length === 0) {
        return '🟢 Healthy';
    }
    else if (issues.length <= 2) {
        return `🟡 Minor issues: ${issues.join(', ')}`;
    }
    else {
        return `🔴 Issues detected: ${issues.join(', ')}`;
    }
}
/**
 * Clear analysis cache command
 * @returns Command disposable
 */
function registerClearAnalysisCacheCommand() {
    return vscode.commands.registerCommand('codexr.clearAnalysisCache', async () => {
        try {
            const confirm = await vscode.window.showWarningMessage('Clear all cached analysis data?', {
                modal: true,
                detail: 'This will remove all stored analysis results and force re-analysis of files.'
            }, 'Clear Cache', 'Cancel');
            if (confirm === 'Clear Cache') {
                // Clear analysis data manager cache
                dataManager_1.analysisDataManager.clearAllData();
                // Stop all file watchers
                const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                if (fileWatchManager) {
                    fileWatchManager.stopAllWatchers();
                }
                // Refresh tree
                const treeDataProvider = global.treeDataProvider;
                if (treeDataProvider && typeof treeDataProvider.refresh === 'function') {
                    treeDataProvider.refresh();
                }
                vscode.window.showInformationMessage('Analysis cache cleared successfully');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error clearing cache: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
//# sourceMappingURL=debugCommands.js.map