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
exports.createDirectoryXRVisualization = createDirectoryXRVisualization;
exports.createDirectoryXRVisualizationDeep = createDirectoryXRVisualizationDeep;
exports.cleanupDirectoryXRResources = cleanupDirectoryXRResources;
exports.cleanupDirectoryXRVisualization = cleanupDirectoryXRVisualization;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const nonceUtils_1 = require("../../utils/nonceUtils");
const analysisSessionManager_1 = require("../analysisSessionManager");
const incrementalAnalysisEngine_1 = require("../shared/incrementalAnalysisEngine");
const directoryAnalysisConfig_1 = require("../static/directory/common/directoryAnalysisConfig");
const directoryWatcher_1 = require("../utils/directoryWatcher");
const serverManager_1 = require("../../server/serverManager");
const serverModel_1 = require("../../server/models/serverModel");
const certificateManager_1 = require("../../server/certificateManager");
const liveReloadManager_1 = require("../../server/liveReloadManager");
const directoryAnalysisProgress_1 = require("../shared/directoryAnalysisProgress");
// Track visualization directories by directory path  
const visualizationDirs = new Map();
// Track active servers by directory path
const activeServers = new Map();
/**
 * Creates a directory XR analysis visualization and opens it in an external browser
 * @param context Extension context
 * @param directoryPath Path to directory that was analyzed
 * @param isProject Whether this is a project-level analysis
 * @returns Promise with visualization folder path or undefined
 */
