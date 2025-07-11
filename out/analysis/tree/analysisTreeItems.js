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
exports.WorkspaceRootFolderItem = exports.ProjectFileContainer = exports.DirectoryFileItem = exports.DirectoryFolderItem = exports.FilesByDirectoryContainer = exports.ActiveAnalysisItem = exports.ActiveAnalysesSection = exports.CHART_TYPE_OPTIONS = exports.FilesPerLanguageContainer = exports.AnalysisResetItem = exports.AnalysisChartTypeOptionItem = exports.AnalysisAutoOptionItem = exports.AnalysisDelayOptionItem = exports.AnalysisDirectoryModeOptionItem = exports.AnalysisModeOptionItem = exports.AnalysisSettingsItem = exports.LanguageGroupItem = exports.AnalysisSectionItem = exports.AnalysisFileItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const dataManager_1 = require("../utils/dataManager");
const analysisSettingsManager_1 = require("./analysisSettingsManager");
const fileWatchManager_1 = require("../watchers/fileWatchManager");
const analysisIconUtils_1 = require("./analysisIconUtils");
/**
 * ✅ ENHANCED: Individual file item with countdown indicator
 */
class AnalysisFileItem extends baseItems_1.TreeItem {
    constructor(filePath, relativePath, language, extensionPath) {
        const fileName = path.basename(filePath);
        const isBeingAnalyzed = dataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath);
        // ✅ FIXED: Now FileWatchManager is properly imported
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        const watcherStatus = fileWatchManager?.getWatcherStatus();
        // ✅ FIXED: Add type annotation for detail parameter
        const hasActiveTimer = watcherStatus?.activeTimerDetails.some((detail) => detail.file === fileName && detail.hasCountdown) || false;
        // ✅ ENHANCED: Show different indicators for different states
        let label = fileName;
        let description = `${language} file - ${relativePath}`;
        let tooltip = `Analyze ${fileName} (${language})`;
        let iconPath = vscode.ThemeIcon.File;
        if (isBeingAnalyzed) {
            label = `${fileName} (analyzing...)`;
            description = 'Analysis in progress...';
            tooltip = `Analyzing ${fileName} (${language}) - Please wait...`;
            iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('progressBar.background'));
        }
        else if (hasActiveTimer) {
            // ✅ FIXED: Add type annotation for detail parameter
            const timerDetail = watcherStatus?.activeTimerDetails.find((detail) => detail.file === fileName);
            if (timerDetail) {
                label = `${fileName} (countdown...)`;
                description = `Analysis will start in ${Math.ceil(parseInt(timerDetail.remainingTime) / 1000)}s`;
                tooltip = `${fileName} (${language}) - Auto-analysis will start in ${timerDetail.remainingTime}`;
                iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.orange'));
            }
        }
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_FILE, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.analyzeFileFromTree',
            title: 'Analyze File',
            arguments: [vscode.Uri.file(filePath)]
        }, iconPath);
        this.resourceUri = vscode.Uri.file(filePath);
        this.description = description;
        // ✅ ENHANCED: Different context values for different states
        if (isBeingAnalyzed) {
            this.contextValue = 'analysisFileAnalyzing';
        }
        else if (hasActiveTimer) {
            this.contextValue = 'analysisFileCountdown';
        }
        else {
            this.contextValue = 'analysisFileReady';
        }
    }
}
exports.AnalysisFileItem = AnalysisFileItem;
/**
 * Item for the main analysis section
 */
class AnalysisSectionItem extends baseItems_1.TreeItem {
    constructor(extensionPath) {
        super('Code Analysis', 'Analyze code complexity, functions, and generate visualizations', treeProvider_1.TreeItemType.ANALYSIS_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('search-view-icon'));
    }
}
exports.AnalysisSectionItem = AnalysisSectionItem;
/**
 * Container for language file groups with showing/total info
 */
class LanguageGroupItem extends baseItems_1.TreeItem {
    constructor(language, totalFileCount, showingFileCount, extensionPath) {
        const label = `${language} (${showingFileCount}${showingFileCount < totalFileCount ? `/${totalFileCount}` : ''})`;
        const tooltip = showingFileCount < totalFileCount
            ? `${language} files - Showing ${showingFileCount} of ${totalFileCount} files. Configure display settings to show more.`
            : `${language} files - ${totalFileCount} file${totalFileCount !== 1 ? 's' : ''} available for analysis`;
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_LANGUAGE_GROUP, vscode.TreeItemCollapsibleState.Collapsed, undefined, getLanguageIcon(language, extensionPath));
        this.language = language;
        this.totalFileCount = totalFileCount;
        this.showingFileCount = showingFileCount;
    }
    language;
    totalFileCount;
    showingFileCount;
}
exports.LanguageGroupItem = LanguageGroupItem;
/**
 * Analysis settings container with proper manager integration
 */
