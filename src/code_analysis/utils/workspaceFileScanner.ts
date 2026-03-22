/**
 * Workspace File Scanner
 * Scans workspace for files and groups them by programming language
 */

import * as vscode from 'vscode';
import { getLanguageForFile, LanguageInfo } from '../../utils/languageMetadata';
import { CodeXRLogger } from '../../core/logging/logger';

const logger = CodeXRLogger.getLogger('WORKSPACE_FILE_SCANNER');

export interface FilesByLanguage {
    [languageName: string]: {
        language: LanguageInfo;
        files: string[];
    };
}

export interface WorkspaceFilesSummary {
    supportedFiles: FilesByLanguage;
    unsupportedFiles: string[];
    totalLanguages: number;
    totalFiles: number;
}

export class WorkspaceFileScanner {
    /**
     * Scan workspace for all files and group by programming language.
     */
    static async scanWorkspaceFiles(): Promise<WorkspaceFilesSummary> {
        const supportedFiles: FilesByLanguage = {};
        const unsupportedFiles: string[] = [];

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                return {
                    supportedFiles,
                    unsupportedFiles,
                    totalLanguages: 0,
                    totalFiles: 0,
                };
            }

            const excludePatterns = [
                '**/node_modules/**',
                '**/.*/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                '**/out/**',
                '**/coverage/**',
                '**/.vscode/**',
                '**/target/**',
                '**/__pycache__/**',
                '**/*.pyc',
                '**/*.pyo',
                '**/*.min.js',
                '**/*.min.css',
                '**/package-lock.json',
                '**/yarn.lock',
                '**/Cargo.lock',
                '**/Gemfile.lock',
            ];

            for (const folder of workspaceFolders) {
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*'),
                    `{${excludePatterns.join(',')}}`,
                    10000,
                );

                for (const fileUri of files) {
                    try {
                        const stat = await vscode.workspace.fs.stat(fileUri);
                        if (stat.type === vscode.FileType.Directory) {
                            continue;
                        }
                    } catch {
                        continue;
                    }

                    const filePath = fileUri.fsPath;
                    const relativePath = vscode.workspace.asRelativePath(fileUri);
                    const languageInfo = getLanguageForFile(filePath);

                    if (languageInfo) {
                        if (!supportedFiles[languageInfo.name]) {
                            supportedFiles[languageInfo.name] = {
                                language: languageInfo,
                                files: [],
                            };
                        }
                        supportedFiles[languageInfo.name].files.push(relativePath);
                    } else {
                        unsupportedFiles.push(relativePath);
                    }
                }
            }

            Object.values(supportedFiles).forEach((languageGroup) => {
                languageGroup.files.sort();
            });
            unsupportedFiles.sort();

            const totalLanguages = Object.keys(supportedFiles).length;
            const totalFiles = Object.values(supportedFiles).reduce((sum, group) => sum + group.files.length, 0) + unsupportedFiles.length;

            return {
                supportedFiles,
                unsupportedFiles,
                totalLanguages,
                totalFiles,
            };
        } catch (error) {
            logger.warn('Workspace file scan failed.', error);
            return {
                supportedFiles,
                unsupportedFiles,
                totalLanguages: 0,
                totalFiles: 0,
            };
        }
    }

    /**
     * Get icon URI for a programming language.
     */
    static getLanguageIconUri(context: vscode.ExtensionContext, languageName: string): vscode.Uri {
        const iconMapping: { [key: string]: string } = {
            'Python': 'python.svg',
            'JavaScript': 'javascript.svg',
            'TypeScript': 'typescript.svg',
            'Java': 'java.svg',
            'C': 'c.svg',
            'C++': 'cplusplus.svg',
            'C#': 'csharp.svg',
            'Go': 'go.svg',
            'Ruby': 'ruby.svg',
            'PHP': 'php.svg',
            'Swift': 'swift.svg',
            'Kotlin': 'kotlin.svg',
            'Scala': 'scala.svg',
            'Lua': 'lua.svg',
            'Perl': 'perl.svg',
            'Erlang': 'erlang.svg',
            'Fortran': 'fortran.svg',
            'Objective-C': 'objectivec.svg',
            'Solidity': 'solidity.svg',
            'TTCN-3': 'ttcn3.svg',
            'Vue': 'vuejs.svg',
            'Zig': 'zig.svg',
            'HTML': 'html5.svg',
            'GDScript': 'godot.svg',
        };

        const iconFileName = iconMapping[languageName] || 'default.svg';
        return vscode.Uri.joinPath(context.extensionUri, 'resources', 'languages_icons', 'color', iconFileName);
    }
}
