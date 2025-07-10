import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { DirectoryAnalysisResult, FileMetrics } from '../static/directory/directoryAnalysisModel';

/**
 * @deprecated This class is deprecated and no longer used.
 * Hash-based change detection is now handled directly by the DirectoryAnalysisManager
 * and shared utilities. This file remains for reference but should not be used.
 * 
 * See: src/analysis/shared/directoryAnalysisDataManager.ts for current implementation
 */

/**
 * File change detection result
 */
export interface FileChangeDetection {
  /** Files that were added (new files) */
  added: string[];
  
  /** Files that were modified (hash changed) */
  modified: string[];
  
  /** Files that were deleted (no longer exist) */
  deleted: string[];
  
  /** Files that are unchanged */
  unchanged: string[];
  
  /** Whether any changes were detected */
  hasChanges: boolean;
}

/**
 * Utility for detecting file changes in directory analysis
 */
export class DirectoryChangeDetector {
  
  /**
   * Compare current directory state with previous analysis result
   * @param directoryPath The directory being analyzed
   * @param previousResult Previous analysis result (with file hashes)
   * @param includeSubdirectories Whether to scan subdirectories
   * @returns Change detection result
   */
  static async detectChanges(
    directoryPath: string,
    previousResult: DirectoryAnalysisResult | undefined,
    includeSubdirectories: boolean = false
  ): Promise<FileChangeDetection> {
    
    // Get current file list from filesystem
    const currentFiles = await this.getCurrentFileList(directoryPath, includeSubdirectories);
    
    // If no previous result, all files are new
    if (!previousResult) {
      return {
        added: currentFiles,
        modified: [],
        deleted: [],
        unchanged: [],
        hasChanges: currentFiles.length > 0
      };
    }
    
    // Create maps for efficient lookup
    const previousFileMap = new Map<string, FileMetrics>();
    for (const file of previousResult.files) {
      previousFileMap.set(file.relativePath, file);
    }
    
    const currentFileSet = new Set(currentFiles);
    const previousFileSet = new Set(previousResult.files.map(f => f.relativePath));
    
    // Detect added files
    const added = currentFiles.filter(file => !previousFileSet.has(file));
    
    // Detect deleted files
    const deleted = Array.from(previousFileSet).filter(file => !currentFileSet.has(file));
    
    // Check modified files (files that exist in both but might have changed)
    const modified: string[] = [];
    const unchanged: string[] = [];
    
    for (const currentFile of currentFiles) {
      if (previousFileSet.has(currentFile)) {
        const previousFileData = previousFileMap.get(currentFile);
        if (previousFileData) {
          // Calculate current file hash to compare
          const fullPath = path.join(directoryPath, currentFile);
          try {
            const currentHash = await this.calculateFileHash(fullPath);
            if (currentHash !== previousFileData.fileHash) {
              modified.push(currentFile);
            } else {
              unchanged.push(currentFile);
            }
          } catch (error) {
            console.warn(`Could not calculate hash for ${fullPath}:`, error);
            // If we can't calculate hash, assume it's modified to be safe
            modified.push(currentFile);
          }
        }
      }
    }
    
    const hasChanges = added.length > 0 || modified.length > 0 || deleted.length > 0;
    
    console.log(`📊 Change detection for ${directoryPath}:`);
    console.log(`   ➕ Added: ${added.length} files`);
    console.log(`   📝 Modified: ${modified.length} files`);
    console.log(`   ➖ Deleted: ${deleted.length} files`);
    console.log(`   ✅ Unchanged: ${unchanged.length} files`);
    
    return {
      added,
      modified,
      deleted,
      unchanged,
      hasChanges
    };
  }
  
  /**
   * Get list of analyzable files in directory
   * @param directoryPath Directory to scan
   * @param includeSubdirectories Whether to include subdirectories
   * @returns Array of relative file paths
   */
  private static async getCurrentFileList(
    directoryPath: string,
    includeSubdirectories: boolean
  ): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (currentPath: string, relativePath: string = '') => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          const entryRelativePath = path.join(relativePath, entry.name);
          
          if (entry.isFile()) {
            // Check if file should be analyzed (basic filters)
            if (this.shouldAnalyzeFile(entry.name)) {
              files.push(entryRelativePath);
            }
          } else if (entry.isDirectory() && includeSubdirectories) {
            // Skip hidden and common ignored directories
            if (!this.shouldIgnoreDirectory(entry.name)) {
              await scanDirectory(entryPath, entryRelativePath);
            }
          }
        }
      } catch (error) {
        console.warn(`Could not scan directory ${currentPath}:`, error);
      }
    };
    
    await scanDirectory(directoryPath);
    return files.sort(); // Sort for consistent ordering
  }
  
  /**
   * Calculate SHA-256 hash of a file
   * @param filePath Full path to file
   * @returns File hash as hex string
   */
  private static async calculateFileHash(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }
  
  /**
   * Check if a file should be analyzed based on extension
   * @param fileName File name to check
   * @returns True if file should be analyzed
   */
  private static shouldAnalyzeFile(fileName: string): boolean {
    const extension = path.extname(fileName).toLowerCase();
    
    // Common code file extensions
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx',           // JavaScript/TypeScript
      '.py', '.pyw',                          // Python
      '.java', '.kt', '.scala',               // JVM languages
      '.go', '.rs', '.cpp', '.c', '.h',       // Systems languages
      '.cs', '.vb',                           // .NET languages
      '.php', '.rb', '.swift', '.m',          // Other languages
      '.html', '.css', '.scss', '.less',      // Web technologies
      '.json', '.xml', '.yaml', '.yml',       // Data formats
      '.sh', '.bat', '.ps1'                   // Scripts
    ];
    
    return codeExtensions.includes(extension);
  }
  
  /**
   * Check if a directory should be ignored
   * @param dirName Directory name to check
   * @returns True if directory should be ignored
   */
  private static shouldIgnoreDirectory(dirName: string): boolean {
    const ignoredDirs = [
      '.git', '.svn', '.hg',                  // Version control
      'node_modules', '__pycache__', '.venv', // Dependencies/build
      '.idea', '.vscode',                     // IDE directories
      'build', 'dist', 'target', 'bin',      // Build outputs
      '.DS_Store'                             // System files
    ];
    
    return dirName.startsWith('.') || ignoredDirs.includes(dirName);
  }
}