class AnalysisSettingsItem extends baseItems_1.TreeItem {
    settingsManager;
    constructor(extensionPath, context) {
        super('Analysis Settings', 'Configure analysis behavior and preferences', treeProvider_1.TreeItemType.ANALYSIS_SETTINGS, vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('settings-gear'));
        this.settingsManager = new analysisSettingsManager_1.AnalysisSettingsManager(context);
    }
    /**
     * Gets all settings children using the settings manager
     */
    async getChildren() {
        return await this.settingsManager.getSettingsChildren();
    }
}
exports.AnalysisSettingsItem = AnalysisSettingsItem;
/**
 * ✅ UPDATED: Item for analysis mode setting option with dynamic icon colors
 */
class AnalysisModeOptionItem extends baseItems_1.TreeItem {
    constructor(currentMode, isSelected, extensionPath) {
        // ✅ CHANGED: Show current mode and make it clickable to change
        const label = `Analysis Mode (Files): ${currentMode}`;
        const description = `Current: ${currentMode} - Click to change`;
        const tooltip = currentMode === 'Static'
            ? 'Static analysis in webview panels. Click to switch to XR mode.'
            : 'XR analysis with 3D visualizations. Click to switch to Static mode.';
        // ✅ NEW: Dynamic icon color based on mode
        const iconName = 'file-code';
        const iconColor = currentMode === 'Static'
            ? new vscode.ThemeColor('charts.green') // Green for Static
            : new vscode.ThemeColor('charts.purple'); // Purple for XR
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.toggleAnalysisMode',
            title: 'Toggle Analysis Mode',
            arguments: []
        }, new vscode.ThemeIcon(iconName, iconColor));
        this.description = description;
    }
}
exports.AnalysisModeOptionItem = AnalysisModeOptionItem;
/**
 * ✅ UPDATED: Item for directory analysis mode setting option - now supports 4 modes with proper capitalization
 */
class AnalysisDirectoryModeOptionItem extends baseItems_1.TreeItem {
    constructor(currentMode, extensionPath) {
        const formattedMode = formatDirectoryModeDisplay(currentMode);
        const label = `Analysis Mode (Directories): ${formattedMode}`;
        const description = `Current: ${formattedMode} - Click to change`;
        // Update tooltip based on current mode
        let tooltip;
        let iconName;
        let iconColor;
        switch (currentMode) {
            case 'static':
                tooltip = 'Static shallow directory analysis. Click to switch modes.';
                iconName = 'folder';
                iconColor = new vscode.ThemeColor('charts.green');
                break;
            case 'static-deep':
                tooltip = 'Static deep directory analysis (recursive). Click to switch modes.';
                iconName = 'folder-library';
                iconColor = new vscode.ThemeColor('charts.green');
                break;
            case 'xr':
                tooltip = 'XR shallow directory analysis with 3D visualization. Click to switch modes.';
                iconName = 'folder';
                iconColor = new vscode.ThemeColor('charts.purple');
                break;
            case 'xr-deep':
                tooltip = 'XR deep directory analysis (recursive) with 3D visualization. Click to switch modes.';
                iconName = 'folder-library';
                iconColor = new vscode.ThemeColor('charts.purple');
                break;
            default:
                tooltip = 'Directory analysis mode. Click to switch modes.';
                iconName = 'folder';
                iconColor = undefined;
        }
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.selectDirectoryAnalysisMode',
            title: 'Select Directory Analysis Mode',
            arguments: []
        }, new vscode.ThemeIcon(iconName, iconColor));
        this.description = description;
    }
}
exports.AnalysisDirectoryModeOptionItem = AnalysisDirectoryModeOptionItem;
/**
 * ✅ ENHANCED: Delay option item with live countdown info
 */
