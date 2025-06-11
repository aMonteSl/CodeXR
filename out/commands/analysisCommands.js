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
exports.registerAnalysisCommands = registerAnalysisCommands;
exports.registerSetAnalysisModeCommand = registerSetAnalysisModeCommand;
exports.registerSetAnalysisDebounceDelayCommand = registerSetAnalysisDebounceDelayCommand;
exports.registerToggleAutoAnalysisCommand = registerToggleAutoAnalysisCommand;
exports.registerRefreshAnalysisTreeCommand = registerRefreshAnalysisTreeCommand;
exports.registerSetAnalysisChartTypeCommand = registerSetAnalysisChartTypeCommand;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const analysisManager_1 = require("../analysis/analysisManager");
const fileWatchManager_1 = require("../analysis/fileWatchManager");
const model_1 = require("../analysis/model");
const xrAnalysisManager_1 = require("../analysis/xr/xrAnalysisManager");
const analysisDataManager_1 = require("../analysis/analysisDataManager");
const dimensionMapping_js_1 = require("../analysis/xr/dimensionMapping.js");
/**
 * ✅ COMANDO PARA DEPURACIÓN DE WATCHERS (ACTUALIZADO)
 */
function registerDebugWatchersCommand() {
    return vscode.commands.registerCommand('codexr.debugWatchers', async () => {
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (!fileWatchManager) {
            vscode.window.showWarningMessage('FileWatchManager not initialized');
            return;
        }
        const watcherStatus = fileWatchManager.getWatcherStatus();
        const managerStatus = analysisDataManager_1.analysisDataManager.getManagerStatus();
        const filesBeingAnalyzed = analysisDataManager_1.analysisDataManager.getFilesBeingAnalyzed();
        const debugInfo = `🔍 Analysis System Debug Info:

📁 File Watchers:
  • Total watchers: ${watcherStatus.totalWatchers}
  • Active timers: ${watcherStatus.activeTimers}
  • Auto-analysis: ${watcherStatus.autoAnalysisEnabled ? 'Enabled' : 'Disabled'}
  • Debounce delay: ${watcherStatus.debounceDelay}ms

📊 Data Manager:
  • Analysis results: ${managerStatus.analysisResults}
  • Active panels: ${managerStatus.activePanels}
  • Function panels: ${managerStatus.functionPanels}
  • Function data: ${managerStatus.functionData}
  • Files being analyzed: ${managerStatus.filesBeingAnalyzed}

📝 Watched Files:
${watcherStatus.watchedFiles.length > 0
            ? watcherStatus.watchedFiles.map(file => `  • ${file}`).join('\n')
            : '  • No files being watched'}

🔄 Currently Analyzing:
${filesBeingAnalyzed.length > 0
            ? filesBeingAnalyzed.map(file => `  • ${path.basename(file)}`).join('\n')
            : '  • No files currently being analyzed'}`;
        console.log(debugInfo);
        vscode.window.showInformationMessage(debugInfo, { modal: true });
    });
}
/**
 * Registers all analysis-related commands
 */
