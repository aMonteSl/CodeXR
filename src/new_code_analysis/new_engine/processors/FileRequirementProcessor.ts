import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { LivePanelFileRequirements } from './requirementRules/LivePanelFileRequirements';
import { LivePanelDirectoryRequirements } from './requirementRules/LivePanelDirectoryRequirements';
import { ThemeUtils } from '../utils/themeUtils';

/**
 * Interfaces simples para requerimientos
 */
export interface FileRequirement {
    filePath: string;
    fileName: string;
    fileType: 'template';
    priority: 'critical';
    extractionStrategy: 'full';
    reason: string;
}

export interface ProcessedRequirements {
    sessionId: string;
    analysisMode: string;
    targetPath: string;
    loadedFiles: Map<string, string>; // fileName -> file content
    estimatedComplexity: 'low';
    processingTime: Date;
}

/**
 * Main class for processing and determining required files for analysis
 * 
 * This class acts as the main orchestrator that:
 * - Receives session from SessionRegistry
 * - Delegates to specific processors based on analysis mode and target type
 * - Returns necessary files without processing them (only paths and metadata)
 */
export class FileRequirementProcessor {
    private livePanelFileRequirements: LivePanelFileRequirements;
    private livePanelDirectoryRequirements: LivePanelDirectoryRequirements;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('FILE_REQUIREMENT_PROCESSOR: Initializing FileRequirementProcessor...');
        this.context = context;
        this.livePanelFileRequirements = new LivePanelFileRequirements(context);
        this.livePanelDirectoryRequirements = new LivePanelDirectoryRequirements(context);
        
        // Initialize ThemeUtils with extension context
        ThemeUtils.initialize(context);
        console.log('FILE_REQUIREMENT_PROCESSOR: ThemeUtils initialized');
    }

    /**
     * MAIN FUNCTION: Process file requirements for a session
     * 
     * @param session - Unified analysis session
     * @param theme - Current user theme (optional, defaults to 'vscode-light')
     * @returns Promise with required files (paths and metadata only)
     */
    public async processRequirements(session: UnifiedAnalysisSession, theme?: string): Promise<ProcessedRequirements> {
        console.log(`FILE_REQUIREMENT_PROCESSOR: 🚀 Processing requirements for session ${session.id}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Analysis mode: ${session.analysisMode}, Target type: ${session.targetType}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Target path: ${session.targetPath}`);
        console.log(`FILE_REQUIREMENT_PROCESSOR: Theme: ${theme || 'default'}`);

        try {
            let requirements: ProcessedRequirements;

            // Determine which processor to use based on analysis mode and target type
            switch (session.analysisMode) {
                case 'LivePanel':
                    if (session.targetType === 'file') {
                        console.log(`FILE_REQUIREMENT_PROCESSOR: Delegating to LivePanelFileRequirements...`);
                        requirements = await this.livePanelFileRequirements.getRequiredFiles(session, theme);
                    } else if (session.targetType === 'directory') {
                        console.log(`FILE_REQUIREMENT_PROCESSOR: Delegating to LivePanelDirectoryRequirements...`);
                        requirements = await this.livePanelDirectoryRequirements.getRequiredFiles(session, theme);
                    } else {
                        throw new Error(`Unknown target type for LivePanel: ${session.targetType}`);
                    }
                    break;
                
                case 'XR':
                    console.log(`FILE_REQUIREMENT_PROCESSOR: XR analysis not implemented yet`);
                    throw new Error('XR analysis file requirements not implemented yet');
                
                default:
                    throw new Error(`Unknown analysis mode: ${session.analysisMode}`);
            }

            console.log(`FILE_REQUIREMENT_PROCESSOR: ✅ Requirements processed successfully for session ${session.id}`);
            console.log(`FILE_REQUIREMENT_PROCESSOR: Total files loaded: ${requirements.loadedFiles.size}`);
            console.log(`FILE_REQUIREMENT_PROCESSOR: Estimated complexity: ${requirements.estimatedComplexity}`);

            return requirements;

        } catch (error) {
            console.error(`FILE_REQUIREMENT_PROCESSOR: ❌ Error processing requirements for session ${session.id}:`, error);
            throw error;
        }
    }
}