class AnalysisDelayOptionItem extends baseItems_1.TreeItem {
    constructor(delay, extensionPath) {
        // ✅ CATEGORIZE DELAY FOR USER-FRIENDLY DISPLAY
        let delayCategory;
        let delayIcon;
        if (delay <= 500) {
            delayCategory = 'Very Fast';
            delayIcon = 'zap';
        }
        else if (delay <= 1000) {
            delayCategory = 'Fast';
            delayIcon = 'dashboard';
        }
        else if (delay <= 2000) {
            delayCategory = 'Normal';
            delayIcon = 'clock';
        }
        else if (delay <= 3000) {
            delayCategory = 'Slow';
            delayIcon = 'watch';
        }
        else {
            delayCategory = 'Very Slow';
            delayIcon = 'history';
        }
        const label = `Auto-Analysis Delay: ${delay}ms`;
        // ✅ ENHANCED: Show active countdown info in description
        // ✅ FIXED: Now FileWatchManager is properly imported
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        const watcherStatus = fileWatchManager?.getWatcherStatus();
        // ✅ FIXED: Add type annotation for detail parameter
        const activeCountdowns = watcherStatus?.activeTimerDetails.filter((detail) => detail.hasCountdown).length || 0;
        let description = `${delayCategory} - Click to change`;
        if (activeCountdowns > 0) {
            description = `${delayCategory} - ${activeCountdowns} active countdown${activeCountdowns > 1 ? 's' : ''}`;
        }
        const tooltip = `Current delay: ${delay}ms (${delayCategory})

This delay prevents excessive analysis when files change rapidly.
• Lower values = faster response but may impact performance
• Higher values = more stable but slower response
• Current setting: When you save a file, analysis starts after ${delay}ms

${activeCountdowns > 0 ? `\n🕒 Active countdowns: ${activeCountdowns} file(s) waiting for analysis` : ''}

Click to modify the delay setting.`;
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.setAnalysisDebounceDelay',
            title: 'Set Analysis Delay',
            arguments: []
        }, new vscode.ThemeIcon(delayIcon));
        this.description = description;
    }
}
exports.AnalysisDelayOptionItem = AnalysisDelayOptionItem;
/**
 * ✅ UPDATED: Item for toggling auto-analysis (remove emoji indicators)
 */
class AnalysisAutoOptionItem extends baseItems_1.TreeItem {
    constructor(enabled, extensionPath) {
        const label = `Auto-Analysis: ${enabled ? 'Enabled' : 'Disabled'}`;
        const description = enabled
            ? 'Files analyzed automatically on save - Click to disable'
            : 'Manual analysis only - Click to enable auto-analysis';
        const tooltip = enabled
            ? 'Auto-analysis is enabled. Files will be analyzed automatically when saved.\n\nClick to disable automatic analysis.'
            : 'Auto-analysis is disabled. Files must be analyzed manually.\n\nClick to enable automatic analysis on file save.';
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.toggleAutoAnalysis',
            title: 'Toggle Auto Analysis',
            arguments: []
        }, new vscode.ThemeIcon(enabled ? 'sync' : 'sync-ignored'));
        this.description = description;
    }
}
exports.AnalysisAutoOptionItem = AnalysisAutoOptionItem;
/**
 * Item for setting chart type for analysis visualizations
 */
class AnalysisChartTypeOptionItem extends baseItems_1.TreeItem {
    constructor(currentChart, extensionPath, analysisType = 'File') {
        const label = `Chart Type (${analysisType}): ${currentChart}`;
        const description = `Current: ${currentChart} - Click to change`;
        const tooltip = `Current chart type for ${analysisType} XR analysis visualizations: ${currentChart}\n\nClick to select a different chart type for future ${analysisType} XR analyses.`;
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: analysisType === 'Directory' ? 'codexr.setDirectoryAnalysisChartType' : 'codexr.setAnalysisChartType',
            title: `Set ${analysisType} Chart Type`,
            arguments: []
        }, new vscode.ThemeIcon('graph'));
        this.description = description;
    }
}
exports.AnalysisChartTypeOptionItem = AnalysisChartTypeOptionItem;
/**
 * Item for reset to defaults
 */
class AnalysisResetItem extends baseItems_1.TreeItem {
    constructor(extensionPath) {
        super('Reset to Defaults', 'Reset all analysis settings to their default values', treeProvider_1.TreeItemType.ANALYSIS_RESET, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.resetAnalysisDefaults',
            title: 'Reset Analysis Settings',
            arguments: []
        }, new vscode.ThemeIcon('discard'));
        this.description = 'Restore default analysis configuration';
    }
}
exports.AnalysisResetItem = AnalysisResetItem;
/**
 * Container item for all files per language groups
 */
