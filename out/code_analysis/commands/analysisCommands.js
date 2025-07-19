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
exports.CodeAnalysisCommands = void 0;
exports.executeFileAnalysis = executeFileAnalysis;
exports.runXRFileAnalysisCoordinator = runXRFileAnalysisCoordinator;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const handleAnalysisClicks_1 = require("../views/interactions/handleAnalysisClicks");
const analysisSettingsStorage_1 = require("../../utils/analysisSettingsStorage");
const pythonEnvStorage_1 = require("../../python_env/storage/pythonEnvStorage");
const pythonEnvUtils_1 = require("../../python_env/utils/pythonEnvUtils");
const tempStorageManager_1 = require("../utils/tempStorageManager");
const activeAnalysisRegistry_1 = require("../active_analyses/registry/activeAnalysisRegistry");
const activeAnalysisModel_1 = require("../active_analyses/model/activeAnalysisModel");
const chartRegistry_1 = require("../../babia_templates/registry/chartRegistry");
const xrTemplateRenderer_1 = require("../utils/xrTemplateRenderer");
/**
 * Code Analysis Commands
 * Handles all command registrations for the code analysis functionality
 */
class CodeAnalysisCommands {
    /**
     * Register all code analysis commands
     */
    static registerCommands(context) {
        console.log('[CODE_ANALYSIS] Registering code analysis commands...');
        // Main section commands
        const showActiveAnalysesCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showActiveAnalyses', () => {
            console.log('[CODE_ANALYSIS] Command: showActiveAnalyses executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('active-analyses', context);
        });
        const showAnalysisSettingsCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showAnalysisSettings', () => {
            console.log('[CODE_ANALYSIS] Command: showAnalysisSettings executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('analysis-settings', context);
        });
        const showFilesByLanguageCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.showFilesByLanguage', () => {
            console.log('[CODE_ANALYSIS] Command: showFilesByLanguage executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleSectionClick('files-by-language', context);
        });
        // Placeholder commands
        const placeholderActiveAnalysesCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.activeAnalyses', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.activeAnalyses executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('activeAnalyses');
        });
        const placeholderAnalysisSettingsCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.analysisSettings', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.analysisSettings executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('analysisSettings');
        });
        const placeholderFilesByLanguageCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.placeholder.filesByLanguage', () => {
            console.log('[CODE_ANALYSIS] Command: placeholder.filesByLanguage executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handlePlaceholderClick('filesByLanguage');
        });
        // Analysis mode toggle command
        const toggleAnalysisModeCommand = vscode.commands.registerCommand('codexr.analysis.toggleMode', async () => {
            console.log('[CODE_ANALYSIS] Command: toggleMode executed');
            try {
                const newMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.toggleAnalysisMode(context);
                vscode.window.showInformationMessage(`Analysis mode switched to: ${newMode}`);
                // Refresh the tree view to show the updated mode
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error toggling analysis mode:', error);
                vscode.window.showErrorMessage('Failed to toggle analysis mode');
            }
        });
        // File analysis commands
        const analyzeFileStaticCommand = vscode.commands.registerCommand('codexr.analysis.fileStatic', async (uri) => {
            console.log('[CODE_ANALYSIS] Command: analyzeFileStatic executed');
            let analysisId;
            try {
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                if (!targetUri) {
                    vscode.window.showErrorMessage('No file selected for analysis');
                    return;
                }
                // Check if file is saved (for unsaved files, suggest saving first)
                if (targetUri.scheme !== 'file') {
                    vscode.window.showWarningMessage('Please save the file before analyzing it.');
                    return;
                }
                console.log(`ANALYSIS_FILE_STATS: Starting static analysis for ${targetUri.fsPath}`);
                // Check if file type is supported
                const supportedExtensions = [
                    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
                    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.kts', '.scala', '.sc', '.dart',
                    '.vue', '.html', '.css', '.scss', '.less',
                    // Additional languages for comprehensive analysis
                    '.sol', '.m', '.mm', '.zig', '.ttcn', '.ttcn3', '.erl', '.hrl', '.lua', '.pl', '.pm',
                    '.pod', '.t', '.f90', '.f95', '.f03', '.f08', '.gd'
                ];
                const fileExtension = path.extname(targetUri.fsPath).toLowerCase();
                if (!supportedExtensions.includes(fileExtension)) {
                    vscode.window.showWarningMessage(`File type ${fileExtension} is not currently supported for analysis.`);
                    return;
                }
                vscode.window.showInformationMessage(`Analyzing ${path.basename(targetUri.fsPath)} in Static mode...`);
                // Ensure we have a proper file system path
                let actualFilePath = targetUri.fsPath;
                // Fix URI path if it contains the file:// protocol prefix or similar issues
                if (actualFilePath.startsWith('/file:')) {
                    actualFilePath = actualFilePath.replace('/file:', '');
                    // Remove any leading extra slashes
                    while (actualFilePath.startsWith('//')) {
                        actualFilePath = actualFilePath.substring(1);
                    }
                }
                console.log(`ANALYSIS_FILE_STATS: Corrected file path: ${actualFilePath}`);
                // 🔥 REGISTER ANALYSIS IN ACTIVE ANALYSES
                console.log('[CODE_ANALYSIS] 📋 Registering file analysis in Active Analyses...');
                const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                {
                    const analysisTemplate = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(actualFilePath, 'Static', path.extname(actualFilePath).toLowerCase().substring(1) || 'unknown');
                    // Convert to ActiveAnalysisData by removing the id
                    const { id, ...registrationData } = analysisTemplate;
                    analysisId = registry.registerAnalysis(registrationData);
                    console.log(`[CODE_ANALYSIS] ✅ Registered analysis with ID: ${analysisId}`);
                }
                // Run the Python analysis coordinator
                const analysisData = await executeFileAnalysis(context, actualFilePath);
                if (analysisData) {
                    console.log(`ANALYSIS_FILE_STATS: Generated data.json for ${path.basename(targetUri.fsPath)}`, analysisData);
                    // Get current analysis mode to determine how to handle the result
                    const currentMode = await analysisSettingsStorage_1.AnalysisSettingsStorage.getCurrentAnalysisMode(context);
                    if (currentMode === 'Static') {
                        // For Static mode: Create viewer assets and launch server
                        try {
                            console.log(`ANALYSIS_FILE_STATS: Preparing static analysis viewer for ${path.basename(targetUri.fsPath)}`);
                            await (0, tempStorageManager_1.prepareStaticAnalysisViewerAssets)(context, targetUri.fsPath, analysisData);
                            console.log(`ANALYSIS_FILE_STATS: Static analysis viewer launched successfully`);
                        }
                        catch (viewerError) {
                            console.error(`ANALYSIS_FILE_STATS: Failed to prepare static analysis viewer: ${viewerError}`);
                            vscode.window.showErrorMessage(`Failed to launch static analysis viewer: ${viewerError}`);
                            // Fallback: Still store the data for manual access
                            try {
                                const storageUri = await (0, tempStorageManager_1.storeAnalysisJson)(context, targetUri.fsPath, analysisData);
                                console.log(`ANALYSIS_FILE_STATS: Analysis data stored at ${storageUri.fsPath} (fallback)`);
                            }
                            catch (storageError) {
                                console.error(`ANALYSIS_FILE_STATS: Fallback storage also failed: ${storageError}`);
                            }
                        }
                    }
                    else {
                        // For XR mode or other modes: Just store the data
                        try {
                            const storageUri = await (0, tempStorageManager_1.storeAnalysisJson)(context, targetUri.fsPath, analysisData);
                            console.log(`ANALYSIS_FILE_STATS: Analysis data stored at ${storageUri.fsPath}`);
                        }
                        catch (storageError) {
                            console.error(`ANALYSIS_FILE_STATS: Failed to store analysis data: ${storageError}`);
                            // Continue with the rest of the process even if storage fails
                        }
                    }
                    const stats = analysisData;
                    const functionCount = stats.functionCount || 0;
                    const classCount = stats.classCount || 0;
                    const complexity = stats.complexity?.averageComplexity || 0;
                    const commentRatio = Math.round((stats.commentRatio || 0) * 100);
                    const modeMessage = currentMode === 'Static' ? ' (viewer launched)' : '';
                    vscode.window.showInformationMessage(`Analysis completed: ${functionCount} functions, ${classCount} classes, ` +
                        `${commentRatio}% comments, avg complexity ${complexity.toFixed(1)}${modeMessage}`);
                    // 🔥 UPDATE ANALYSIS STATUS TO COMPLETED
                    console.log(`[CODE_ANALYSIS] 🎉 Updating analysis ${analysisId} status to completed`);
                    registry.updateAnalysis(analysisId, 'completed', 100, undefined, {
                        totalLines: stats.totalLines,
                        totalFunctions: functionCount,
                        complexity: complexity
                    });
                }
                else {
                    console.error('ANALYSIS_FILE_STATS: Failed to generate analysis data');
                    vscode.window.showErrorMessage('Analysis failed - no data generated');
                    // 🔥 UPDATE ANALYSIS STATUS TO FAILED
                    console.log(`[CODE_ANALYSIS] ❌ Updating analysis ${analysisId} status to failed`);
                    registry.updateAnalysis(analysisId, 'failed', 0, 'Failed to generate analysis data');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error analyzing file (Static):', error);
                vscode.window.showErrorMessage('Failed to analyze file in Static mode');
                // 🔥 UPDATE ANALYSIS STATUS TO FAILED (if analysisId exists)
                try {
                    if (typeof analysisId !== 'undefined') {
                        console.log(`[CODE_ANALYSIS] ❌ Updating analysis ${analysisId} status to failed due to exception`);
                        const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                        registry.updateAnalysis(analysisId, 'failed', 0, `Analysis failed: ${error}`);
                    }
                }
                catch (registryError) {
                    console.error('[CODE_ANALYSIS] Failed to update analysis status in catch block:', registryError);
                }
            }
        });
        const analyzeFileXRCommand = vscode.commands.registerCommand('codexr.analysis.fileXR', async (uri) => {
            console.log('[CODE_ANALYSIS] Command: analyzeFileXR executed');
            let analysisId;
            try {
                const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
                if (!targetUri) {
                    vscode.window.showErrorMessage('No file selected for analysis');
                    return;
                }
                // Check if file type is supported (same check as static analysis)
                const supportedExtensions = [
                    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
                    '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.kts', '.scala', '.sc', '.dart',
                    '.vue', '.html', '.css', '.scss', '.less',
                    // Additional languages for comprehensive analysis
                    '.sol', '.m', '.mm', '.zig', '.ttcn', '.ttcn3', '.erl', '.hrl', '.lua', '.pl', '.pm',
                    '.pod', '.t', '.f90', '.f95', '.f03', '.f08', '.gd'
                ];
                const fileExtension = path.extname(targetUri.fsPath).toLowerCase();
                if (!supportedExtensions.includes(fileExtension)) {
                    vscode.window.showWarningMessage(`File type ${fileExtension} is not currently supported for XR analysis.`);
                    return;
                }
                // Ensure we have a proper file system path
                let actualFilePath = targetUri.fsPath;
                // Fix URI path if it contains the file:// protocol prefix or similar issues
                if (actualFilePath.startsWith('/file:')) {
                    actualFilePath = actualFilePath.replace('/file:', '');
                    // Remove any leading extra slashes
                    while (actualFilePath.startsWith('//')) {
                        actualFilePath = actualFilePath.substring(1);
                    }
                }
                console.log(`[CODE_ANALYSIS] Corrected XR file path: ${actualFilePath}`);
                console.log(`[CODE_ANALYSIS] Analyzing file in XR mode: ${actualFilePath}`);
                vscode.window.showInformationMessage(`Analyzing ${path.basename(actualFilePath)} in XR mode...`);
                // 🔥 REGISTER ANALYSIS IN ACTIVE ANALYSES
                console.log('[CODE_ANALYSIS] 📋 Registering XR file analysis in Active Analyses...');
                const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                {
                    const analysisTemplate = activeAnalysisModel_1.ActiveAnalysisFactory.createFileAnalysis(actualFilePath, 'XR', path.extname(actualFilePath).toLowerCase().substring(1) || 'unknown');
                    // Convert to ActiveAnalysisData by removing the id
                    const { id, ...registrationData } = analysisTemplate;
                    analysisId = registry.registerAnalysis(registrationData);
                    console.log(`[CODE_ANALYSIS] ✅ Registered XR analysis with ID: ${analysisId}`);
                }
                // Run the XR Python analysis coordinator
                const analysisData = await runXRFileAnalysisCoordinator(context, actualFilePath);
                if (analysisData) {
                    console.log(`[CODE_ANALYSIS] Generated XR analysis data.json for ${path.basename(actualFilePath)}`, analysisData);
                    // Store the analysis data using the same temp storage as static analysis
                    try {
                        const tempFolder = await (0, tempStorageManager_1.storeAnalysisJson)(context, actualFilePath, analysisData);
                        console.log(`[CODE_ANALYSIS] XR analysis data stored at: ${tempFolder.fsPath}`);
                        // Generate XR visualization index.html
                        try {
                            console.log(`[CODE_ANALYSIS] Generating XR visualization HTML for ${path.basename(actualFilePath)}`);
                            await xrTemplateRenderer_1.XRTemplateRenderer.generateXRVisualization(context, tempFolder, actualFilePath, analysisData);
                            console.log(`[CODE_ANALYSIS] ✅ XR visualization HTML generated successfully`);
                            // Launch XR server with the generated assets
                            try {
                                console.log(`[CODE_ANALYSIS] Launching XR viewer server for ${path.basename(actualFilePath)}`);
                                await (0, tempStorageManager_1.prepareXRAnalysisViewerAssets)(context, tempFolder, actualFilePath);
                                console.log(`[CODE_ANALYSIS] ✅ XR viewer server launched successfully`);
                            }
                            catch (serverError) {
                                console.error(`[CODE_ANALYSIS] ⚠️ Failed to launch XR viewer server: ${serverError}`);
                                vscode.window.showWarningMessage(`XR analysis completed but failed to launch viewer: ${serverError}`);
                            }
                        }
                        catch (htmlError) {
                            console.error(`[CODE_ANALYSIS] ⚠️ Failed to generate XR visualization HTML: ${htmlError}`);
                            // Don't fail the entire analysis, just warn
                            vscode.window.showWarningMessage(`XR analysis completed but failed to generate visualization: ${htmlError}`);
                        }
                        // Update analysis status to completed
                        registry.updateAnalysis(analysisId, 'completed', 100, undefined, {
                            totalLines: analysisData.totalLines || 0,
                            totalFunctions: analysisData.functionCount || 0,
                            complexity: analysisData.complexity?.averageComplexity || 0
                        });
                        vscode.window.showInformationMessage(`XR analysis completed for ${path.basename(actualFilePath)}`);
                    }
                    catch (storageError) {
                        console.error(`[CODE_ANALYSIS] Failed to store XR analysis data: ${storageError}`);
                        vscode.window.showErrorMessage(`Failed to store XR analysis data: ${storageError}`);
                        registry.updateAnalysis(analysisId, 'failed', 0, `Storage failed: ${storageError}`);
                    }
                }
                else {
                    console.error(`[CODE_ANALYSIS] XR analysis returned no data for ${actualFilePath}`);
                    vscode.window.showErrorMessage(`XR analysis failed for ${path.basename(actualFilePath)}`);
                    registry.updateAnalysis(analysisId, 'failed', 0, 'Analysis returned no data');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error analyzing file (XR):', error);
                vscode.window.showErrorMessage('Failed to analyze file in XR mode');
                // 🔥 UPDATE ANALYSIS STATUS TO FAILED (if analysisId exists)
                try {
                    if (typeof analysisId !== 'undefined') {
                        console.log(`[CODE_ANALYSIS] ❌ Updating XR analysis ${analysisId} status to failed due to exception`);
                        const registry = activeAnalysisRegistry_1.ActiveAnalysisRegistry.getInstance();
                        registry.updateAnalysis(analysisId, 'failed', 0, `XR Analysis failed: ${error}`);
                    }
                }
                catch (registryError) {
                    console.error('[CODE_ANALYSIS] Failed to update XR analysis status in catch block:', registryError);
                }
            }
        });
        // Refresh command
        const refreshCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.refresh', () => {
            console.log('[CODE_ANALYSIS] Command: refresh executed');
            vscode.commands.executeCommand('codexr.servers.refresh');
        });
        // File click command
        const fileClickedCommand = vscode.commands.registerCommand('codeXR.codeAnalysis.fileClicked', (filePath) => {
            console.log('[CODE_ANALYSIS] Command: fileClicked executed');
            handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleFileClick(filePath, context);
        });
        // Theme toggle command
        const toggleThemeCommand = vscode.commands.registerCommand('codexr.analysis.toggleTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: toggleTheme executed');
            try {
                const newTheme = await analysisSettingsStorage_1.AnalysisSettingsStorage.toggleTheme(context);
                vscode.window.showInformationMessage(`Analysis viewer theme switched to: ${newTheme}`);
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error toggling theme:', error);
                vscode.window.showErrorMessage('Failed to toggle analysis viewer theme');
            }
        });
        // Set theme commands
        const setLightThemeCommand = vscode.commands.registerCommand('codexr.analysis.setLightTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: setLightTheme executed');
            try {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, 'light');
                vscode.window.showInformationMessage('Analysis viewer theme set to light');
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting light theme:', error);
                vscode.window.showErrorMessage('Failed to set light theme');
            }
        });
        const setDarkThemeCommand = vscode.commands.registerCommand('codexr.analysis.setDarkTheme', async () => {
            console.log('[CODE_ANALYSIS] Command: setDarkTheme executed');
            try {
                await analysisSettingsStorage_1.AnalysisSettingsStorage.setTheme(context, 'dark');
                vscode.window.showInformationMessage('Analysis viewer theme set to dark');
                // Refresh the tree view to show the updated theme
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting dark theme:', error);
                vscode.window.showErrorMessage('Failed to set dark theme');
            }
        });
        // Auto-Analysis Delay command
        const setAutoAnalysisDelayCommand = vscode.commands.registerCommand('codexr.analysis.setAutoAnalysisDelay', async () => {
            console.log('[CODE_ANALYSIS] Command: setAutoAnalysisDelay executed');
            try {
                await handleAnalysisClicks_1.CodeAnalysisInteractionHandler.handleAutoAnalysisDelaySelection(context);
                // Refresh the tree view to show the updated delay
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error setting auto-analysis delay:', error);
                vscode.window.showErrorMessage('Failed to set auto-analysis delay');
            }
        });
        // Command: Select Chart Type for File Analysis
        const selectChartTypeFileCommand = vscode.commands.registerCommand('codexr.analysis.selectChartTypeFile', async () => {
            console.log('[CODE_ANALYSIS] Command: selectChartTypeFile executed');
            try {
                await handleChartTypeFileSelection(context);
                // Refresh the tree view to show the updated chart type
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error selecting chart type for file analysis:', error);
                vscode.window.showErrorMessage('Failed to select chart type for file analysis');
            }
        });
        // Command: Map Dimension for File Analysis
        const mapDimensionFileCommand = vscode.commands.registerCommand('codexr.analysis.mapDimensionFile', async (dimensionName, dataType, required) => {
            console.log('[CODE_ANALYSIS] Command: mapDimensionFile executed', { dimensionName, dataType, required });
            // Validate arguments
            if (!dimensionName || typeof dimensionName !== 'string') {
                console.error('[CODE_ANALYSIS] Invalid dimensionName argument:', dimensionName);
                vscode.window.showErrorMessage('Invalid dimension name provided');
                return;
            }
            try {
                await handleDimensionMappingFileSelection(context, dimensionName, dataType, required);
                // Refresh the tree view to show the updated mapping
                vscode.commands.executeCommand('codexr.servers.refresh');
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error mapping dimension for file analysis:', error);
                vscode.window.showErrorMessage('Failed to map dimension for file analysis');
            }
        });
        // Command: Reset Analysis Settings to Defaults
        const resetSettingsCommand = vscode.commands.registerCommand('codexr.analysis.resetSettings', async () => {
            console.log('[CODE_ANALYSIS] Command: resetSettings executed');
            try {
                // Show confirmation dialog
                const result = await vscode.window.showWarningMessage('Reset all analysis settings to default values? This will restore chart type to "boats" and clear all dimension mappings.', { modal: true }, 'Reset Settings', 'Cancel');
                if (result === 'Reset Settings') {
                    // Reset to default configuration
                    await analysisSettingsStorage_1.AnalysisSettingsStorage.resetToDefaults(context);
                    // Refresh the tree view to show the updated settings
                    vscode.commands.executeCommand('codexr.servers.refresh');
                    vscode.window.showInformationMessage('Analysis settings have been reset to default values');
                }
            }
            catch (error) {
                console.error('[CODE_ANALYSIS] Error resetting analysis settings:', error);
                vscode.window.showErrorMessage('Failed to reset analysis settings');
            }
        });
        // Add all commands to subscriptions
        context.subscriptions.push(showActiveAnalysesCommand, showAnalysisSettingsCommand, showFilesByLanguageCommand, placeholderActiveAnalysesCommand, placeholderAnalysisSettingsCommand, placeholderFilesByLanguageCommand, toggleAnalysisModeCommand, analyzeFileStaticCommand, analyzeFileXRCommand, refreshCommand, fileClickedCommand, toggleThemeCommand, setLightThemeCommand, setDarkThemeCommand, setAutoAnalysisDelayCommand, selectChartTypeFileCommand, mapDimensionFileCommand, resetSettingsCommand);
        console.log('[CODE_ANALYSIS] All code analysis commands registered successfully');
    }
}
exports.CodeAnalysisCommands = CodeAnalysisCommands;
/**
 * Run analysis for a file and return the analysis data
 * This is a reusable function that can be called from various contexts
 *
 * @param context - VS Code extension context
 * @param filePath - Absolute file path to analyze
 * @returns Promise<any> - Analysis data object
 */
