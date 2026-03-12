import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { LivePanelParser } from '../../parsers/livePanelParser';
import { ExecutePython } from '../../utils/executePython';

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
            // STEP 1: Load template files
            console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Loading template files...`);
            const loadedFiles = await this.livePanelParser.loadTemplateFiles(session.targetType, session.analysisMode, theme);
            
            // STEP 2: Execute Python analysis to get data.json
            console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Executing Python directory analysis...`);
            
            try {
                // Execute Python analysis using the unified analysis method
                const analysisResult = await this.executePython.executeAnalysis(session);
                
                if (analysisResult && analysisResult.summary) {
                    // Add the generated data.json to the loaded files
                    const dataJsonContent = JSON.stringify(analysisResult, null, 2);
                    loadedFiles.set('data.json', dataJsonContent);
                    
                    console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Python analysis completed successfully`);
                    console.log(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Analysis summary:`, {
                        totalFiles: analysisResult.summary?.totalFiles || 0,
                        analyzedFiles: analysisResult.summary?.totalFilesAnalyzed || 0,
                        notAnalyzedFiles: analysisResult.summary?.totalFilesNotAnalyzed || 0
                    });

                    // 🔥 CRITICAL FIX: Update session.filesToHash with actually analyzed files
                    // This is essential for the DirectoryWatcherOrchestrator to work properly
                    const analyzedFiles = analysisResult.files || [];
                    if (analyzedFiles.length > 0) {
                        console.log(` LIVEPANEL_DIRECTORY_REQUIREMENTS: Updating session.filesToHash with ${analyzedFiles.length} analyzed files...`);
                        const filesToHash: { filePath: string; hash: string }[] = [];
                        
                        for (const fileData of analyzedFiles) {
                            if (fileData.filePath) {
                                try {
                                    // Generate hash for the analyzed file
                                    const { SHA256Generator } = require('../../../../utils/sha256Generator');
                                    const fileHash = await SHA256Generator.generateFileHash(fileData.filePath);
                                    filesToHash.push({
                                        filePath: fileData.filePath,
                                        hash: fileHash
                                    });
                                } catch (hashError) {
                                    console.error(`LIVEPANEL_DIRECTORY_REQUIREMENTS: Error generating hash for ${fileData.filePath}:`, hashError);
                                    // Add with empty hash as fallback
                                    filesToHash.push({
                                        filePath: fileData.filePath,
                                        hash: ''
                                    });
                                }
                            }
                        }
                        
                        // Update the session with actually analyzed files
                        session.filesToHash = filesToHash;
                        console.log(` LIVEPANEL_DIRECTORY_REQUIREMENTS: Updated session.filesToHash with ${filesToHash.length} files for watchers`);
                    }
                } else {
                    console.warn(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Python analysis returned invalid data`);
                    // Add empty data.json as fallback
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
                            analysisType: "DirectoryLivePanel",
                            error: "Analysis returned invalid data"
                        }
                    };
                    loadedFiles.set('data.json', JSON.stringify(fallbackData, null, 2));
                }
                
            } catch (pythonError) {
                console.error(`LIVEPANEL_DIRECTORY_REQUIREMENTS:  Error during Python analysis:`, pythonError);
                // Add error data.json as fallback
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
                        analysisType: "DirectoryLivePanel",
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
                loadedFiles: loadedFiles,
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