class FilesPerLanguageContainer extends baseItems_1.TreeItem {
    constructor(totalLanguages, totalFiles, extensionPath) {
        const label = `Files by Language`;
        const description = `${totalLanguages} language${totalLanguages !== 1 ? 's' : ''}, ${totalFiles} file${totalFiles !== 1 ? 's' : ''}`;
        const tooltip = `Browse files by programming language\n\n${totalLanguages} programming language${totalLanguages !== 1 ? 's' : ''} found with ${totalFiles} analyzable file${totalFiles !== 1 ? 's' : ''} total.`;
        super(label, tooltip, treeProvider_1.TreeItemType.FILES_PER_LANGUAGE_CONTAINER, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('folder-library'));
        this.description = description;
    }
}
exports.FilesPerLanguageContainer = FilesPerLanguageContainer;
/**
 * Gets appropriate icon for language using PNG files
 */
function getLanguageIcon(language, extensionPath) {
    let iconFileName;
    switch (language) {
        case 'JavaScript':
            iconFileName = 'javascript.png';
            break;
        case 'TypeScript':
            iconFileName = 'typescript.png';
            break;
        case 'Python':
            iconFileName = 'python.png';
            break;
        case 'Java':
            iconFileName = 'java.png';
            break;
        case 'C':
            iconFileName = 'c.png';
            break;
        case 'C++':
            iconFileName = 'cpp.png';
            break;
        case 'C#':
            iconFileName = 'csharp.png';
            break;
        case 'Ruby':
            iconFileName = 'ruby.png';
            break;
        case 'PHP':
            iconFileName = 'php.png';
            break;
        case 'Go':
            iconFileName = 'go.png';
            break;
        case 'Rust':
            iconFileName = 'rust.png';
            break;
        case 'Swift':
            iconFileName = 'swift.png';
            break;
        case 'Kotlin':
            iconFileName = 'kotlin.png';
            break;
        case 'HTML':
            iconFileName = 'html.png';
            break;
        case 'Vue':
            iconFileName = 'vue.png';
            break;
        case 'Scala':
            iconFileName = 'scala.png';
            break;
        case 'Lua':
            iconFileName = 'lua.png';
            break;
        case 'Erlang':
            iconFileName = 'erlang.png';
            break;
        case 'Zig':
            iconFileName = 'zig.png';
            break;
        case 'Perl':
            iconFileName = 'perl.png';
            break;
        case 'GDScript':
            iconFileName = 'gdscript.png';
            break;
        case 'Solidity':
            iconFileName = 'solidity.png';
            break;
        case 'Fortran':
            iconFileName = 'fortran.png';
            break;
        case 'TTCN-3':
            iconFileName = 'ttcn3.png';
            break;
        case 'Objective-C':
            iconFileName = 'objectivec.png';
            break;
        default:
            iconFileName = 'default.png';
            break;
    }
    console.log(`🎨 Language: "${language}" → Icon: "${iconFileName}"`);
    return {
        light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
        dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
    };
}
/**
 * Gets an example file name for a language to display the correct icon
 */
function getExampleFileForLanguage(language) {
    switch (language.toLowerCase()) {
        case 'javascript': return 'example.js';
        case 'typescript': return 'example.ts';
        case 'python': return 'example.py';
        case 'java': return 'Example.java';
        case 'c': return 'example.c';
        case 'c++': return 'example.cpp';
        case 'c#': return 'Example.cs';
        case 'ruby': return 'example.rb';
        case 'php': return 'example.php';
        case 'go': return 'example.go';
        case 'rust': return 'example.rs';
        case 'swift': return 'example.swift';
        case 'kotlin': return 'Example.kt';
        case 'html': return 'example.html';
        case 'vue': return 'example.vue';
        case 'scala': return 'example.scala';
        case 'lua': return 'example.lua';
        case 'erlang': return 'example.erl';
        case 'zig': return 'example.zig';
        case 'perl': return 'example.pl';
        case 'gdscript': return 'example.gd';
        case 'solidity': return 'example.sol';
        case 'fortran': return 'example.f90';
        case 'ttcn-3': return 'example.ttcn3';
        case 'objective-c': return 'example.m';
        default: return 'example.txt';
    }
}
// ✅ TECHNICAL FIX: Ensure cylinder chart type is correctly defined
// ✅ ENHANCED: Chart type options with new bubbles chart
exports.CHART_TYPE_OPTIONS = [
    { value: 'boats', label: 'Boats Chart', description: 'Area-based 3D visualization' },
    { value: 'bars', label: 'Bars Chart', description: 'Traditional bar chart in 3D' },
    { value: 'cyls', label: 'Cylinder Chart', description: 'Cylinder-based visualization with radius and height' },
    { value: 'bubbles', label: 'Bubbles Chart', description: '3D bubbles visualization with X/Z positioning and radius/height' }, // ✅ ADDED: Bubbles chart option
    { value: 'barsmap', label: 'Barsmap Chart', description: '3D bars with Z-axis grouping' },
    { value: 'pie', label: 'Pie Chart', description: 'Traditional pie chart in 3D' },
    { value: 'donut', label: 'Donut Chart', description: 'Donut/doughnut chart in 3D' }
];
/**
 * Section for active analyses with proper context and commands
 */
