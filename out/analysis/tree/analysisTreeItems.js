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
exports.CHART_TYPE_OPTIONS = exports.FilesPerLanguageContainer = exports.AnalysisResetItem = exports.AnalysisChartTypeOptionItem = exports.AnalysisAutoOptionItem = exports.AnalysisDelayOptionItem = exports.AnalysisModeOptionItem = exports.AnalysisSettingsItem = exports.LanguageGroupItem = exports.AnalysisSectionItem = exports.AnalysisFileItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const analysisDataManager_1 = require("../analysisDataManager");
const analysisSettingsManager_1 = require("./analysisSettingsManager");
const fileWatchManager_1 = require("../fileWatchManager"); // ✅ ADDED: Missing import
/**
 * ✅ ENHANCED: Individual file item with countdown indicator
 */
class AnalysisFileItem extends baseItems_1.TreeItem {
    constructor(filePath, relativePath, language, extensionPath) {
        const fileName = path.basename(filePath);
        const isBeingAnalyzed = analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath);
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
            arguments: [filePath]
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
 * ✅ UPDATED: Item for analysis mode setting option with proper mode switching
 */
class AnalysisModeOptionItem extends baseItems_1.TreeItem {
    constructor(currentMode, isSelected, extensionPath) {
        // ✅ CHANGED: Show current mode and make it clickable to change
        const label = `Analysis Mode: ${currentMode}`;
        const description = `Current: ${currentMode} - Click to change`;
        const tooltip = currentMode === 'Static'
            ? 'Static analysis in webview panels. Click to switch to XR mode.'
            : 'XR analysis with 3D visualizations. Click to switch to Static mode.';
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.toggleAnalysisMode',
            title: 'Toggle Analysis Mode',
            arguments: []
        }, new vscode.ThemeIcon(currentMode === 'Static' ? 'desktop-download' : 'globe'));
        this.description = description;
    }
}
exports.AnalysisModeOptionItem = AnalysisModeOptionItem;
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
    constructor(currentChart, extensionPath) {
        const label = `Chart Type: ${currentChart}`;
        const description = `Current: ${currentChart} - Click to change`;
        const tooltip = `Current chart type for XR analysis visualizations: ${currentChart}\n\nClick to select a different chart type for future XR analyses.`;
        super(label, tooltip, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.setAnalysisChartType',
            title: 'Set Chart Type',
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
//# sourceMappingURL=analysisTreeItems.js.map