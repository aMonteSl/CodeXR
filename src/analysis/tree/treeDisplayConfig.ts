import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Enhanced configuration for tree display behavior
 */
export interface TreeDisplayConfig {
  /** Maximum number of files to show per language group */
  maxFilesPerLanguage: number;
  /** Language sorting method */
  languageSortMethod: LanguageSortMethod;
  /** Language sorting direction */
  languageSortDirection: SortDirection;
  /** File sorting method */
  fileSortMethod: FileSortMethod;
  /** File sorting direction */
  fileSortDirection: SortDirection;
}

/**
 * Available language sorting methods
 */
export enum LanguageSortMethod {
  ALPHABETICAL = 'alphabetical',
  FILE_COUNT = 'fileCount'
}

/**
 * Available file sorting methods
 */
export enum FileSortMethod {
  ALPHABETICAL = 'alphabetical',
  FILE_SIZE = 'fileSize',
  MODIFICATION_DATE = 'modificationDate',
  FILE_EXTENSION = 'fileExtension'
}

/**
 * Sort direction options
 */
export enum SortDirection {
  ASCENDING = 'ascending',
  DESCENDING = 'descending'
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: TreeDisplayConfig = {
  maxFilesPerLanguage: 0, // 0 means unlimited
  languageSortMethod: LanguageSortMethod.FILE_COUNT,
  languageSortDirection: SortDirection.DESCENDING,
  fileSortMethod: FileSortMethod.ALPHABETICAL,
  fileSortDirection: SortDirection.ASCENDING
};

/**
 * Gets the current tree display configuration
 * @param context Extension context
 * @returns Current configuration
 */
export function getTreeDisplayConfig(context?: vscode.ExtensionContext): TreeDisplayConfig {
  // ✅ FIXED: Use registered configuration keys with correct prefix
  const config = vscode.workspace.getConfiguration('codexr.analysis.tree');
  
  return {
    maxFilesPerLanguage: config.get<number>('maxFilesPerLanguage', DEFAULT_CONFIG.maxFilesPerLanguage),
    languageSortMethod: config.get<LanguageSortMethod>('languageSortMethod', DEFAULT_CONFIG.languageSortMethod),
    languageSortDirection: config.get<SortDirection>('languageSortDirection', DEFAULT_CONFIG.languageSortDirection),
    fileSortMethod: config.get<FileSortMethod>('fileSortMethod', DEFAULT_CONFIG.fileSortMethod),
    fileSortDirection: config.get<SortDirection>('fileSortDirection', DEFAULT_CONFIG.fileSortDirection)
  };
}

/**
 * Updates tree display configuration
 * @param context Extension context
 * @param config New configuration values
 */
export async function updateTreeDisplayConfig(
  context: vscode.ExtensionContext, 
  config: Partial<TreeDisplayConfig>
): Promise<void> {
  // ✅ FIXED: Use registered configuration keys with correct prefix
  const vsConfig = vscode.workspace.getConfiguration('codexr.analysis.tree');
  
  if (config.maxFilesPerLanguage !== undefined) {
    await vsConfig.update('maxFilesPerLanguage', config.maxFilesPerLanguage, vscode.ConfigurationTarget.Global);
  }
  
  if (config.languageSortMethod !== undefined) {
    await vsConfig.update('languageSortMethod', config.languageSortMethod, vscode.ConfigurationTarget.Global);
  }
  
  if (config.languageSortDirection !== undefined) {
    await vsConfig.update('languageSortDirection', config.languageSortDirection, vscode.ConfigurationTarget.Global);
  }
  
  if (config.fileSortMethod !== undefined) {
    await vsConfig.update('fileSortMethod', config.fileSortMethod, vscode.ConfigurationTarget.Global);
  }
  
  if (config.fileSortDirection !== undefined) {
    await vsConfig.update('fileSortDirection', config.fileSortDirection, vscode.ConfigurationTarget.Global);
  }
}

/**
 * Enhanced language sorting function with method and direction support
 * @param filesByLanguage Map of language to files
 * @param config Display configuration
 * @returns Sorted array of [language, files] entries
 */
export function sortLanguageEntries(
  filesByLanguage: Record<string, vscode.Uri[]>,
  config: TreeDisplayConfig
): [string, vscode.Uri[]][] {
  const entries = Object.entries(filesByLanguage);
  
  // Separate "Unknown Files" from other languages
  const unknownEntries = entries.filter(([langName]) => langName === 'Unknown Files');
  const knownEntries = entries.filter(([langName]) => langName !== 'Unknown Files');
  
  let sortedKnownEntries: [string, vscode.Uri[]][];
  
  switch (config.languageSortMethod) {
    case LanguageSortMethod.ALPHABETICAL:
      sortedKnownEntries = knownEntries.sort(([langA], [langB]) => {
        const comparison = langA.localeCompare(langB);
        return config.languageSortDirection === SortDirection.ASCENDING ? comparison : -comparison;
      });
      break;
      
    case LanguageSortMethod.FILE_COUNT:
      sortedKnownEntries = knownEntries.sort(([langA, filesA], [langB, filesB]) => {
        const countDiff = filesB.length - filesA.length;
        
        if (countDiff !== 0) {
          return config.languageSortDirection === SortDirection.DESCENDING ? countDiff : -countDiff;
        }
        
        // If counts are equal, sort alphabetically as secondary sort
        return langA.localeCompare(langB);
      });
      break;
      
    default:
      sortedKnownEntries = knownEntries;
  }
  
  // Always append "Unknown Files" at the end
  return [...sortedKnownEntries, ...unknownEntries];
}

/**
 * Enhanced file sorting and limiting with multiple methods and directions
 * @param files Array of file URIs
 * @param config Display configuration
 * @returns Limited and sorted array of files
 */
export function limitAndSortFiles(
  files: vscode.Uri[],
  config: TreeDisplayConfig
): vscode.Uri[] {
  let sortedFiles = [...files];
  
  switch (config.fileSortMethod) {
    case FileSortMethod.ALPHABETICAL:
      sortedFiles.sort((a, b) => {
        const nameA = path.basename(a.fsPath);
        const nameB = path.basename(b.fsPath);
        const comparison = nameA.localeCompare(nameB);
        return config.fileSortDirection === SortDirection.ASCENDING ? comparison : -comparison;
      });
      break;
      
    case FileSortMethod.FILE_SIZE:
      sortedFiles.sort((a, b) => {
        try {
          const fs = require('fs');
          const sizeA = fs.statSync(a.fsPath).size;
          const sizeB = fs.statSync(b.fsPath).size;
          const comparison = sizeA - sizeB;
          return config.fileSortDirection === SortDirection.ASCENDING ? comparison : -comparison;
        } catch (error) {
          // If we can't read file sizes, fall back to alphabetical
          const nameA = path.basename(a.fsPath);
          const nameB = path.basename(b.fsPath);
          return nameA.localeCompare(nameB);
        }
      });
      break;
      
    case FileSortMethod.MODIFICATION_DATE:
      sortedFiles.sort((a, b) => {
        try {
          const fs = require('fs');
          const mtimeA = fs.statSync(a.fsPath).mtime.getTime();
          const mtimeB = fs.statSync(b.fsPath).mtime.getTime();
          const comparison = mtimeA - mtimeB;
          return config.fileSortDirection === SortDirection.ASCENDING ? comparison : -comparison;
        } catch (error) {
          // If we can't read modification times, fall back to alphabetical
          const nameA = path.basename(a.fsPath);
          const nameB = path.basename(b.fsPath);
          return nameA.localeCompare(nameB);
        }
      });
      break;
      
    case FileSortMethod.FILE_EXTENSION:
      sortedFiles.sort((a, b) => {
        const extA = path.extname(a.fsPath).toLowerCase();
        const extB = path.extname(b.fsPath).toLowerCase();
        
        if (extA !== extB) {
          const comparison = extA.localeCompare(extB);
          return config.fileSortDirection === SortDirection.ASCENDING ? comparison : -comparison;
        }
        
        // If extensions are the same, sort by filename as secondary sort
        const nameA = path.basename(a.fsPath, extA);
        const nameB = path.basename(b.fsPath, extB);
        return nameA.localeCompare(nameB);
      });
      break;
      
    default:
      // No sorting, keep original order
      break;
  }
  
  // Limit the number of files
  if (config.maxFilesPerLanguage > 0 && sortedFiles.length > config.maxFilesPerLanguage) {
    return sortedFiles.slice(0, config.maxFilesPerLanguage);
  }
  
  return sortedFiles;
}

/**
 * Gets user-friendly display text for sort methods and directions
 */
export function getSortMethodDisplayText(method: LanguageSortMethod | FileSortMethod, direction: SortDirection): string {
  let methodText: string;
  
  switch (method) {
    case LanguageSortMethod.ALPHABETICAL:
    case FileSortMethod.ALPHABETICAL:
      methodText = 'Alphabetical';
      break;
    case LanguageSortMethod.FILE_COUNT:
      methodText = 'File Count';
      break;
    case FileSortMethod.FILE_SIZE:
      methodText = 'File Size';
      break;
    case FileSortMethod.MODIFICATION_DATE:
      methodText = 'Last Modified';
      break;
    case FileSortMethod.FILE_EXTENSION:
      methodText = 'File Extension';
      break;
    default:
      methodText = 'Unknown';
  }
  
  const directionText = direction === SortDirection.ASCENDING ? '↑' : '↓';
  return `${methodText} ${directionText}`;
}

/**
 * Gets all available sort options for QuickPick
 */
export function getLanguageSortOptions(): Array<{label: string, method: LanguageSortMethod, direction: SortDirection}> {
  return [
    { label: 'Alphabetical ↑ (A-Z)', method: LanguageSortMethod.ALPHABETICAL, direction: SortDirection.ASCENDING },
    { label: 'Alphabetical ↓ (Z-A)', method: LanguageSortMethod.ALPHABETICAL, direction: SortDirection.DESCENDING },
    { label: 'File Count ↑ (Less first)', method: LanguageSortMethod.FILE_COUNT, direction: SortDirection.ASCENDING },
    { label: 'File Count ↓ (More first)', method: LanguageSortMethod.FILE_COUNT, direction: SortDirection.DESCENDING }
  ];
}

/**
 * Gets all available file sort options for QuickPick
 */
export function getFileSortOptions(): Array<{label: string, method: FileSortMethod, direction: SortDirection}> {
  return [
    { label: 'Alphabetical ↑ (A-Z)', method: FileSortMethod.ALPHABETICAL, direction: SortDirection.ASCENDING },
    { label: 'Alphabetical ↓ (Z-A)', method: FileSortMethod.ALPHABETICAL, direction: SortDirection.DESCENDING },
    { label: 'File Size ↑ (Smaller first)', method: FileSortMethod.FILE_SIZE, direction: SortDirection.ASCENDING },
    { label: 'File Size ↓ (Larger first)', method: FileSortMethod.FILE_SIZE, direction: SortDirection.DESCENDING },
    { label: 'Last Modified ↑ (Older first)', method: FileSortMethod.MODIFICATION_DATE, direction: SortDirection.ASCENDING },
    { label: 'Last Modified ↓ (Newer first)', method: FileSortMethod.MODIFICATION_DATE, direction: SortDirection.DESCENDING },
    { label: 'File Extension ↑ (A-Z)', method: FileSortMethod.FILE_EXTENSION, direction: SortDirection.ASCENDING },
    { label: 'File Extension ↓ (Z-A)', method: FileSortMethod.FILE_EXTENSION, direction: SortDirection.DESCENDING }
  ];
}