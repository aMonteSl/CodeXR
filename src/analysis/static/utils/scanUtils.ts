import * as fs from 'fs';
import * as path from 'path';
import { getLanguageName, isSupportedLanguage } from '../../../utils/languageUtils';
import { calculateFileHash } from '../../../utils/hash';

/**
 * Directories that should always be excluded from analysis
 */
export const EXCLUDED_DIRECTORIES = [
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  'dist',
  'build',
  'out',
  'coverage',
  '.coverage',
  '.next',
  '.nuxt',
  'target',
  'bin',
  'obj',
  '.mvn',
  '.gradle',
  'vendor',
  'Pods',
  '.vs',
  '.vscode',
  '.idea',
  '.DS_Store',
  'Thumbs.db'
];

/**
 * Checks if a directory or file path should be excluded based on excluded directories
 * @param pathToCheck Full or relative path to check
 * @returns true if the path should be excluded
 */
function shouldExcludeBasedOnDirectories(pathToCheck: string): boolean {
  const pathParts = pathToCheck.split(path.sep);
  
  for (const part of pathParts) {
    if (EXCLUDED_DIRECTORIES.includes(part)) {
      console.log(`DEPURATION: Skipped excluded folder: ${part} in path: ${pathToCheck}`);
      return true;
    }
  }
  
  return false;
}

/**
 * File filters for analysis
 */
export interface AnalysisFilters {
  /** Supported file extensions (if not provided, uses default supported extensions) */
  extensions?: string[];
  
  /** Maximum directory depth to scan */
  maxDepth?: number;
  
  /** Patterns to exclude (glob-style) */
  excludePatterns?: string[];
  
  /** Maximum file size in bytes (default: 1MB) */
  maxFileSize?: number;
}

/**
 * Default analysis filters
 */
export const DEFAULT_FILTERS: AnalysisFilters = {
  maxDepth: 10,
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/.git/**',
    '**/coverage/**',
    '**/.coverage/**',
    '**/__pycache__/**',
    '**/.pytest_cache/**',
    '**/.venv/**',
    '**/venv/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/target/**',
    '**/bin/**',
    '**/obj/**',
    '**/.mvn/**',
    '**/.gradle/**',
    '**/vendor/**',
    '**/Pods/**',
    '**/.vs/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/.DS_Store',
    '**/Thumbs.db'
  ],
  maxFileSize: 1024 * 1024 // 1MB
};

/**
 * File information for analysis
 */
export interface FileInfo {
  filePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  language: string;
  sizeBytes: number;
  hash: string;
}

/**
 * Scans a directory for supported files
 * @param directoryPath Path to directory to scan
 * @param filters Analysis filters
 * @returns Array of file information
 */
/**
 * Scans a directory for supported files (immediate children only)
 * @param directoryPath Path to directory to scan
 * @param filters Analysis filters
 * @returns Array of file information
 */
/**
 * Interface for directory scan results
 */
export interface DirectoryScanResult {
  /** Files that can be analyzed */
  analyzableFiles: FileInfo[];
  /** Total number of files in directory */
  totalFiles: number;
  /** Number of files that can be analyzed */
  totalAnalyzableFiles: number;
  /** Number of files that cannot be analyzed */
  totalNonAnalyzableFiles: number;
}

/**
 * Checks if a path should be excluded based on patterns
 * @param relativePath Relative path to check
 * @param excludePatterns Array of glob-style patterns
 * @returns True if path should be excluded
 */
function shouldExcludePath(relativePath: string, excludePatterns: string[]): boolean {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  
  return excludePatterns.some(pattern => {
    const normalizedPattern = pattern.replace(/\*/g, '.*').replace(/\\/g, '/');
    const regex = new RegExp('^' + normalizedPattern + '$');
    return regex.test(normalizedPath);
  });
}

/**
 * Scans a directory for files, returning both analyzable and total counts
 * @param directoryPath Directory to scan
 * @param filters Analysis filters
 * @returns Scan results with file counts
 */
export async function scanDirectoryWithCounts(
  directoryPath: string, 
  filters: AnalysisFilters = DEFAULT_FILTERS
): Promise<DirectoryScanResult> {
  const analyzableFiles: FileInfo[] = [];
  let totalFiles = 0;
  
  // Use recursive scan based on maxDepth
  const maxDepth = filters.maxDepth || 10;
  
  console.log(`🔍 scanDirectoryWithCounts: directoryPath=${directoryPath}, maxDepth=${maxDepth}`);
  
  if (maxDepth === 1) {
    // Shallow scan (original behavior)
    console.log(`📁 Using SHALLOW scan (maxDepth=1)`);
    return await scanDirectoryShallow(directoryPath, filters);
  } else {
    // Deep recursive scan
    console.log(`🏗️ Using RECURSIVE scan (maxDepth=${maxDepth})`);
    return await scanDirectoryRecursive(directoryPath, filters);
  }
}

/**
 * Shallow scan - only immediate children (original behavior)
 */
