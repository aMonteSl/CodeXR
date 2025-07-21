/**
 * Check If Analysis Already Running
 * Utility to prevent duplicate analysis sessions for the same file and type
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { AnalysisSessionRegistry, AnalysisType } from '../registry/analysisSessionRegistry';
import { ServerWatcherIntegration } from '../../services/serverWatcherIntegration';

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
            console.log(`CHECK_ANALYSIS: ===== STARTING CONFLICT CHECK =====`);
            console.log(`CHECK_ANALYSIS: Checking conflicts for ${analysisType} analysis of: ${filePath}`);
            console.log(`CHECK_ANALYSIS: File name: ${path.basename(filePath)}`);
            
            const registry = AnalysisSessionRegistry.getInstance();
            const fileName = path.basename(filePath);
            
            // Get all sessions - check ALL sessions regardless of status for conflicts
            const allSessions = registry.getAllSessions();
            console.log(`CHECK_ANALYSIS: Found ${allSessions.length} total sessions to check for conflicts`);
            
            // Log all sessions
            console.log(`CHECK_ANALYSIS: All sessions in registry:`);
            allSessions.forEach((session, index) => {
                console.log(`CHECK_ANALYSIS: Session ${index + 1}: ID=${session.id}, fileName="${session.fileName}", analysisType="${session.analysisType}", status="${session.status}"`);
            });
            
            // Find conflicting sessions for the same file and analysis type (ANY status)
            const conflictingSessions: string[] = [];
            
            console.log(`CHECK_ANALYSIS: Starting detailed comparison for fileName="${fileName}" and analysisType="${analysisType}"...`);
            for (const session of allSessions) {
                console.log(`CHECK_ANALYSIS: -----`);
                console.log(`CHECK_ANALYSIS: Comparing session ${session.id}:`);
                console.log(`CHECK_ANALYSIS:   - Session fileName: "${session.fileName}"`);
                console.log(`CHECK_ANALYSIS:   - Target fileName: "${fileName}"`);
                console.log(`CHECK_ANALYSIS:   - fileName match: ${session.fileName === fileName}`);
                console.log(`CHECK_ANALYSIS:   - Session analysisType: "${session.analysisType}"`);
                console.log(`CHECK_ANALYSIS:   - Target analysisType: "${analysisType}"`);
                console.log(`CHECK_ANALYSIS:   - analysisType match: ${session.analysisType === analysisType}`);
                console.log(`CHECK_ANALYSIS:   - Session status: "${session.status}"`);
                
                // Theory: check if same fileName AND same analysisType
                const fileNameMatch = session.fileName === fileName;
                const analysisTypeMatch = session.analysisType === analysisType;
                
                console.log(`CHECK_ANALYSIS:   - Both fileName and analysisType match: ${fileNameMatch && analysisTypeMatch}`);
                
                if (fileNameMatch && analysisTypeMatch) {
                    conflictingSessions.push(session.id);
                    console.log(`CHECK_ANALYSIS: *** CONFLICT FOUND *** session ${session.id} - ${session.analysisType} for ${session.fileName}`);
                } else {
                    console.log(`CHECK_ANALYSIS: No conflict - different ${!fileNameMatch ? 'fileName' : 'analysisType'}`);
                }
            }
            
            // Determine if analysis can run
            const canRun = conflictingSessions.length === 0;
            
            console.log(`CHECK_ANALYSIS: ===== CONFLICT CHECK RESULT =====`);
            console.log(`CHECK_ANALYSIS: Analysis ${canRun ? 'CAN' : 'CANNOT'} run`);
            console.log(`CHECK_ANALYSIS: Found ${conflictingSessions.length} conflicting sessions: [${conflictingSessions.join(', ')}]`);
            console.log(`CHECK_ANALYSIS: =====================================`);
            
            // Generate warning message if conflicts found
            let warningMessage: string | undefined;
            if (!canRun) {
                const sessionWord = conflictingSessions.length === 1 ? 'session' : 'sessions';
                warningMessage = `${analysisType} analysis already exists for "${fileName}". Only one analysis per file and type is allowed. Found ${conflictingSessions.length} existing ${sessionWord}.`;
            }
            
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
                'Force Restart',
                'View Existing Sessions'
            );
            
            if (action === 'Force Restart') {
                console.log(`CHECK_ANALYSIS: User chose to force restart - closing existing sessions first`);
                
                // Close all conflicting sessions before allowing new analysis
                const closeSuccess = await this.stopConflictingSessions(conflictResult.conflictingSessions);
                
                if (closeSuccess) {
                    console.log(`CHECK_ANALYSIS: Successfully closed ${conflictResult.conflictingSessions.length} existing sessions`);
                    return true; // Proceed with new analysis
                } else {
                    console.log(`CHECK_ANALYSIS: Failed to close some existing sessions`);
                    vscode.window.showErrorMessage('Failed to close existing analysis sessions. Please try again.');
                    return false;
                }
            } else if (action === 'View Existing Sessions') {
                // Show information about conflicting sessions
                const conflictInfo = this.getConflictingSessionsInfo(conflictResult.conflictingSessions);
                let infoMessage = `Existing sessions for ${path.basename(filePath)}:\n\n`;
                
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
                console.log(`CHECK_ANALYSIS: User cancelled analysis (closed dialog)`);
                return false; // Closed dialog or no action
            }
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error in checkAndWarnAboutConflicts:`, error);
            // In case of error, allow analysis to proceed
            return true;
        }
    }

    /**
     * Stop conflicting sessions using comprehensive cleanup
     */
    static async stopConflictingSessions(sessionIds: string[]): Promise<boolean> {
        try {
            console.log(`CHECK_ANALYSIS: Stopping ${sessionIds.length} conflicting sessions with full cleanup...`);
            
            const integrationService = ServerWatcherIntegration.getInstance();
            let successCount = 0;
            
            for (const sessionId of sessionIds) {
                console.log(`CHECK_ANALYSIS: Cleaning up session ${sessionId}...`);
                const success = await integrationService.triggerManualCleanup(sessionId);
                
                if (success) {
                    successCount++;
                    console.log(`CHECK_ANALYSIS: Successfully cleaned up session: ${sessionId}`);
                } else {
                    console.warn(`CHECK_ANALYSIS: Failed to clean up session: ${sessionId}`);
                }
            }
            
            if (successCount > 0) {
                const sessionWord = successCount === 1 ? 'session' : 'sessions';
                vscode.window.showInformationMessage(
                    `Closed ${successCount} existing analysis ${sessionWord} and their servers.`
                );
            }
            
            // Return true if all sessions were successfully cleaned up
            const allSuccess = successCount === sessionIds.length;
            console.log(`CHECK_ANALYSIS: Cleanup summary: ${successCount}/${sessionIds.length} sessions cleaned up successfully`);
            
            return allSuccess;
            
        } catch (error) {
            console.error(`CHECK_ANALYSIS: Error stopping conflicting sessions:`, error);
            return false;
        }
    }
}