async function executeFileAnalysis(context, filePath) {
    console.log(`[ANALYSIS_EXECUTION] Starting analysis for ${path.basename(filePath)}`);
    try {
        // Run the Python static analysis coordinator
        const analysisData = await runStaticFileAnalysisCoordinator(context, filePath);
        if (!analysisData) {
            throw new Error('Analysis coordinator returned no data');
        }
        console.log(`[ANALYSIS_EXECUTION] Analysis completed for ${path.basename(filePath)}`);
        return analysisData;
    }
    catch (error) {
        console.error(`[ANALYSIS_EXECUTION] Analysis failed for ${path.basename(filePath)}:`, error);
        throw error;
    }
}
/**
 * Run the Python static file analysis coordinator
 */
async function runStaticFileAnalysisCoordinator(context, filePath) {
    return new Promise((resolve, reject) => {
        console.log(`STATIC_ANALYSIS: Running static coordinator for ${filePath}`);
        // Get the path to the Python coordinator script
        const extensionPath = context.extensionPath;
        const coordinatorPath = path.join(extensionPath, 'src', 'code_analysis', 'python', 'static_file_analysis_coordinator.py');
        console.log(`STATIC_ANALYSIS: Using coordinator script: ${coordinatorPath}`);
        // Get virtual environment paths
        const pythonEnvStorage = new pythonEnvStorage_1.PythonEnvStorage(context);
        const venvPath = pythonEnvStorage.getVenvPath();
        const pythonExecutable = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
        console.log(`STATIC_ANALYSIS: Using Python virtual environment: ${venvPath}`);
        console.log(`STATIC_ANALYSIS: Using Python executable: ${pythonExecutable}`);
        // Check if virtual environment exists and use it, otherwise fallback to system Python
        let pythonCommand = 'python3';
        try {
            if (pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
                pythonCommand = pythonExecutable;
                console.log(`STATIC_ANALYSIS: Using virtual environment Python: ${pythonCommand}`);
            }
            else {
                console.log(`STATIC_ANALYSIS: Virtual environment not found, using system Python: ${pythonCommand}`);
            }
        }
        catch (error) {
            console.log(`STATIC_ANALYSIS: Error checking virtual environment, using system Python: ${error}`);
        }
        // Spawn the Python process
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [coordinatorPath, filePath], {
            cwd: path.dirname(coordinatorPath)
        });
        let stdout = '';
        let stderr = '';
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderr += stderrText;
            // Log debug messages from the Python script
            const lines = stderrText.split('\n').filter((line) => line.trim());
            lines.forEach((line) => {
                try {
                    const debugMsg = JSON.parse(line);
                    if (debugMsg.debug) {
                        console.log(debugMsg.debug);
                    }
                }
                catch {
                    // Not a JSON debug message, log as is
                    console.log(`STATIC_ANALYSIS: ${line}`);
                }
            });
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    console.log(`STATIC_ANALYSIS: Analysis completed with status: ${result.status}`);
                    resolve(result);
                }
                catch (error) {
                    console.error(`STATIC_ANALYSIS: Failed to parse JSON output: ${error}`);
                    console.error(`STATIC_ANALYSIS: Raw stdout: ${stdout}`);
                    reject(new Error('Failed to parse static analysis output'));
                }
            }
            else {
                console.error(`STATIC_ANALYSIS: Python process exited with code ${code}`);
                console.error(`STATIC_ANALYSIS: stderr: ${stderr}`);
                reject(new Error(`Static analysis process failed with code ${code}`));
            }
        });
        pythonProcess.on('error', (error) => {
            console.error(`STATIC_ANALYSIS: Failed to start Python process: ${error}`);
            reject(error);
        });
    });
}
/**
 * Run the Python XR file analysis coordinator
 */
