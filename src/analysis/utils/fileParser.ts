import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Options for parsing a file
 */
export interface ParseOptions {
  /** Target language version */
  target?: ts.ScriptTarget;
  /** Whether to include JSX syntax */
  jsx?: boolean;
}

/**
 * Parse a file using TypeScript Compiler API
 */
export function parseFile(filePath: string, options: ParseOptions = {}): ts.SourceFile {
  // Set default options
  const target = options.target || ts.ScriptTarget.Latest;
  const jsx = options.jsx || false;
  
  // Read file content
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // Parse the file
  return ts.createSourceFile(
    path.basename(filePath),
    fileContent,
    target,
    /*setParentNodes*/ true,
    jsx ? ts.ScriptKind.JSX : undefined
  );
}

/**
 * Find all files in a directory that match the given extensions
 */
export function findFilesRecursively(dirPath: string, extensions: string[]): string[] {
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
 * Read file content as string
 */
export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}