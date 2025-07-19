import * as vscode from 'vscode';

/**
 * Represents an active analysis being tracked in the system
 */
export interface ActiveAnalysis {
    /** Unique identifier for this analysis */
    id: string;
    
    /** The file or directory being analyzed */
    path: string;
    
    /** Type of analysis being performed */
    mode: 'Static' | 'XR';
    
    /** When this analysis was started */
    timestamp: Date;
    
    /** Current status of the analysis */
    status: 'running' | 'completed' | 'failed' | 'paused';
    
    /** File extension or language detected */
    language?: string;
    
    /** Progress percentage (0-100) */
    progress?: number;
    
    /** Any error message if status is 'failed' */
    error?: string;
    
    /** Additional metadata about the analysis */
    metadata?: {
        totalLines?: number;
        totalFunctions?: number;
        complexity?: number;
        fileCount?: number; // For directory analyses
    };
}

/**
 * Data for creating a new analysis (without the generated ID)
 */
export type ActiveAnalysisData = Omit<ActiveAnalysis, 'id'>;

/**
 * Type representing the different types of active analysis tree items
 */
export type ActiveAnalysisTreeItemType = 
    | 'active-analysis-file' 
    | 'active-analysis-directory' 
    | 'active-analysis-placeholder'
    | 'active-analysis-section';

/**
 * Factory for creating active analysis objects
 */
export class ActiveAnalysisFactory {
    
    /**
     * Create a new active analysis for a file
     */
    static createFileAnalysis(
        filePath: string, 
        mode: 'Static' | 'XR', 
        language?: string
    ): ActiveAnalysis {
        return {
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: filePath,
            mode,
            timestamp: new Date(),
            status: 'running',
            language,
            progress: 0
        };
    }
    
    /**
     * Create a new active analysis for a directory
     */
    static createDirectoryAnalysis(
        directoryPath: string, 
        mode: 'Static' | 'XR'
    ): ActiveAnalysis {
        return {
            id: `dir-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: directoryPath,
            mode,
            timestamp: new Date(),
            status: 'running',
            progress: 0
        };
    }
    
    /**
     * Update the status of an existing analysis
     */
    static updateAnalysisStatus(
        analysis: ActiveAnalysis, 
        status: ActiveAnalysis['status'],
        progress?: number,
        error?: string,
        metadata?: ActiveAnalysis['metadata']
    ): ActiveAnalysis {
        return {
            ...analysis,
            status,
            progress,
            error,
            metadata: metadata || analysis.metadata
        };
    }
}
