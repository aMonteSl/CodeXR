import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../../core/analysisSession';
import { ProcessedRequirements } from '../FileRequirementProcessor';
import { FileLivePanelParser } from '../../parsers/fileLivePanelParser';
import { ExecutePython } from '../../utils/executePython';

/**
 * Handles template files for LivePanel analysis
 * 
 * This class:
 * - Determines which templates are needed based on analysis type
 * - Calls FileLivePanelParser to load actual files
 * - Returns loaded files, not just paths
 */
export class LivePanelFileRequirements {
    private fileLivePanelParser: FileLivePanelParser;
    private executePython: ExecutePython;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('LIVEPANEL_FILE_REQUIREMENTS: Initializing LivePanelFileRequirements...');
        this.context = context;
        this.fileLivePanelParser = new FileLivePanelParser();
        this.executePython = new ExecutePython(context);
    }

    /**
     * Gets loaded template files for LivePanel analysis
     * 
     * @param session - Unified analysis session
     * @param theme - Current user theme (optional, defaults to 'vscode-light')
     * @returns Promise with loaded template files
     */
    public async getRequiredFiles(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`LIVEPANEL_FILE_REQUIREMENTS: 🎯 Getting template files for LivePanel analysis`);
        console.log(`LIVEPANEL_FILE_REQUIREMENTS: Target type: ${session.targetType}`);
        console.log(`LIVEPANEL_FILE_REQUIREMENTS: Theme: ${theme || 'default'}`);

        try {
            // STEP 1: Load template files
            console.log(`LIVEPANEL_FILE_REQUIREMENTS: 📁 Step 1 - Loading template files...`);
            const loadedFiles = await this.fileLivePanelParser.loadTemplateFiles(session.targetType, session.analysisMode, theme);
            
            // STEP 2: Execute Python analysis to get data.json
            console.log(`LIVEPANEL_FILE_REQUIREMENTS: 🐍 Step 2 - Executing Python analysis...`);
            
            if (session.analysisMode === 'LivePanel' && session.targetType === 'file') {
                console.log(`LIVEPANEL_FILE_REQUIREMENTS: 📄 Executing file analysis and generating data.json`);
                const analysisData = await this.executePython.executeAnalysis(session);
                
                console.log(`LIVEPANEL_FILE_REQUIREMENTS: ✅ Python analysis completed successfully!`);
                console.log(`LIVEPANEL_FILE_REQUIREMENTS: 📊 Generated data.json:`, JSON.stringify(analysisData, null, 2));
                
                // Convert analysisData to JSON string and add to loadedFiles as data.json
                const dataJsonContent = JSON.stringify(analysisData, null, 2);
                loadedFiles.set('data.json', dataJsonContent);
                
                console.log(`LIVEPANEL_FILE_REQUIREMENTS: ✅ Added data.json to template files (${dataJsonContent.length} characters)`);
                
            } else {
                console.log(`LIVEPANEL_FILE_REQUIREMENTS: ⏭️ Skipping Python analysis for ${session.analysisMode}/${session.targetType}`);
            }
            
            const requirements: ProcessedRequirements = {
                sessionId: session.id,
                analysisMode: session.analysisMode,
                targetPath: session.targetPath,
                loadedFiles: loadedFiles,
                estimatedComplexity: 'low',
                processingTime: new Date()
            };

            console.log(`LIVEPANEL_FILE_REQUIREMENTS: ✅ Loaded ${loadedFiles.size} template files (including data.json)`);
            console.log(`LIVEPANEL_FILE_REQUIREMENTS: 📋 Files prepared:`, Array.from(loadedFiles.keys()));
            
            return requirements;

        } catch (error) {
            console.error(`LIVEPANEL_FILE_REQUIREMENTS: ❌ Error loading template files:`, error);
            throw error;
        }
    }
}
