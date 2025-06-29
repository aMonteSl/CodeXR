import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LineCountInfo } from './model';

/**
 * Resolves the path to a Python analyzer script using multiple strategies
 * @param scriptName Name of the Python script (e.g., 'python_comment_analyzer.py')
 * @param outputChannel Optional output channel for logging
 * @returns Resolved path to the script
 */
export function resolveAnalyzerScriptPath(scriptName: string, outputChannel?: vscode.OutputChannel): string {
  // Get the extension path if possible (most reliable method)
  const extensionPath = vscode.extensions.getExtension('codexr')?.extensionPath;
  
  // The most reliable path is the one relative to the project root 
  const projectRootPath = path.resolve(__dirname, '..', '..');
  
  const possiblePaths = [
    // 1. Project root based path - most reliable in development
    path.join(projectRootPath, 'src', 'analysis', 'python', scriptName),
    
    // 2. Try using extension path 
    ...(extensionPath ? [path.join(extensionPath, 'src', 'analysis', 'python', scriptName)] : []),
    
    // 3. Try relative to the current module's directory
    path.join(__dirname, 'python', scriptName),
    
    // 4. Try parent directory
    path.join(__dirname, '..', 'analysis', 'python', scriptName),
    
    // 5. Try two levels up (from out/ to src/)
    path.join(__dirname, '..', '..', 'src', 'analysis', 'python', scriptName),
    
    // 6. Try workspace folders
    ...(vscode.workspace.workspaceFolders?.map(folder => 
      path.join(folder.uri.fsPath, 'src', 'analysis', 'python', scriptName)) || [])
  ];
  
  // Log all paths we're searching (helpful for debugging)
  outputChannel?.appendLine(`Searching for ${scriptName} in:`);
  possiblePaths.forEach(p => outputChannel?.appendLine(` - ${p}`));

  // Check each path and return the first one that exists
  for (const scriptPath of possiblePaths) {
    try {
      if (fs.existsSync(scriptPath)) {
        outputChannel?.appendLine(`✓ Found analyzer script at: ${scriptPath}`);
        return scriptPath;
      }
    } catch (e) {
      // Ignore errors during path checking
    }
  }

  // Log the issue if we couldn't find the script
  const errorMsg = `Could not find Python analyzer script: ${scriptName}. Please ensure scripts are installed correctly.`;
  outputChannel?.appendLine(`❌ ${errorMsg}`);
  
  // Return a path relative to the project root as a last resort
  return path.join(projectRootPath, 'src', 'analysis', 'python', scriptName);
}

/**
 * Gets the language name based on file extension
 */
export function getLanguageName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.js':
    case '.jsx':
      return 'JavaScript';
    case '.ts':
    case '.tsx':
      return 'TypeScript';
    case '.py':
      return 'Python';
    case '.java':
      return 'Java';
    case '.c':
      return 'C';
    case '.cpp':
    case '.cxx':
    case '.cc':
      return 'C++';
    case '.h':
    case '.hpp':
      return 'C/C++ Headers';
    case '.cs':
      return 'C#';
    case '.php':
      return 'PHP';
    case '.rb':
      return 'Ruby';
    case '.go':
      return 'Go';
    case '.rs':
      return 'Rust';
    case '.swift':
      return 'Swift';
    case '.kt':
    case '.kts':
      return 'Kotlin';
    case '.html':
    case '.htm':
      return 'HTML';
    case '.vue':
      return 'Vue';
    case '.scala':
    case '.sc':
      return 'Scala';
    case '.lua':
      return 'Lua';
    case '.erl':
    case '.hrl':
      return 'Erlang';
    case '.zig':
      return 'Zig';
    case '.pl':
    case '.pm':
    case '.pod':
    case '.t':
      return 'Perl';
    case '.gd':
      return 'GDScript';
    case '.sol':
      return 'Solidity';
    case '.f':
    case '.f77':
    case '.f90':
    case '.f95':
    case '.f03':
    case '.f08':
    case '.for':
    case '.ftn':
      return 'Fortran';
    case '.ttcn3':
    case '.ttcn':
    case '.3mp':
      return 'TTCN-3';
    case '.m':
    case '.mm':
      return 'Objective-C';
    default:
      return 'Unknown';
  }
}

/**
 * Gets comment patterns for different file types
 */
function getCommentPatterns(extension: string): {
  singleLine: string[];
  blockStart: { start: string; end: string; }[];
} {
  const patterns: Record<string, any> = {
    '.js': {
      singleLine: ['//'],
      blockStart: [{ start: '/*', end: '*/' }]
    },
    '.tsx': {
      singleLine: ['//'],
      blockStart: [{ start: '/*', end: '*/' }]
    },
    '.py': {
      singleLine: ['#'],
      blockStart: [{ start: '"""', end: '"""' }, { start: "'''", end: "'''" }]
    },
    '.java': {
      singleLine: ['//'],
      blockStart: [{ start: '/*', end: '*/' }, { start: '/**', end: '*/' }]
    }
  };

  return patterns[extension] || {
    singleLine: ['#'],
    blockStart: []
  };
}