async function createDirectoryXRVisualization(context, directoryPath, isProject = false) {
    try {
        console.log(`🔍 Creating directory XR visualization for: ${directoryPath}`);
        // Close existing panel and server if they exist
        await cleanupExistingDirectoryXR(directoryPath);
        // Scan directory and generate analysis data
        const analysisResult = await generateDirectoryXRAnalysisData(directoryPath, context);
        if (!analysisResult) {
            vscode.window.showErrorMessage('Failed to analyze directory for XR visualization');
            return undefined;
        }
        // Create visualization directory structure
        const visualizationDir = await createDirectoryXRVisualizationFolder(context, directoryPath, analysisResult);
        if (!visualizationDir) {
            return undefined;
        }
        // Copy XR template and assets
        await copyDirectoryXRAssets(context, visualizationDir, analysisResult);
        // Start server for XR visualization
        const serverInfo = await startDirectoryXRServer(visualizationDir, context);
        if (!serverInfo) {
            vscode.window.showErrorMessage('Failed to start server for directory XR visualization');
            return undefined;
        }
        // Track resources
        visualizationDirs.set(directoryPath, visualizationDir);
        activeServers.set(directoryPath, serverInfo);
        // Add to analysis session manager
        const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
        sessionManager.addSession(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY, serverInfo, { mode: 'shallow', visualizationType: 'xr' });
        // Open the XR visualization in external browser
        await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        const dirName = path.basename(directoryPath);
        vscode.window.showInformationMessage(`Directory XR Analysis opened in browser: ${dirName}`, { modal: false });
        // Start directory watcher for hash-based automatic updates
        // TODO: Fix missing watcher function
        // await startDirectoryXRWatcher(directoryPath, analysisResult, isProject);
        console.log(`✅ Directory XR visualization created: ${visualizationDir}`);
        console.log(`🌐 XR Server running at: ${serverInfo.url}`);
        return visualizationDir;
    }
    catch (error) {
        console.error('Error creating directory XR visualization:', error);
        vscode.window.showErrorMessage(`Directory XR visualization error: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Creates a directory XR analysis visualization with deep recursive scanning
 * @param context Extension context
 * @param directoryPath Path to directory that was analyzed
 * @param isProject Whether this is a project-level analysis
 * @returns Promise with visualization folder path or undefined
 */
async function createDirectoryXRVisualizationDeep(context, directoryPath, isProject = false) {
    try {
        console.log(`🔍 Creating directory XR visualization (DEEP) for: ${directoryPath}`);
        // Close existing panel and server if they exist
        await cleanupExistingDirectoryXR(directoryPath);
        // Scan directory and generate analysis data using DEEP filters
        const analysisResult = await generateDirectoryXRAnalysisDataDeep(directoryPath, context);
        if (!analysisResult) {
            vscode.window.showErrorMessage('Failed to analyze directory for XR deep visualization');
            return undefined;
        }
        // Create visualization directory structure
        const visualizationDir = await createDirectoryXRVisualizationFolder(context, directoryPath, analysisResult);
        if (!visualizationDir) {
            return undefined;
        }
        // Copy XR template and assets
        await copyDirectoryXRAssets(context, visualizationDir, analysisResult);
        // Start server for XR visualization
        const serverInfo = await startDirectoryXRServer(visualizationDir, context);
        if (!serverInfo) {
            vscode.window.showErrorMessage('Failed to start server for directory XR deep visualization');
            return undefined;
        }
        // Track resources
        visualizationDirs.set(directoryPath, visualizationDir);
        activeServers.set(directoryPath, serverInfo);
        // Add to analysis session manager
        const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
        sessionManager.addSession(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY, serverInfo, { mode: 'deep', visualizationType: 'xr' });
        // Open the XR visualization in external browser
        await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
        const dirName = path.basename(directoryPath);
        vscode.window.showInformationMessage(`Directory XR Analysis (Deep) opened in browser: ${dirName}`, { modal: false });
        // Start directory watcher for hash-based automatic updates with deep scanning
        // TODO: Fix missing watcher function
        // await startDirectoryXRWatcherDeep(directoryPath, analysisResult, isProject);
        console.log(`✅ Directory XR deep visualization created: ${visualizationDir}`);
        console.log(`🌐 XR Server running at: ${serverInfo.url}`);
        return visualizationDir;
    }
    catch (error) {
        console.error('Error creating directory XR deep visualization:', error);
        vscode.window.showErrorMessage(`Directory XR deep visualization error: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Generates directory analysis data for XR visualization using the static analysis system
 */
async function generateDirectoryXRAnalysisData(directoryPath, context) {
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Directory XR Analysis',
        cancellable: true
    }, async (progress, token) => {
        progress.report({
            increment: 0,
            message: 'Scanning directory for XR analysis...'
        });
        // Load previous analysis to determine if this is initial or incremental
        let previousResult;
        try {
            const { loadPreviousDirectoryAnalysis } = await import('../shared/directoryAnalysisDataManager.js');
            const { previousResult: prev } = await loadPreviousDirectoryAnalysis({
                context,
                directoryPath,
                mode: 'xr',
                isProject: false
            });
            previousResult = prev;
        }
        catch (error) {
            // No previous data, this is initial analysis
        }
        const isInitial = (0, directoryAnalysisProgress_1.isInitialAnalysis)(previousResult);
        // Log analysis start
        (0, directoryAnalysisProgress_1.logAnalysisStart)('xr', directoryPath, isInitial);
        // Set up standardized progress callback using shared utility
        const progressCallback = isInitial
            ? (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, 'xr', true)
            : (current, total, currentFile) => {
                if (token.isCancellationRequested) {
                    throw new Error('XR analysis cancelled by user');
                }
                // Simple callback for incremental analysis
                progress.report({
                    increment: (1 / total) * 100,
                    message: `Re-analyzing changes: ${path.basename(currentFile)}`
                });
            };
        try {
            const startTime = Date.now();
            console.log(`DIRECTORY-ANALYSIS: Starting XR analysis using shared incremental engine`);
            // Create incremental analysis engine
            const engine = new incrementalAnalysisEngine_1.IncrementalAnalysisEngine();
            // Set up standardized progress callback using shared utility
            const progressCallback = isInitial
                ? (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, 'xr', true)
                : (current, total, currentFile) => {
                    if (token.isCancellationRequested) {
                        throw new Error('XR analysis cancelled by user');
                    }
                    // Simple callback for incremental analysis
                    progress.report({
                        increment: (1 / total) * 100,
                        message: `Re-analyzing changes: ${path.basename(currentFile)}`
                    });
                };
            // Configure analysis
            const config = {
                directoryPath,
                filters: { ...directoryAnalysisConfig_1.DEFAULT_SHALLOW_FILTERS },
                previousResult,
                progressCallback,
                outputChannel: {
                    appendLine: (message) => console.log(`XR-ANALYSIS: ${message}`)
                }
            };
            // Perform incremental analysis
            const incrementalResult = await engine.performIncrementalAnalysis(config);
            // Transform to files array for XR visualization
            const filesData = (0, incrementalAnalysisEngine_1.transformToFilesArray)(incrementalResult);
            // Create mock result for compatibility with existing code
            const result = {
                summary: {
                    directoryPath,
                    totalFiles: incrementalResult.scanResult.totalFiles,
                    totalFilesAnalyzed: incrementalResult.scanResult.totalAnalyzableFiles,
                    totalFilesNotAnalyzed: incrementalResult.scanResult.totalNonAnalyzableFiles,
                    totalLines: filesData.reduce((sum, f) => sum + f.totalLines, 0),
                    totalCommentLines: filesData.reduce((sum, f) => sum + f.commentLines, 0),
                    totalFunctions: filesData.reduce((sum, f) => sum + f.functionCount, 0),
                    totalClasses: filesData.reduce((sum, f) => sum + f.classCount, 0),
                    averageComplexity: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanComplexity, 0) / filesData.length : 0,
                    averageDensity: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanDensity, 0) / filesData.length : 0,
                    averageParameters: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanParameters, 0) / filesData.length : 0,
                    languageDistribution: {},
                    fileSizeDistribution: { small: 0, medium: 0, large: 0, huge: 0 },
                    complexityDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
                    analyzedAt: new Date().toISOString(),
                    totalDuration: Date.now() - startTime
                },
                files: filesData,
                functions: incrementalResult.allFunctions,
                metadata: {
                    version: '0.0.9',
                    mode: 'directory',
                    filters: config.filters,
                    filesAnalyzedThisSession: incrementalResult.filesAnalyzedThisSession,
                    totalFilesConsidered: incrementalResult.totalFilesConsidered,
                    isIncremental: incrementalResult.isIncremental
                }
            };
            // Log correct analysis completion using metadata
            const filesAnalyzed = incrementalResult.filesAnalyzedThisSession;
            const totalFiles = incrementalResult.totalFilesConsidered;
            if (incrementalResult.isIncremental && filesAnalyzed > 0) {
                console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - updated ${filesAnalyzed} of ${totalFiles} files`);
            }
            else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
                console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - no changes detected (${totalFiles} files unchanged)`);
            }
            else {
                console.log(`DIRECTORY-ANALYSIS: XR initial analysis completed - analyzed ${filesAnalyzed} files`);
            }
            // Save the result using shared data manager
            try {
                const { saveDirectoryAnalysisResult } = await import('../shared/directoryAnalysisDataManager.js');
                const analysisDir = path.join(context.extensionPath, '.codexr', 'analysis');
                const dataPath = path.join(analysisDir, `directory_xr_${path.basename(directoryPath)}.json`);
                await saveDirectoryAnalysisResult(result, dataPath, 'xr');
                if (incrementalResult.isIncremental && filesAnalyzed > 0) {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files updated) to: ${dataPath}`);
                }
                else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (no changes) to: ${dataPath}`);
                }
                else {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files analyzed) to: ${dataPath}`);
                }
            }
            catch (error) {
                console.warn(`DIRECTORY-ANALYSIS: Could not save XR analysis data:`, error);
            }
            // Log analysis completion
            const duration = Date.now() - startTime;
            (0, directoryAnalysisProgress_1.logAnalysisComplete)('xr', directoryPath, filesAnalyzed, totalFiles, !incrementalResult.isIncremental, duration);
            progress.report({
                increment: 100,
                message: 'Creating XR visualization...'
            });
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                vscode.window.showInformationMessage('Directory XR analysis cancelled by user.');
                return undefined;
            }
            else {
                throw error;
            }
        }
    });
}
/**
 * Generates directory analysis data for XR visualization using the static analysis system
 */
async function generateDirectoryXRAnalysisDataDeep(directoryPath, context) {
    return await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Directory XR Analysis (Deep)',
        cancellable: true
    }, async (progress, token) => {
        progress.report({
            increment: 0,
            message: 'Scanning directory for XR deep analysis...'
        });
        // Load previous analysis to determine if this is initial or incremental
        let previousResult;
        try {
            const { loadPreviousDirectoryAnalysis } = await import('../shared/directoryAnalysisDataManager.js');
            const { previousResult: prev } = await loadPreviousDirectoryAnalysis({
                context,
                directoryPath,
                mode: 'xr',
                isProject: false
            });
            previousResult = prev;
        }
        catch (error) {
            // No previous data, this is initial analysis
        }
        const isInitial = (0, directoryAnalysisProgress_1.isInitialAnalysis)(previousResult);
        // Log analysis start
        (0, directoryAnalysisProgress_1.logAnalysisStart)('xr', directoryPath, isInitial);
        // Set up standardized progress callback using shared utility
        const progressCallback = isInitial
            ? (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, 'xr', true)
            : (current, total, currentFile) => {
                if (token.isCancellationRequested) {
                    throw new Error('XR deep analysis cancelled by user');
                }
                // Simple callback for incremental analysis
                progress.report({
                    increment: (1 / total) * 100,
                    message: `Re-analyzing changes: ${path.basename(currentFile)}`
                });
            };
        try {
            const startTime = Date.now();
            console.log(`DIRECTORY-ANALYSIS: Starting XR deep analysis using shared incremental engine`);
            // Create incremental analysis engine
            const engine = new incrementalAnalysisEngine_1.IncrementalAnalysisEngine();
            // Configure analysis with DEEP filters
            const config = {
                directoryPath,
                filters: { ...directoryAnalysisConfig_1.DEFAULT_DEEP_FILTERS },
                previousResult,
                progressCallback,
                outputChannel: {
                    appendLine: (message) => console.log(`XR-ANALYSIS: ${message}`)
                }
            };
            // Perform incremental analysis
            const incrementalResult = await engine.performIncrementalAnalysis(config);
            // Transform to files array for XR visualization
            const filesData = (0, incrementalAnalysisEngine_1.transformToFilesArray)(incrementalResult);
            // Create mock result for compatibility with existing code
            const result = {
                summary: {
                    directoryPath,
                    totalFiles: incrementalResult.scanResult.totalFiles,
                    totalFilesAnalyzed: incrementalResult.scanResult.totalAnalyzableFiles,
                    totalFilesNotAnalyzed: incrementalResult.scanResult.totalNonAnalyzableFiles,
                    totalLines: filesData.reduce((sum, f) => sum + f.totalLines, 0),
                    totalCommentLines: filesData.reduce((sum, f) => sum + f.commentLines, 0),
                    totalFunctions: filesData.reduce((sum, f) => sum + f.functionCount, 0),
                    totalClasses: filesData.reduce((sum, f) => sum + f.classCount, 0),
                    averageComplexity: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanComplexity, 0) / filesData.length : 0,
                    averageDensity: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanDensity, 0) / filesData.length : 0,
                    averageParameters: filesData.length > 0 ? filesData.reduce((sum, f) => sum + f.meanParameters, 0) / filesData.length : 0,
                    languageDistribution: {},
                    fileSizeDistribution: { small: 0, medium: 0, large: 0, huge: 0 },
                    complexityDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
                    analyzedAt: new Date().toISOString(),
                    totalDuration: Date.now() - startTime
                },
                files: filesData,
                functions: incrementalResult.allFunctions,
                metadata: {
                    version: '0.0.9',
                    mode: 'directory',
                    filters: config.filters,
                    filesAnalyzedThisSession: incrementalResult.filesAnalyzedThisSession,
                    totalFilesConsidered: incrementalResult.totalFilesConsidered,
                    isIncremental: incrementalResult.isIncremental
                }
            };
            // Log correct analysis completion using metadata
            const filesAnalyzed = incrementalResult.filesAnalyzedThisSession;
            const totalFiles = incrementalResult.totalFilesConsidered;
            if (incrementalResult.isIncremental && filesAnalyzed > 0) {
                console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - updated ${filesAnalyzed} of ${totalFiles} files`);
            }
            else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
                console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - no changes detected (${totalFiles} files unchanged)`);
            }
            else {
                console.log(`DIRECTORY-ANALYSIS: XR initial analysis completed - analyzed ${filesAnalyzed} files`);
            }
            // Save the result using shared data manager
            try {
                const { saveDirectoryAnalysisResult } = await import('../shared/directoryAnalysisDataManager.js');
                const analysisDir = path.join(context.extensionPath, '.codexr', 'analysis');
                const dataPath = path.join(analysisDir, `directory_xr_${path.basename(directoryPath)}.json`);
                await saveDirectoryAnalysisResult(result, dataPath, 'xr');
                if (incrementalResult.isIncremental && filesAnalyzed > 0) {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files updated) to: ${dataPath}`);
                }
                else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (no changes) to: ${dataPath}`);
                }
                else {
                    console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files analyzed) to: ${dataPath}`);
                }
            }
            catch (error) {
                console.warn(`DIRECTORY-ANALYSIS: Could not save XR analysis data:`, error);
            }
            // Log analysis completion
            const duration = Date.now() - startTime;
            (0, directoryAnalysisProgress_1.logAnalysisComplete)('xr', directoryPath, filesAnalyzed, totalFiles, !incrementalResult.isIncremental, duration);
            progress.report({
                increment: 100,
                message: 'Creating XR visualization...'
            });
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('cancelled')) {
                vscode.window.showInformationMessage('Directory XR deep analysis cancelled by user.');
                return undefined;
            }
            else {
                throw error;
            }
        }
    });
}
/**
 * Creates visualization directory structure and saves analysis data
 */
