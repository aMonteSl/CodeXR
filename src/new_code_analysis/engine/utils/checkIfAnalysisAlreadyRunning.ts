/**
 * Check If Analysis Already Running
 * Utility to prevent duplicate analysis sessions for the same file and type
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AnalysisSessionRegistry, AnalysisType } from '../registry/analysisSessionRegistry';

export interface AnalysisConflictResult {
    canRun: boolean;
    conflictingSessions: string[]; // Session IDs that conflict
    warningMessage?: string;
}

export class CheckIfAnalysisAlreadyRunning {

    /**
     * Check if analysis can be started for given file and type
     * Returns conflict information and whether the analysis can proceed
     */
    static checkAnalysisConflict(
        filePath: string, 
        analysisType: AnalysisType
    ): AnalysisConflictResult {
        try {
            console.log(`CHECK_ANALYSIS: Checking conflicts for ${analysisType} analysis of: ${filePath}`);
            
            const registry = AnalysisSessionRegistry.getInstance();
            const fileName = path.basename(filePath);
            
            // Get all active sessions (creating or analyzing status)
            const activeSessions = registry.getActiveSessions();
            console.log(`CHECK_ANALYSIS: Found ${activeSessions.length} active sessions to check`);
            
            // Find conflicting sessions for the same file and analysis type
            const conflictingSessions: string[] = [];
            
            for (const session of activeSessions) {
                // Check if it's the same file and same analysis type
                if (session.filePath === filePath && session.analysisType === analysisType) {
                    conflictingSessions.push(session.id);
                    console.log(`CHECK_ANALYSIS: Found conflicting session ${session.id} - ${session.analysisType} for ${path.basename(session.filePath)}`);
                }
            }
            
            // Determine if analysis can run
            const canRun = conflictingSessions.length === 0;
            
            // Generate warning message if conflicts found
            let warningMessage: string | undefined;
            if (!canRun) {
                const sessionWord = conflictingSessions.length === 1 ? 'session' : 'sessions';
                warningMessage = `${analysisType} analysis is already running for "${fileName}". Please wait for the current analysis to complete or close it first. Found ${conflictingSessions.length} conflicting ${sessionWord}.`;
            }
            
            console.log(`CHECK_ANALYSIS: Analysis ${canRun ? 'CAN' : 'CANNOT'} run - ${conflictingSessions.length} conflicts found`);
            
            return {
                canRun,
                conflictingSessions,
                warningMessage
            };
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error checking analysis conflicts:`, error);
            
            // In case of error, allow analysis to proceed but log the issue
            return {
                canRun: true,
                conflictingSessions: [],
                warningMessage: undefined
            };
        }
    }

    /**
     * Get detailed information about conflicting sessions
     */
    static getConflictingSessionsInfo(sessionIds: string[]): Array<{
        id: string;
        fileName: string;
        analysisType: AnalysisType;
        status: string;
        startTime: Date;
        progress?: number;
    }> {
        try {
            const registry = AnalysisSessionRegistry.getInstance();
            const conflictInfo = [];
            
            for (const sessionId of sessionIds) {
                const session = registry.getSession(sessionId);
                if (session) {
                    conflictInfo.push({
                        id: session.id,
                        fileName: session.fileName,
                        analysisType: session.analysisType,
                        status: session.status,
                        startTime: session.startTime,
                        progress: session.progress
                    });
                }
            }
            
            return conflictInfo;
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error getting conflicting sessions info:`, error);
            return [];
        }
    }

    /**
     * Check and show warning dialog if conflicts exist
     * Returns true if analysis should proceed, false if cancelled
     */
    static async checkAndWarnAboutConflicts(
        filePath: string,
        analysisType: AnalysisType
    ): Promise<boolean> {
        try {
            const conflictResult = this.checkAnalysisConflict(filePath, analysisType);
            
            if (conflictResult.canRun) {
                return true; // No conflicts, proceed
            }
            
            // Show warning dialog with options
            const action = await vscode.window.showWarningMessage(
                conflictResult.warningMessage!,
                { modal: true },
                'Cancel',
                'Force Start Anyway',
                'View Active Sessions'
            );
            
            if (action === 'Force Start Anyway') {
                console.log(`CHECK_ANALYSIS: User chose to force start analysis despite conflicts`);
                return true;
            } else if (action === 'View Active Sessions') {
                // Show information about conflicting sessions
                const conflictInfo = this.getConflictingSessionsInfo(conflictResult.conflictingSessions);
                let infoMessage = `Active sessions for ${path.basename(filePath)}:\n\n`;
                
                for (const info of conflictInfo) {
                    infoMessage += `• ${info.analysisType} (${info.status}) - Started: ${info.startTime.toLocaleTimeString()}`;
                    if (info.progress !== undefined) {
                        infoMessage += ` - Progress: ${info.progress}%`;
                    }
                    infoMessage += '\n';
                }
                
                await vscode.window.showInformationMessage(infoMessage, { modal: true });
                return false; // Don't proceed after showing info
            } else {
                console.log(`CHECK_ANALYSIS: User cancelled analysis due to conflicts`);
                return false; // Cancel or closed dialog
            }
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error in checkAndWarnAboutConflicts:`, error);
            // In case of error, allow analysis to proceed
            return true;
        }
    }

    /**
     * Stop conflicting sessions if user requests it
     */
    static async stopConflictingSessions(sessionIds: string[]): Promise<boolean> {
        try {
            const registry = AnalysisSessionRegistry.getInstance();
            let stoppedCount = 0;
            
            for (const sessionId of sessionIds) {
                const success = registry.closeSession(sessionId);
                if (success) {
                    stoppedCount++;
                    console.log(`CHECK_ANALYSIS: Stopped conflicting session: ${sessionId}`);
                }
            }
            
            if (stoppedCount > 0) {
                vscode.window.showInformationMessage(
                    `Stopped ${stoppedCount} conflicting analysis session${stoppedCount === 1 ? '' : 's'}.`
                );
            }
            
            return stoppedCount === sessionIds.length;
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error stopping conflicting sessions:`, error);
            return false;
        }
    }
}
