import * as vscode from 'vscode';
import { FileAnalysisResult, FunctionInfo, ComplexityMetrics } from '../../model';
import { analyzeLizard } from '../lizardAnalyzer';
import { analyzeComments } from '../commentAnalyzer';
import { analyzeClassCount } from '../classAnalyzer';
import { 
  countFileLines, 
  getLanguageName, 
  formatFileSize, 
  getCurrentTimestamp,
  createAnalysisError 
} from '../../utils/generalUtils';

/**
 * File-based static analysis manager
 * Handles comprehensive static analysis of individual files
 */

// Output channel for file analysis operations
let fileAnalysisOutputChannel: vscode.OutputChannel;

/**
 * Creates a dummy output channel that doesn't output anything
 */
class SilentOutputChannel implements vscode.OutputChannel {
  name: string = 'Silent';
  
  append(): void {
    // Do nothing
  }
  
  appendLine(): void {
    // Do nothing
  }
  
  replace(): void {
    // Do nothing
  }
  
  clear(): void {
    // Do nothing
  }
  
  show(): void {
    // Do nothing
  }
  
  hide(): void {
    // Do nothing
  }
  
  dispose(): void {
    // Do nothing
  }
}

/**
 * Gets or creates the file analysis output channel
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!fileAnalysisOutputChannel) {
    fileAnalysisOutputChannel = vscode.window.createOutputChannel('CodeXR File Analysis');
  }
  return fileAnalysisOutputChannel;
}

/**
 * Performs comprehensive static analysis on a single file
 * @param filePath Path to the file to analyze
 * @param context VS Code extension context
 * @param silent Whether to suppress output channel logging (useful for batch operations)
 * @returns FileAnalysisResult or undefined if analysis fails
 */
export async function analyzeFileStatic(
  filePath: string, 
  _context: vscode.ExtensionContext,
  silent: boolean = false
): Promise<FileAnalysisResult | undefined> {
  const outputChannel = silent ? new SilentOutputChannel() : getOutputChannel();
  
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
    const { getVenvPath } = require('../../../pythonEnv/utils/pathUtils');
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
 * Analyzes multiple files in batch with progress reporting
 * @param filePaths Array of file paths to analyze
 * @param context VS Code extension context
 * @param progressCallback Optional callback to report progress
 * @returns Array of FileAnalysisResult
 */
export async function analyzeFilesBatch(
  filePaths: string[],
  context: vscode.ExtensionContext,
  progressCallback?: (current: number, total: number, currentFile: string) => void
): Promise<FileAnalysisResult[]> {
  const results: FileAnalysisResult[] = [];
  
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    
    if (progressCallback) {
      progressCallback(i + 1, filePaths.length, filePath);
    }
    
    try {
      const result = await analyzeFileStatic(filePath, context, true); // Silent mode for batch
      if (result) {
        results.push(result);
      }
    } catch (error) {
      // Continue with other files even if one fails
      console.error(`Failed to analyze ${filePath}:`, error);
    }
  }
  
  return results;
}
