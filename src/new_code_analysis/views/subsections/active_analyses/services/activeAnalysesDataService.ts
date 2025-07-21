/**
 * Active Analyses Data Service
 * Service for fetching and managing active analysis data from the session registry
 */

import * as vscode from 'vscode';
import { AnalysisSessionRegistry, AnalysisSession } from '../../../../engine/registry/analysisSessionRegistry';
import { ActiveAnalysisData } from '../model/activeAnalysisModel';
import { getActiveServerRegistry } from '../../../../../active_servers/registry/activeServerRegistry';

export class ActiveAnalysesDataService {
    private static instance: ActiveAnalysesDataService;
    private sessionRegistry: AnalysisSessionRegistry;
    
    private constructor() {
        this.sessionRegistry = AnalysisSessionRegistry.getInstance();
        console.log('ACTIVE_ANALYSES_SERVICE: Initialized Active Analyses Data Service');
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): ActiveAnalysesDataService {
        if (!ActiveAnalysesDataService.instance) {
            ActiveAnalysesDataService.instance = new ActiveAnalysesDataService();
        }
        return ActiveAnalysesDataService.instance;
    }
    
    /**
     * Get all active analysis data
     */
    public getActiveAnalyses(): ActiveAnalysisData[] {
        try {
            console.log('ACTIVE_ANALYSES_SERVICE: Fetching active analyses from session registry');
            
            // Get all sessions (including completed ones for recent activity)
            const allSessions = this.sessionRegistry.getAllSessions();
            console.log(`ACTIVE_ANALYSES_SERVICE: Found ${allSessions.length} total sessions`);
            
            // Filter and convert to ActiveAnalysisData
            const activeAnalyses: ActiveAnalysisData[] = [];
            
            for (const session of allSessions) {
                // Include sessions that are not closed/failed or were recently completed
                if (this.shouldIncludeSession(session)) {
                    const analysisData = this.convertSessionToAnalysisData(session);
                    if (analysisData) {
                        activeAnalyses.push(analysisData);
                    }
                }
            }
            
            console.log(`ACTIVE_ANALYSES_SERVICE: Returning ${activeAnalyses.length} active analyses`);
            return activeAnalyses;
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_SERVICE: Error fetching active analyses:', error);
            return [];
        }
    }
    
    /**
     * Get specific analysis data by session ID
     */
    public getAnalysisData(sessionId: string): ActiveAnalysisData | null {
        try {
            const session = this.sessionRegistry.getSession(sessionId);
            if (!session) {
                return null;
            }
            
            return this.convertSessionToAnalysisData(session);
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_SERVICE: Error fetching analysis data for session ${sessionId}:`, error);
            return null;
        }
    }
    
    /**
     * Check if session should be included in active analyses list
     */
    private shouldIncludeSession(session: AnalysisSession): boolean {
        // Always include active sessions
        if (['creating', 'analyzing'].includes(session.status)) {
            return true;
        }
        
        // Include completed sessions if they're recent (within last 30 minutes)
        if (session.status === 'completed' && session.endTime) {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            return session.endTime > thirtyMinutesAgo;
        }
        
        // Include failed sessions if they're recent (within last 10 minutes)
        if (session.status === 'failed' && session.endTime) {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            return session.endTime > tenMinutesAgo;
        }
        
        // Don't include closing sessions or very old ones
        return false;
    }
    
    /**
     * Convert AnalysisSession to ActiveAnalysisData
     */
    private convertSessionToAnalysisData(session: AnalysisSession): ActiveAnalysisData | null {
        try {
            // Get server information for this session
            const serverInfo = this.getServerInfoForSession(session.id);
            
            // Calculate duration if available
            let durationSeconds: number | undefined;
            const currentTime = session.endTime || new Date();
            if (session.startTime) {
                durationSeconds = Math.round((currentTime.getTime() - session.startTime.getTime()) / 1000);
            }
            
            // Use endTime if available, otherwise use current time for active sessions
            const lastAnalysisTime = session.endTime || new Date();
            
            const analysisData: ActiveAnalysisData = {
                sessionId: session.id,
                fileName: session.fileName,
                filePath: session.filePath,
                analysisType: session.analysisType,
                status: session.status,
                lastAnalysisTime: lastAnalysisTime,
                serverPort: serverInfo?.port,
                serverUrl: serverInfo?.url,
                progress: session.progress,
                startTime: session.startTime,
                durationSeconds
            };
            
            return analysisData;
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_SERVICE: Error converting session ${session.id} to analysis data:`, error);
            return null;
        }
    }
    
    /**
     * Get server information for a session
     */
    private getServerInfoForSession(sessionId: string): { port: number; url: string } | null {
        try {
            // Get active server registry to find servers related to this session
            const serverRegistry = getActiveServerRegistry();
            const activeServers = serverRegistry.getAllServers();
            
            // Look for a server that might be serving this session
            // This is a best-effort approach since the session doesn't directly track the server
            for (const server of activeServers) {
                // Check if the server's HTML file or ID might relate to this session
                if (server.htmlFile && server.htmlFile.includes(sessionId)) {
                    return {
                        port: server.port,
                        url: server.url
                    };
                }
                // Also check if the server ID contains the session ID
                if (server.id.includes(sessionId)) {
                    return {
                        port: server.port,
                        url: server.url
                    };
                }
            }
            
            return null;
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_SERVICE: Error getting server info for session ${sessionId}:`, error);
            return null;
        }
    }
    
    /**
     * Get count of analyses by status
     */
    public getAnalysisCountByStatus(): {
        creating: number;
        analyzing: number;
        completed: number;
        failed: number;
        total: number;
    } {
        try {
            const analyses = this.getActiveAnalyses();
            
            const counts = {
                creating: 0,
                analyzing: 0,
                completed: 0,
                failed: 0,
                total: analyses.length
            };
            
            for (const analysis of analyses) {
                switch (analysis.status) {
                    case 'creating':
                        counts.creating++;
                        break;
                    case 'analyzing':
                        counts.analyzing++;
                        break;
                    case 'completed':
                        counts.completed++;
                        break;
                    case 'failed':
                        counts.failed++;
                        break;
                }
            }
            
            return counts;
            
        } catch (error) {
            console.error('ACTIVE_ANALYSES_SERVICE: Error getting analysis count by status:', error);
            return { creating: 0, analyzing: 0, completed: 0, failed: 0, total: 0 };
        }
    }
    
    /**
     * Stop/close an active analysis session
     */
    public stopAnalysis(sessionId: string): boolean {
        try {
            console.log(`ACTIVE_ANALYSES_SERVICE: Stopping analysis session: ${sessionId}`);
            
            const success = this.sessionRegistry.closeSession(sessionId);
            
            if (success) {
                console.log(`ACTIVE_ANALYSES_SERVICE: Successfully stopped session: ${sessionId}`);
            } else {
                console.warn(`ACTIVE_ANALYSES_SERVICE: Failed to stop session: ${sessionId}`);
            }
            
            return success;
            
        } catch (error) {
            console.error(`ACTIVE_ANALYSES_SERVICE: Error stopping analysis session ${sessionId}:`, error);
            return false;
        }
    }
    
    /**
     * Refresh analysis data (force reload from registry)
     */
    public refresh(): void {
        console.log('ACTIVE_ANALYSES_SERVICE: Refreshing analysis data');
        // The data is always fetched fresh from the registry, so no caching to clear
        // This method exists for potential future caching implementation
    }
}
