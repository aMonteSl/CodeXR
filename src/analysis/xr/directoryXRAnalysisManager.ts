import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DirectoryAnalysisResult } from '../static/directory/directoryAnalysisModel';
import { generateNonce } from '../../utils/nonceUtils';
import { AnalysisSessionManager, AnalysisType } from '../analysisSessionManager';
import { IncrementalAnalysisEngine, IncrementalAnalysisConfig, transformToFilesArray } from '../shared/incrementalAnalysisEngine';
import { DEFAULT_SHALLOW_FILTERS, DEFAULT_DEEP_FILTERS } from '../static/directory/common/directoryAnalysisConfig';
import { SharedDirectoryWatcherManager, DirectoryWatcherOptions } from '../utils/directoryWatcher';
import { createServer, getActiveServers, stopServer, updateServerDisplayInfo } from '../../server/serverManager';
import { ServerInfo, ServerMode } from '../../server/models/serverModel';
import { portManager } from '../../server/portManager';
import { defaultCertificatesExist } from '../../server/certificateManager';
import { injectLiveReloadScript, notifyClientsDataRefresh } from '../../server/liveReloadManager';
import { 
  createNotificationProgressCallback, 
  logAnalysisStart, 
  logAnalysisComplete, 
  isInitialAnalysis 
} from '../shared/directoryAnalysisProgress';
import { getChartTemplate, CHART_TEMPLATES, generateChartComponent as generateEnhancedChartComponent } from './chartTemplates';
import { getDimensionMapping } from './dimensionMapping';

// Track visualization directories by directory path  
const visualizationDirs: Map<string, string> = new Map();

// Track active servers by directory path
const activeServers: Map<string, ServerInfo> = new Map();

/**
 * Creates a directory XR analysis visualization and opens it in an external browser
 * @param context Extension context
 * @param directoryPath Path to directory that was analyzed
 * @param isProject Whether this is a project-level analysis
 * @returns Promise with visualization folder path or undefined
 */
