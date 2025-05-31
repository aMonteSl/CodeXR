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
        if (!filePath)
            return;
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
        if (!filePath)
            return;
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
            // Create XR visualization (this automatically opens the browser)
            const htmlPath = await (0, xrAnalysisManager_1.createXRVisualization)(context, result);
            if (htmlPath) {
                // Configure file watcher for XR analysis
                const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                if (fileWatchManager) {
                    fileWatchManager.setContext(context);
                    fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.XR);
                    fileWatchManager.startWatching(filePath, model_1.AnalysisMode.XR);
                }
                console.log('✅ XR visualization created and file watcher configured');
            }
        });
    }));
    // ✅ COMANDO DESDE EL ÁRBOL (USA EL MODO CONFIGURADO)
    disposables.push(vscode.commands.registerCommand('codexr.analyzeFileFromTree', async (filePath) => {
        console.log(`🌳 Analyzing file from tree: ${filePath}`);
        try {
            // ✅ PRIMERO ABRIR EL ARCHIVO EN EL EDITOR SI NO ESTÁ ABIERTO
            console.log(`📂 Opening file in editor: ${path.basename(filePath)}`);
            const fileUri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document, {
                preview: false, // No abrir en modo preview
                viewColumn: vscode.ViewColumn.One // Abrir en la columna principal
            });
            console.log(`✅ File opened in editor: ${path.basename(filePath)}`);
            // ✅ PEQUEÑO DELAY PARA ASEGURAR QUE EL EDITOR ESTÉ LISTO
            await new Promise(resolve => setTimeout(resolve, 100));
            // Get current analysis mode from settings
            const config = vscode.workspace.getConfiguration();
            const currentMode = config.get('codexr.analysisMode', 'Static');
            console.log(`🔍 Analysis mode from settings: ${currentMode}`);
            if (currentMode === 'XR') {
                // Use XR analysis
                console.log(`🔮 Starting XR analysis for ${path.basename(filePath)}`);
                await vscode.commands.executeCommand('codexr.analyzeFile3D', fileUri);
            }
            else {
                // Use static analysis
                console.log(`📊 Starting static analysis for ${path.basename(filePath)}`);
                await vscode.commands.executeCommand('codexr.analyzeFile', fileUri);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error opening/analyzing file from tree:`, error);
            vscode.window.showErrorMessage(`Error opening file: ${errorMessage}`);
        }
    }));
    // ✅ COMANDO DE APERTURA Y ANÁLISIS (SIEMPRE ESTÁTICO)
    disposables.push(vscode.commands.registerCommand('codexr.openAndAnalyzeFile', async (filePath) => {
        console.log(`📂 Opening and analyzing file: ${filePath}`);
        try {
            // ✅ ABRIR EL ARCHIVO EN EL EDITOR
            const fileUri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.One
            });
            console.log(`✅ File opened: ${path.basename(filePath)}`);
            // ✅ PEQUEÑO DELAY PARA ASEGURAR QUE EL EDITOR ESTÉ LISTO
            await new Promise(resolve => setTimeout(resolve, 100));
            // ✅ SIEMPRE USAR ANÁLISIS ESTÁTICO PARA ESTE COMANDO
            console.log(`📊 Starting static analysis for opened file: ${path.basename(filePath)}`);
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Analyzing ${path.basename(filePath)}...`,
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: "Running code analysis..." });
                const result = await (0, analysisManager_1.analyzeFile)(filePath, context);
                if (!result) {
                    vscode.window.showErrorMessage('Failed to analyze file.');
                    return;
                }
                progress.report({ increment: 50, message: "Opening analysis view..." });
                // Show static analysis
                (0, analysisManager_1.showAnalysisWebView)(context, result);
                // Configure file watcher for static analysis
                const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
                if (fileWatchManager) {
                    fileWatchManager.setContext(context);
                    fileWatchManager.setAnalysisMode(filePath, model_1.AnalysisMode.STATIC);
                    fileWatchManager.startWatching(filePath, model_1.AnalysisMode.STATIC);
                }
                console.log('✅ Static analysis completed and file watcher configured');
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Error in openAndAnalyzeFile:`, error);
            vscode.window.showErrorMessage(`Error: ${errorMessage}`);
        }
    }));
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
            vscode.commands.executeCommand('codexr.refreshTreeView');
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
            // Update FileWatchManager if it exists
            const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
            if (fileWatchManager) {
                fileWatchManager.setDebounceDelay(selection.value);
            }
            vscode.window.showInformationMessage(`Debounce delay set to ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
            else {
                vscode.commands.executeCommand('codexr.refreshTreeView');
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
        // Update FileWatchManager if it exists
        const fileWatchManager = fileWatchManager_1.FileWatchManager.getInstance();
        if (fileWatchManager) {
            fileWatchManager.setAutoAnalysis(newValue);
        }
        vscode.window.showInformationMessage(`Auto-analysis ${newValue ? 'enabled' : 'disabled'}`);
        // Refresh tree view
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
        else {
            vscode.commands.executeCommand('codexr.refreshTreeView');
        }
    });
}
/**
 * Refresh the analysis tree
 */
