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
exports.AnalysisChartTypeOptionItem = exports.AnalysisAutoOptionItem = exports.AnalysisDelayOptionItem = exports.AnalysisModeOptionItem = exports.AnalysisSettingsItem = exports.AnalysisFileItem = exports.LanguageGroupItem = exports.AnalysisSectionItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
/**
 * Item for the main analysis section
 */
class AnalysisSectionItem extends baseItems_1.TreeItem {
    constructor(extensionPath) {
        super('Code Analysis', 'Analyze code metrics and complexity', treeProvider_1.TreeItemType.ANALYSIS_SECTION, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('microscope'));
    }
}
exports.AnalysisSectionItem = AnalysisSectionItem;
/**
 * Container for language file groups
 */
class LanguageGroupItem extends baseItems_1.TreeItem {
    constructor(language, fileCount, extensionPath) {
        const languageIcon = getLanguageIcon(language, extensionPath);
        super(language, `${language} files that can be analyzed`, treeProvider_1.TreeItemType.ANALYSIS_LANGUAGE_GROUP, vscode.TreeItemCollapsibleState.Expanded, undefined, languageIcon);
        this.description = `(${fileCount} files)`;
    }
}
exports.LanguageGroupItem = LanguageGroupItem;
/**
 * Item for an analyzable file
 */
class AnalysisFileItem extends baseItems_1.TreeItem {
    constructor(fileUri, extensionPath) {
        const fileName = path.basename(fileUri.fsPath);
        const fileExtension = path.extname(fileUri.fsPath).toLowerCase();
        const language = getLanguageFromExtension(fileExtension);
        const languageIcon = getLanguageIcon(language, extensionPath);
        // Get the configured analysis mode
        const config = vscode.workspace.getConfiguration();
        const analysisMode = config.get('codexr.analysisMode', 'Static');
        // Use our new commands that first open the file, then analyze it
        const command = analysisMode === 'XR' ? 'codexr.openAndAnalyzeFile3D' : 'codexr.openAndAnalyzeFile';
        super(fileName, `Analyze ${fileName} using ${analysisMode} mode`, treeProvider_1.TreeItemType.ANALYSIS_FILE, vscode.TreeItemCollapsibleState.None, {
            command: command,
            title: `Analyze File (${analysisMode})`,
            arguments: [fileUri]
        }, languageIcon);
        // Use the resource URI to enable VS Code's built-in file handling capabilities
        this.resourceUri = fileUri;
    }
}
exports.AnalysisFileItem = AnalysisFileItem;
/**
 * Item for analysis settings section
 */
class AnalysisSettingsItem extends baseItems_1.TreeItem {
    constructor(extensionPath) {
        super('Settings', 'Configure analysis preferences', treeProvider_1.TreeItemType.ANALYSIS_SETTINGS, vscode.TreeItemCollapsibleState.Expanded, // Change from Collapsed to Expanded
        undefined, new vscode.ThemeIcon('gear'));
    }
}
exports.AnalysisSettingsItem = AnalysisSettingsItem;
/**
 * Item for an analysis mode setting option
 */
class AnalysisModeOptionItem extends baseItems_1.TreeItem {
    constructor(mode, isSelected, extensionPath) {
        super(`Analysis Mode: ${mode}`, // Make the label more descriptive
        `Use ${mode} as default analysis mode`, treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.setAnalysisMode',
            title: 'Set Analysis Mode',
            arguments: [mode]
        }, isSelected ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('circle-outline'));
        // Add a highlight for the selected option
        if (isSelected) {
            this.description = '(current)';
        }
    }
}
exports.AnalysisModeOptionItem = AnalysisModeOptionItem;
/**
 * Item for setting debounce delay
 */
class AnalysisDelayOptionItem extends baseItems_1.TreeItem {
    constructor(delay, extensionPath) {
        const delayLabels = {
            500: "Very Quick (500ms)",
            1000: "Quick (1 second)",
            2000: "Standard (2 seconds)",
            3000: "Relaxed (3 seconds)",
            5000: "Extended (5 seconds)"
        };
        const label = `Debounce Delay: ${delayLabels[delay] || delay + 'ms'}`;
        super(label, "Set the delay before auto-analysis after a file change", treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.setAnalysisDebounceDelay',
            title: 'Set Analysis Debounce Delay',
            arguments: []
        }, new vscode.ThemeIcon('clock'));
    }
}
exports.AnalysisDelayOptionItem = AnalysisDelayOptionItem;
/**
 * Item for toggling auto-analysis
 */
class AnalysisAutoOptionItem extends baseItems_1.TreeItem {
    constructor(enabled, extensionPath) {
        super(`Auto-Analysis: ${enabled ? 'Enabled' : 'Disabled'}`, "Toggle automatic re-analysis of files when they change", treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.toggleAutoAnalysis',
            title: 'Toggle Auto Analysis',
            arguments: []
        }, enabled ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('close'));
        // Add a highlight for the current state
        this.description = enabled ? '(active)' : '(inactive)';
    }
}
exports.AnalysisAutoOptionItem = AnalysisAutoOptionItem;
/**
 * Item for setting chart type for analysis visualizations
 */
class AnalysisChartTypeOptionItem extends baseItems_1.TreeItem {
    constructor(currentChart, extensionPath) {
        const chartLabels = {
            'boats': "Boats (3D blocks)",
            'bars': "Bars (2D bars)",
            'cyls': "Cylinders (3D cylinders)",
            'barsmap': "Bars Map (3D layout)",
            'pie': "Pie Chart",
            'donut': "Donut Chart"
        };
        const label = `Chart Type: ${chartLabels[currentChart] || currentChart}`;
        super(label, "Select which chart type to use for code analysis visualization", treeProvider_1.TreeItemType.ANALYSIS_SETTING_OPTION, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.setAnalysisChartType',
            title: 'Set Analysis Chart Type',
            arguments: []
        }, new vscode.ThemeIcon('pie-chart'));
    }
}
exports.AnalysisChartTypeOptionItem = AnalysisChartTypeOptionItem;
/**
 * Gets language name from file extension
 */
function getLanguageFromExtension(ext) {
    switch (ext) {
        case '.py':
            return 'Python';
        case '.js':
            return 'JavaScript';
        case '.ts':
            return 'TypeScript';
        case '.c':
            return 'C';
        // Add new language support
        case '.cpp':
        case '.cc':
        case '.cxx':
            return 'C++';
        case '.cs':
            return 'C#';
        case '.vue':
            return 'Vue';
        case '.rb':
            return 'Ruby';
        default:
            return 'Unknown';
    }
}
/**
 * Gets appropriate icon for language
 */
function getLanguageIcon(language, extensionPath) {
    // Convert language name to lowercase for filename
    const languageFileName = language.toLowerCase() + '.png';
    // Handle special case for JavaScript (correct casing in filename)
    const iconFileName = language === 'JavaScript'
        ? 'javascript.png'
        : languageFileName;
    // Return custom icon paths
    return {
        light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
        dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
    };
}
//# sourceMappingURL=analysisTreeItems.js.map