export async function createDirectoryXRVisualization(
  context: vscode.ExtensionContext,
  directoryPath: string,
  isProject: boolean = false
): Promise<string | undefined> {
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
    const visualizationDir = await createDirectoryXRVisualizationFolder(
      context, 
      directoryPath, 
      analysisResult
    );
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
    const sessionManager = AnalysisSessionManager.getInstance();
    sessionManager.addSession(directoryPath, AnalysisType.DIRECTORY, serverInfo, { mode: 'shallow', visualizationType: 'xr' });
    
    // Open the XR visualization in external browser
    await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
    
    const dirName = path.basename(directoryPath);
    vscode.window.showInformationMessage(
      `Directory XR Analysis opened in browser: ${dirName}`,
      { modal: false }
    );
    
    // Start directory watcher for hash-based automatic updates
    // TODO: Fix missing watcher function
    // await startDirectoryXRWatcher(directoryPath, analysisResult, isProject);
    
    console.log(`✅ Directory XR visualization created: ${visualizationDir}`);
    console.log(`🌐 XR Server running at: ${serverInfo.url}`);
    
    return visualizationDir;
    
  } catch (error) {
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
export async function createDirectoryXRVisualizationDeep(
  context: vscode.ExtensionContext,
  directoryPath: string,
  isProject: boolean = false
): Promise<string | undefined> {
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
    const visualizationDir = await createDirectoryXRVisualizationFolder(
      context, 
      directoryPath, 
      analysisResult
    );
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
    const sessionManager = AnalysisSessionManager.getInstance();
    sessionManager.addSession(directoryPath, AnalysisType.DIRECTORY, serverInfo, { mode: 'deep', visualizationType: 'xr' });
    
    // Open the XR visualization in external browser
    await vscode.env.openExternal(vscode.Uri.parse(serverInfo.url));
    
    const dirName = path.basename(directoryPath);
    vscode.window.showInformationMessage(
      `Directory XR Analysis (Deep) opened in browser: ${dirName}`,
      { modal: false }
    );
    
    // Start directory watcher for hash-based automatic updates with deep scanning
    // TODO: Fix missing watcher function
    // await startDirectoryXRWatcherDeep(directoryPath, analysisResult, isProject);
    
    console.log(`✅ Directory XR deep visualization created: ${visualizationDir}`);
    console.log(`🌐 XR Server running at: ${serverInfo.url}`);
    
    return visualizationDir;
    
  } catch (error) {
    console.error('Error creating directory XR deep visualization:', error);
    vscode.window.showErrorMessage(`Directory XR deep visualization error: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Generates directory analysis data for XR visualization using the static analysis system
 */
async function generateDirectoryXRAnalysisData(
  directoryPath: string,
  context: vscode.ExtensionContext
): Promise<DirectoryAnalysisResult | undefined> {
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
    let previousResult: DirectoryAnalysisResult | undefined;
    try {
      const { loadPreviousDirectoryAnalysis } = await import('../shared/directoryAnalysisDataManager.js');
      const { previousResult: prev } = await loadPreviousDirectoryAnalysis({
        context,
        directoryPath,
        mode: 'xr',
        isProject: false
      });
      previousResult = prev;
    } catch (error) {
      // No previous data, this is initial analysis
    }
    
    const isInitial = isInitialAnalysis(previousResult);
    
    // Log analysis start
    logAnalysisStart('xr', directoryPath, isInitial);
    
    // Set up standardized progress callback using shared utility
    const progressCallback = isInitial 
      ? createNotificationProgressCallback(progress, 'xr', true)
      : (current: number, total: number, currentFile: string) => {
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
      const engine = new IncrementalAnalysisEngine();
      
      // Set up standardized progress callback using shared utility
      const progressCallback = isInitial 
        ? createNotificationProgressCallback(progress, 'xr', true)
        : (current: number, total: number, currentFile: string) => {
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
      const config: IncrementalAnalysisConfig = {
        directoryPath,
        filters: { ...DEFAULT_SHALLOW_FILTERS },
        previousResult,
        progressCallback,
        outputChannel: {
          appendLine: (message: string) => console.log(`XR-ANALYSIS: ${message}`)
        }
      };
      
      // Perform incremental analysis
      const incrementalResult = await engine.performIncrementalAnalysis(config);
      
      // Transform to files array for XR visualization
      const filesData = transformToFilesArray(incrementalResult);
      
      // Create mock result for compatibility with existing code
      const result: DirectoryAnalysisResult = {
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
      } else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
        console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - no changes detected (${totalFiles} files unchanged)`);
      } else {
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
        } else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
          console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (no changes) to: ${dataPath}`);
        } else {
          console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files analyzed) to: ${dataPath}`);
        }
      } catch (error) {
        console.warn(`DIRECTORY-ANALYSIS: Could not save XR analysis data:`, error);
      }
      
      // Log analysis completion
      const duration = Date.now() - startTime;
      logAnalysisComplete('xr', directoryPath, filesAnalyzed, totalFiles, !incrementalResult.isIncremental, duration);
      
      progress.report({ 
        increment: 100, 
        message: 'Creating XR visualization...' 
      });
      
      return result;
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        vscode.window.showInformationMessage('Directory XR analysis cancelled by user.');
        return undefined;
      } else {
        throw error;
      }
    }
  });
}

/**
 * Generates directory analysis data for XR visualization using the static analysis system
 */