async function runXRFileAnalysisCoordinator(context, filePath) {
    return new Promise((resolve, reject) => {
        console.log(`XR_ANALYSIS: Running XR coordinator for ${filePath}`);
        // Get the path to the Python coordinator script
        const extensionPath = context.extensionPath;
        const coordinatorPath = path.join(extensionPath, 'src', 'code_analysis', 'python', 'xr_file_analysis_coordinator.py');
        console.log(`XR_ANALYSIS: Using coordinator script: ${coordinatorPath}`);
        // Get virtual environment paths
        const pythonEnvStorage = new pythonEnvStorage_1.PythonEnvStorage(context);
        const venvPath = pythonEnvStorage.getVenvPath();
        const pythonExecutable = pythonEnvUtils_1.PythonEnvUtils.getVenvPythonPath(venvPath);
        console.log(`XR_ANALYSIS: Using Python virtual environment: ${venvPath}`);
        console.log(`XR_ANALYSIS: Using Python executable: ${pythonExecutable}`);
        // Check if virtual environment exists and use it, otherwise fallback to system Python
        let pythonCommand = 'python3';
        try {
            if (pythonEnvUtils_1.PythonEnvUtils.isValidVenv(venvPath)) {
                pythonCommand = pythonExecutable;
                console.log(`XR_ANALYSIS: Using virtual environment Python: ${pythonCommand}`);
            }
            else {
                console.log(`XR_ANALYSIS: Virtual environment not found, using system Python: ${pythonCommand}`);
            }
        }
        catch (error) {
            console.log(`XR_ANALYSIS: Error checking virtual environment, using system Python: ${error}`);
        }
        // Spawn the Python process
        const pythonProcess = (0, child_process_1.spawn)(pythonCommand, [coordinatorPath, filePath], {
            cwd: path.dirname(coordinatorPath)
        });
        let stdout = '';
        let stderr = '';
        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        pythonProcess.stderr.on('data', (data) => {
            const stderrText = data.toString();
            stderr += stderrText;
            // Log debug messages from the Python script
            const lines = stderrText.split('\n').filter((line) => line.trim());
            lines.forEach((line) => {
                try {
                    const debugMsg = JSON.parse(line);
                    if (debugMsg.debug) {
                        console.log(debugMsg.debug);
                    }
                }
                catch {
                    // Not a JSON debug message, log as is
                    console.log(`XR_ANALYSIS: ${line}`);
                }
            });
        });
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout.trim());
                    console.log(`XR_ANALYSIS: Analysis completed, found ${Array.isArray(result) ? result.length : 'N/A'} functions`);
                    resolve(result);
                }
                catch (error) {
                    console.error(`XR_ANALYSIS: Failed to parse JSON output: ${error}`);
                    console.error(`XR_ANALYSIS: Raw stdout: ${stdout}`);
                    reject(new Error('Failed to parse XR analysis output'));
                }
            }
            else {
                console.error(`XR_ANALYSIS: Python process exited with code ${code}`);
                console.error(`XR_ANALYSIS: stderr: ${stderr}`);
                reject(new Error(`XR analysis process failed with code ${code}`));
            }
        });
        pythonProcess.on('error', (error) => {
            console.error(`XR_ANALYSIS: Failed to start Python process: ${error}`);
            reject(error);
        });
    });
}
/**
 * Handle chart type selection for file analysis
 */