async function createDirectoryXRVisualizationFolder(context, directoryPath, analysisResult) {
    try {
        const dirName = path.basename(directoryPath);
        const nonce = (0, nonceUtils_1.generateNonce)();
        // Create visualization directory
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        await fs.mkdir(visualizationsDir, { recursive: true });
        const visualizationDir = path.join(visualizationsDir, `${dirName}_xr_${nonce}`);
        await fs.mkdir(visualizationDir, { recursive: true });
        console.log(`📁 Created XR visualization directory: ${visualizationDir}`);
        // Save analysis data as JSON for BabiaXR (extract the files array)
        const dataFilePath = path.join(visualizationDir, 'data.json');
        // BabiaXR expects an array of objects, so we use the files array directly
        const xrData = analysisResult.files;
        await fs.writeFile(dataFilePath, JSON.stringify(xrData, null, 2));
        console.log(`💾 Saved XR analysis data (${xrData.length} files): ${dataFilePath}`);
        return visualizationDir;
    }
    catch (error) {
        console.error('Error creating directory XR visualization folder:', error);
        return undefined;
    }
}
/**
 * Copies XR template and assets to visualization directory
 */
async function copyDirectoryXRAssets(context, visualizationDir, analysisResult) {
    try {
        // Copy the directory XR HTML template and adapt it for directory analysis
        const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'directory-xr-template.html');
        const htmlPath = path.join(visualizationDir, 'index.html');
        let htmlContent = await fs.readFile(templatePath, 'utf8');
        // Replace template variables for directory analysis
        const dirName = path.basename(analysisResult.summary.directoryPath);
        htmlContent = htmlContent
            .replace(/\${TITLE}/g, `Directory XR Analysis - ${dirName}`)
            .replace(/\${DATA_SOURCE}/g, './data.json')
            .replace(/\${BACKGROUND_COLOR}/g, '#1a1a2e')
            .replace(/\${ENVIRONMENT_PRESET}/g, 'forest')
            .replace(/\${GROUND_COLOR}/g, '#2d5a27')
            .replace(/\${ICON_PATH}/g, '../../../resources/icon.svg')
            .replace(/\${CHART_COMPONENT}/g, `
        <!-- Directory XR Boats Visualization -->
        <a-entity id="chart"
                  babia-boats="from: data;
                              legend: true;
                              tooltip: true;
                              palette: pearl;
                              area: functionCount;
                              height: totalLines;
                              color: meanComplexity;
                              tooltip_position: top;
                              tooltip_show_always: false;
                              tooltip_height: 0.3;
                              heightMax: 20"
                  position="0 1 -10"
                  rotation="0 0 0"
                  scale="1.5 1.5 1.5"
                  class="babiaxraycasterclass">
        </a-entity>
      `);
        // Inject SSE live reload script for automatic updates
        htmlContent = (0, liveReloadManager_1.injectLiveReloadScript)(htmlContent);
        console.log(`🔄 Injected SSE live reload script for directory XR`);
        await fs.writeFile(htmlPath, htmlContent);
        console.log(`📄 Created directory XR HTML template: ${htmlPath}`);
    }
    catch (error) {
        console.error('Error copying directory XR assets:', error);
        throw error;
    }
}
/**
 * Starts server for directory XR visualization with proper mode selection
 */
