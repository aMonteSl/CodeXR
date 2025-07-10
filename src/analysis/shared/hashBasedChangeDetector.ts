import * as path from 'path';
import * as fs from 'fs/promises';
import { calculateFileHash } from '../../utils/hash';
import { isSupportedLanguage } from '../../utils/languageUtils';

/**
 * File information with hash for change detection
 */
export interface FileWithHash {
  /** Relative path from the directory being analyzed */
  relativePath: string;
  /** Full file path */
  filePath: string;
  /** SHA-256 hash of file contents */
  fileHash: string;
}

/**
 * File change detection result
 */
export interface FileChangeDetection {
  /** Files that were added (new files) */
  added: FileWithHash[];
  
  /** Files that were modified (hash changed) */
  modified: FileWithHash[];
  
  /** Files that were deleted (no longer exist) */
  deleted: FileWithHash[];
  
  /** Files that are unchanged */
  unchanged: FileWithHash[];
  
  /** Whether any changes were detected */
  hasChanges: boolean;
}

/**
 * Detailed change information for a single file
 */
export interface FileChangeInfo {
  /** File path */
  filePath: string;
  
  /** Relative path */
  relativePath: string;
  
  /** Type of change */
  changeType: 'added' | 'modified' | 'deleted' | 'unchanged';
  
  /** Previous hash (if exists) */
  previousHash?: string;
  
  /** Current hash */
  currentHash?: string;
}

/**
 * Shared utility for hash-based file change detection across all directory analysis types
 */
export class HashBasedChangeDetector {
  
  /**
   * Compare current directory state with previous files using hash comparison
   * @param directoryPath The directory being analyzed
   * @param currentFiles Current files from filesystem with their hashes
   * @param previousFiles Previous files with their hashes (from previous analysis)
   * @returns Change detection result
   */
  static detectChanges(
    directoryPath: string,
    currentFiles: FileWithHash[],
    previousFiles: FileWithHash[]
  ): FileChangeDetection {
    
    // Create maps for efficient lookup
    const previousFileMap = new Map<string, FileWithHash>();
    for (const file of previousFiles) {
      previousFileMap.set(file.relativePath, file);
    }
    
    const currentFileMap = new Map<string, FileWithHash>();
    for (const file of currentFiles) {
      currentFileMap.set(file.relativePath, file);
    }
    
    const currentFileSet = new Set(currentFiles.map(f => f.relativePath));
    const previousFileSet = new Set(previousFiles.map(f => f.relativePath));
    
    // Detect added files
    const added = currentFiles.filter(file => !previousFileSet.has(file.relativePath));
    
    // Detect deleted files
    const deleted = previousFiles.filter(file => !currentFileSet.has(file.relativePath));
    
    // Check modified and unchanged files
    const modified: FileWithHash[] = [];
    const unchanged: FileWithHash[] = [];
    
    for (const currentFile of currentFiles) {
      if (previousFileSet.has(currentFile.relativePath)) {
        const previousFile = previousFileMap.get(currentFile.relativePath);
        if (previousFile) {
          if (currentFile.fileHash !== previousFile.fileHash) {
            modified.push(currentFile);
          } else {
            unchanged.push(currentFile);
          }
        }
      }
    }
    
    const hasChanges = added.length > 0 || modified.length > 0 || deleted.length > 0;
    
    console.log(`📊 Hash-based change detection for ${directoryPath}:`);
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
   * Generate detailed change information (compatible with existing DirectoryAnalysisManager)
   * @param directoryPath The directory being analyzed
   * @param currentFiles Current files from filesystem with their hashes
   * @param previousFiles Previous files with their hashes
   * @returns Array of detailed change information
   */
  static generateChangeInfo(
    directoryPath: string,
    currentFiles: FileWithHash[],
    previousFiles: FileWithHash[]
  ): FileChangeInfo[] {
    const changes: FileChangeInfo[] = [];
    const previousFileMap = new Map<string, FileWithHash>();
    for (const file of previousFiles) {
      previousFileMap.set(file.relativePath, file);
    }
    
    const currentFileMap = new Map<string, FileWithHash>();
    for (const file of currentFiles) {
      currentFileMap.set(file.relativePath, file);
    }
    
    // Check for new and modified files
    for (const currentFile of currentFiles) {
      const previousFile = previousFileMap.get(currentFile.relativePath);
      
      if (!previousFile) {
        // New file
        changes.push({
          filePath: currentFile.filePath,
          relativePath: currentFile.relativePath,
          changeType: 'added',
          currentHash: currentFile.fileHash
        });
      } else if (previousFile.fileHash !== currentFile.fileHash) {
        // Modified file
        changes.push({
          filePath: currentFile.filePath,
          relativePath: currentFile.relativePath,
          changeType: 'modified',
          previousHash: previousFile.fileHash,
          currentHash: currentFile.fileHash
        });
      } else {
        // Unchanged file
        changes.push({
          filePath: currentFile.filePath,
          relativePath: currentFile.relativePath,
          changeType: 'unchanged',
          previousHash: previousFile.fileHash,
          currentHash: currentFile.fileHash
        });
      }
    }
    
    // Check for deleted files
    for (const previousFile of previousFiles) {
      if (!currentFileMap.has(previousFile.relativePath)) {
        changes.push({
          filePath: previousFile.filePath,
          relativePath: previousFile.relativePath,
          changeType: 'deleted',
          previousHash: previousFile.fileHash
        });
      }
    }
    
    return changes;
  }
  
  /**
   * Calculate hash for a single file (async version)
   * @param filePath Full path to file
   * @returns File hash as hex string
   */
  static async calculateFileHashAsync(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const crypto = await import('crypto');
      const hash = crypto.createHash('sha256');
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
    }
  }
  