async function handleChartTypeFileSelection(context) {
    console.log('[CODE_ANALYSIS] Handling chart type selection for file analysis');
    try {
        // Get available charts from BabiaXR registry
        const chartRegistry = chartRegistry_1.BabiaChartRegistry.getInstance();
        const availableCharts = chartRegistry.getAllCharts();
        if (availableCharts.length === 0) {
            console.error('[CODE_ANALYSIS] No chart types found in registry');
            vscode.window.showErrorMessage('No chart templates available');
            return;
        }
        // Create quick pick items for available charts
        const quickPickItems = availableCharts.map(chart => ({
            label: chart.name,
            description: chart.description,
            detail: `Category: ${chart.category} | Dimensions: ${chart.dimensions.map(d => d.name).join(', ')}`,
            chartId: chart.id
        }));
        // Show quick pick
        const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: 'Select a chart type for file analysis visualization',
            title: 'Chart Type Selection for File Analysis'
        });
        if (selectedItem && selectedItem.chartId) {
            // Update settings with selected chart type
            await analysisSettingsStorage_1.AnalysisSettingsStorage.setChartTypeFile(context, selectedItem.chartId);
            console.log(`[CODE_ANALYSIS] Chart type selected for file analysis: ${selectedItem.label}`);
            vscode.window.showInformationMessage(`Chart type set to ${selectedItem.label} for file analysis`);
        }
        else {
            console.log('[CODE_ANALYSIS] Chart type selection cancelled');
        }
    }
    catch (error) {
        console.error('[CODE_ANALYSIS] Error in chart type selection:', error);
        vscode.window.showErrorMessage(`Failed to select chart type: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Handle dimension mapping selection for file analysis
 */
async function handleDimensionMappingFileSelection(context, dimensionName, dataType, required) {
    console.log(`[CODE_ANALYSIS] Handling dimension mapping for file analysis: ${dimensionName}`);
    try {
        // Define available data fields from file analysis
        const fieldOptions = [
            {
                label: 'parameters',
                description: 'Number of parameters in functions',
                dataType: 'numeric'
            },
            {
                label: 'lines_count',
                description: 'Lines of code count',
                dataType: 'numeric'
            },
            {
                label: 'ccn',
                description: 'Cyclomatic Complexity Number (McCabe complexity)',
                dataType: 'numeric'
            },
            {
                label: 'function_name',
                description: 'Name of the function',
                dataType: 'text'
            },
            {
                label: 'ccn_density',
                description: 'CCN density (complexity per line of code)',
                dataType: 'numeric'
            }
        ];
        // Filter options based on data type if numeric only
        let availableOptions = fieldOptions;
        if (dataType === 'numeric') {
            availableOptions = fieldOptions.filter(option => option.dataType === 'numeric');
        }
        // Create quick pick items
        const quickPickItems = availableOptions.map(option => ({
            label: option.label,
            description: option.description,
            detail: option.dataType === 'numeric' ? 'Numeric values only' : 'Any value type'
        }));
        // Show quick pick
        const selectedField = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `Select field to map to dimension "${dimensionName}"`,
            title: `Map Dimension: ${dimensionName} (${dataType}${required ? ', required' : ''})`
        });
        if (selectedField && selectedField.label) {
            // Update dimension mapping
            await analysisSettingsStorage_1.AnalysisSettingsStorage.updateDimensionMappingFile(context, dimensionName, selectedField.label);
            console.log(`[CODE_ANALYSIS] Dimension mapped: ${dimensionName} → ${selectedField.label}`);
            vscode.window.showInformationMessage(`Mapped ${dimensionName} to ${selectedField.label}`);
        }
        else {
            console.log(`[CODE_ANALYSIS] Dimension mapping cancelled for ${dimensionName}`);
        }
    }
    catch (error) {
        console.error(`[CODE_ANALYSIS] Error mapping dimension ${dimensionName}:`, error);
        vscode.window.showErrorMessage(`Failed to map dimension: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=analysisCommands.js.map