async function startDirectoryXRServer(visualizationDir, context) {
    try {
        // Determine server mode based on configuration (same as File XR)
        const userServerMode = context.globalState.get('serverMode') || serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
        let analysisServerMode;
        let protocolForPort;
        switch (userServerMode) {
            case serverModel_1.ServerMode.HTTP:
                analysisServerMode = serverModel_1.ServerMode.HTTP;
                protocolForPort = 'http';
                break;
            case serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS:
                if ((0, certificateManager_1.defaultCertificatesExist)(context)) {
                    analysisServerMode = serverModel_1.ServerMode.HTTPS_DEFAULT_CERTS;
                    protocolForPort = 'https';
                }
                else {
                    analysisServerMode = serverModel_1.ServerMode.HTTP;
                    protocolForPort = 'http';
                    vscode.window.showWarningMessage('Default HTTPS certificates not found. Directory XR server will use HTTP instead.');
                }
                break;
            case serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS:
                const customKeyPath = context.globalState.get('customKeyPath');
                const customCertPath = context.globalState.get('customCertPath');
                if (customKeyPath && customCertPath) {
                    analysisServerMode = serverModel_1.ServerMode.HTTPS_CUSTOM_CERTS;
                    protocolForPort = 'https';
                }
                else {
                    analysisServerMode = serverModel_1.ServerMode.HTTP;
                    protocolForPort = 'http';
                    vscode.window.showWarningMessage('Custom HTTPS certificates not configured. Directory XR server will use HTTP instead.');
                }
                break;
            default:
                analysisServerMode = serverModel_1.ServerMode.HTTP;
                protocolForPort = 'http';
        }
        const serverInfo = await (0, serverManager_1.createServer)(visualizationDir, analysisServerMode, context, undefined // No preferred port
        );
        if (serverInfo) {
            // Set analysis file name for XR directory analysis to enable proper icon/formatting in Active Servers
            // Extract directory name from the visualization directory path
            const visualizationDirName = path.basename(visualizationDir);
            const dirName = visualizationDirName.split('_')[0]; // Remove timestamp suffix
            (0, serverManager_1.updateServerDisplayInfo)(serverInfo.id, {
                analysisFileName: `DIR:${dirName}` // Prefix to distinguish directory from file analysis
            });
            const protocolMessage = protocolForPort === 'https'
                ? '🔒 Secure HTTPS server (VR compatible)'
                : '🌐 HTTP server (not VR compatible)';
            console.log(`🌐 Directory XR server started: ${serverInfo.url}`);
            console.log(`📋 ${protocolMessage}`);
            return serverInfo;
        }
        return undefined;
    }
    catch (error) {
        console.error('Error starting directory XR server:', error);
        return undefined;
    }
}
/**
 * Opens the directory XR visualization in external browser with SSE support
 */
