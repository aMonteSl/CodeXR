import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { FileAnalysis, CodeMetrics, ProjectAnalysis } from './models/analysisModel';
import { countLines } from './metrics/locMetrics';
import { getAllComments, calculateCommentLines } from './metrics/commentMetrics';
import { countFunctionsAndClasses } from './metrics/functionMetrics';

/**
 * Analyzes JavaScript/TypeScript code using the TypeScript Compiler API
 * @param filePath Path to the file to analyze
 * @returns Analysis results for the file
 */
export async function analyzeFile(filePath: string): Promise<FileAnalysis> {
  try {
    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Parse the file using TypeScript Compiler API
    const sourceFile = ts.createSourceFile(
      path.basename(filePath),
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Calculate metrics
    const metrics = calculateFileMetrics(sourceFile, fileContent);

    // Return analysis result
    return {
      filePath,
      fileName: path.basename(filePath),
      metrics,
      analyzedAt: new Date()
    };
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Analyzes a directory of JavaScript/TypeScript files
 * @param dirPath Path to the directory to analyze
 * @param fileExtensions Array of file extensions to include
 * @returns Analysis results for the directory
 */
export async function analyzeDirectory(
  dirPath: string, 
  fileExtensions: string[] = ['.js', '.jsx', '.ts', '.tsx']
): Promise<ProjectAnalysis> {
  try {
    // Find all matching files in the directory
    const files = findFilesRecursively(dirPath, fileExtensions);
    
    // Analyze each file
    const fileAnalyses: FileAnalysis[] = [];
    for (const file of files) {
      try {
        const analysis = await analyzeFile(file);
        fileAnalyses.push(analysis);
      } catch (error) {
        console.error(`Skipping file ${file} due to error:`, error);
      }
    }
    
    // Calculate aggregate metrics
    const summary = calculateProjectMetrics(fileAnalyses);
    
    return {
      files: fileAnalyses,
      summary,
      analyzedAt: new Date()
    };
  } catch (error) {
    console.error(`Error analyzing directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Finds all files in a directory that match the given extensions
 * @param dirPath Directory to search
 * @param extensions File extensions to include
 * @returns Array of file paths
 */
function findFilesRecursively(dirPath: string, extensions: string[]): string[] {
  let results: string[] = [];
  
  // Read all items in the directory
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      // Recursively search subdirectories (skip node_modules and .git)
      if (item !== 'node_modules' && item !== '.git') {
        results = results.concat(findFilesRecursively(itemPath, extensions));
      }
    } else if (stats.isFile()) {
      // Check if the file has one of the specified extensions
      const ext = path.extname(itemPath).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(itemPath);
      }
    }
  }
  
  return results;
}

/**
 * Calculates code metrics for a single file
 * @param sourceFile TypeScript source file
 * @param fileContent File content as string
 * @returns Code metrics
 */
function calculateFileMetrics(sourceFile: ts.SourceFile, fileContent: string): CodeMetrics {
  // Get line metrics
  const lineMetrics = countLines(fileContent);
  const totalLines = lineMetrics.total;
  const blankLines = lineMetrics.blank;
  
  // Get function and class metrics
  const functionMetrics = countFunctionsAndClasses(sourceFile);
  const functionCount = functionMetrics.functionCount;
  const classCount = functionMetrics.classCount;
  
  // Get comment metrics
  const comments = getAllComments(sourceFile, fileContent);
  let commentLines = calculateCommentLines(comments, fileContent);
  
  // Ensure commentLines doesn't exceed the possible maximum
  commentLines = Math.min(commentLines, totalLines - blankLines);
  
  // Calculate code lines (non-blank, non-comment)
  // Ensure codeLines never goes negative
  const codeLines = Math.max(0, totalLines - blankLines - commentLines);
  
  return {
    totalLines,
    codeLines,
    blankLines,
    commentLines,
    functionCount,
    classCount
  };
}

/**
 * Calculates aggregate metrics for a project
 * @param fileAnalyses Array of file analyses
 * @returns Aggregated code metrics
 */
function calculateProjectMetrics(fileAnalyses: FileAnalysis[]): CodeMetrics {
  const summary: CodeMetrics = {
    totalLines: 0,
    codeLines: 0,
    blankLines: 0,
    commentLines: 0,
    functionCount: 0,
    classCount: 0
  };
  
  for (const analysis of fileAnalyses) {
    summary.totalLines += analysis.metrics.totalLines;
    summary.codeLines += analysis.metrics.codeLines;
    summary.blankLines += analysis.metrics.blankLines;
    summary.commentLines += analysis.metrics.commentLines;
    summary.functionCount += analysis.metrics.functionCount;
    summary.classCount += analysis.metrics.classCount;
  }
  
  // Sanity check: ensure all values are non-negative
  Object.keys(summary).forEach(key => {
    const metricKey = key as keyof CodeMetrics;
    if (typeof summary[metricKey] === 'number' && summary[metricKey] < 0) {
      console.warn(`Correcting negative value for ${metricKey}: ${summary[metricKey]}`);
      summary[metricKey] = 0;
    }
  });
  
  return summary;
}