class ActiveAnalysesSection extends baseItems_1.TreeItem {
    constructor(extensionPath, count) {
        const title = count !== undefined ? `Active Analyses (${count})` : 'Active Analyses';
        super(title, 'Manage and view active analyses', treeProvider_1.TreeItemType.ACTIVE_ANALYSES_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('browser'));
    }
}
exports.ActiveAnalysesSection = ActiveAnalysesSection;
/**
 * Item for individual active analysis
 */
class ActiveAnalysisItem extends baseItems_1.TreeItem {
    session;
    constructor(session, extensionPath) {
        const label = `${session.fileName}`;
        // Generate description using shared utility
        const description = (0, analysisIconUtils_1.getAnalysisDescription)(session);
        const tooltip = `Active ${session.analysisType} analysis\n\nFile: ${session.filePath}\nStarted: ${session.created.toLocaleString()}\n\nClick to reopen • Right-click to close`;
        // Get appropriate icon using shared utility
        const icon = (0, analysisIconUtils_1.getAnalysisIcon)(session);
        super(label, tooltip, treeProvider_1.TreeItemType.ACTIVE_ANALYSIS, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.reopenAnalysis',
            title: 'Reopen Analysis',
            arguments: [session.filePath, session.analysisType]
        }, icon);
        this.session = session;
        this.description = description;
        // Add context menu for closing analysis
        this.contextValue = 'activeAnalysis';
    }
}
exports.ActiveAnalysisItem = ActiveAnalysisItem;
/**
 * Container item for Files by Directory section
 * Now shows the workspace name as the root node
 */
class FilesByDirectoryContainer extends baseItems_1.TreeItem {
    rootPath;
    extensionPath;
    constructor(rootPath, extensionPath) {
        const rootFolderName = path.basename(rootPath);
        console.log(`DEPURATION: Creating FilesByDirectoryContainer for rootPath: ${rootPath}, rootFolderName: ${rootFolderName}`);
        // Use the workspace name as the label, not "Files by Directory"
        const label = rootFolderName;
        const tooltip = `Workspace: ${rootFolderName}\n\nBrowse files by directory structure\n\nPath: ${rootPath}`;
        super(label, tooltip, treeProvider_1.TreeItemType.FILES_BY_DIRECTORY_CONTAINER, vscode.TreeItemCollapsibleState.Collapsed, // Changed from Expanded to Collapsed
        undefined, new vscode.ThemeIcon('folder-opened'));
        this.rootPath = rootPath;
        this.extensionPath = extensionPath;
        console.log(`DEPURATION: FilesByDirectoryContainer created with label: ${label}`);
    }
    /**
     * Get children for the workspace directory
     */
    async getChildren() {
        console.log(`DEPURATION: FilesByDirectoryContainer.getChildren() called for rootPath: ${this.rootPath}`);
        try {
            // Create a DirectoryFolderItem for the root workspace directory
            const { DirectoryFolderItem } = await import('./analysisTreeItems.js');
            const rootItem = new DirectoryFolderItem(this.rootPath, '', this.extensionPath);
            // Return the children of the root directory directly (not the root item itself)
            const children = await rootItem.getChildren();
            console.log(`DEPURATION: FilesByDirectoryContainer returning ${children.length} children from root directory`);
            return children;
        }
        catch (error) {
            console.error(`DEPURATION: Error getting FilesByDirectoryContainer children:`, error);
            return [];
        }
    }
}
exports.FilesByDirectoryContainer = FilesByDirectoryContainer;
/**
 * Directory folder item - Enhanced with VS Code Explorer-like behavior
 */
