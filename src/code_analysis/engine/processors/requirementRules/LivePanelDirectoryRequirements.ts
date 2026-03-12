import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { LivePanelParser } from '../../parsers/livePanelParser';
import { ExecutePython } from '../../utils/executePython';
import { SHA256Generator } from '../../../../utils/sha256Generator';
import { buildTrackedFileSnapshot } from '../../watchers/directorySnapshot';
import { resolveTrackedSystemPath } from '../../watchers/directoryReanalysisData';

/**
 * Handles template files for LivePanel directory analysis
 *
 * This class:
 * - Determines which templates are needed based on analysis type
 * - Calls LivePanelParser to load actual files
 * - Returns loaded files, not just paths
 */
export class LivePanelDirectoryRequirements {
    private livePanelParser: LivePanelParser;
    private context: vscode.ExtensionContext;
    private executePython: ExecutePython;

    constructor(context: vscode.ExtensionContext) {
        console.log('LIVEPANEL_DIRECTORY_REQUIREMENTS: Initializing LivePanelDirectoryRequirements...');
        this.context = context;
        this.livePanelParser = new LivePanelParser();
        this.executePython = new ExecutePython(context);
    }

    /**
     * Gets loaded template files for LivePanel directory analysis
     *
     * @param session - Unified analysis session
     * @param theme - Current user theme (optional, defaults to 'vscode-light')
     * @returns Promise with loaded template files
     */
    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Getting template files for LivePanel directory analysis`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Target type: ${session.targetType}`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Analysis mode: ${session.analysisMode}`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Target path: ${session.targetPath}`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Theme: ${theme || 'default'}`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Directories to analyze: ${session.directoriesToAnalyze?.length || 0}`);
        console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Files to hash: ${session.filesToHash?.length || 0}`);

        try {
            console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Loading template files...`);
            const loadedFiles = await this.livePanelParser.loadTemplateFiles(session.targetType, session.analysisMode, theme);

            console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Executing Python directory analysis...`);

            try {
                const analysisResult = await this.executePython.executeAnalysis(session);

                if (analysisResult && analysisResult.summary) {
                    const dataJsonContent = JSON.stringify(analysisResult, null, 2);
                    loadedFiles.set('data.json', dataJsonContent);

                    console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Python analysis completed successfully`);
                    console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Analysis summary:`, {
                        totalFiles: analysisResult.summary?.totalFiles || 0,
                        analyzedFiles: analysisResult.summary?.totalFilesAnalyzed || 0,
                        notAnalyzedFiles: analysisResult.summary?.totalFilesNotAnalyzed || 0
                    });

                    const analyzedFiles = analysisResult.files || [];
                    if (analyzedFiles.length > 0) {
                        console.log(` LIVEPANEL_DIRECTORY_REQUIREMENTS: Updating session.filesToHash with ${analyzedFiles.length} analyzed files...`);
                        const filesToHash: { filePath: string; hash: string }[] = [];

                        for (const fileData of analyzedFiles) {
                            const trackedPath = resolveTrackedSystemPath(session.targetPath, fileData);
                            if (!trackedPath) {
                                console.warn(
                                    `LIVEPANEL_DIRECTORY_REQUIREMENTS: Could not resolve system path for tracked entry: ${fileData.fileName || fileData.relativePath || 'unknown'}`,
                                );
                                continue;
                            }

                            try {
                                const fileHash = await SHA256Generator.generateFileHash(trackedPath);
                                const trackedSnapshot = await buildTrackedFileSnapshot(trackedPath, fileHash);
                                filesToHash.push(trackedSnapshot ?? {
                                    filePath: trackedPath,
                                    hash: fileHash
                                });
                            } catch (hashError) {
                                console.error(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Error generating hash for ${trackedPath}:`, hashError);
                                filesToHash.push({
                                    filePath: trackedPath,
                                    hash: ''
                                });
                            }
                        }

                        session.filesToHash = filesToHash;
                        console.log(` LIVEPANEL_DIRECTORY_REQUIREMENTS: Updated session.filesToHash with ${filesToHash.length} files for watchers`);
                    }
                } else {
                    console.warn(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Python analysis returned invalid data`);
                    const fallbackData = {
                        summary: {
                            totalFiles: 0,
                            totalFilesAnalyzed: 0,
                            totalFilesNotAnalyzed: 0,
                            totalLines: 0,
                            totalLinesOfCode: 0,
                            totalComments: 0,
                            totalBlankLines: 0,
                            totalFunctions: 0,
                            totalClasses: 0,
                            averageComplexity: 0,
                            analyzedAt: new Date().toISOString(),
                            languages: {}
                        },
                        files: [],
                        metadata: {
                            analysisType: 'DirectoryLivePanel',
                            error: 'Analysis returned invalid data'
                        }
                    };
                    loadedFiles.set('data.json', JSON.stringify(fallbackData, null, 2));
                }
            } catch (pythonError) {
                console.error(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Error during Python analysis:`, pythonError);
                const errorData = {
                    summary: {
                        totalFiles: 0,
                        totalFilesAnalyzed: 0,
                        totalFilesNotAnalyzed: 0,
                        totalLines: 0,
                        totalLinesOfCode: 0,
                        totalComments: 0,
                        totalBlankLines: 0,
                        totalFunctions: 0,
                        totalClasses: 0,
                        averageComplexity: 0,
                        analyzedAt: new Date().toISOString(),
                        languages: {}
                    },
                    files: [],
                    metadata: {
                        analysisType: 'DirectoryLivePanel',
                        error: `Python execution error: ${pythonError}`
                    }
                };
                loadedFiles.set('data.json', JSON.stringify(errorData, null, 2));
            }

            console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Successfully loaded ${loadedFiles.size} template files`);

            const requirements: ProcessedRequirements = {
                sessionId: session.id,
                analysisMode: session.analysisMode,
                targetPath: session.targetPath,
                loadedFiles,
                estimatedComplexity: 'low',
                processingTime: new Date()
            };

            return requirements;
        } catch (error) {
            console.error(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Error loading template files:`, error);
            throw error;
        }
    }
}