/**
 * Counts code, comment, and blank lines
 */
export async function countFileLines(filePath: string): Promise<LineCountInfo> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    
    // Track multi-line comment state
    let inMultilineComment = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Blank line check
      if (trimmedLine === '') {
        blankLines++;
        continue;
      }
      
      // Language-specific comment detection
      const ext = path.extname(filePath).toLowerCase();
      
      // Handle multi-line comments
      if (inMultilineComment) {
        commentLines++;
        if ((ext === '.js' || ext === '.ts' || ext === '.c' || ext === '.h' || 
             ext === '.java' || ext === '.m' || ext === '.mm' || ext === '.swift' ||
             ext === '.scala' || ext === '.sc' || ext === '.ttcn3' || ext === '.ttcn' || ext === '.3mp' ||
             ext === '.php' || ext === '.phtml' || ext === '.php3' || ext === '.php4' || ext === '.php5' || ext === '.phps' ||
             ext === '.go' || ext === '.rs' || ext === '.kt' || ext === '.kts' || ext === '.sol' || ext === '.zig') && 
            trimmedLine.includes('*/')) {
          inMultilineComment = false;
        } else if (ext === '.lua' && trimmedLine.includes(']]')) {
          inMultilineComment = false;
        }
        continue;
      }
      
      // Single line comments
      if ((ext === '.js' || ext === '.ts') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.py' || ext === '.gd') && trimmedLine.startsWith('#')) {
        commentLines++;
      } else if ((ext === '.c' || ext === '.h') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.java') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.m' || ext === '.mm') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if (ext === '.swift' && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.scala' || ext === '.sc') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.ttcn3' || ext === '.ttcn' || ext === '.3mp') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.php' || ext === '.phtml' || ext === '.php3' || ext === '.php4' || ext === '.php5' || ext === '.phps') && 
                (trimmedLine.startsWith('//') || trimmedLine.startsWith('#'))) {
        commentLines++;
      // ✅ AÑADIR NUEVOS LENGUAJES
      } else if (ext === '.go' && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if (ext === '.rs' && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if ((ext === '.kt' || ext === '.kts') && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if (ext === '.sol' && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if (ext === '.zig' && trimmedLine.startsWith('//')) {
        commentLines++;
      } else if (ext === '.lua' && trimmedLine.startsWith('--')) {
        commentLines++;
      } else if ((ext === '.f' || ext === '.f77' || ext === '.f90' || ext === '.f95' || ext === '.f03' || ext === '.f08' || ext === '.for' || ext === '.ftn') && 
                (trimmedLine.startsWith('!') || (line.length > 0 && line[0].toLowerCase() === 'c'))) {
        commentLines++;
      } else if ((ext === '.erl' || ext === '.hrl') && trimmedLine.startsWith('%')) {
        commentLines++;
      } else if ((ext === '.pl' || ext === '.pm' || ext === '.pod' || ext === '.t') && 
                (trimmedLine.startsWith('#') || trimmedLine.startsWith('='))) {
        commentLines++;
      }
      // Multi-line comment start
      else if ((ext === '.js' || ext === '.ts' || ext === '.c' || ext === '.h' || 
                ext === '.java' || ext === '.m' || ext === '.mm' || ext === '.swift' ||
                ext === '.scala' || ext === '.sc' || ext === '.ttcn3' || ext === '.ttcn' || ext === '.3mp' ||
                ext === '.php' || ext === '.phtml' || ext === '.php3' || ext === '.php4' || ext === '.php5' || ext === '.phps' ||
                ext === '.go' || ext === '.rs' || ext === '.kt' || ext === '.kts' || ext === '.sol' || ext === '.zig') && 
               trimmedLine.startsWith('/*')) {
        commentLines++;
        inMultilineComment = true;
        
        // Check if comment ends on same line
        if (trimmedLine.includes('*/')) {
          inMultilineComment = false;
        }
      } else if (ext === '.lua' && trimmedLine.includes('--[[')) {
        commentLines++;
        inMultilineComment = true;
        
        // Check if comment ends on same line
        if (trimmedLine.includes(']]')) {
          inMultilineComment = false;
        }
      } else {
        codeLines++;
      }
    }
    
    return {
      total: lines.length,
      code: codeLines,
      comment: commentLines,
      blank: blankLines
    };
  } catch (error) {
    console.error(`Error counting lines in ${filePath}:`, error);
    return {
      total: 0,
      code: 0,
      comment: 0,
      blank: 0
    };
  }
}

/**
 * Gets file size in bytes
 * @param filePath Path to file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
}

/**
 * Formats a file size for display
 * @param bytes Size in bytes
 * @returns Human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Determines if a function's complexity is concerning
 * @param complexity Cyclomatic complexity value
 * @returns Classification of complexity
 */
export function classifyComplexity(complexity: number): 'low' | 'medium' | 'high' | 'critical' {
  if (complexity <= 5) {
    return 'low';
  } else if (complexity <= 10) {
    return 'medium';
  } else if (complexity <= 25) {
    return 'high';
  } else {
    return 'critical';
  }
}