class DirectoryFolderItem extends baseItems_1.TreeItem {
    folderPath;
    parentPath;
    extensionPath;
    constructor(folderPath, parentPath, extensionPath) {
        const folderName = path.basename(folderPath);
        const label = folderName;
        const tooltip = `Folder: ${folderPath}\n\nClick to analyze directory`;
        console.log(`DEPURATION: Creating DirectoryFolderItem for folderPath: ${folderPath}, folderName: ${folderName}`);
        super(label, tooltip, treeProvider_1.TreeItemType.DIRECTORY_FOLDER, vscode.TreeItemCollapsibleState.Collapsed, {
            command: 'codexr.analyzeDirectoryFromTree',
            title: 'Analyze Directory',
            arguments: [folderPath]
        }, new vscode.ThemeIcon('folder'));
        this.folderPath = folderPath;
        this.parentPath = parentPath;
        this.extensionPath = extensionPath;
        this.contextValue = 'directoryFolder';
        console.log(`DEPURATION: DirectoryFolderItem created with label: ${label}, contextValue: ${this.contextValue}`);
    }
    async getChildren() {
        const children = [];
        console.log(`DEPURATION: Getting children for directory: ${this.folderPath}`);
        try {
            const items = await vscode.workspace.fs.readDirectory(vscode.Uri.file(this.folderPath));
            console.log(`DEPURATION: Read ${items.length} items from directory: ${this.folderPath}`);
            // Apply filtering similar to VS Code Explorer
            const filteredItems = items.filter(([name, type]) => {
                console.log(`DEPURATION: Processing item: ${name}, type: ${type}`);
                // Get VS Code explorer settings
                const filesConfig = vscode.workspace.getConfiguration('files');
                const explorerConfig = vscode.workspace.getConfiguration('explorer');
                // Check if hidden files should be shown (like VS Code Explorer)
                const excludePatterns = filesConfig.get('exclude') || {};
                const showHiddenFiles = !excludePatterns['**/.*'];
                // Handle hidden files based on VS Code settings
                if (name.startsWith('.') && !showHiddenFiles) {
                    console.log(`DEPURATION: Skipping hidden item: ${name} (hidden files not shown in VS Code)`);
                    return false;
                }
                // Check if item matches any exclude pattern
                for (const [pattern, exclude] of Object.entries(excludePatterns)) {
                    if (exclude && this.matchesGlobPattern(name, pattern)) {
                        console.log(`DEPURATION: Skipping item: ${name} (matches exclude pattern: ${pattern})`);
                        return false;
                    }
                }
                // Additional filtering for common build/temp directories (but respect VS Code settings)
                const commonExcludes = ['node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', '__pycache__', 'coverage'];
                if (type === vscode.FileType.Directory && commonExcludes.includes(name) && !showHiddenFiles) {
                    console.log(`DEPURATION: Skipping common build directory: ${name}`);
                    return false;
                }
                console.log(`DEPURATION: Including item: ${name}`);
                return true;
            });
            console.log(`DEPURATION: After filtering: ${filteredItems.length} items remain`);
            // Sort: folders first, then files, alphabetically within each group (like VS Code Explorer)
            const sortedItems = filteredItems.sort((a, b) => {
                const [nameA, typeA] = a;
                const [nameB, typeB] = b;
                // Folders first
                if (typeA !== typeB) {
                    return typeA === vscode.FileType.Directory ? -1 : 1;
                }
                // Alphabetical within type (case-insensitive like VS Code)
                return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
            });
            console.log(`DEPURATION: Processing ${sortedItems.length} sorted items`);
            for (const [name, type] of sortedItems) {
                const fullPath = path.join(this.folderPath, name);
                console.log(`DEPURATION: Creating tree item for: ${name}, type: ${type}, fullPath: ${fullPath}`);
                if (type === vscode.FileType.Directory) {
                    const folderItem = new DirectoryFolderItem(fullPath, this.folderPath, this.extensionPath);
                    children.push(folderItem);
                    console.log(`DEPURATION: Added DirectoryFolderItem: ${name}`);
                }
                else if (type === vscode.FileType.File) {
                    const fileItem = new DirectoryFileItem(fullPath, this.folderPath, this.extensionPath);
                    children.push(fileItem);
                    console.log(`DEPURATION: Added DirectoryFileItem: ${name}`);
                }
                else if (type === vscode.FileType.SymbolicLink) {
                    // Handle symlinks like VS Code Explorer
                    try {
                        const stats = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
                        if (stats.type === vscode.FileType.Directory) {
                            const folderItem = new DirectoryFolderItem(fullPath, this.folderPath, this.extensionPath);
                            children.push(folderItem);
                            console.log(`DEPURATION: Added DirectoryFolderItem (symlink): ${name}`);
                        }
                        else {
                            const fileItem = new DirectoryFileItem(fullPath, this.folderPath, this.extensionPath);
                            children.push(fileItem);
                            console.log(`DEPURATION: Added DirectoryFileItem (symlink): ${name}`);
                        }
                    }
                    catch (symlinkError) {
                        console.log(`DEPURATION: Error resolving symlink ${name}: ${symlinkError}`);
                        // Treat as file if we can't resolve it
                        const fileItem = new DirectoryFileItem(fullPath, this.folderPath, this.extensionPath);
                        children.push(fileItem);
                        console.log(`DEPURATION: Added DirectoryFileItem (unresolved symlink): ${name}`);
                    }
                }
            }
            console.log(`DEPURATION: Created ${children.length} child items for directory: ${this.folderPath}`);
        }
        catch (error) {
            console.error(`DEPURATION: Error reading directory: ${this.folderPath}`, error);
        }
        return children;
    }
    /**
     * Simple glob pattern matching for exclude patterns
     */
    matchesGlobPattern(fileName, pattern) {
        // Simple implementation - convert glob to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '.*') // ** matches any number of directories
            .replace(/\*/g, '[^/]*') // * matches any characters except /
            .replace(/\?/g, '.') // ? matches any single character
            .replace(/\./g, '\\.'); // Escape literal dots
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(fileName);
    }
}
exports.DirectoryFolderItem = DirectoryFolderItem;
/**
 * Directory file item - Enhanced with debug logging
 */
