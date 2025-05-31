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
exports.AnalysisResetItem = exports.AnalysisChartTypeOptionItem = exports.AnalysisAutoOptionItem = exports.AnalysisDelayOptionItem = exports.AnalysisModeOptionItem = exports.AnalysisSettingsItem = exports.AnalysisFileItem = exports.LanguageGroupItem = exports.AnalysisSectionItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const baseItems_1 = require("../../ui/treeItems/baseItems");
const treeProvider_1 = require("../../ui/treeProvider");
const dimensionMappingTreeItem_1 = require("./dimensionMappingTreeItem");
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
 * Individual file item in the analysis tree
 */
class AnalysisFileItem extends baseItems_1.TreeItem {
    constructor(filePath, relativePath, language, extensionPath) {
        const fileName = path.basename(filePath);
        super(fileName, `${language} file - ${relativePath}`, treeProvider_1.TreeItemType.ANALYSIS_FILE, vscode.TreeItemCollapsibleState.None, {
            // ✅ CAMBIAR EL COMANDO INEXISTENTE
            command: 'codexr.analyzeFileFromTree', // ✅ USAR COMANDO QUE SÍ EXISTE
            title: 'Analyze File',
            arguments: [filePath] // ✅ PASAR LA RUTA COMO ARGUMENTO
        }, new vscode.ThemeIcon('file-code'));
        this.resourceUri = vscode.Uri.file(filePath);
        this.tooltip = `Analyze ${fileName} (${language})`;
    }
}
exports.AnalysisFileItem = AnalysisFileItem;
/**
 * Analysis settings container
 */
class AnalysisSettingsItem extends baseItems_1.TreeItem {
    extensionPath;
    context;
    constructor(extensionPath, context) {
        super('Settings', 'Configure analysis preferences', treeProvider_1.TreeItemType.ANALYSIS_SETTINGS, vscode.TreeItemCollapsibleState.Expanded, undefined, new vscode.ThemeIcon('gear'));
        this.extensionPath = extensionPath;
        this.context = context;
    }
    /**
     * Gets current analysis settings from VS Code configuration
     */
    async getCurrentSettings() {
        const config = vscode.workspace.getConfiguration();
        // ✅ LEER CHART TYPE DESDE GLOBAL STATE PRIMERO
        const chartType = this.context.globalState.get('codexr.analysis.chartType') ||
            config.get('codexr.analysis.chartType', 'boats');
        return {
            currentMode: config.get('codexr.analysisMode', 'Static'),
            debounceDelay: config.get('codexr.analysis.debounceDelay', 2000),
            autoAnalysis: config.get('codexr.analysis.autoAnalysis', true),
            chartType
        };
    }
    async getChildren() {
        console.log('🔧 AnalysisSettingsItem.getChildren() called');
        // Get current settings
        const { currentMode, debounceDelay, autoAnalysis, chartType } = await this.getCurrentSettings();
        console.log('🔧 Current settings in getChildren:', { currentMode, chartType });
        const items = [
            new AnalysisModeOptionItem('Static', currentMode === 'Static', this.extensionPath),
            new AnalysisModeOptionItem('XR', currentMode === 'XR', this.extensionPath),
            new AnalysisDelayOptionItem(debounceDelay, this.extensionPath),
            new AnalysisAutoOptionItem(autoAnalysis, this.extensionPath),
            new AnalysisChartTypeOptionItem(chartType, this.extensionPath)
        ];
        // Add dimension mapping only for XR mode
        if (currentMode === 'XR') {
            console.log('🎯 Adding DimensionMappingItem for chart type:', chartType);
            items.push(new dimensionMappingTreeItem_1.DimensionMappingItem(chartType, this.extensionPath, this.context));
        }
        else {
            console.log('🔧 Not adding DimensionMappingItem because mode is:', currentMode);
        }
        // ✅ AÑADIR RESET BUTTON AL FINAL
        items.push(new AnalysisResetItem(this.extensionPath));
        console.log('🔧 Returning items:', items.map(item => item.label));
        return items;
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
 * ✅ NUEVO ITEM PARA RESET DE CONFIGURACIÓN
 */
class AnalysisResetItem extends baseItems_1.TreeItem {
    constructor(extensionPath) {
        super('Reset to Defaults', 'Reset chart type to Boats and dimension mapping to default values', treeProvider_1.TreeItemType.ANALYSIS_RESET, vscode.TreeItemCollapsibleState.None, {
            command: 'codexr.resetAnalysisDefaults',
            title: 'Reset Analysis Configuration',
            arguments: []
        }, new vscode.ThemeIcon('refresh'));
    }
}
exports.AnalysisResetItem = AnalysisResetItem;
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
    // ✅ FIX: Handle special cases for C# and C++ language names
    let iconFileName;
    switch (language) {
        case 'C#':
            iconFileName = 'csharp.png';
            break;
        case 'C++':
        case 'C++ Header':
            iconFileName = 'cpp.png';
            break;
        case 'JavaScript':
        case 'JavaScript (JSX)':
            iconFileName = 'javascript.png';
            break;
        case 'TypeScript':
        case 'TypeScript (TSX)':
            iconFileName = 'typescript.png';
            break;
        case 'Python':
            iconFileName = 'python.png';
            break;
        case 'C':
        case 'C Header':
            iconFileName = 'c.png';
            break;
        case 'Vue':
            iconFileName = 'vue.png';
            break;
        case 'Ruby':
            iconFileName = 'ruby.png';
            break;
        default:
            // For any other language, convert to lowercase and add .png
            iconFileName = language.toLowerCase() + '.png';
            break;
    }
    console.log(`🎨 Language: "${language}" → Icon: "${iconFileName}"`);
    // Return custom icon paths
    return {
        light: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName)),
        dark: vscode.Uri.file(path.join(extensionPath, 'resources', 'languajes_icons', iconFileName))
    };
}
//# sourceMappingURL=analysisTreeItems.js.map