function registerAnalysisCommands(context) {
    const disposables = [];
    // Register settings commands
    disposables.push(registerSetAnalysisModeCommand());
    disposables.push(registerSetAnalysisDebounceDelayCommand());
    disposables.push(registerToggleAutoAnalysisCommand());
    disposables.push(registerRefreshAnalysisTreeCommand());
    disposables.push(registerSetAnalysisChartTypeCommand(context));
    disposables.push(registerSetDimensionMappingCommand(context));
    disposables.push(registerResetAnalysisDefaultsCommand(context));
    // ✅ COMANDOS PRINCIPALES DE ANÁLISIS (MENÚ CONTEXTUAL)
    // Comando para análisis estático (webview)
    disposables.push(vscode.commands.registerCommand('codexr.analyzeFile', async (fileUri) => {
        const filePath = getFilePathFromUri(fileUri);
        if (!filePath) {
            return;
        }
        // ✅ VERIFICAR SI EL ARCHIVO YA ESTÁ SIENDO ANALIZADO
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${path.basename(filePath)} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        console.log(`🔍 Starting STATIC analysis of file: ${filePath}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing ${path.basename(filePath)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 30, message: "Running code analysis..." });
            const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
            if (!result) {
                vscode.window.showErrorMessage('Failed to analyze file.');
                return;
            }
            progress.report({ increment: 70, message: "Preparing visualization..." });
            // Store result
            analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
            // Show static webview
            (0, analysisManager_1.showAnalysisWebView)(context, result);
            // Configure file watcher for static analysis
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setContext(context);
                fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.STATIC);
                fileWatchManager.startWatching(filePath, model_1.AnalysisMode.STATIC);
            }
        });
    }));
    // Comando para análisis XR (3D)
    disposables.push(vscode.commands.registerCommand('codexr.analyzeFile3D', async (fileUri) => {
        const filePath = getFilePathFromUri(fileUri);
        if (!filePath) {
            return;
        }
        // ✅ VERIFICAR SI EL ARCHIVO YA ESTÁ SIENDO ANALIZADO
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${path.basename(filePath)} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        console.log(`🔮 Starting XR analysis of file: ${filePath}`);
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Creating XR visualization for ${path.basename(filePath)}...`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 30, message: "Running code analysis..." });
            const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
            if (!result) {
                vscode.window.showErrorMessage('Failed to analyze file.');
                return;
            }
            progress.report({ increment: 70, message: "Creating XR visualization..." });
            // Store result
            analysisDataManager_1.analysisDataManager.setAnalysisResult(filePath, result);
            // Create XR visualization
            const xrPath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
            if (!xrPath) {
                vscode.window.showErrorMessage('Failed to create XR visualization.');
                return;
            }
            // Configure file watcher for XR analysis
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setContext(context);
                fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.XR);
                fileWatchManager.startWatching(filePath, model_1.AnalysisMode.XR);
            }
        });
    }));
    // ✅ COMANDO DESDE EL ÁRBOL (USA EL MODO CONFIGURADO) CON VERIFICACIÓN
    disposables.push(vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath) => {
        console.log(`🌳 Analyzing file from tree: ${filePath}`);
        // ✅ VERIFICAR SI EL ARCHIVO YA ESTÁ SIENDO ANALIZADO
        if (analysisDataManager_1.analysisDataManager.isFileBeingAnalyzed(filePath)) {
            vscode.window.showWarningMessage(`File ${path.basename(filePath)} is already being analyzed. Please wait for the current analysis to complete.`);
            return;
        }
        try {
            // Get current analysis mode from configuration
            const config = vscode.workspace.getConfiguration();
            const currentMode = config.get('codexr.analysisMode', 'Static');
            console.log(`Using configured analysis mode: ${currentMode}`);
            if (currentMode === 'XR') {
                // Execute XR analysis command
                await vscode.commands.executeCommand('codexr.analyzeFile3D', vscode.Uri.file(filePath));
            }
            else {
                // Execute static analysis command (default)
                await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
            }
        }
        catch (error) {
            console.error('Error analyzing file from tree:', error);
            vscode.window.showErrorMessage(`Error analyzing file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // ✅ COMANDO DE APERTURA Y ANÁLISIS (SIEMPRE ESTÁTICO)
    disposables.push(vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (filePath) => {
        console.log(`📂 Opening and analyzing file: ${filePath}`);
        try {
            // Open the file in editor first
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
            // Then run static analysis
            await vscode.commands.executeCommand('codexr.analyzeFile', vscode.Uri.file(filePath));
        }
        catch (error) {
            console.error('Error opening and analyzing file:', error);
            vscode.window.showErrorMessage(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }));
    // ✅ AÑADIR COMANDO DE DEPURACIÓN
    disposables.push(registerDebugWatchersCommand());
    return disposables;
}
/**
 * Helper function to get file path from URI
 */
function getFilePathFromUri(fileUri) {
    if (fileUri) {
        return fileUri.fsPath;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No file is currently open for analysis');
        return undefined;
    }
    return editor.document.uri.fsPath;
}
/**
 * Sets the default analysis mode
 */
function registerSetAnalysisModeCommand() {
    return vscode.commands.registerCommand('codexr.setAnalysisMode', async (mode) => {
        console.log('Setting analysis mode to:', mode);
        const config = vscode.workspace.getConfiguration();
        await config.update('codexr.analysisMode', mode, vscode.ConfigurationTarget.Global);
        // Show confirmation message
        vscode.window.showInformationMessage(`Default analysis mode set to: ${mode}`);
        // Use type assertion to avoid TypeScript error
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
        else {
            console.log('Tree data provider not available for refresh');
        }
    });
}
/**
 * Sets the analysis debounce delay
 */
function registerSetAnalysisDebounceDelayCommand() {
    return vscode.commands.registerCommand('codexr.setAnalysisDebounceDelay', async () => {
        const options = [
            { label: "Very Quick (500ms)", value: 500 },
            { label: "Quick (1 second)", value: 1000 },
            { label: "Standard (2 seconds)", value: 2000 },
            { label: "Relaxed (3 seconds)", value: 3000 },
            { label: "Extended (5 seconds)", value: 5000 }
        ];
        const selection = await vscode.window.showQuickPick(options.map(option => ({
            label: option.label,
            description: `${option.value}ms`,
            value: option.value
        })), {
            placeHolder: 'Select debounce delay',
            title: 'How long to wait before auto-analyzing after a file change'
        });
        if (selection) {
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.debounceDelay', selection.value, vscode.ConfigurationTarget.Global);
            // Update FileWatchManager with new delay
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setDebounceDelay(selection.value);
            }
            vscode.window.showInformationMessage(`Analysis debounce delay set to: ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
        }
    });
}
/**
 * Toggles automatic analysis
 */
