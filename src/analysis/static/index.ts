import * as vscode from 'vscode';
import { FileAnalysisResult, FunctionInfo, ComplexityMetrics } from '../model';
import { analyzeLizard } from './lizardAnalyzer';
import { analyzeComments } from './commentAnalyzer';
import { analyzeClassCount } from './classAnalyzer';
import { 
  countFileLines, 
  getLanguageName, 
  formatFileSize, 
  getCurrentTimestamp,
  createAnalysisError 
} from '../utils/generalUtils';

/**
 * Main static analysis manager that orchestrates all static analysis operations
 */

// Output channel for analysis operations
let staticAnalysisOutputChannel: vscode.OutputChannel;

/**
 * Gets or creates the static analysis output channel
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!staticAnalysisOutputChannel) {
    staticAnalysisOutputChannel = vscode.window.createOutputChannel('CodeXR Static Analysis');
  }
  return staticAnalysisOutputChannel;
}

/**
 * Performs comprehensive static analysis on a file
 */
export async function analyzeFileStatic(
  filePath: string, 
  _context: vscode.ExtensionContext
): Promise<FileAnalysisResult | undefined> {
  const outputChannel = getOutputChannel();
  
  try {
    outputChannel.appendLine(`\n🔍 Starting static analysis for: ${filePath}`);
    
    // Extract basic file information
    const fileName = require('path').basename(filePath);
    const language = getLanguageName(filePath);
    const fileSize = formatFileSize(filePath);
    
    outputChannel.appendLine(`📁 File: ${fileName}`);
    outputChannel.appendLine(`🏷️ Language: ${language}`);
    outputChannel.appendLine(`📊 Size: ${fileSize}`);
    
    // Analyze file lines
    outputChannel.appendLine(`📏 Analyzing file structure...`);
    const lineInfo = await countFileLines(filePath);
    outputChannel.appendLine(`   Total lines: ${lineInfo.total}`);
    outputChannel.appendLine(`   Code lines: ${lineInfo.code}`);
    outputChannel.appendLine(`   Comment lines: ${lineInfo.comment}`);
    outputChannel.appendLine(`   Blank lines: ${lineInfo.blank}`);
    
    // Initialize default values
    let functions: FunctionInfo[] = [];
    let complexity: ComplexityMetrics = {
      averageComplexity: 0,
      maxComplexity: 0,
      functionCount: 0,
      highComplexityFunctions: 0,
      criticalComplexityFunctions: 0
    };
    
    // Try Lizard analysis (with better error handling)
    const fs = require('fs');
    const { getVenvPath } = require('../../pythonEnv/utils/pathUtils');
    const venvPath = getVenvPath();
    if (venvPath && fs.existsSync(venvPath)) {
      try {
        outputChannel.appendLine('🐍 Python environment found, running Lizard analysis...');
        
        const lizardResult = await analyzeLizard(filePath, outputChannel);
        
        if (lizardResult && lizardResult.functions.length > 0) {
          functions = lizardResult.functions;
          complexity = lizardResult.metrics;
          
          outputChannel.appendLine(`✅ Lizard analysis completed: ${functions.length} functions found`);
        } else {
          outputChannel.appendLine('⚠️ Lizard analysis returned no functions');
        }
      } catch (error) {
        outputChannel.appendLine(`⚠️ Lizard analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        outputChannel.appendLine('📊 Continuing with basic analysis...');
        
        // Fallback to basic analysis without Lizard
        functions = [];
        complexity = {
          averageComplexity: 0,
          maxComplexity: 0,
          functionCount: 0,
          highComplexityFunctions: 0,
          criticalComplexityFunctions: 0
        };
      }
    } else {
      outputChannel.appendLine('⚠️ No Python virtual environment found. Skipping Lizard analysis...');
    }
    
    // Analyze comments (with better error handling)
    let commentLines = 0;
    try {
      commentLines = await analyzeComments(filePath, outputChannel);
      outputChannel.appendLine(`💬 Comments: ${commentLines} lines`);
    } catch (error) {
      outputChannel.appendLine(`⚠️ Comment analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Analyze classes (with better error handling)
    let classCount = 0;
    try {
      classCount = await analyzeClassCount(filePath, outputChannel);
      outputChannel.appendLine(`🏛️ Classes: ${classCount}`);
    } catch (error) {
      outputChannel.appendLine(`⚠️ Class analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Build final result
    const result: FileAnalysisResult = {
      fileName,
      filePath,
      language,
      fileSize,
      totalLines: lineInfo.total,
      codeLines: lineInfo.code,
      commentLines: Math.max(commentLines, lineInfo.comment),
      blankLines: lineInfo.blank,
      functions,
      functionCount: functions.length,
      classCount,
      complexity,
      timestamp: getCurrentTimestamp()
    };
    
    outputChannel.appendLine(`✅ Static analysis completed for ${fileName}`);
    outputChannel.appendLine(`📊 Summary: ${result.functionCount} functions, ${result.classCount} classes, complexity avg: ${result.complexity.averageComplexity}`);
    
    return result;
    
  } catch (error) {
    const errorMessage = createAnalysisError('Static analysis', error instanceof Error ? error : new Error(String(error)));
    outputChannel.appendLine(`❌ ${errorMessage}`);
    
    return {
      fileName: require('path').basename(filePath),
      filePath,
      language: getLanguageName(filePath),
      fileSize: formatFileSize(filePath),
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      functions: [],
      functionCount: 0,
      classCount: 0,
      complexity: {
        averageComplexity: 0,
        maxComplexity: 0,
        functionCount: 0,
        highComplexityFunctions: 0,
        criticalComplexityFunctions: 0
      },
      timestamp: getCurrentTimestamp(),
      error: errorMessage
    };
  }
}

/**
 * Re-export the new static visualization manager
 */
export { 
  createStaticVisualization, 
  getStaticVisualizationFolder, 
  cleanupStaticVisualizations,
  getOpenPanel,
  closePanelForFile,
  getOpenPanelFiles
} from './staticVisualizationManager';

/**
 * Re-export individual analyzers for direct use
 */
export { analyzeLizard, analyzeComments, analyzeClassCount };

/**
 * Main analysis function alias for backward compatibility
 */
export { analyzeFileStatic as analyzeFile };
