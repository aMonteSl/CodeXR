import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DirectoryAnalysisResult } from '../static/directory/directoryAnalysisModel';

/**
 * Shared utilities for directory analysis data management
 * Handles loading previous analysis results and determining output paths
 */

/**
 * Options for finding previous analysis data
 */
export interface PreviousDataSearchOptions {
  /** Extension context for finding visualization directories */
  context: vscode.ExtensionContext;
  /** Directory path being analyzed */
  directoryPath: string;
  /** Analysis mode (affects where data is stored) */
  mode: 'static' | 'xr' | 'deep' | 'project';
  /** Whether this is a project-level analysis */
  isProject?: boolean;
}

/**
 * Result of searching for previous analysis data
 */
export interface PreviousDataResult {
  /** Previous analysis result if found */
  previousResult?: DirectoryAnalysisResult;
  /** Path where the analysis data is/will be stored */
  dataPath: string;
  /** Directory where visualization files are/will be stored */
  visualizationDir: string;
}

/**
 * Loads previous analysis data for a directory if it exists
 * This enables hash-based incremental analysis across all directory analysis types
 */
export async function loadPreviousDirectoryAnalysis(
  options: PreviousDataSearchOptions
): Promise<PreviousDataResult> {
  const { context, directoryPath, mode, isProject = false } = options;
  
  console.log(`🔍 Loading previous analysis data for: ${directoryPath} (mode: ${mode})`);
  
  // Determine where analysis data should be stored based on mode
  const visualizationDir = await findOrCreateVisualizationDirectory(context, directoryPath, mode, isProject);
  const dataPath = path.join(visualizationDir, 'data.json');
  
  let previousResult: DirectoryAnalysisResult | undefined;
  
  try {
    // Check if previous data.json exists
    const dataExists = await fs.access(dataPath).then(() => true).catch(() => false);
    
    if (dataExists) {
      console.log(`📊 Found previous data.json: ${dataPath}`);
      
      // Load and parse previous data
      const dataContent = await fs.readFile(dataPath, 'utf8');
      const parsedData = JSON.parse(dataContent);
      
      // Handle different data formats based on analysis mode
      if (mode === 'xr') {
        // XR mode stores files array directly
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Convert XR format to DirectoryAnalysisResult format
          previousResult = convertXRDataToDirectoryResult(parsedData, directoryPath);
          console.log(`✅ Loaded previous XR analysis: ${parsedData.length} files`);
        }
      } else {
        // Static/Deep/Project modes store DirectoryAnalysisResult format
        if (parsedData.summary && parsedData.files) {
          previousResult = parsedData as DirectoryAnalysisResult;
          console.log(`✅ Loaded previous ${mode} analysis: ${previousResult.files.length} files`);
        }
      }
    } else {
      console.log(`📊 No previous data.json found, will perform full analysis`);
    }
  } catch (error) {
    console.warn(`⚠️ Error loading previous analysis data: ${error}`);
    // Continue without previous data - will perform full analysis
  }
  
  return {
    previousResult,
    dataPath,
    visualizationDir
  };
}

/**
 * Finds existing visualization directory or creates a new one
 */
async function findOrCreateVisualizationDirectory(
  context: vscode.ExtensionContext,
  directoryPath: string,
  mode: string,
  isProject: boolean
): Promise<string> {
  const dirName = path.basename(directoryPath);
  const visualizationsDir = path.join(context.extensionPath, 'visualizations');
  
  // Create visualizations directory if it doesn't exist
  await fs.mkdir(visualizationsDir, { recursive: true });
  
  // Look for existing visualization directory for this path and mode
  const existingDir = await findExistingVisualizationDir(visualizationsDir, dirName, mode, isProject);
  
  if (existingDir) {
    console.log(`🔍 Found existing visualization directory: ${existingDir}`);
    return existingDir;
  }
  
  // Create new visualization directory
  const timestamp = Date.now();
  const modePrefix = isProject ? 'project' : 'directory';
  const newDirName = `${dirName}_${modePrefix}_${mode}_${timestamp}`;
  const newDir = path.join(visualizationsDir, newDirName);
  
  await fs.mkdir(newDir, { recursive: true });
  console.log(`📁 Created new visualization directory: ${newDir}`);
  
  return newDir;
}

/**
 * Finds existing visualization directory for a specific path and mode
 */
