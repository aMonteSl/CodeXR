/**
 * Active Analysis Data Model
 * Model for representing active analysis sessions in the UI
 */

import * as path from 'path';

export interface ActiveAnalysisData {
    /** Session ID */
    sessionId: string;
    
    /** File name without path */
    fileName: string;
    
    /** Full file path */
    filePath: string;
    
    /** Type of analysis */
    analysisType: string;
    
    /** Current analysis status */
    status: 'creating' | 'analyzing' | 'completed' | 'failed' | 'closing';
    
    /** Last analysis time */
    lastAnalysisTime: Date;
    
    /** Server port if available */
    serverPort?: number;
    
    /** Server URL if available */
    serverUrl?: string;
    
    /** Progress percentage (0-100) */
    progress?: number;
    
    /** Start time of the analysis */
    startTime: Date;
    
    /** Analysis duration in seconds */
    durationSeconds?: number;
}

export interface ActiveAnalysisUIItem {
    /** Display label for the tree item */
    label: string;
    
    /** Description shown next to the label */
    description: string;
    
    /** Tooltip with detailed information */
    tooltip: string;
    
    /** Icon name for the tree item */
    iconName: string;
    
    /** Theme color for the icon */
    iconColor?: string;
    
    /** Context value for commands */
    contextValue: string;
    
    /** Associated session data */
    sessionData: ActiveAnalysisData;
}

/**
 * Utility class for converting session data to UI models
 */
export class ActiveAnalysisModelMapper {
    
    /**
     * Convert session data to UI display model
     */
    static toUIItem(data: ActiveAnalysisData): ActiveAnalysisUIItem {
        const fileName = path.basename(data.filePath);
        const label = `${fileName} - ${data.analysisType}`;
        
        // Generate description with last analysis time and server info
        const lastAnalysisStr = data.lastAnalysisTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        let description = `Last: ${lastAnalysisStr}`;
        if (data.serverPort) {
            description += ` | Port: ${data.serverPort}`;
        }
        
        // Generate detailed tooltip
        let tooltip = `Analysis: ${data.analysisType}\n`;
        tooltip += `File: ${fileName}\n`;
        tooltip += `Status: ${data.status}\n`;
        tooltip += `Started: ${data.startTime.toLocaleString()}\n`;
        tooltip += `Last Analysis: ${data.lastAnalysisTime.toLocaleString()}\n`;
        
        if (data.serverUrl) {
            tooltip += `Server: ${data.serverUrl}\n`;
        }
        
        if (data.progress !== undefined) {
            tooltip += `Progress: ${data.progress}%\n`;
        }
        
        if (data.durationSeconds !== undefined) {
            tooltip += `Duration: ${data.durationSeconds}s\n`;
        }
        
        tooltip += `Path: ${data.filePath}`;
        
        // Determine icon and context based on status
        const { iconName, iconColor, contextValue } = this.getStatusVisuals(data.status, data.analysisType);
        
        return {
            label,
            description,
            tooltip,
            iconName,
            iconColor,
            contextValue,
            sessionData: data
        };
    }
    
    /**
     * Get visual representation for analysis status and type
     */
    private static getStatusVisuals(status: string, analysisType?: string): {
        iconName: string;
        iconColor?: string;
        contextValue: string;
    } {
        // Determine base icon based on analysis type
        let baseIcon: string;
        let baseColor: string;
        
        if (analysisType === 'FileXRAnalysis') {
            // XR Analysis uses VR icon in purple
            baseIcon = 'vr';
            baseColor = 'charts.purple';
        } else if (analysisType === 'FileLivePanel') {
            // File Live Panel uses file-code icon in green
            baseIcon = 'file-code';
            baseColor = 'charts.green';
        } else if (analysisType === 'DirectoryLivePanel') {
            // Directory Live Panel uses folder icon in green
            baseIcon = 'folder';
            baseColor = 'charts.green';
        } else if (analysisType === 'DeepDirectoryLivePanel') {
            // Deep Directory Live Panel uses folder-library icon in green
            baseIcon = 'folder-library';
            baseColor = 'charts.green';
        } else if (analysisType === 'DirectoryXRAnalysis') {
            // Directory XR Analysis uses folder with VR icon in purple
            baseIcon = 'folder';
            baseColor = 'charts.purple';
        } else if (analysisType === 'DeepDirectoryXRAnalysis') {
            // Deep Directory XR Analysis uses folder-library with VR icon in purple
            baseIcon = 'folder-library';
            baseColor = 'charts.purple';
        } else if (analysisType === 'DOMVisualization') {
            // DOM Visualization uses code-oss icon in orange
            baseIcon = 'code-oss';
            baseColor = 'charts.orange';
        } else {
            // Default fallback
            baseIcon = 'file-code';
            baseColor = 'charts.green';
        }
        
        switch (status) {
            case 'creating':
                return {
                    iconName: 'loading~spin',
                    iconColor: 'charts.yellow',
                    contextValue: 'activeAnalysis.creating'
                };
            case 'analyzing':
                return {
                    iconName: 'sync~spin',
                    iconColor: 'charts.blue',
                    contextValue: 'activeAnalysis.analyzing'
                };
            case 'completed':
                return {
                    iconName: baseIcon,
                    iconColor: baseColor,
                    contextValue: 'activeAnalysis.completed'
                };
            case 'failed':
                return {
                    iconName: 'error',
                    iconColor: 'charts.red',
                    contextValue: 'activeAnalysis.failed'
                };
            case 'closing':
                return {
                    iconName: 'close',
                    iconColor: 'charts.orange',
                    contextValue: 'activeAnalysis.closing'
                };
            default:
                return {
                    iconName: 'question',
                    iconColor: 'charts.foreground',
                    contextValue: 'activeAnalysis.unknown'
                };
        }
    }
    
    /**
     * Sort analysis items by priority and time
     */
    static sortAnalysisItems(items: ActiveAnalysisUIItem[]): ActiveAnalysisUIItem[] {
        return items.sort((a, b) => {
            // Priority order: analyzing > creating > completed > failed > closing
            const statusPriority = {
                'analyzing': 1,
                'creating': 2,
                'completed': 3,
                'failed': 4,
                'closing': 5
            };
            
            const aPriority = statusPriority[a.sessionData.status as keyof typeof statusPriority] || 6;
            const bPriority = statusPriority[b.sessionData.status as keyof typeof statusPriority] || 6;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // If same priority, sort by last analysis time (most recent first)
            return b.sessionData.lastAnalysisTime.getTime() - a.sessionData.lastAnalysisTime.getTime();
        });
    }
}
