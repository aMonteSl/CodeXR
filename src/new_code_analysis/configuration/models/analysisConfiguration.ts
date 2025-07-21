/**
 * Analysis Configuration Models
 * Types and interfaces for all analysis configuration data
 */

export type AnalysisFileMode = 'XR' | 'LivePanel';
export type ViewTheme = 'Dark' | 'Light';
export type AutoAnalysisDelay = 'RealTime' | '1s' | '3s' | '5s' | '10s' | 'Custom';

export interface AutoAnalysisDelayConfig {
    type: AutoAnalysisDelay;
    customMs?: number; // Only used when type is 'Custom', max 20000ms
}

export interface AnalysisConfiguration {
    /**
     * Analysis file mode setting
     */
    analysisFileMode: AnalysisFileMode;
    
    /**
     * View theme setting for analysis visualization
     */
    viewTheme: ViewTheme;
    
    /**
     * Auto-analysis delay configuration
     */
    autoAnalysisDelay: AutoAnalysisDelayConfig;
    
    /**
     * TODO: Add more configuration settings here as they are implemented
     * Example future settings:
     */
    
    // analysisDepth?: 'shallow' | 'medium' | 'deep';
    // includePatterns?: string[];
    // excludePatterns?: string[];
    // autoSaveResults?: boolean;
    // maxConcurrentAnalyses?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_ANALYSIS_CONFIGURATION: AnalysisConfiguration = {
    analysisFileMode: 'XR', // Default to XR as requested
    viewTheme: 'Dark', // Default to Dark theme
    autoAnalysisDelay: {
        type: 'RealTime', // Default to Real Time (0s)
        customMs: undefined
    }
};

/**
 * Configuration file metadata
 */
export interface ConfigurationMetadata {
    version: string;
    lastModified: number;
    createdBy: string;
}

/**
 * Complete configuration file structure
 */
export interface AnalysisConfigurationFile {
    metadata: ConfigurationMetadata;
    configuration: AnalysisConfiguration;
}

/**
 * Default configuration file structure
 */
export const DEFAULT_CONFIGURATION_FILE: AnalysisConfigurationFile = {
    metadata: {
        version: '1.0.0',
        lastModified: Date.now(),
        createdBy: 'CodeXR New Code Analysis'
    },
    configuration: DEFAULT_ANALYSIS_CONFIGURATION
};