async function openDirectoryXRVisualizationPanel(context, serverUrl, analysisResult, directoryPath, isProject) {
    // Track the visualization (no webview panel needed)
    console.log(`🌐 Opening Directory XR visualization in browser: ${serverUrl}`);
    // Add to active analyses session manager (using server info instead of panel)
    const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
    const serverInfo = activeServers.get(directoryPath);
    if (serverInfo) {
        sessionManager.addSession(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY, serverInfo, { mode: 'shallow', visualizationType: 'xr' }); // XR is always shallow
    }
    // Open in external browser (like File XR)
    await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
    const dirName = path.basename(directoryPath);
    vscode.window.showInformationMessage(`🎯 Directory XR Analysis opened in browser for: ${dirName}\n🌐 URL: ${serverUrl}`);
    console.log(`� Directory XR opened in browser for: ${dirName}`);
}
/**
 * Cleanup existing directory XR resources
 */
async function cleanupExistingDirectoryXR(directoryPath) {
    // Stop directory watcher
    const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
    if (sharedWatcherManager.isWatching(directoryPath)) {
        console.log(`🛑 Stopping existing directory XR watcher for: ${directoryPath}`);
        sharedWatcherManager.stopWatching(directoryPath);
    }
    // Stop existing server
    const existingServer = activeServers.get(directoryPath);
    if (existingServer) {
        (0, serverManager_1.stopServer)(existingServer.id);
    }
    // Clear tracking
    activeServers.delete(directoryPath);
    visualizationDirs.delete(directoryPath);
}
/**
 * Cleanup directory XR resources
 */