function registerRefreshAnalysisTreeCommand() {
    return vscode.commands.registerCommand('codexr.refreshAnalysisTree', async () => {
        // Usa el proveedor global si está disponible
        if (global.treeDataProvider) {
            global.treeDataProvider.refresh();
        }
        else {
            vscode.commands.executeCommand('codexr.refreshTreeView');
        }
        vscode.window.showInformationMessage('Analysis tree refreshed');
    });
}
/**
 * Registers the command to set the analysis chart type
 */
function registerSetAnalysisChartTypeCommand(context) {
    return vscode.commands.registerCommand('codexr.setAnalysisChartType', async () => {
        const options = [
            { label: "Boats", description: "3D Blocks Visualization", value: "boats" },
            { label: "Bars", description: "Classic 2D Bar Chart", value: "bars" },
            { label: "Cylinders", description: "3D Cylinder Chart", value: "cyls" },
            { label: "Bars Map", description: "3D Bars Layout", value: "barsmap" },
            { label: "Pie Chart", description: "Circular Sectors Chart", value: "pie" },
            { label: "Donut Chart", description: "Ring Chart with Center Hole", value: "donut" }
        ];
        const selection = await vscode.window.showQuickPick(options.map(option => ({
            label: option.label,
            description: option.description,
            value: option.value
        })), {
            placeHolder: 'Select chart type for visualizations',
            title: 'Which chart type should be used for code analysis?'
        });
        if (selection) {
            // ✅ GUARDAR EN AMBOS LUGARES PARA CONSISTENCIA
            await context.globalState.update('codexr.analysis.chartType', selection.value);
            // ✅ TAMBIÉN GUARDAR EN WORKSPACE CONFIG PARA EL TREE VIEW
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.chartType', selection.value, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Chart type set to: ${selection.label}`);
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
            else {
                vscode.commands.executeCommand('codexr.refreshTreeView');
            }
        }
    });
}
/**
 * Register command to set dimension mapping for analysis charts
 */
function registerSetDimensionMappingCommand(context) {
    return vscode.commands.registerCommand('codexr.setDimensionMapping', async (chartType, dimensionKey, dimensionLabel) => {
        try {
            // Get current mapping
            const currentMapping = (0, dimensionMapping_js_1.getDimensionMapping)(chartType, context);
            // Show available fields
            const options = dimensionMapping_js_1.ANALYSIS_FIELDS.map(field => ({
                label: field.label,
                description: field.description,
                value: field.key
            }));
            const selection = await vscode.window.showQuickPick(options, {
                placeHolder: `Select field for ${dimensionLabel}`,
                title: `Map ${dimensionLabel} to which data field?`
            });
            if (selection) {
                // Update the mapping
                const updatedMapping = { ...currentMapping };
                updatedMapping[dimensionKey] = selection.value;
                // Save the mapping
                (0, dimensionMapping_js_1.setDimensionMapping)(chartType, updatedMapping, context);
                vscode.window.showInformationMessage(`${dimensionLabel} mapped to ${selection.label}`);
                // Refresh tree view
                if (global.treeDataProvider) {
                    global.treeDataProvider.refresh();
                }
                else {
                    vscode.commands.executeCommand('codexr.refreshTreeView');
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error setting dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
/**
 * ✅ NUEVO COMANDO PARA RESET DE CONFIGURACIÓN
 */
function registerResetAnalysisDefaultsCommand(context) {
    return vscode.commands.registerCommand('codexr.resetAnalysisDefaults', async () => {
        try {
            // Confirmar la acción con el usuario
            const confirmation = await vscode.window.showWarningMessage('This will reset your analysis configuration to defaults:\n\n• Chart Type: Boats\n• Area: parameters\n• Height: linesCount\n• Color: complexity\n\nDo you want to continue?', { modal: true }, 'Reset to Defaults', 'Cancel');
            if (confirmation !== 'Reset to Defaults') {
                return;
            }
            // Reset chart type to boats
            await context.globalState.update('codexr.analysis.chartType', 'boats');
            // ✅ TAMBIÉN ACTUALIZAR EN WORKSPACE CONFIG PARA CONSISTENCIA
            const config = vscode.workspace.getConfiguration();
            await config.update('codexr.analysis.chartType', 'boats', vscode.ConfigurationTarget.Global);
            // Reset dimension mapping for boats to default values
            const defaultBoatsMapping = {
                area: 'parameters',
                height: 'linesCount',
                color: 'complexity'
            };
            await context.globalState.update('codexr.analysis.dimensionMapping.boats', defaultBoatsMapping);
            // Clear any other chart type mappings to ensure clean state
            const chartTypes = ['bars', 'cyls', 'barsmap', 'pie', 'donut'];
            for (const chartType of chartTypes) {
                await context.globalState.update(`codexr.analysis.dimensionMapping.${chartType}`, undefined);
            }
            console.log('🔄 Analysis configuration reset to defaults:', {
                chartType: 'boats',
                mapping: defaultBoatsMapping
            });
            vscode.window.showInformationMessage('Analysis configuration reset to defaults: Boats chart with default dimension mapping.');
            // Refresh tree view
            if (global.treeDataProvider) {
                global.treeDataProvider.refresh();
            }
            else {
                vscode.commands.executeCommand('codexr.refreshTreeView');
            }
        }
        catch (error) {
            console.error('Error resetting analysis defaults:', error);
            vscode.window.showErrorMessage(`Error resetting configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
}
//# sourceMappingURL=analysisCommands.js.map