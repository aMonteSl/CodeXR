"use strict";
/**
 * Shared XR analysis utilities for both shallow and deep directory analysis
 * Provides common functionality for XR visualization, server management, and watcher setup
 */
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
exports.XRAnalysisManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const analysisSessionManager_1 = require("../analysisSessionManager");
const incrementalAnalysisEngine_1 = require("./incrementalAnalysisEngine");
const directoryWatcher_1 = require("../utils/directoryWatcher");
const serverManager_1 = require("../../server/serverManager");
const serverModel_1 = require("../../server/models/serverModel");
const liveReloadManager_1 = require("../../server/liveReloadManager");
const directoryAnalysisProgress_1 = require("./directoryAnalysisProgress");
/**
 * Shared XR analysis utilities
 */
class XRAnalysisManager {
    // Track visualization directories by directory path  
    static visualizationDirs = new Map();
    // Track active servers by directory path
    static activeServers = new Map();
    /**
     * Creates an XR analysis visualization
     * @param config XR analysis configuration
     * @returns Promise with XR analysis result or undefined
     */
    static async createXRVisualization(config) {
        const { directoryPath, filters, isProject, context, previousResult, modeLabel } = config;
        try {
            console.log(`🔍 Creating ${modeLabel} XR visualization for: ${directoryPath}`);
            // Close existing panel and server if they exist
            await this.cleanupExistingXR(directoryPath);
            // Generate analysis data
            const analysisResult = await this.generateXRAnalysisData({
                directoryPath,
                filters,
                context,
                previousResult,
                modeLabel
            });
            if (!analysisResult) {
                vscode.window.showErrorMessage(`Failed to analyze directory for ${modeLabel} XR visualization`);
                return undefined;
            }
            // Create visualization directory structure
            const visualizationDir = await this.createXRVisualizationFolder(context, directoryPath, analysisResult, modeLabel);
            if (!visualizationDir) {
                return undefined;
            }
            // Copy XR template and assets
            await this.copyXRAssets(context, visualizationDir, analysisResult);
            // Start server for XR visualization
            const serverInfo = await this.startXRServer(visualizationDir, context, modeLabel);
            if (!serverInfo) {
                vscode.window.showErrorMessage(`Failed to start server for ${modeLabel} XR visualization`);
                return undefined;
            }
            // Track resources
            this.visualizationDirs.set(directoryPath, visualizationDir);
            this.activeServers.set(directoryPath, serverInfo);
            // Add to analysis session manager
            const sessionManager = analysisSessionManager_1.AnalysisSessionManager.getInstance();
            const analysisMode = filters.maxDepth === 1 ? 'shallow' : 'deep';
            sessionManager.addSession(directoryPath, analysisSessionManager_1.AnalysisType.DIRECTORY, serverInfo, { mode: analysisMode, visualizationType: 'xr' });
            // Open the XR visualization in external browser
            await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
            const dirName = path.basename(directoryPath);
            vscode.window.showInformationMessage(`${modeLabel} XR Analysis opened in browser: ${dirName}`, { modal: false });
            // Start directory watcher for hash-based automatic updates
            await this.startXRWatcher(directoryPath, analysisResult, isProject, filters);
            console.log(`✅ ${modeLabel} XR visualization created: ${visualizationDir}`);
            console.log(`🌐 XR Server running at: ${serverInfo.url}`);
            return {
                analysisResult,
                visualizationDir,
                serverInfo
            };
        }
        catch (error) {
            console.error(`Error creating ${modeLabel} XR visualization:`, error);
            vscode.window.showErrorMessage(`${modeLabel} XR visualization error: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    /**
     * Generates XR analysis data using the incremental analysis engine
     */
    static async generateXRAnalysisData(config) {
        const { directoryPath, filters, context, previousResult, modeLabel } = config;
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${modeLabel} XR Analysis`,
            cancellable: true
        }, async (progress, token) => {
            // Check if this is initial analysis
            const isInitial = (0, directoryAnalysisProgress_1.isInitialAnalysis)(previousResult);
            // Log analysis start
            (0, directoryAnalysisProgress_1.logAnalysisStart)('xr', directoryPath, isInitial);
            // Set up progress callback
            const progressCallback = isInitial
                ? (0, directoryAnalysisProgress_1.createNotificationProgressCallback)(progress, 'xr', true)
                : (current, total, currentFile) => {
                    if (token.isCancellationRequested) {
                        throw new Error(`${modeLabel} XR analysis cancelled by user`);
                    }
                    progress.report({
                        increment: (1 / total) * 100,
                        message: `Re-analyzing changes: ${path.basename(currentFile)}`
                    });
                };
            try {
                const startTime = Date.now();
                console.log(`DIRECTORY-ANALYSIS: Starting ${modeLabel} XR analysis using shared incremental engine`);
                // Create incremental analysis engine
                const engine = new incrementalAnalysisEngine_1.IncrementalAnalysisEngine();
                // Configure analysis
                const engineConfig = {
                    directoryPath,
                    filters,
                    previousResult,
                    progressCallback,
                    outputChannel: {
                        appendLine: (message) => console.log(`${modeLabel.toUpperCase()}-XR-ANALYSIS: ${message}`)
                    }
                };
                // Perform incremental analysis
                const incrementalResult = await engine.performIncrementalAnalysis(engineConfig);
                // Transform to files array for XR visualization
                const filesData = (0, incrementalAnalysisEngine_1.transformToFilesArray)(incrementalResult);
                // Create result compatible with existing code
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
                        averageComplexity: filesData.length > 0
                            ? filesData.reduce((sum, f) => sum + f.meanComplexity, 0) / filesData.length
                            : 0,
                        averageDensity: filesData.length > 0
                            ? filesData.reduce((sum, f) => sum + f.meanDensity, 0) / filesData.length
                            : 0,
                        averageParameters: filesData.length > 0
                            ? filesData.reduce((sum, f) => sum + f.meanParameters, 0) / filesData.length
                            : 0,
                        languageDistribution: this.calculateLanguageDistribution(filesData),
                        fileSizeDistribution: this.calculateFileSizeDistribution(filesData),
                        complexityDistribution: this.calculateComplexityDistribution(filesData),
                        analyzedAt: new Date().toISOString(),
                        totalDuration: Date.now() - startTime
                    },
                    files: filesData,
                    functions: incrementalResult.allFunctions,
                    metadata: {
                        version: '1.0.0',
                        mode: 'directory',
                        filters: {
                            maxDepth: filters.maxDepth,
                            excludePatterns: filters.excludePatterns
                        },
                        filesAnalyzedThisSession: incrementalResult.filesAnalyzedThisSession,
                        totalFilesConsidered: incrementalResult.totalFilesConsidered,
                        isIncremental: incrementalResult.isIncremental
                    }
                };
                // Log completion
                (0, directoryAnalysisProgress_1.logAnalysisComplete)('xr', directoryPath, result.summary.totalFilesAnalyzed, result.summary.totalFiles, isInitial, result.summary.totalDuration);
                return result;
            }
            catch (error) {
                console.error(`Error during ${modeLabel} XR analysis:`, error);
                if (token.isCancellationRequested) {
                    throw new vscode.CancellationError();
                }
                throw error;
            }
        });
    }
    /**
     * Starts XR watcher for automatic updates
     */
    static async startXRWatcher(directoryPath, initialResult, isProject, filters) {
        const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
        const watcherOptions = {
            mode: 'xr',
            includeSubdirectories: filters.maxDepth > 1,
            isProject,
            onAnalysisComplete: async (newResult) => {
                console.log(`🔄 XR watcher analysis complete, updating visualization...`);
                const serverInfo = this.activeServers.get(directoryPath);
                if (serverInfo) {
                    console.log(`📡 Notifying XR clients of data refresh via SSE`);
                    (0, liveReloadManager_1.notifyClientsDataRefresh)();
                }
            },
            onAnalysisError: (error) => {
                console.error(`❌ XR watcher analysis error:`, error);
                vscode.window.showErrorMessage(`XR re-analysis failed: ${error.message}`);
            }
        };
        console.log(`👁️ Starting XR watcher for ${directoryPath} (mode: ${watcherOptions.mode})`);
        sharedWatcherManager.startWatching(directoryPath, watcherOptions, initialResult);
    }
    /**
     * Helper methods for calculating distributions
     */
    static calculateLanguageDistribution(files) {
        const distribution = {};
        for (const file of files) {
            distribution[file.language] = (distribution[file.language] || 0) + 1;
        }
        return distribution;
    }
    static calculateFileSizeDistribution(files) {
        return {
            small: files.filter(f => f.fileSizeBytes < 1024).length,
            medium: files.filter(f => f.fileSizeBytes >= 1024 && f.fileSizeBytes < 10240).length,
            large: files.filter(f => f.fileSizeBytes >= 10240 && f.fileSizeBytes < 102400).length,
            huge: files.filter(f => f.fileSizeBytes >= 102400).length
        };
    }
    static calculateComplexityDistribution(files) {
        return {
            low: files.filter(f => f.meanComplexity <= 5).length,
            medium: files.filter(f => f.meanComplexity > 5 && f.meanComplexity <= 10).length,
            high: files.filter(f => f.meanComplexity > 10 && f.meanComplexity <= 20).length,
            critical: files.filter(f => f.meanComplexity > 20).length
        };
    }
    /**
     * Cleanup and utility methods - implement core XR functionality
     */
    static async cleanupExistingXR(directoryPath) {
        try {
            // Stop any existing watcher
            const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
            sharedWatcherManager.stopWatching(directoryPath);
            // Stop any existing server
            const existingServer = this.activeServers.get(directoryPath);
            if (existingServer) {
                console.log(`🛑 Stopping existing XR server for: ${directoryPath}`);
                (0, serverManager_1.stopServer)(existingServer.id);
                this.activeServers.delete(directoryPath);
            }
            // Clean up visualization directory reference
            this.visualizationDirs.delete(directoryPath);
        }
        catch (error) {
            console.warn('Error during XR cleanup:', error);
        }
    }
    /**
     * Clean up XR visualization resources for a specific directory
     * Called when analysis session is closed
     */
    static async cleanupXRVisualization(directoryPath) {
        console.log(`🧹 Cleaning up XR visualization resources for: ${directoryPath}`);
        try {
            // Stop watcher
            const sharedWatcherManager = directoryWatcher_1.SharedDirectoryWatcherManager.getInstance();
            sharedWatcherManager.stopWatching(directoryPath);
            // Stop and remove server
            const existingServer = this.activeServers.get(directoryPath);
            if (existingServer) {
                console.log(`🛑 Stopping XR server: ${existingServer.id}`);
                (0, serverManager_1.stopServer)(existingServer.id);
                this.activeServers.delete(directoryPath);
            }
            // Clean up visualization directory reference
            this.visualizationDirs.delete(directoryPath);
            console.log(`✅ XR visualization cleanup complete for: ${directoryPath}`);
        }
        catch (error) {
            console.warn(`⚠️ Error during XR visualization cleanup for ${directoryPath}:`, error);
        }
    }
    static async createXRVisualizationFolder(context, directoryPath, analysisResult, modeLabel) {
        try {
            // Create unique visualization directory
            const dirName = path.basename(directoryPath);
            const timestamp = Date.now();
            const visualizationDir = path.join(context.globalStorageUri.fsPath, 'visualizations', 'xr', `${dirName}_${timestamp}`);
            // Ensure directory exists
            await fs.mkdir(visualizationDir, { recursive: true });
            console.log(`📁 Created XR visualization directory: ${visualizationDir}`);
            return visualizationDir;
        }
        catch (error) {
            console.error(`Error creating XR visualization folder:`, error);
            vscode.window.showErrorMessage(`Failed to create XR visualization folder: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
    static async copyXRAssets(context, visualizationDir, analysisResult) {
        try {
            // Write analysis data
            const dataFilePath = path.join(visualizationDir, 'data.json');
            await fs.writeFile(dataFilePath, JSON.stringify(analysisResult.files, null, 2));
            // Copy XR template files
            const templatePath = path.join(context.extensionPath, 'templates', 'xr');
            const templateFiles = ['index.html', 'xr-scene.js', 'style.css'];
            for (const fileName of templateFiles) {
                try {
                    const sourcePath = path.join(templatePath, fileName);
                    const targetPath = path.join(visualizationDir, fileName);
                    // Read template content
                    let content = await fs.readFile(sourcePath, 'utf8');
                    // Inject live reload if needed
                    if (fileName === 'index.html') {
                        content = (0, liveReloadManager_1.injectLiveReloadScript)(content);
                    }
                    await fs.writeFile(targetPath, content);
                }
                catch (err) {
                    console.warn(`Warning: Could not copy ${fileName}:`, err);
                }
            }
            console.log(`📋 Copied XR assets to: ${visualizationDir}`);
        }
        catch (error) {
            console.error('Error copying XR assets:', error);
            throw error;
        }
    }
    static async startXRServer(visualizationDir, context, modeLabel) {
        try {
            // Use HTTP mode for simplicity in the shared manager
            const serverInfo = await (0, serverManager_1.createServer)(visualizationDir, serverModel_1.ServerMode.HTTP, context);
            if (serverInfo) {
                // Set analysis file name for XR directory analysis to enable proper icon/formatting in Active Servers
                // Extract directory name from the visualization directory path
                const visualizationDirName = path.basename(visualizationDir);
                const dirName = visualizationDirName.split('_')[0]; // Remove timestamp suffix
                (0, serverManager_1.updateServerDisplayInfo)(serverInfo.id, {
                    analysisFileName: `DIR:${dirName}` // Prefix to distinguish directory from file analysis
                });
                console.log(`🌐 Started XR server at: ${serverInfo.url}`);
                return serverInfo;
            }
            else {
                throw new Error('Server creation returned undefined');
            }
        }
        catch (error) {
            console.error('Error starting XR server:', error);
            vscode.window.showErrorMessage(`Failed to start XR server: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }
}
exports.XRAnalysisManager = XRAnalysisManager;
//# sourceMappingURL=xrAnalysisManager.js.map