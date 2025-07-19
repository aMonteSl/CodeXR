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
exports.CodeAnalysisItemFactory = exports.CodeAnalysisTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fileDisplayUtils_1 = require("../../../utils/fileDisplayUtils");
const analysisSettingsStorage_1 = require("../../../utils/analysisSettingsStorage");
const chartRegistry_1 = require("../../../babia_templates/registry/chartRegistry");
/**
 * Get user-friendly display name for data field
 */
function getFieldDisplayName(fieldName) {
    const fieldNames = {
        'parameters': 'Parameters',
        'lines_count': 'Lines Count',
        'ccn': 'CCN (Complexity)',
        'function_name': 'Function Name',
        'ccn_density': 'CCN Density'
    };
    return fieldNames[fieldName] || fieldName;
}
/**
 * Code Analysis tree item that represents different analysis sections and items
 */
class CodeAnalysisTreeItem extends vscode.TreeItem {
    // Declare properties explicitly (iconPath is inherited from TreeItem)
    type;
    fileInfo;
    languageName;
    constructor(labelOrUri, collapsibleState, type, command, iconPath, tooltip, description, contextValue, fileInfo, languageName) {
        // Call super() FIRST with the appropriate arguments
        if (labelOrUri instanceof vscode.Uri) {
            super(labelOrUri, collapsibleState);
            // After super(), we can set the label
            this.label = path.basename(labelOrUri.fsPath);
        }
        else {
            super(labelOrUri, collapsibleState);
        }
        // NOW assign all properties after super() has been called
        this.type = type;
        // Only assign iconPath if it's defined
        if (iconPath !== undefined) {
            this.iconPath = iconPath;
        }
        // Assign other properties
        if (command !== undefined) {
            this.command = command;
        }
        if (tooltip !== undefined) {
            this.tooltip = tooltip;
        }
        if (description !== undefined) {
            this.description = description;
        }
        if (contextValue !== undefined) {
            this.contextValue = contextValue;
        }
        this.fileInfo = fileInfo;
        this.languageName = languageName;
    }
}
exports.CodeAnalysisTreeItem = CodeAnalysisTreeItem;
/**
 * Factory for creating Code Analysis tree items
 */
