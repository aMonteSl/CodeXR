/**
 * Files by Language Sorting Utility
 * Provides sorting functionality for Files by Language section
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    FilesByLanguageSortingConfig,
    LanguageGroupSortBy,
    LanguageGroupSortDirection,
    FilesSortBy,
    FilesSortDirection
} from '../configuration/models/analysisConfiguration';
import { FilesByLanguage } from './workspaceFileScanner';

export interface LanguageGroupWithMetadata {
    languageName: string;
    files: string[];
    fileCount: number;
    language: any;
}

export class FilesByLanguageSortingUtils {

    /**
     * Sort language groups according to configuration
     */
    static sortLanguageGroups(
        filesByLanguage: FilesByLanguage,
        sortingConfig: FilesByLanguageSortingConfig
    ): LanguageGroupWithMetadata[] {
        // Convert to array with metadata
        const languageGroups: LanguageGroupWithMetadata[] = Object.entries(filesByLanguage).map(([languageName, group]) => ({
            languageName,
            files: group.files,
            fileCount: group.files.length,
            language: group.language
        }));

        // Apply primary sorting
        languageGroups.sort((a, b) => {
            const primaryResult = this.compareLanguageGroups(
                a, 
                b, 
                sortingConfig.languageGroupSortBy, 
                sortingConfig.languageGroupSortDirection
            );

            // If primary comparison is equal and there's secondary sorting
            if (primaryResult === 0 && sortingConfig.languageGroupSecondarySortBy && sortingConfig.languageGroupSecondarySortDirection) {
                return this.compareLanguageGroups(
                    a,
                    b,
                    sortingConfig.languageGroupSecondarySortBy,
                    sortingConfig.languageGroupSecondarySortDirection
                );
            }

            return primaryResult;
        });

        return languageGroups;
    }

    /**
     * Sort files within a language group according to configuration
     */
    static async sortFilesInGroup(
        files: string[],
        sortingConfig: FilesByLanguageSortingConfig
    ): Promise<string[]> {
        const sortedFiles = [...files];

        if (sortingConfig.filesSortBy === 'alphabetical') {
            // Alphabetical sorting
            sortedFiles.sort((a, b) => {
                const comparison = path.basename(a).localeCompare(path.basename(b));
                return sortingConfig.filesSortDirection === 'ascending' ? comparison : -comparison;
            });
        } else if (sortingConfig.filesSortBy === 'lastModified') {
            // Last modified sorting - need to get file stats
            const fileStats = await Promise.all(
                sortedFiles.map(async (filePath) => {
                    try {
                        // Get absolute path for workspace file
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        if (!workspaceFolder) {
                            return { filePath, mtime: 0 };
                        }
                        
                        const absolutePath = path.resolve(workspaceFolder.uri.fsPath, filePath);
                        const fileUri = vscode.Uri.file(absolutePath);
                        const stat = await vscode.workspace.fs.stat(fileUri);
                        return { filePath, mtime: stat.mtime };
                    } catch (error) {
                        console.warn(`Failed to get stat for file: ${filePath}`, error);
                        return { filePath, mtime: 0 };
                    }
                })
            );

            // Sort by modification time
            fileStats.sort((a, b) => {
                const comparison = a.mtime - b.mtime;
                return sortingConfig.filesSortDirection === 'ascending' ? comparison : -comparison;
            });

            return fileStats.map(stat => stat.filePath);
        }

        return sortedFiles;
    }

    /**
     * Compare two language groups for sorting
     */
    private static compareLanguageGroups(
        a: LanguageGroupWithMetadata,
        b: LanguageGroupWithMetadata,
        sortBy: LanguageGroupSortBy,
        direction: LanguageGroupSortDirection
    ): number {
        let comparison = 0;

        if (sortBy === 'alphabetical') {
            comparison = a.languageName.localeCompare(b.languageName);
        } else if (sortBy === 'fileCount') {
            comparison = a.fileCount - b.fileCount;
        }

        return direction === 'ascending' ? comparison : -comparison;
    }
}