class DirectoryFileItem extends baseItems_1.TreeItem {
    filePath;
    parentPath;
    extensionPath;
    constructor(filePath, parentPath, extensionPath) {
        const fileName = path.basename(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        const label = fileName;
        const tooltip = `File: ${filePath}`;
        console.log(`DEPURATION: Creating DirectoryFileItem for filePath: ${filePath}, fileName: ${fileName}, extension: ${fileExtension}`);
        // Get appropriate icon based on file extension
        const icon = getFileIcon(fileExtension, extensionPath);
        super(label, tooltip, treeProvider_1.TreeItemType.DIRECTORY_FILE, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.analyzeFile',
            title: 'Analyze File',
            arguments: [vscode.Uri.file(filePath)]
        }, icon);
        this.filePath = filePath;
        this.parentPath = parentPath;
        this.extensionPath = extensionPath;
        this.contextValue = 'directoryFile';
        console.log(`DEPURATION: DirectoryFileItem created with label: ${label}, contextValue: ${this.contextValue}, icon: ${icon.id || 'custom'}`);
    }
}
exports.DirectoryFileItem = DirectoryFileItem;
/**
 * Get appropriate icon for file based on extension using VS Code theme icons
 */
function getFileIcon(extension, extensionPath) {
    // Map file extensions to VS Code theme icons for consistency
    const iconMap = {
        '.js': 'file-code',
        '.jsx': 'file-code',
        '.ts': 'file-code',
        '.tsx': 'file-code',
        '.py': 'file-code',
        '.html': 'file-code',
        '.htm': 'file-code',
        '.css': 'file-code',
        '.scss': 'file-code',
        '.sass': 'file-code',
        '.less': 'file-code',
        '.json': 'json',
        '.md': 'markdown',
        '.java': 'file-code',
        '.c': 'file-code',
        '.h': 'file-code',
        '.cpp': 'file-code',
        '.cc': 'file-code',
        '.cxx': 'file-code',
        '.cs': 'file-code',
        '.rb': 'file-code',
        '.php': 'file-code',
        '.go': 'file-code',
        '.rs': 'file-code',
        '.kt': 'file-code',
        '.swift': 'file-code',
        '.vue': 'file-code',
        '.xml': 'file-code',
        '.yaml': 'file-code',
        '.yml': 'file-code',
        '.sh': 'terminal',
        '.bat': 'terminal',
        '.ps1': 'terminal',
        '.txt': 'file-text',
        '.log': 'file-text',
        '.sql': 'database',
        '.gitignore': 'git-ignore',
        '.dockerfile': 'file-docker',
        '.png': 'file-media',
        '.jpg': 'file-media',
        '.jpeg': 'file-media',
        '.gif': 'file-media',
        '.svg': 'file-media',
        '.ico': 'file-media'
    };
    const iconName = iconMap[extension.toLowerCase()];
    return new vscode.ThemeIcon(iconName || 'file');
}
/**
 * Container item for Project Files section - integrates into analysis tree
 */
