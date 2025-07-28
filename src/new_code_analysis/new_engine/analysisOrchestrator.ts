/**
 * Analysis Orchestrator
 * Central coordinator for all analysis operations in the new engine
 */

import * as vscode from 'vscode';
import { LauncherLivePanel } from './launchers/launcherLivePanel';
import { LauncherXRAnalysis } from './launchers/launcherXRAnalysis';
import { LauncherVisualizeDOM } from './launchers/launcherVisualizeDOM';
import { UnifiedSessionRegistry } from './core/sessionRegistry';
import { UnifiedAnalysisSession } from './core/analysisSession';

export type AnalysisMode = 'LivePanel' | 'XR' | 'VisualizeDOM';
export type TargetType = 'file' | 'directory';

export class AnalysisOrchestrator {
    
    /**
     * Orchestrate analysis based on mode, target type and depth
     */
    static async orchestrateAnalysis(
        targetPath: string,
        analysisMode: AnalysisMode,
        targetType: TargetType,
        context: vscode.ExtensionContext,
        isDeep: boolean = false
    ): Promise<void> {
        console.log(`ANALYSIS_ORCHESTRATOR: Orchestrating ${analysisMode} analysis for ${targetType}: ${targetPath} (deep: ${isDeep})`);
        
        try {
            // Create unified session first - CENTRALIZED SESSION CREATION
            const registry = UnifiedSessionRegistry.getInstance(context);
            let session: UnifiedAnalysisSession | null;
            
            try {
                console.log(`ANALYSIS_ORCHESTRATOR: 🔍 DEBUG - Creating session with parameters:`, {
                    targetPath,
                    targetType,
                    analysisMode,
                    isDeep
                });
                
                session = await registry.createSession({
                    targetPath,
                    targetType,
                    analysisMode,
                    isDeep,
                    context
                });
                
                // Check if session creation was skipped due to duplicate
                if (!session) {
                    console.log(`ANALYSIS_ORCHESTRATOR: Session creation skipped (duplicate detected) - stopping orchestration`);
                    return; // Stop here if duplicate was detected
                }
                
            } catch (sessionError) {
                // Handle session creation errors (e.g., unsupported file types)
                console.error(`ANALYSIS_ORCHESTRATOR: Session creation failed:`, sessionError);
                const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError);
                vscode.window.showErrorMessage(`CodeXR Analysis Error: ${errorMessage}`);
                throw sessionError;
            }
            
            console.log(`ANALYSIS_ORCHESTRATOR: Created session ${session.id} for ${analysisMode} analysis`);
            console.log(`ANALYSIS_ORCHESTRATOR: Session details:`, {
                id: session.id,
                targetName: session.targetName,
                targetPath: session.targetPath,
                analysisMode: session.analysisMode,
                targetType: session.targetType,
                isDeep: session.isDeep,
                status: session.status
            });
            
            // Send session to appropriate launcher
            switch (analysisMode) {
                case 'LivePanel':
                    await this.orchestrateLivePanelAnalysis(session, context);
                    break;
                    
                case 'XR':
                    await this.orchestrateXRAnalysis(session, context);
                    break;
                    
                case 'VisualizeDOM':
                    await this.orchestrateVisualizeDOMAnalysis(session, context);
                    break;
                    
                default:
                    throw new Error(`Unknown analysis mode: ${analysisMode}`);
            }
            
        } catch (error) {
            console.error('ANALYSIS_ORCHESTRATOR: Error orchestrating analysis:', error);
            throw error;
        }
    }
    
    /**
     * Orchestrate Live Panel analysis with session
     */
    private static async orchestrateLivePanelAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        switch (session.targetType) {
            case 'file':
                console.log('ANALYSIS_ORCHESTRATOR: Launching Live Panel analysis for file:', session.targetPath);
                await LauncherLivePanel.launchFileLivePanelAnalysis(session, context);
                break;
                
            case 'directory':
                console.log('ANALYSIS_ORCHESTRATOR: Launching Live Panel analysis for directory:', session.targetPath);
                await LauncherLivePanel.launchDirectoryLivePanelAnalysis(session, context);
                break;
                
            default:
                throw new Error(`Unknown target type: ${session.targetType}`);
        }
    }
    
    /**
     * Orchestrate XR analysis with session
     */
    private static async orchestrateXRAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        switch (session.targetType) {
            case 'file':
                await LauncherXRAnalysis.launchFileXRAnalysis(session, context);
                break;
                
            case 'directory':
                await LauncherXRAnalysis.launchDirectoryXRAnalysis(session, context);
                break;
                
            default:
                throw new Error(`Unknown target type: ${session.targetType}`);
        }
    }
    
    /**
     * Orchestrate VisualizeDOM analysis with session
     */
    private static async orchestrateVisualizeDOMAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        // VisualizeDOM only supports files (HTML files specifically)
        if (session.targetType !== 'file') {
            throw new Error(`VisualizeDOM analysis only supports files, not ${session.targetType}`);
        }
        
        console.log('ANALYSIS_ORCHESTRATOR: Launching VisualizeDOM analysis for file:', session.targetPath);
        await LauncherVisualizeDOM.launchVisualizeDOMAnalysis(session, context);
    }
    
    /**
     * Get analysis type identifier for the given parameters
     */
    static getAnalysisTypeId(analysisMode: AnalysisMode, targetType: TargetType, isDeep: boolean): string {
        const modePrefix = analysisMode === 'LivePanel' ? 'LP' : 
                          analysisMode === 'XR' ? 'XR' : 
                          analysisMode === 'VisualizeDOM' ? 'DOM' : 'UNKNOWN';
        const targetPrefix = targetType === 'file' ? 'File' : 'Dir';
        const depthSuffix = isDeep ? 'Deep' : '';
        
        return `${modePrefix}_${targetPrefix}${depthSuffix}`;
    }
}
