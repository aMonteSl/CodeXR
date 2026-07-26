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
 * Third-party libraries the bundled example scenes load from public CDNs.
 *
 * Single source of truth for the credits dialog and THIRD_PARTY_NOTICES.md.
 * The versions here are the ones the example HTML actually requests — the XR
 * runtime templates pin newer A-Frame/BabiaXR releases, so do not assume they
 * match.
 */
export const BABIA_EXAMPLE_LIBRARIES = [
    {
        label: 'BabiaXR',
        name: 'aframe-babia-components',
        version: 'latest (unpinned)',
        license: 'GPL-3.0',
        licenseUrl: 'https://www.gnu.org/licenses/gpl-3.0.html',
        website: 'https://babiaxr.gitlab.io/aframe-babia-components/',
        source: 'https://gitlab.com/babiaxr/aframe-babia-components',
    },
    {
        label: 'A-Frame',
        name: 'aframe',
        version: '1.0.4',
        license: 'MIT',
        licenseUrl: 'https://github.com/aframevr/aframe/blob/master/LICENSE',
        website: 'https://aframe.io/',
        source: 'https://github.com/aframevr/aframe',
    },
    {
        label: 'Environment',
        name: 'aframe-environment-component',
        version: '1.0.0',
        license: 'MIT',
        licenseUrl: 'https://github.com/supermedium/aframe-environment-component/blob/master/LICENSE',
        website: 'https://github.com/supermedium/aframe-environment-component',
        source: 'https://github.com/supermedium/aframe-environment-component',
    },
    {
        label: 'Extras',
        name: 'aframe-extras',
        version: '6.1.0',
        license: 'MIT',
        licenseUrl: 'https://github.com/c-frame/aframe-extras/blob/master/LICENSE',
        website: 'https://github.com/c-frame/aframe-extras',
        source: 'https://github.com/c-frame/aframe-extras',
    },
] as const;

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