class ProjectFileContainer extends baseItems_1.TreeItem {
    rootPath;
    extensionPath;
    constructor(rootPath, extensionPath) {
        const rootFolderName = path.basename(rootPath);
        console.log(`DEPURATION: Creating ProjectFileContainer for rootPath: ${rootPath}, rootFolderName: ${rootFolderName}`);
        // Use "Project Files" as label with workspace name in description
        const label = 'Project Files';
        const description = rootFolderName;
        const tooltip = `Browse project file structure\n\nWorkspace: ${rootFolderName}\nPath: ${rootPath}`;
        super(label, tooltip, treeProvider_1.TreeItemType.FILES_BY_DIRECTORY_CONTAINER, // Reuse existing type
        vscode.TreeItemCollapsibleState.Collapsed, undefined, new vscode.ThemeIcon('folder-opened'));
        this.rootPath = rootPath;
        this.extensionPath = extensionPath;
        this.description = description;
        console.log(`DEPURATION: ProjectFileContainer created with label: ${label}, description: ${description}`);
    }
    /**
     * Get children for the workspace directory by creating DirectoryFolderItem and DirectoryFileItem
     */
    async getChildren() {
        console.log(`DEPURATION: ProjectFileContainer.getChildren() called for rootPath: ${this.rootPath}`);
        try {
            // Create a special workspace root folder item with project context menu commands
            const workspaceRootItem = new WorkspaceRootFolderItem(this.rootPath, this.extensionPath);
            // Get just the workspace root contents (files and subdirectories)
            const rootChildren = await workspaceRootItem.getChildren();
            // Return the workspace root folder as the first item, followed by its contents
            const children = [workspaceRootItem, ...rootChildren];
            console.log(`DEPURATION: ProjectFileContainer returning ${children.length} children (workspace root + ${rootChildren.length} contents)`);
            return children;
        }
        catch (error) {
            console.error(`DEPURATION: Error getting ProjectFileContainer children:`, error);
            return [];
        }
    }
}
exports.ProjectFileContainer = ProjectFileContainer;
/**
 * ✅ ENHANCED: Special folder item for workspace root that shows project-level context menu commands
 */
class WorkspaceRootFolderItem extends DirectoryFolderItem {
    constructor(folderPath, extensionPath) {
        super(folderPath, '', extensionPath);
        const folderName = path.basename(folderPath);
        console.log(`DEPURATION: Creating WorkspaceRootFolderItem for workspace root: ${folderPath}, name: ${folderName}`);
        // Update properties for workspace root
        this.label = folderName; // Show workspace name
        this.description = 'Workspace Root';
        this.tooltip = `Workspace Root: ${folderPath}\n\nRight-click to analyze entire project`;
        this.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('tree.indentGuidesStroke'));
        // Special context value for workspace root to show project-level commands
        this.contextValue = 'directoryFolder'; // Keep same contextValue for existing commands to work
        console.log(`DEPURATION: WorkspaceRootFolderItem created with label: ${this.label}, contextValue: ${this.contextValue}`);
    }
}
exports.WorkspaceRootFolderItem = WorkspaceRootFolderItem;
/**
 * ✅ HELPER: Format directory mode for display with proper capitalization
 */
function formatDirectoryModeDisplay(mode) {
    switch (mode) {
        case 'static':
            return 'Static';
        case 'static-deep':
            return 'Static Deep';
        case 'xr':
            return 'XR';
        case 'xr-deep':
            return 'XR Deep';
        default:
            // Fallback: capitalize first letter and handle XR specially
            return mode.split('-')
                .map(word => word === 'xr' ? 'XR' : word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
    }
}
//# sourceMappingURL=analysisTreeItems.js.map