async function findExistingVisualizationDir(
  visualizationsDir: string,
  dirName: string,
  mode: string,
  isProject: boolean
): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(visualizationsDir, { withFileTypes: true });
    const directories = entries.filter(entry => entry.isDirectory());
    
    // Look for directories that match the pattern
    const modePrefix = isProject ? 'project' : 'directory';
    const patterns = [
      `${dirName}_${modePrefix}_${mode}_`,  // New naming pattern
      `${dirName}_${mode}_`,                // Fallback pattern
      `${dirName}_xr_`,                     // XR specific pattern
      `${dirName}_static_`,                 // Static specific pattern
    ];
    
    for (const dir of directories) {
      const fullPath = path.join(visualizationsDir, dir.name);
      
      // Check if directory matches any pattern
      const matchesPattern = patterns.some(pattern => dir.name.startsWith(pattern));
      
      if (matchesPattern) {
        // Verify it has a data.json file
        const dataPath = path.join(fullPath, 'data.json');
        const hasData = await fs.access(dataPath).then(() => true).catch(() => false);
        
        if (hasData) {
          return fullPath;
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Error searching for existing visualization directories: ${error}`);
  }
  
  return undefined;
}

/**
 * Converts XR data format (array of file objects) to DirectoryAnalysisResult format
 */
function convertXRDataToDirectoryResult(
  xrData: any[],
  directoryPath: string
): DirectoryAnalysisResult {
  // Create minimal DirectoryAnalysisResult structure for change detection
  const files = xrData.map(item => ({
    fileName: item.fileName || path.basename(item.relativePath || 'unknown'),
    filePath: item.filePath || path.join(directoryPath, item.relativePath || item.fileName || 'unknown'),
    relativePath: item.relativePath || item.fileName || 'unknown',
    extension: path.extname(item.fileName || item.relativePath || 'unknown'),
    language: item.language || 'unknown',
    fileHash: item.fileHash || '',
    fileSizeBytes: item.fileSize || item.fileSizeBytes || 0,
    totalLines: item.totalLines || 0,
    commentLines: item.commentLines || 0,
    functionCount: item.functionCount || 0,
    classCount: item.classCount || 0,
    meanComplexity: item.averageComplexity || item.meanComplexity || 0,
    meanDensity: item.meanDensity || 0,
    meanParameters: item.meanParameters || 0,
    analyzedAt: item.lastModified || new Date().toISOString(),
    analysisDuration: item.analysisTime || 0
  }));
  
  return {
    summary: {
      directoryPath,
      totalFiles: files.length,
      totalFilesAnalyzed: files.length,
      totalFilesNotAnalyzed: 0,
      totalLines: files.reduce((sum, f) => sum + f.totalLines, 0),
      totalCommentLines: files.reduce((sum, f) => sum + f.commentLines, 0),
      totalFunctions: files.reduce((sum, f) => sum + f.functionCount, 0),
      totalClasses: files.reduce((sum, f) => sum + f.classCount, 0),
      averageComplexity: files.length > 0 ? files.reduce((sum, f) => sum + f.meanComplexity, 0) / files.length : 0,
      averageDensity: files.length > 0 ? files.reduce((sum, f) => sum + f.meanDensity, 0) / files.length : 0,
      averageParameters: files.length > 0 ? files.reduce((sum, f) => sum + f.meanParameters, 0) / files.length : 0,
      languageDistribution: files.reduce((acc, f) => {
        acc[f.language] = (acc[f.language] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      fileSizeDistribution: {
        small: files.filter(f => f.fileSizeBytes < 1024).length,
        medium: files.filter(f => f.fileSizeBytes >= 1024 && f.fileSizeBytes < 10240).length,
        large: files.filter(f => f.fileSizeBytes >= 10240 && f.fileSizeBytes < 102400).length,
        huge: files.filter(f => f.fileSizeBytes >= 102400).length
      },
      complexityDistribution: {
        low: files.filter(f => f.meanComplexity <= 5).length,
        medium: files.filter(f => f.meanComplexity > 5 && f.meanComplexity <= 10).length,
        high: files.filter(f => f.meanComplexity > 10 && f.meanComplexity <= 20).length,
        critical: files.filter(f => f.meanComplexity > 20).length
      },
      analyzedAt: new Date().toISOString(),
      totalDuration: 0
    },
    files,
    functions: [], // XR mode doesn't store detailed function data in the same way
    metadata: {
      version: '0.0.9',
      mode: 'directory',
      filters: {}
    }
  };
}

/**
 * Saves analysis result to the appropriate format based on mode
 */
export async function saveDirectoryAnalysisResult(
  result: DirectoryAnalysisResult,
  dataPath: string,
  mode: 'static' | 'xr' | 'deep' | 'project'
): Promise<void> {
  try {
    let dataToSave: any;
    
    if (mode === 'xr') {
      // XR mode expects just the files array
      dataToSave = result.files;
    } else {
      // Static/Deep/Project modes save the full result
      dataToSave = result;
    }
    
    await fs.writeFile(dataPath, JSON.stringify(dataToSave, null, 2));
    
    // Log with context about incremental analysis
    const metadata = result.metadata;
    if (metadata?.filesAnalyzedThisSession !== undefined) {
      const filesAnalyzed = metadata.filesAnalyzedThisSession;
      const totalFiles = metadata.totalFilesConsidered || result.files.length;
      const isIncremental = metadata.isIncremental || false;
      
      if (isIncremental && filesAnalyzed > 0) {
        console.log(`💾 Saved ${mode} analysis data (${filesAnalyzed} of ${totalFiles} files updated): ${dataPath}`);
      } else if (isIncremental && filesAnalyzed === 0) {
        console.log(`💾 Saved ${mode} analysis data (no changes, ${totalFiles} files preserved): ${dataPath}`);
      } else {
        console.log(`💾 Saved ${mode} analysis data (initial analysis, ${filesAnalyzed} files): ${dataPath}`);
      }
    } else if (mode === 'xr') {
      const fileCount = Array.isArray(dataToSave) ? dataToSave.length : 0;
      console.log(`💾 Saved ${mode} analysis data (${fileCount} files): ${dataPath}`);
    } else {
      console.log(`💾 Saved ${mode} analysis data: ${dataPath}`);
    }
    
  } catch (error) {
    console.error(`❌ Error saving analysis data: ${error}`);
    throw error;
  }
}
