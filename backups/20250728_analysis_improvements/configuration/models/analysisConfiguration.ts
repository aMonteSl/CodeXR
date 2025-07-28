/**
 * Analysis Configuration Models
 * Types and interfaces for all analysis configuration data
 */

export type AnalysisFileMode = 'XR' | 'LivePanel';
export type AnalysisDirectoryMode = 'XR' | 'XRDeep' | 'LivePanel' | 'LivePanelDeep';
export type ViewTheme = 'Dark' | 'Light';
export type AutoAnalysisDelay = 'RealTime' | '1s' | '3s' | '5s' | '10s' | 'Custom';
export type ChartType = 'bars' | 'barsmap' | 'cyls' | 'cylsmap' | 'donut' | 'pie' | 'bubbles' | 'boats';

// Files by Language sorting configuration types
export type LanguageGroupSortBy = 'alphabetical' | 'fileCount';
export type LanguageGroupSortDirection = 'ascending' | 'descending';
export type FilesSortBy = 'alphabetical' | 'lastModified';
export type FilesSortDirection = 'ascending' | 'descending';

/**
 * Files by Language sorting configuration
 */
export interface FilesByLanguageSortingConfig {
    /**
     * Primary sorting for language groups
     */
    languageGroupSortBy: LanguageGroupSortBy;
    languageGroupSortDirection: LanguageGroupSortDirection;
    
    /**
     * Secondary sorting for language groups (can work together with primary)
     */
    languageGroupSecondarySortBy?: LanguageGroupSortBy;
    languageGroupSecondarySortDirection?: LanguageGroupSortDirection;
    
    /**
     * Sorting for files within each language group
     */
    filesSortBy: FilesSortBy;
    filesSortDirection: FilesSortDirection;
}

/**
 * Dimension mapping object that maps dimension names to data field names
 */
export interface DimensionMapping {
    [dimensionName: string]: string;
}

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
     * Analysis directory mode setting
     */
    analysisDirectoryMode: AnalysisDirectoryMode;
    
    /**
     * View theme setting for analysis visualization
     */
    viewTheme: ViewTheme;
    
    /**
     * Auto-analysis delay configuration
     */
    autoAnalysisDelay: AutoAnalysisDelayConfig;
    
    /**
     * Chart type for file analysis visualization
     */
    chartTypeFile: ChartType;
    
    /**
     * Chart type for directory analysis visualization
     */
    chartTypeDirectory: ChartType;
    
    /**
     * Dimension mapping for file analysis
     */
    dimensionMappingFile: DimensionMapping;
    
    /**
     * Dimension mapping for directory analysis
     */
    dimensionMappingDirectory: DimensionMapping;
    
    /**
     * Files by Language sorting configuration
     */
    filesByLanguageSorting: FilesByLanguageSortingConfig;
    
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
    analysisDirectoryMode: 'XR', // Default to XR as requested
    viewTheme: 'Dark', // Default to Dark theme
    autoAnalysisDelay: {
        type: 'RealTime', // Default to Real Time (0s)
        customMs: undefined
    },
    chartTypeFile: 'boats', // Default chart type changed to boats
    chartTypeDirectory: 'boats', // Default chart type for directories changed to boats
    dimensionMappingFile: {
        area: 'parameters',
        height: 'lineCount',
        color: 'complexity'
    }, // Default dimension mapping for files
    dimensionMappingDirectory: {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber'
    }, // Default dimension mapping for directories
    filesByLanguageSorting: {
        languageGroupSortBy: 'alphabetical',
        languageGroupSortDirection: 'ascending',
        languageGroupSecondarySortBy: 'fileCount',
        languageGroupSecondarySortDirection: 'descending',
        filesSortBy: 'alphabetical',
        filesSortDirection: 'ascending'
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