function registerToggleAutoAnalysisCommand() {
    return vscode.commands.registerCommand('codexr.toggleAutoAnalysis', async () => {
        const config = vscode.workspace.getConfiguration();
        const currentValue = config.get('codexr.analysis.autoAnalysis', true);
        const newValue = !currentValue;
        await config.update('codexr.analysis.autoAnalysis', newValue, vscode.ConfigurationTarget.Global);
        // Update FileWatchManager
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setAutoAnalysis(newValue);
        }
        vscode.window.showInformationMessage(`Auto-analysis ${newValue ? 'enabled' : 'disabled'}`);
        // Refresh tree view
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
    });
}
/**
 * Refresh the analysis tree
 */
function registerRefreshAnalysisTreeCommand() {
    return vscode.commands.registerCommand('codexr.refreshAnalysisTree', async () => {
        console.log('Refreshing analysis tree view...');
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
            vscode.window.showInformationMessage('Analysis tree refreshed');
        }
        else {
            vscode.window.showWarningMessage('Tree data provider not available');
        }
    });
}
/**
 * Registers the command to set the analysis chart type
 */
function registerSetAnalysisChartTypeCommand(context) {
    return vscode.commands.registerCommand('codexr.setAnalysisChartType', async () => {
        const chartOptions = [
            { label: 'Boats Chart', value: 'boats', description: 'Simple 3D boat-like visualization' },
            { label: 'Bars Chart', value: 'bars', description: 'Traditional bar chart' },
            { label: 'Cylinders Chart', value: 'cylinders', description: 'Cylindrical bars' },
            { label: 'Pie Chart', value: 'pie', description: 'Circular sectors' },
            { label: 'Donut Chart', value: 'donut', description: 'Circular with center hole' }
        ];
        const selection = await vscode.window.showQuickPick(chartOptions, {
            placeHolder: 'Select chart type for analysis visualizations',
            title: 'Analysis Chart Type'
        });
        if (selection) {
            // Store in global state for immediate access
            await context.globalState.update('codexr.analysis.chartType', selection.value);
            // Also store in configuration for consistency
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.chartType', selection.value, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Analysis chart type set to: ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
        }
    });
}
/**
 * Register command to set dimension mapping for analysis charts
 */
function registerSetDimensionMappingCommand(context) {
    return vscode.commands.registerCommand('codexr.setDimensionMapping', async (chartType, dimensionKey, dimensionLabel) => {
        console.log(`Setting dimension mapping for ${chartType}, ${dimensionKey}: ${dimensionLabel}`);
        // Get available analysis fields
        const fieldOptions = dimensionMapping_js_1.ANALYSIS_FIELDS.map(field => ({
            label: field.displayName,
            description: field.description,
            value: field.key
        }));
        const selection = await vscode.window.showQuickPick(fieldOptions, {
            placeHolder: `Select data field for ${dimensionLabel}`,
            title: `Dimension Mapping: ${dimensionLabel}`
        });
        if (selection) {
            // Set the dimension mapping
            (0, dimensionMapping_js_1.setDimensionMapping)(context, chartType, dimensionKey, selection.value);
            vscode.window.showInformationMessage(`${dimensionLabel} mapped to: ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
        }
    });
}
/**
 * ✅ COMANDO PARA RESET DE CONFIGURACIÓN
 */
function registerResetAnalysisDefaultsCommand(context) {
    return vscode.commands.registerCommand('codexr.resetAnalysisDefaults', async () => {
        const confirmReset = await vscode.window.showWarningMessage('This will reset all analysis settings to their default values. Continue?', 'Reset', 'Cancel');
        if (confirmReset === 'Reset') {
            try {
                const config = vscode.workspace.getConfiguration();
                // Reset configuration values
                await config.update('codexr.analysisMode', 'Static', vscode.ConfigurationTarget.Global);
                await config.update('codexr.analysis.debounceDelay', 2000, vscode.ConfigurationTarget.Global);
                await config.update('codexr.analysis.autoAnalysis', true, vscode.ConfigurationTarget.Global);
                await config.update('codexr.analysis.chartType', 'boats', vscode.ConfigurationTarget.Global);
                // Reset global state values
                await context.globalState.update('codexr.analysis.chartType', 'boats');
                // Clear dimension mappings
                await context.globalState.update('codexr.analysis.dimensionMappings', undefined);
                // Update FileWatchManager with defaults
                const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                if (fileWatchManager) {
                    fileWatchManager.setDebounceDelay(2000);
                    fileWatchManager.setAutoAnalysis(true);
                }
                vscode.window.showInformationMessage('Analysis settings reset to defaults');
                // Refresh tree view
                if (global.treeDataProvider) {
                    global.treeDataProvider.refresh();
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error resetting settings: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });
}
//# sourceMappingURL=analysisCommands.js.map