  /**
   * Create FileWithHash from file path
   * @param filePath Full path to file
   * @param basePath Base directory path to calculate relative path
   * @returns FileWithHash object
   */
  static async createFileWithHash(filePath: string, basePath: string): Promise<FileWithHash> {
    const relativePath = path.relative(basePath, filePath);
    const fileHash = await this.calculateFileHashAsync(filePath);
    
    return {
      relativePath,
      filePath,
      fileHash
    };
  }
  
  /**
   * Convert from DirectoryAnalysisResult FileMetrics to FileWithHash format
   * @param fileMetrics Array of FileMetrics from previous analysis
   * @returns Array of FileWithHash
   */
  static convertFromFileMetrics(fileMetrics: any[]): FileWithHash[] {
    return fileMetrics.map(file => ({
      relativePath: file.relativePath,
      filePath: file.filePath,
      fileHash: file.fileHash
    }));
  }
  
  /**
   * Check if a file should be analyzed based on extension
   * @param fileName File name to check
   * @returns True if file should be analyzed
   */
  static shouldAnalyzeFile(fileName: string): boolean {
    // Use the same supported language detection as the main analysis engine
    return isSupportedLanguage(fileName);
  }
  
  /**
   * Check if a directory should be ignored
   * @param dirName Directory name to check
   * @returns True if directory should be ignored
   */
  static shouldIgnoreDirectory(dirName: string): boolean {
    const ignoredDirs = [
      '.git', '.svn', '.hg',                  // Version control
      'node_modules', '__pycache__', '.venv', // Dependencies/build
      '.idea', '.vscode',                     // IDE directories
      'build', 'dist', 'target', 'bin',      // Build outputs
      '.DS_Store'                             // System files
    ];
    
    return dirName.startsWith('.') || ignoredDirs.includes(dirName);
  }
  
  /**
   * Get list of analyzable files in directory with their hashes
   * @param directoryPath Directory to scan
   * @param includeSubdirectories Whether to include subdirectories
   * @returns Array of FileWithHash
   */
  static async getCurrentFileListWithHashes(
    directoryPath: string,
    includeSubdirectories: boolean = false
  ): Promise<FileWithHash[]> {
    const files: FileWithHash[] = [];
    
    const scanDirectory = async (currentPath: string, relativePath: string = '') => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          const entryRelativePath = path.join(relativePath, entry.name);
          
          if (entry.isFile()) {
            // Check if file should be analyzed
            if (this.shouldAnalyzeFile(entry.name)) {
              const fileWithHash = await this.createFileWithHash(entryPath, directoryPath);
              files.push(fileWithHash);
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
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath)); // Sort for consistent ordering
  }
}