async function scanDirectoryShallow(
  directoryPath: string, 
  filters: AnalysisFilters
): Promise<DirectoryScanResult> {
  const analyzableFiles: FileInfo[] = [];
  let totalFiles = 0;
  
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      
      // Check if this path should be excluded based on directory names
      if (shouldExcludeBasedOnDirectories(fullPath)) {
        continue;
      }
      
      // Only process files, not directories (immediate children only)
      if (!entry.isFile()) {
        continue;
      }
      
      totalFiles++;
      const relativePath = entry.name; // Just the filename for immediate children
      
      // Check if file type is supported
      if (!isSupportedLanguage(fullPath)) {
        continue;
      }
      
      // Check file size
      try {
        const stats = await fs.promises.stat(fullPath);
        if (filters.maxFileSize && stats.size > filters.maxFileSize) {
          continue;
        }
        
        // Calculate file hash
        const hash = calculateFileHash(fullPath);
        
        analyzableFiles.push({
          filePath: fullPath,
          relativePath,
          fileName: entry.name,
          extension: path.extname(entry.name),
          language: getLanguageName(fullPath),
          sizeBytes: stats.size,
          hash
        });
      } catch (error) {
        console.warn(`Failed to process file ${fullPath}:`, error);
      }
    }
  } catch (error) {
    throw new Error(`Failed to scan directory ${directoryPath}: ${error}`);
  }
  
  return {
    analyzableFiles,
    totalFiles,
    totalAnalyzableFiles: analyzableFiles.length,
    totalNonAnalyzableFiles: totalFiles - analyzableFiles.length
  };
}

/**
 * Recursive scan - scans all subdirectories up to maxDepth
 */
async function scanDirectoryRecursive(
  directoryPath: string, 
  filters: AnalysisFilters,
  currentDepth: number = 0,
  basePath: string = directoryPath
): Promise<DirectoryScanResult> {
  const analyzableFiles: FileInfo[] = [];
  let totalFiles = 0;
  
  const maxDepth = filters.maxDepth || 10;
  
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directoryPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      
      // Check if this path should be excluded based on directory names
      if (shouldExcludeBasedOnDirectories(fullPath)) {
        continue;
      }
      
      // Check exclude patterns (existing pattern-based exclusion)
      if (filters.excludePatterns && shouldExcludePath(relativePath, filters.excludePatterns)) {
        continue;
      }
      
      if (entry.isFile()) {
        totalFiles++;
        
        // Check if file type is supported
        if (!isSupportedLanguage(fullPath)) {
          continue;
        }
        
        // Check file size
        try {
          const stats = await fs.promises.stat(fullPath);
          if (filters.maxFileSize && stats.size > filters.maxFileSize) {
            continue;
          }
          
          // Calculate file hash
          const hash = calculateFileHash(fullPath);
          
          analyzableFiles.push({
            filePath: fullPath,
            relativePath,
            fileName: entry.name,
            extension: path.extname(entry.name),
            language: getLanguageName(fullPath),
            sizeBytes: stats.size,
            hash
          });
        } catch (error) {
          console.warn(`Failed to process file ${fullPath}:`, error);
        }
      } else if (entry.isDirectory() && currentDepth < maxDepth - 1) {
        // Recursively scan subdirectory
        try {
          const subResult = await scanDirectoryRecursive(
            fullPath, 
            filters, 
            currentDepth + 1, 
            basePath
          );
          
          // Merge results
          analyzableFiles.push(...subResult.analyzableFiles);
          totalFiles += subResult.totalFiles;
        } catch (error) {
          console.warn(`Error scanning subdirectory ${fullPath}:`, error);
        }
      }
    }
  } catch (error) {
    throw new Error(`Failed to scan directory ${directoryPath}: ${error}`);
  }
  
  const result = {
    analyzableFiles,
    totalFiles,
    totalAnalyzableFiles: analyzableFiles.length,
    totalNonAnalyzableFiles: totalFiles - analyzableFiles.length
  };
  
  console.log(`✅ scanDirectoryRecursive result: ${result.totalAnalyzableFiles} analyzable files out of ${result.totalFiles} total`);
  
  return result;
}

export async function scanDirectory(
  directoryPath: string, 
  filters: AnalysisFilters = DEFAULT_FILTERS
): Promise<FileInfo[]> {
  const result = await scanDirectoryWithCounts(directoryPath, filters);
  return result.analyzableFiles;
}

/**
 * Creates a safe directory name from a path
 * @param directoryPath Path to convert
 * @returns Safe directory name
 */
export function createSafeDirectoryName(directoryPath: string): string {
  const dirName = path.basename(directoryPath);
  return dirName.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Formats file size in human readable format
 * @param bytes File size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Categorizes file size
 * @param bytes File size in bytes
 * @returns Size category
 */
export function categorizeFileSize(bytes: number): 'small' | 'medium' | 'large' | 'huge' {
  if (bytes < 1024) {
    return 'small';           // < 1KB
  }
  if (bytes < 10240) {
    return 'medium';         // 1KB - 10KB
  }
  if (bytes < 102400) {
    return 'large';         // 10KB - 100KB
  }
  return 'huge';                              // > 100KB
}

/**
 * Categorizes complexity
 * @param complexity Cyclomatic complexity value
 * @returns Complexity category
 */
export function categorizeComplexity(complexity: number): 'low' | 'medium' | 'high' | 'critical' {
  if (complexity <= 5) {
    return 'low';
  }
  if (complexity <= 10) {
    return 'medium';
  }
  if (complexity <= 20) {
    return 'high';
  }
  return 'critical';
}