class CodeAnalysisItemFactory {
    /**
     * Create the main code analysis sections
     */
    static createCodeAnalysisSections() {
        console.log('[CODE_ANALYSIS] Creating main analysis sections');
        return [
            new CodeAnalysisTreeItem('Active Analyses', vscode.TreeItemCollapsibleState.Collapsed, 'active-analyses', {
                command: 'codeXR.codeAnalysis.showActiveAnalyses',
                title: 'Show Active Analyses'
            }, new vscode.ThemeIcon('pulse'), 'View currently running analyses', '', 'active-analyses'),
            new CodeAnalysisTreeItem('Analysis Settings', vscode.TreeItemCollapsibleState.Collapsed, 'analysis-settings', {
                command: 'codeXR.codeAnalysis.showAnalysisSettings',
                title: 'Show Analysis Settings'
            }, new vscode.ThemeIcon('gear'), 'Configure analysis parameters', '', 'analysis-settings'),
            new CodeAnalysisTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'project-structure', {
                command: 'codexr.codeanalysis.refreshProjectStructure',
                title: 'Refresh Project Structure'
            }, new vscode.ThemeIcon('folder-library'), 'Browse complete project directory structure', '', 'project-structure'),
            new CodeAnalysisTreeItem('Files by Language', vscode.TreeItemCollapsibleState.Collapsed, 'files-by-language', undefined, // No command - let tree expansion handle the scanning
            new vscode.ThemeIcon('files'), 'Browse project files grouped by language', '', 'files-by-language')
        ];
    }
    /**
     * Create the main code analysis sections with file counts
     */
    static createCodeAnalysisSectionsWithCounts(filesByLanguage, isScanning = false, activeAnalysesSummary) {
        console.log('[CODE_ANALYSIS] Creating main analysis sections with file counts');
        // Calculate file summary if data is available, excluding "Unknown Files"
        let filesByLanguageDescription = '';
        if (isScanning) {
            filesByLanguageDescription = 'Scanning project files...';
            console.log('[CODE_ANALYSIS] Scanning in progress, showing scanning message');
        }
        else if (filesByLanguage && Object.keys(filesByLanguage).length > 0) {
            // Filter out "Unknown Files" from the count
            const analyzableLanguages = Object.entries(filesByLanguage)
                .filter(([languageName]) => languageName !== 'Unknown Files');
            const languageCount = analyzableLanguages.length;
            const totalAnalyzableFiles = analyzableLanguages.reduce((total, [, files]) => total + files.length, 0);
            if (languageCount > 0 && totalAnalyzableFiles > 0) {
                // Create descriptive text
                const languageText = languageCount === 1 ? 'language' : 'languages';
                const fileText = totalAnalyzableFiles === 1 ? 'file' : 'files';
                filesByLanguageDescription = `${languageCount} ${languageText}, ${totalAnalyzableFiles} ${fileText} (analyzable)`;
                console.log(`[CODE_ANALYSIS] Updated description: ${filesByLanguageDescription}`);
            }
            else {
                filesByLanguageDescription = 'No analyzable files found';
                console.log('[CODE_ANALYSIS] No analyzable files found in project');
            }
        }
        else {
            filesByLanguageDescription = 'Ready to analyze';
            console.log('[CODE_ANALYSIS] No file data available, showing ready message');
        }
        // Use the provided active analyses summary or default
        const activeAnalysesLabel = activeAnalysesSummary || 'Active Analyses';
        return [
            new CodeAnalysisTreeItem(activeAnalysesLabel, vscode.TreeItemCollapsibleState.Collapsed, 'active-analyses', {
                command: 'codeXR.codeAnalysis.showActiveAnalyses',
                title: 'Show Active Analyses'
            }, new vscode.ThemeIcon('pulse'), 'View currently running analyses', '', 'active-analyses'),
            new CodeAnalysisTreeItem('Analysis Settings', vscode.TreeItemCollapsibleState.Collapsed, 'analysis-settings', {
                command: 'codeXR.codeAnalysis.showAnalysisSettings',
                title: 'Show Analysis Settings'
            }, new vscode.ThemeIcon('gear'), 'Configure analysis parameters', '', 'analysis-settings'),
            new CodeAnalysisTreeItem('Project Directory Tree', vscode.TreeItemCollapsibleState.Collapsed, 'project-structure', {
                command: 'codexr.codeanalysis.refreshProjectStructure',
                title: 'Refresh Project Structure'
            }, new vscode.ThemeIcon('folder-library'), 'Browse complete project directory structure', 'Hierarchical file explorer', 'project-structure'),
            new CodeAnalysisTreeItem('Files by Language', vscode.TreeItemCollapsibleState.Collapsed, 'files-by-language', undefined, // No command - let tree expansion handle the scanning
            new vscode.ThemeIcon('files'), 'Browse project files grouped by language', filesByLanguageDescription, 'files-by-language')
        ];
    }
    /**
     * Create placeholder items for when sections are expanded
     */
    static async createPlaceholderItems(sectionKey, context) {
        const placeholders = [];
        switch (sectionKey) {
            case 'analysis-settings':
                // Get current analysis mode from storage
                const currentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'Static';
                const modeItem = new CodeAnalysisTreeItem(`Analysis Mode: ${currentMode}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.toggleMode',
                    title: 'Toggle Analysis Mode',
                    arguments: []
                });
                // Set icon based on current mode - use the returned ThemeIcon directly
                const modeIcon = analysisSettingsStorage_1.AnalysisSettingsStorage.getAnalysisModeIcon(currentMode);
                modeItem.iconPath = modeIcon;
                modeItem.tooltip = `Current analysis mode: ${currentMode}. Click to toggle between XR and Static modes.`;
                modeItem.description = `${currentMode === 'XR' ? 'VR/AR visualization' : 'Standard visualization'}`;
                placeholders.push(modeItem);
                // Get current theme from storage
                const currentTheme = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentTheme(context) :
                    'light';
                const themeItem = new CodeAnalysisTreeItem(`Viewer Theme: ${currentTheme}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.toggleTheme',
                    title: 'Toggle Viewer Theme',
                    arguments: []
                });
                // Set icon based on current theme
                themeItem.iconPath = currentTheme === 'light' ?
                    new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('foreground')) :
                    new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('charts.orange'));
                themeItem.tooltip = `Current viewer theme: ${currentTheme}. Click to toggle between light and dark themes.`;
                themeItem.description = `${currentTheme === 'light' ? 'Light appearance' : 'Dark appearance'}`;
                placeholders.push(themeItem);
                // Get current auto-analysis delay from storage
                const currentDelay = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelay(context) :
                    0;
                const delayItem = new CodeAnalysisTreeItem(`Auto-Analysis Delay: ${analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayLabel(currentDelay)}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', {
                    command: 'codexr.analysis.setAutoAnalysisDelay',
                    title: 'Set Auto-Analysis Delay',
                    arguments: []
                });
                // Set icon for delay setting
                delayItem.iconPath = new vscode.ThemeIcon('clock', new vscode.ThemeColor('charts.blue'));
                delayItem.tooltip = `Current auto-analysis delay: ${analysisSettingsStorage_1.AnalysisSettingsStorage.getAutoAnalysisDelayLabel(currentDelay)}. Click to change the delay before re-analyzing changed files.`;
                delayItem.description = `${currentDelay === 0 ? 'Immediate analysis' : 'Delayed analysis'}`;
                placeholders.push(delayItem);
                // Get current chart type for file analysis
                const currentChartType = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context) :
                    'donut';
                const chartTypeItem = new CodeAnalysisTreeItem(`Chart Type (File): ${currentChartType}`, vscode.TreeItemCollapsibleState.None, 'chart-type-file', {
                    command: 'codexr.analysis.selectChartTypeFile',
                    title: 'Select Chart Type for File Analysis',
                    arguments: []
                });
                // Set icon for chart type setting - match analysis mode color
                const chartCurrentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'XR';
                const chartModeColor = chartCurrentMode === 'XR' ? 'charts.purple' : 'charts.green';
                chartTypeItem.iconPath = new vscode.ThemeIcon('graph', new vscode.ThemeColor(chartModeColor));
                chartTypeItem.tooltip = `Current chart type for file analysis: ${currentChartType}. Click to select a different chart type.`;
                chartTypeItem.description = `${currentChartType} chart visualization`;
                placeholders.push(chartTypeItem);
                // Add reset to defaults option
                const resetItem = new CodeAnalysisTreeItem('Reset to default values', vscode.TreeItemCollapsibleState.None, 'reset-settings', {
                    command: 'codexr.analysis.resetSettings',
                    title: 'Reset Analysis Settings to Default Values',
                    arguments: []
                });
                resetItem.iconPath = new vscode.ThemeIcon('refresh', new vscode.ThemeColor('charts.red'));
                resetItem.tooltip = 'Reset all analysis settings to their default values (chart type: boats, default dimension mappings, etc.)';
                resetItem.description = 'Restore defaults';
                placeholders.push(resetItem);
                // Get current dimension mappings for file analysis
                const currentDimensionMappings = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context) :
                    [];
                const mappedCount = currentDimensionMappings.length;
                const dimensionMappingItem = new CodeAnalysisTreeItem(`Dimension Mapping (File)`, vscode.TreeItemCollapsibleState.Collapsed, 'dimension-mapping-file', undefined, // No command - expandable section
                undefined, // Will be set below based on mapping status
                `Configure dimension mapping for file analysis visualization`, `${mappedCount} mapped`);
                // Set icon based on mapping status - match analysis mode color
                const dimCurrentMode = context ?
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context) :
                    'XR';
                const dimModeColor = dimCurrentMode === 'XR' ? 'charts.purple' : 'charts.green';
                dimensionMappingItem.iconPath = mappedCount > 0 ?
                    new vscode.ThemeIcon('settings-gear', new vscode.ThemeColor(dimModeColor)) :
                    new vscode.ThemeIcon('settings-gear', new vscode.ThemeColor('charts.orange'));
                placeholders.push(dimensionMappingItem);
                break;
            case 'dimension-mapping-file':
                // Create dimension items based on the current chart type
                if (context) {
                    const chartType = await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context);
                    const dimensionMappings = await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context);
                    // Get chart metadata from the registry
                    const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
                    const chartMetadata = chartRegistry.getChart(chartType);
                    if (chartMetadata) {
                        // Create dimension items for the current chart
                        for (const dimension of chartMetadata.dimensions) {
                            const currentMapping = dimensionMappings.find(m => m.dimension === dimension.name);
                            let description = 'Not mapped';
                            let tooltip = `${dimension.label} - ${dimension.description}`;
                            let iconPath;
                            // Add data type information to tooltip
                            if (dimension.dataType === 'numeric') {
                                tooltip += '\n(numeric values only)';
                            }
                            else {
                                tooltip += '\n(any value type)';
                            }
                            if (currentMapping) {
                                // Get user-friendly field name
                                const fieldDisplayName = getFieldDisplayName(currentMapping.dataField);
                                description = `→ ${fieldDisplayName}`;
                                tooltip += `\nMapped to: ${fieldDisplayName}`;
                                iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
                            }
                            else {
                                tooltip += '\nNot mapped - Click to select field';
                                iconPath = dimension.required
                                    ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'))
                                    : new vscode.ThemeIcon('circle-outline');
                            }
                            const dimensionItem = new CodeAnalysisTreeItem(dimension.label || dimension.name, vscode.TreeItemCollapsibleState.None, 'dimension-item-file', {
                                command: 'codexr.analysis.mapDimensionFile',
                                title: 'Map Dimension for File Analysis',
                                arguments: [dimension.name, dimension.dataType, dimension.required]
                            }, iconPath, tooltip, description);
                            placeholders.push(dimensionItem);
                        }
                    }
                    else {
                        // Chart type not found - show placeholder
                        placeholders.push(new CodeAnalysisTreeItem(`Unknown chart type: ${chartType}`, vscode.TreeItemCollapsibleState.None, 'analysis-item', undefined, new vscode.ThemeIcon('error'), 'Chart type not found in registry'));
                    }
                }
                else {
                    // No context - show placeholder
                    placeholders.push(new CodeAnalysisTreeItem('Placeholder dimensions (TODO1, TODO2, TODO3)', vscode.TreeItemCollapsibleState.None, 'dimension-item-file', undefined, new vscode.ThemeIcon('circle-outline'), 'Placeholder dimension mapping'));
                }
                break;
            default:
                // Generic placeholder for other sections
                placeholders.push(new CodeAnalysisTreeItem("Configuration options", vscode.TreeItemCollapsibleState.None, 'analysis-item'));
                break;
        }
        return placeholders;
    } /**
     * Create language group items from scanned files
     */
    static createLanguageGroupItems(filesByLanguage, context) {
        console.log('[CODE_ANALYSIS] Creating language group items from scanned files');
        const languageItems = [];
        // Sort languages by file count (descending), but keep "Unknown Files" at the end
        const sortedLanguages = Object.entries(filesByLanguage)
            .sort(([nameA, filesA], [nameB, filesB]) => {
            // Always put "Unknown Files" at the end
            if (nameA === 'Unknown Files') {
                return 1;
            }
            if (nameB === 'Unknown Files') {
                return -1;
            }
            // Sort others by file count (descending)
            return filesB.length - filesA.length;
        });
        sortedLanguages.forEach(([languageName, files]) => {
            const fileCount = files.length;
            const languageInfo = files.length > 0 ? files[0].language : null;
            // Use shared utility for consistent icon display
            let iconPath;
            if (languageName === 'Unknown Files') {
                iconPath = new vscode.ThemeIcon('question');
            }
            else {
                iconPath = fileDisplayUtils_1.FileDisplayUtils.getFileIcon(languageInfo, context);
            }
            const languageItem = new CodeAnalysisTreeItem(languageName, vscode.TreeItemCollapsibleState.Collapsed, 'language-group', undefined, // No command for language groups
            iconPath, `${languageName} - ${fileCount} files found`, `${fileCount} files`, 'language-group', undefined, languageName);
            languageItems.push(languageItem);
        });
        console.log(`[CODE_ANALYSIS] Created ${languageItems.length} language group items`);
        return languageItems;
    }
    /**
     * Create file items for a specific language using shared utility for consistent display
     */
    static createFileItems(languageName, filesByLanguage, context) {
        console.log(`[ANALYSIS] Creating file items for language: ${languageName}`);
        const files = filesByLanguage[languageName] || [];
        return files.map(fileInfo => {
            const fileUri = vscode.Uri.file(fileInfo.fullPath);
            // Use shared utility for consistent file display
            const fileProperties = fileDisplayUtils_1.FileDisplayUtils.createFileTreeItemProperties(fileInfo.fileName, fileInfo.fullPath, 'language', // Use 'language' view type for relative path description
            undefined, // No file size needed for language view
            context, {
                command: 'codeXR.codeAnalysis.fileClicked',
                title: 'Open File',
                arguments: [fileUri]
            });
            console.log(`[ANALYSIS] File icon setup - Path: ${fileUri.fsPath}, Language: ${fileInfo.language?.name || 'unknown'}`);
            // Create tree item with unified display properties
            const treeItem = new CodeAnalysisTreeItem(path.basename(fileInfo.fileName), vscode.TreeItemCollapsibleState.None, 'file-item', fileProperties.command, fileProperties.iconPath, fileProperties.tooltip, fileProperties.description, // Will show relative path
            'file-item', fileInfo);
            // Set the resource URI for context menu and other VS Code features
            treeItem.resourceUri = fileUri;
            return treeItem;
        });
    }
}
exports.CodeAnalysisItemFactory = CodeAnalysisItemFactory;
//# sourceMappingURL=analysisTreeItems.js.map