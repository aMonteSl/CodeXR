/**
 * Babia Example Model
 * Interface definitions for Babia visualization examples
 */

/**
 * Represents a Babia visualization example
 */
export interface BabiaExample {
    /** Unique identifier for the example */
    id: string;
    
    /** Display name of the example */
    name: string;
    
    /** Full path to the HTML file */
    htmlFilePath: string;
    
    /** Directory containing the example */
    directory: string;
    
    /** Example category (e.g., 'pie', 'bar-chart', 'cylinder') */
    category: string;
    
    /** Description of the visualization */
    description?: string;
    
    /** Whether the example has a valid HTML entry point */
    isValid: boolean;
    
    /** Last modified timestamp */
    lastModified?: number;
}

/**
 * Result of example scanning operation
 */
export interface ExampleScanResult {
    /** List of found examples */
    examples: BabiaExample[];
    
    /** Number of valid examples found */
    validCount: number;
    
    /** Number of invalid examples found */
    invalidCount: number;
    
    /** Scan errors if any */
    errors: string[];
}

/**
 * Example launch configuration
 */
export interface ExampleLaunchConfig {
    /** The example to launch */
    example: BabiaExample;
    
    /** Whether to use current server settings */
    useCurrentSettings: boolean;
    
    /** Override port if specified */
    overridePort?: number;
}
