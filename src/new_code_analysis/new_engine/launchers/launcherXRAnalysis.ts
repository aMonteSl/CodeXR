/**
 * XR Analysis Launcher
 * Handles the launch and orchestration of XR-based analysis for both files and directories
 */

import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../core/analysisSession';

export class LauncherXRAnalysis {
    
    /**
     * Launch XR analysis for a file using session
     */
    static async launchFileXRAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Starting XR FILE analysis with session`);
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Session received:`, {
            id: session.id,
            targetName: session.targetName,
            targetPath: session.targetPath,
            targetType: session.targetType,
            analysisMode: session.analysisMode,
            isDeep: session.isDeep,
            status: session.status,
            outputPath: session.outputPath,
            hash256: session.hash256
        });
        
        try {
            // TODO: Implement file XR analysis logic
            // This will integrate with the unified session registry and XR processor
            
            vscode.window.showInformationMessage(
                `XR Analysis started for file: ${session.targetName}${session.isDeep ? ' (Deep mode)' : ''}`
            );
            
        } catch (error) {
            console.error('NEW_LAUNCHER_XR_ANALYSIS: Error launching file XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to start XR analysis: ${error}`);
        }
    }
    
    /**
     * Launch XR analysis for a directory using session
     */
    static async launchDirectoryXRAnalysis(session: UnifiedAnalysisSession, context: vscode.ExtensionContext): Promise<void> {
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Starting XR DIRECTORY analysis with session`);
        console.log(`NEW_LAUNCHER_XR_ANALYSIS: Session received:`, {
            id: session.id,
            targetName: session.targetName,
            targetPath: session.targetPath,
            targetType: session.targetType,
            analysisMode: session.analysisMode,
            isDeep: session.isDeep,
            status: session.status,
            outputPath: session.outputPath,
            hash256: session.hash256,
            metadata: session.metadata
        });
        
        try {
            // TODO: Implement directory XR analysis logic
            // This will integrate with the unified session registry and XR processor
            
            vscode.window.showInformationMessage(
                `XR Analysis started for directory: ${session.targetName}${session.isDeep ? ' (Deep mode)' : ''}`
            );
            
        } catch (error) {
            console.error('NEW_LAUNCHER_XR_ANALYSIS: Error launching directory XR analysis:', error);
            vscode.window.showErrorMessage(`Failed to start XR directory analysis: ${error}`);
        }
    }
}
