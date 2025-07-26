import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { LivePanelFileRequirements } from './requirementRules/LivePanelFileRequirements';
import { LivePanelDirectoryRequirements } from './requirementRules/LivePanelDirectoryRequirements';
import { VisualizeDOMRequirements } from './requirementRules/VisualizeDOMRequirements';
import { XRFileRequirements } from './requirementRules/XRFileRequirements';
import { XRDirectoryRequirements } from './requirementRules/XRDirectoryRequirements';
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
    private visualizeDOMRequirements: VisualizeDOMRequirements;
    private xrFileRequirements: XRFileRequirements;
    private xrDirectoryRequirements: XRDirectoryRequirements;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        console.log('FILE_REQUIREMENT_PROCESSOR: Initializing FileRequirementProcessor...');
        this.context = context;
        this.livePanelFileRequirements = new LivePanelFileRequirements(context);
        this.livePanelDirectoryRequirements = new LivePanelDirectoryRequirements(context);
        this.visualizeDOMRequirements = new VisualizeDOMRequirements(context);
        this.xrFileRequirements = new XRFileRequirements(context);
        this.xrDirectoryRequirements = new XRDirectoryRequirements(context);
        this.xrFileRequirements = new XRFileRequirements(context);
        
        // Initialize ThemeUtils with extension context
        ThemeUtils.initialize(context);
        console.log('FILE_REQUIREMENT_PROCESSOR: ThemeUtils initialized');
        console.log('FILE_REQUIREMENT_PROCESSOR: VisualizeDOMRequirements initialized');
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
                
                case 'VisualizeDOM':
                    console.log(`FILE_REQUIREMENT_PROCESSOR: Delegating to VisualizeDOMRequirements...`);
                    requirements = await this.visualizeDOMRequirements.getRequiredFiles(session, theme);
                    break;
                
                case 'XR':
                    if (session.targetType === 'file') {
                        console.log(`FILE_REQUIREMENT_PROCESSOR: Delegating to XRFileRequirements...`);
                        requirements = await this.xrFileRequirements.getRequiredFiles(session, theme);
                    } else if (session.targetType === 'directory') {
                        console.log(`FILE_REQUIREMENT_PROCESSOR: Delegating to XRDirectoryRequirements...`);
                        const xrResult = await this.xrDirectoryRequirements.processDirectoryXRRequirements(session);
                        
                        if (!xrResult.success) {
                            throw new Error(`XR directory processing failed: ${xrResult.error}`);
                        }
                        
                        // Convert XR result to ProcessedRequirements format
                        requirements = {
                            sessionId: session.id,
                            analysisMode: session.analysisMode,
                            targetPath: session.targetPath,
                            loadedFiles: xrResult.loadedFiles,
                            estimatedComplexity: 'low' as const,
                            processingTime: new Date()
                        };
                    } else {
                        throw new Error(`Unknown target type for XR: ${session.targetType}`);
                    }
                    break;
                
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


