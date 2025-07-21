/**
 * Configuration Manager
 * Handles the current analysis configuration with getters for each JSON attribute
 */

import { 
    AnalysisConfiguration, 
    AnalysisFileMode, 
    ViewTheme, 
    AutoAnalysisDelayConfig,
    DEFAULT_ANALYSIS_CONFIGURATION 
} from './models/analysisConfiguration';

/**
 * Configuration Manager Class
 * Provides typed getters for each configuration attribute stored in JSON
 */
export class ConfigurationManager {
    private _configuration: AnalysisConfiguration;

    constructor(initialConfiguration?: AnalysisConfiguration) {
        this._configuration = initialConfiguration || DEFAULT_ANALYSIS_CONFIGURATION;
    }

    // =========================
    // Configuration Getters
    // =========================

    /**
     * Get the current analysis file mode
     * @returns Current analysis file mode ('XR' or 'LivePanel')
     */
    get analysisFileMode(): AnalysisFileMode {
        return this._configuration.analysisFileMode;
    }

    /**
     * Get the current view theme
     * @returns Current view theme ('Dark' or 'Light')
     */
    get viewTheme(): ViewTheme {
        return this._configuration.viewTheme;
    }

    /**
     * Get the current auto-analysis delay configuration
     * @returns Current auto-analysis delay configuration object
     */
    get autoAnalysisDelay(): AutoAnalysisDelayConfig {
        return this._configuration.autoAnalysisDelay;
    }

    /**
     * Get the auto-analysis delay type
     * @returns Current auto-analysis delay type
     */
    get autoAnalysisDelayType(): string {
        return this._configuration.autoAnalysisDelay.type;
    }

    /**
     * Get the custom delay in milliseconds (if applicable)
     * @returns Custom delay in milliseconds or undefined
     */
    get customDelayMs(): number | undefined {
        return this._configuration.autoAnalysisDelay.customMs;
    }

    // =========================
    // Configuration Setters
    // =========================

    /**
     * Set the analysis file mode
     * @param mode New analysis file mode
     */
    set analysisFileMode(mode: AnalysisFileMode) {
        this._configuration.analysisFileMode = mode;
    }

    /**
     * Set the view theme
     * @param theme New view theme
     */
    set viewTheme(theme: ViewTheme) {
        this._configuration.viewTheme = theme;
    }

    /**
     * Set the auto-analysis delay configuration
     * @param delayConfig New auto-analysis delay configuration
     */
    set autoAnalysisDelay(delayConfig: AutoAnalysisDelayConfig) {
        this._configuration.autoAnalysisDelay = delayConfig;
    }

    // =========================
    // Utility Methods
    // =========================

    /**
     * Get the complete configuration object
     * @returns Current configuration object
     */
    getConfiguration(): AnalysisConfiguration {
        return { ...this._configuration };
    }

    /**
     * Update the entire configuration
     * @param newConfiguration New configuration object
     */
    updateConfiguration(newConfiguration: AnalysisConfiguration): void {
        this._configuration = { ...newConfiguration };
    }

    /**
     * Reset configuration to defaults
     */
    resetToDefaults(): void {
        this._configuration = { ...DEFAULT_ANALYSIS_CONFIGURATION };
    }

    /**
     * Check if current mode is XR
     * @returns True if analysis file mode is XR
     */
    isXRMode(): boolean {
        return this._configuration.analysisFileMode === 'XR';
    }

    /**
     * Check if current mode is LivePanel
     * @returns True if analysis file mode is LivePanel
     */
    isLivePanelMode(): boolean {
        return this._configuration.analysisFileMode === 'LivePanel';
    }

    /**
     * Check if current theme is Dark
     * @returns True if view theme is Dark
     */
    isDarkTheme(): boolean {
        return this._configuration.viewTheme === 'Dark';
    }

    /**
     * Check if current theme is Light
     * @returns True if view theme is Light
     */
    isLightTheme(): boolean {
        return this._configuration.viewTheme === 'Light';
    }

    /**
     * Check if auto-analysis is set to real time
     * @returns True if auto-analysis delay is RealTime
     */
    isRealTimeAnalysis(): boolean {
        return this._configuration.autoAnalysisDelay.type === 'RealTime';
    }

    /**
     * Get delay in milliseconds based on current configuration
     * @returns Delay in milliseconds
     */
    getDelayInMs(): number {
        const delayConfig = this._configuration.autoAnalysisDelay;
        
        switch (delayConfig.type) {
            case 'RealTime':
                return 0;
            case '1s':
                return 1000;
            case '3s':
                return 3000;
            case '5s':
                return 5000;
            case '10s':
                return 10000;
            case 'Custom':
                return delayConfig.customMs || 0;
            default:
                return 0;
        }
    }

    /**
     * Convert configuration to JSON string
     * @returns JSON string representation of configuration
     */
    toJSON(): string {
        return JSON.stringify(this._configuration, null, 2);
    }

    /**
     * Load configuration from JSON string
     * @param jsonString JSON string to parse
     */
    fromJSON(jsonString: string): void {
        try {
            const parsedConfig = JSON.parse(jsonString) as AnalysisConfiguration;
            this._configuration = { ...DEFAULT_ANALYSIS_CONFIGURATION, ...parsedConfig };
        } catch (error) {
            console.error('Error parsing configuration JSON:', error);
            this._configuration = { ...DEFAULT_ANALYSIS_CONFIGURATION };
        }
    }
}

/**
 * Default export for convenience
 */
export default ConfigurationManager;