async function generateDirectoryXRAnalysisDataDeep(
  directoryPath: string,
  context: vscode.ExtensionContext
): Promise<DirectoryAnalysisResult | undefined> {
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
    let previousResult: DirectoryAnalysisResult | undefined;
    try {
      const { loadPreviousDirectoryAnalysis } = await import('../shared/directoryAnalysisDataManager.js');
      const { previousResult: prev } = await loadPreviousDirectoryAnalysis({
        context,
        directoryPath,
        mode: 'xr',
        isProject: false
      });
      previousResult = prev;
    } catch (error) {
      // No previous data, this is initial analysis
    }
    
    const isInitial = isInitialAnalysis(previousResult);
    
    // Log analysis start
    logAnalysisStart('xr', directoryPath, isInitial);
    
    // Set up standardized progress callback using shared utility
    const progressCallback = isInitial 
      ? createNotificationProgressCallback(progress, 'xr', true)
      : (current: number, total: number, currentFile: string) => {
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
      const engine = new IncrementalAnalysisEngine();
      
      // Configure analysis with DEEP filters
      const config: IncrementalAnalysisConfig = {
        directoryPath,
        filters: { ...DEFAULT_DEEP_FILTERS },
        previousResult,
        progressCallback,
        outputChannel: {
          appendLine: (message: string) => console.log(`XR-ANALYSIS: ${message}`)
        }
      };
      
      // Perform incremental analysis
      const incrementalResult = await engine.performIncrementalAnalysis(config);
      
      // Transform to files array for XR visualization
      const filesData = transformToFilesArray(incrementalResult);
      
      // Create mock result for compatibility with existing code
      const result: DirectoryAnalysisResult = {
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
      } else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
        console.log(`DIRECTORY-ANALYSIS: XR hash-based analysis completed - no changes detected (${totalFiles} files unchanged)`);
      } else {
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
        } else if (incrementalResult.isIncremental && filesAnalyzed === 0) {
          console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (no changes) to: ${dataPath}`);
        } else {
          console.log(`DIRECTORY-ANALYSIS: Saved XR analysis data (${filesAnalyzed} files analyzed) to: ${dataPath}`);
        }
      } catch (error) {
        console.warn(`DIRECTORY-ANALYSIS: Could not save XR analysis data:`, error);
      }
      
      // Log analysis completion
      const duration = Date.now() - startTime;
      logAnalysisComplete('xr', directoryPath, filesAnalyzed, totalFiles, !incrementalResult.isIncremental, duration);
      
      progress.report({ 
        increment: 100, 
        message: 'Creating XR visualization...' 
      });
      
      return result;
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('cancelled')) {
        vscode.window.showInformationMessage('Directory XR deep analysis cancelled by user.');
        return undefined;
      } else {
        throw error;
      }
    }
  });
}

/**
 * Creates visualization directory structure and saves analysis data
 */
async function createDirectoryXRVisualizationFolder(
  context: vscode.ExtensionContext,
  directoryPath: string,
  analysisResult: DirectoryAnalysisResult
): Promise<string | undefined> {
  try {
    const dirName = path.basename(directoryPath);
    const nonce = generateNonce();
    
    // Create visualization directory
    const visualizationsDir = path.join(context.extensionPath, 'visualizations');
    await fs.mkdir(visualizationsDir, { recursive: true });
    
    const visualizationDir = path.join(
      visualizationsDir,
      `${dirName}_xr_${nonce}`
    );
    
    await fs.mkdir(visualizationDir, { recursive: true });
    console.log(`📁 Created XR visualization directory: ${visualizationDir}`);
    
    // Save analysis data as JSON for BabiaXR (extract the files array)
    const dataFilePath = path.join(visualizationDir, 'data.json');
    
    // BabiaXR expects an array of objects, so we use the files array directly
    const xrData = analysisResult.files;
    await fs.writeFile(dataFilePath, JSON.stringify(xrData, null, 2));
    console.log(`💾 Saved XR analysis data (${xrData.length} files): ${dataFilePath}`);
    
    return visualizationDir;
    
  } catch (error) {
    console.error('Error creating directory XR visualization folder:', error);
    return undefined;
  }
}

/**
 * Copies XR template and assets to visualization directory
 */
async function copyDirectoryXRAssets(
  context: vscode.ExtensionContext,
  visualizationDir: string,
  analysisResult: DirectoryAnalysisResult
): Promise<void> {
  try {
    // Get user's chart type and dimension mapping preferences for directory analyses
    const config = vscode.workspace.getConfiguration();
    const directoryChartType = context.globalState.get<string>('codexr.analysis.directoryChartType') || 
                              config.get<string>('codexr.analysis.directoryChartType', 'boats');
    
    console.log(`📊 Using directory chart type: ${directoryChartType}`);
    
    // Get the chart template
    const chartTemplate = getChartTemplate(directoryChartType);
    if (!chartTemplate) {
      console.warn(`⚠️ Unknown chart type: ${directoryChartType}, falling back to boats`);
    }
    
    // Get dimension mappings for the selected chart type
    const dimensionMapping = getDimensionMapping(directoryChartType, context, 'Directory');
    console.log(`📊 Using dimension mapping for ${directoryChartType}:`, dimensionMapping);
    
    // Generate the chart component based on selected chart type and mappings
    const dirName = path.basename(analysisResult.summary.directoryPath);
    const chartTitle = dirName; // ✅ FIXED: Use just the raw directory name
    const chartComponent = generateEnhancedChartComponent(directoryChartType, dimensionMapping, chartTitle, 'directory');
    
    // Copy the directory XR HTML template and adapt it for directory analysis
    const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'directory-xr-template.html');
    const htmlPath = path.join(visualizationDir, 'index.html');
    
    let htmlContent = await fs.readFile(templatePath, 'utf8');
    
    // Replace template variables for directory analysis
    htmlContent = htmlContent
      .replace(/\${TITLE}/g, `Directory XR Analysis - ${dirName}`)
      .replace(/\${DATA_SOURCE}/g, './data.json')
      .replace(/\${BACKGROUND_COLOR}/g, '#1a1a2e')
      .replace(/\${ENVIRONMENT_PRESET}/g, 'forest')
      .replace(/\${GROUND_COLOR}/g, '#2d5a27')
      .replace(/\${ICON_PATH}/g, '../../../resources/icon.svg')
      .replace(/\${CHART_COMPONENT}/g, chartComponent);
    
    // Inject SSE live reload script for automatic updates
    htmlContent = injectLiveReloadScript(htmlContent);
    console.log(`🔄 Injected SSE live reload script for directory XR`);
    
    await fs.writeFile(htmlPath, htmlContent);
    console.log(`📄 Created directory XR HTML template: ${htmlPath}`);
    
  } catch (error) {
    console.error('Error copying directory XR assets:', error);
    throw error;
  }
}

/**
 * Starts server for directory XR visualization with proper mode selection
 */
async function startDirectoryXRServer(
  visualizationDir: string,
  context: vscode.ExtensionContext
): Promise<ServerInfo | undefined> {
  try {
    // Determine server mode based on configuration (same as File XR)
    const userServerMode = context.globalState.get<ServerMode>('serverMode') || ServerMode.HTTPS_DEFAULT_CERTS;
    let analysisServerMode: ServerMode;
    let protocolForPort: 'http' | 'https';
    
    switch (userServerMode) {
      case ServerMode.HTTP:
        analysisServerMode = ServerMode.HTTP;
        protocolForPort = 'http';
        break;
        
      case ServerMode.HTTPS_DEFAULT_CERTS:
        if (defaultCertificatesExist(context)) {
          analysisServerMode = ServerMode.HTTPS_DEFAULT_CERTS;
          protocolForPort = 'https';
        } else {
          analysisServerMode = ServerMode.HTTP;
          protocolForPort = 'http';
          vscode.window.showWarningMessage(
            'Default HTTPS certificates not found. Directory XR server will use HTTP instead.'
          );
        }
        break;
        
      case ServerMode.HTTPS_CUSTOM_CERTS:
        const customKeyPath = context.globalState.get<string>('customKeyPath');
        const customCertPath = context.globalState.get<string>('customCertPath');
        
        if (customKeyPath && customCertPath) {
          analysisServerMode = ServerMode.HTTPS_CUSTOM_CERTS;
          protocolForPort = 'https';
        } else {
          analysisServerMode = ServerMode.HTTP;
          protocolForPort = 'http';
          vscode.window.showWarningMessage(
            'Custom HTTPS certificates not configured. Directory XR server will use HTTP instead.'
          );
        }
        break;
        
      default:
        analysisServerMode = ServerMode.HTTP;
        protocolForPort = 'http';
    }
    
    const serverInfo = await createServer(
      visualizationDir,
      analysisServerMode,
      context,
      undefined // No preferred port
    );
    
    if (serverInfo) {
      // Set analysis file name for XR directory analysis to enable proper icon/formatting in Active Servers
      // Extract directory name from the visualization directory path
      const visualizationDirName = path.basename(visualizationDir);
      const dirName = visualizationDirName.split('_')[0]; // Remove timestamp suffix
      updateServerDisplayInfo(serverInfo.id, {
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
    
  } catch (error) {
    console.error('Error starting directory XR server:', error);
    return undefined;
  }
}

/**
 * Opens the directory XR visualization in external browser with SSE support
 */
async function openDirectoryXRVisualizationPanel(
  context: vscode.ExtensionContext,
  serverUrl: string,
  analysisResult: DirectoryAnalysisResult,
  directoryPath: string,
  isProject: boolean
): Promise<void> {
  // Track the visualization (no webview panel needed)
  console.log(`🌐 Opening Directory XR visualization in browser: ${serverUrl}`);
  
  // Add to active analyses session manager (using server info instead of panel)
  const sessionManager = AnalysisSessionManager.getInstance();
  const serverInfo = activeServers.get(directoryPath);
  if (serverInfo) {
    sessionManager.addSession(directoryPath, AnalysisType.DIRECTORY, serverInfo, { mode: 'shallow', visualizationType: 'xr' }); // XR is always shallow
  }
  
  // Open in external browser (like File XR)
  await vscode.env.openExternal(vscode.Uri.parse(serverUrl));
  
  const dirName = path.basename(directoryPath);
  vscode.window.showInformationMessage(
    `🎯 Directory XR Analysis opened in browser for: ${dirName}\n🌐 URL: ${serverUrl}`
  );
  
  console.log(`� Directory XR opened in browser for: ${dirName}`);
}

/**
 * Cleanup existing directory XR resources
 */
async function cleanupExistingDirectoryXR(directoryPath: string): Promise<void> {
  // Stop directory watcher
  const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
  if (sharedWatcherManager.isWatching(directoryPath)) {
    console.log(`🛑 Stopping existing directory XR watcher for: ${directoryPath}`);
    sharedWatcherManager.stopWatching(directoryPath);
  }
  
  // Stop existing server
  const existingServer = activeServers.get(directoryPath);
  if (existingServer) {
    stopServer(existingServer.id);
  }
  
  // Clear tracking
  activeServers.delete(directoryPath);
  visualizationDirs.delete(directoryPath);
}

/**
 * Cleanup directory XR resources
 */
export function cleanupDirectoryXRResources(directoryPath: string): void {
  // Stop directory watcher
  const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
  if (sharedWatcherManager.isWatching(directoryPath)) {
    console.log(`🛑 Stopping directory XR watcher for: ${directoryPath}`);
    sharedWatcherManager.stopWatching(directoryPath);
  }
  
  // Stop server
  const serverInfo = activeServers.get(directoryPath);
  if (serverInfo) {
    stopServer(serverInfo.id);
  }
  
  // Clear tracking
  activeServers.delete(directoryPath);
  visualizationDirs.delete(directoryPath);
}

/**
 * Cleanup directory XR visualization for a specific directory (called when analysis session is closed)
 */
export async function cleanupDirectoryXRVisualization(directoryPath: string): Promise<void> {
  console.log(`🧹 Cleaning up directory XR visualization for: ${directoryPath}`);
  
  try {
    // Stop watcher
    const sharedWatcherManager = SharedDirectoryWatcherManager.getInstance();
    if (sharedWatcherManager.isWatching(directoryPath)) {
      console.log(`🛑 Stopping directory XR watcher for: ${directoryPath}`);
      sharedWatcherManager.stopWatching(directoryPath);
    }
    
    // Stop and remove server
    const existingServer = activeServers.get(directoryPath);
    if (existingServer) {
      console.log(`🛑 Stopping directory XR server: ${existingServer.id}`);
      stopServer(existingServer.id);
      activeServers.delete(directoryPath);
    }
    
    // Clean up visualization directory reference
    visualizationDirs.delete(directoryPath);
    
    console.log(`✅ Directory XR visualization cleanup complete for: ${directoryPath}`);
    
  } catch (error) {
    console.warn(`⚠️ Error during directory XR visualization cleanup for ${directoryPath}:`, error);
  }
}


