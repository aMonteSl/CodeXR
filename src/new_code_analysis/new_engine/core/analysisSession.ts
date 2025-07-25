/**
 * Analysis Session Types and Interfaces
 * Unified session structure for the new analysis engine
 */

import * as vscode from 'vscode';
import { FileHash } from '../utils/fileHashCalculator';

export type AnalysisMode = 'LivePanel' | 'XR' | 'VisualizeDOM';
export type TargetType = 'file' | 'directory';
export type AnalysisStatus = 'creating' | 'analyzing' | 'monitoring' | 'error' | 'closed';

/**
 * Unified Analysis Session Interface
 * Handles both file and directory analysis with a single structure
 */
export interface UnifiedAnalysisSession {
    // Identification
    id: string;                    // Generated nonce
    
    // Target information
    targetPath: string;            // File path OR directory path
    targetType: TargetType;        // 'file' | 'directory'
    targetName: string;            // File name OR directory name
    
    // Analysis configuration
    analysisMode: AnalysisMode;    // 'LivePanel' | 'XR'
    isDeep: boolean;               // true for deep analysis (applies to directories mainly)
    
    // Server information (added for server integration)
    assignedPort?: number;         // Puerto asignado al servidor de esta sesión
    serverUrl?: string;            // URL completa del servidor
    serverId?: string;             // ID del servidor en el registro activo
    watcherId?: string;            // ID del watcher activo para esta sesión
    
    // Active Analyses UI integration
    activeAnalysisId?: string;     // ID in the Active Analyses registry
    
    // Session state
    status: AnalysisStatus;        // Current status
    progress?: number;             // Progress percentage (0-100)
    error?: string;                // Error message if failed
    
    // Timing
    startTime: Date;               // When analysis started
    endTime?: Date;                // When analysis completed/failed
    
    // Hash and validation
    hash256: string;               // SHA256 of target (file content or directory structure)
    
    // Results and output
    outputDirectory: string;       // Directory name: {targetName}_{mode}_{type}_{nonce}
    outputPath: string;            // Full path to analysis results directory
    savedFilesPath?: string;       // Path where processed template files are saved
    port?: number;                 // Port where analysis is being served (if applicable)
    
    // Required files for analysis
    requiredFiles: Map<string, string>; // Map of filename -> file content
    
    // Template paths (SOLO rutas, no contenido)
    templatePaths: Map<string, string>; // Map of filename -> file path
    
    // Directory analysis specific fields
    directoriesToAnalyze?: string[];    // Filtered directories for analysis (only for directory analysis)
    filesToHash?: FileHash[];           // File paths and their SHA256 hashes (only for directory analysis)
    
    // Metadata
    metadata: UnifiedAnalysisSessionMetadata;
}

/**
 * Session metadata interface - SIMPLIFICADO
 */
export interface UnifiedAnalysisSessionMetadata {
    targetSize?: number;            // File size OR total directory size
    lastModified?: Date;            // Last modification time
    [key: string]: any;            // Flexible para cualquier metadata adicional
}

/**
 * Factory class for creating and managing analysis sessions
 */
export class AnalysisSessionFactory {
    
    /**
     * Get analysis type identifier for logging and categorization
     */
    static getAnalysisTypeId(session: UnifiedAnalysisSession): string {
        const modePrefix = session.analysisMode === 'LivePanel' ? 'LP' : 'XR';
        const targetPrefix = session.targetType === 'file' ? 'File' : 'Dir';
        const depthSuffix = session.isDeep ? 'Deep' : '';
        
        return `${modePrefix}_${targetPrefix}${depthSuffix}`;
        // Results in: LP_File, LP_Dir, LP_DirDeep, XR_File, XR_Dir, XR_DirDeep
    }
    
    /**
     * Get a human-readable description of the analysis type
     */
    static getAnalysisDescription(session: UnifiedAnalysisSession): string {
        const mode = session.analysisMode === 'LivePanel' ? 'Live Panel' : 'XR';
        const target = session.targetType === 'file' ? 'File' : 'Directory';
        const depth = session.isDeep ? ' (Deep)' : '';
        
        return `${mode} ${target} Analysis${depth}`;
    }
    
    /**
     * Check if a session is for file analysis
     */
    static isFileAnalysis(session: UnifiedAnalysisSession): boolean {
        return session.targetType === 'file';
    }
    
    /**
     * Check if a session is for directory analysis
     */
    static isDirectoryAnalysis(session: UnifiedAnalysisSession): boolean {
        return session.targetType === 'directory';
    }
    
    /**
     * Check if a session is for LivePanel analysis
     */
    static isLivePanelAnalysis(session: UnifiedAnalysisSession): boolean {
        return session.analysisMode === 'LivePanel';
    }
    
    /**
     * Check if a session is for XR analysis
     */
    static isXRAnalysis(session: UnifiedAnalysisSession): boolean {
        return session.analysisMode === 'XR';
    }
    
    /**
     * Check if a session is for deep analysis
     */
    static isDeepAnalysis(session: UnifiedAnalysisSession): boolean {
        return session.isDeep;
    }
    
    /**
     * Check if a session is active (creating, analyzing, or monitoring)
     */
    static isActiveSession(session: UnifiedAnalysisSession): boolean {
        return session.status === 'creating' || session.status === 'analyzing' || session.status === 'monitoring';
    }
    
    /**
     * Check if a session is in monitoring state (analysis completed but still watching)
     */
    static isMonitoringSession(session: UnifiedAnalysisSession): boolean {
        return session.status === 'monitoring';
    }
    
    /**
     * Check if a session has an error
     */
    static isErrorSession(session: UnifiedAnalysisSession): boolean {
        return session.status === 'error';
    }
    
    /**
     * Check if a session is closed (truly finished)
     */
    static isClosedSession(session: UnifiedAnalysisSession): boolean {
        return session.status === 'closed';
    }
}

/**
 * Session creation parameters
 */
export interface SessionCreationParams {
    targetPath: string;
    analysisMode: AnalysisMode;
    targetType: TargetType;
    isDeep?: boolean;
    context: vscode.ExtensionContext;
}