function cleanupDirectoryXRResources(directoryPath) {
    // Stop directory watcher
    const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
    if (sharedWatcherManager.isWatching(directoryPath)) {
        console.log(`🛑 Stopping directory XR watcher for: ${directoryPath}`);
        sharedWatcherManager.stopWatching(directoryPath);
    }
    // Stop server
    const serverInfo = activeServers.get(directoryPath);
    if (serverInfo) {
        (0, serverManager_1.stopServer)(serverInfo.id);
    }
    // Clear tracking
    activeServers.delete(directoryPath);
    visualizationDirs.delete(directoryPath);
}
/**
 * Cleanup directory XR visualization for a specific directory (called when analysis session is closed)
 */
async function cleanupDirectoryXRVisualization(directoryPath) {
    console.log(`🧹 Cleaning up directory XR visualization for: ${directoryPath}`);
    try {
        // Stop watcher
        const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
        if (sharedWatcherManager.isWatching(directoryPath)) {
            console.log(`🛑 Stopping directory XR watcher for: ${directoryPath}`);
            sharedWatcherManager.stopWatching(directoryPath);
        }
        // Stop and remove server
        const existingServer = activeServers.get(directoryPath);
        if (existingServer) {
            console.log(`🛑 Stopping directory XR server: ${existingServer.id}`);
            (0, serverManager_1.stopServer)(existingServer.id);
            activeServers.delete(directoryPath);
        }
        // Clean up visualization directory reference
        visualizationDirs.delete(directoryPath);
        console.log(`✅ Directory XR visualization cleanup complete for: ${directoryPath}`);
    }
    catch (error) {
        console.warn(`⚠️ Error during directory XR visualization cleanup for ${directoryPath}:`, error);
    }
}
//# sourceMappingURL=directoryXRAnalysisManager.js.map