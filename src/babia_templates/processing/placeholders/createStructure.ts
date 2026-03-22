import { VisualizationSettings } from '../../../utils/getVisualizationConfiguration';
import { generateNonce } from '../../../utils/nonceGenerator';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Structure Creator Module - Specialized for General Structure Placeholders
 * Handles background, environment, SSE scripts, tree_builder, and other structural elements
 * Part of the modular restructuring for cleaner architecture
 */
export class CreateStructure {

    /**
     * Main method to create structural placeholders for complete XR template
     * Returns placeholders for background, environment, SSE scripts, etc.
     */
    public static createStructuralPlaceholders(
        title: string,
        dataSource: string,
        visualizationSettings: VisualizationSettings,
        analysisType: 'xr' | 'dom' | 'none' = 'none',
        context: vscode.ExtensionContext,
        chartType?: string,
        isDirectoryAnalysis?: boolean
    ): { success: boolean; placeholders?: Map<string, string>; error?: string } {
        
        console.log(`CREATE_STRUCTURE: Creating structural placeholders for analysis type: ${analysisType}, chart type: ${chartType}`);

        try {
            const placeholders = new Map<string, string>();

            // Basic structural placeholders
            placeholders.set('TITLE', title);
            placeholders.set('DATA_SOURCE', dataSource);
            
            // Environment and visualization settings
            placeholders.set('ENVIRONMENT_PRESET', visualizationSettings.environment);
            placeholders.set('BACKGROUND_COLOR', visualizationSettings.backgroundColor);
            placeholders.set('GROUND_COLOR', visualizationSettings.groundColor);
            placeholders.set('CHART_PALETTE', visualizationSettings.palette);

            // Generate unique nonce for security
            const nonce = generateNonce();
            placeholders.set('NONCE', nonce);
            placeholders.set('nonce', nonce); // lowercase for template compatibility

            // SSE script with nonce and standard main.js path
            const sseScriptWithNonce = this.getSSEScriptWithNonce(analysisType, nonce, context);
            placeholders.set('SSE_SCRIPT', sseScriptWithNonce);
            
            // Template-specific placeholders for backwards compatibility
            placeholders.set('scriptUri', './main.js');
            placeholders.set('SCRIPT_URI', './main.js');

            // Tree builder - only for boats chart in XR analysis
            const treeBuilder = this.getTreeBuilder(analysisType, chartType, isDirectoryAnalysis);
            placeholders.set('TREE_BUILDER', treeBuilder);

            // Icon path (optional)
            placeholders.set('ICON_PATH', '');

            // Additional metadata
            placeholders.set('TIMESTAMP', new Date().toISOString());
            placeholders.set('ANALYSIS_TYPE', analysisType);
            placeholders.set('BABIA_UI_COMPONENT', '');
            placeholders.set('BABIA_UI_SCRIPT', '');

            console.log(`CREATE_STRUCTURE: Created ${placeholders.size} structural placeholders`);
            return { 
                success: true, 
                placeholders 
            };

        } catch (error) {
            console.error(`CREATE_STRUCTURE: Error creating structural placeholders:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Get appropriate SSE script with nonce and main.js path based on analysis type
     */
    private static getSSEScriptWithNonce(analysisType: 'xr' | 'dom' | 'none', nonce: string, context: vscode.ExtensionContext): string {
        console.log(`CREATE_STRUCTURE: Creating SSE script with nonce for analysis type: ${analysisType}`);

        try {
            let scriptFileName: string;

            switch (analysisType) {
                case 'xr':
                    scriptFileName = 'live_sse_fileXR.js';
                    break;
                case 'dom':
                    scriptFileName = 'live_sse_fileDOM.js';
                    break;
                case 'none':
                default:
                    // No SSE script needed
                    return '';
            }

            const scriptPath = path.join(context.extensionPath, 'templates', 'xr', 'sse', scriptFileName);

            if (!fs.existsSync(scriptPath)) {
                console.warn(`CREATE_STRUCTURE: SSE script not found at: ${scriptPath}`);
                return '';
            }

            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            console.log(`CREATE_STRUCTURE: Loaded SSE script: ${scriptFileName} (${scriptContent.length} chars)`);

            // Add nonce script tag for main.js (standard path for all analyses)
            const mainJsScript = `<script nonce="${nonce}" src="./main.js"></script>`;
            
            return scriptContent + '\n' + mainJsScript;

        } catch (error) {
            console.error(`CREATE_STRUCTURE: Error loading SSE script:`, error);
            return '';
        }
    }

    /**
     * Get tree builder entity for boats chart in XR analysis
     */
    private static getTreeBuilder(analysisType: 'xr' | 'dom' | 'none', chartType?: string, isDirectoryAnalysis?: boolean): string {
        console.log(`CREATE_STRUCTURE: Getting tree builder for analysis type: ${analysisType}, chart type: ${chartType}, directory analysis: ${isDirectoryAnalysis}`);

        // Tree builder is only needed for boats chart in XR analysis
        if (analysisType === 'xr' && chartType === 'boats') {
            if (isDirectoryAnalysis) {
                console.log(`CREATE_STRUCTURE: Adding tree builder for XR boats chart (directory analysis)`);
                return '<a-entity id="tree" babia-treebuilder="field: filePath; split_by: /; from: data"></a-entity>';
            } else {
                console.log(`CREATE_STRUCTURE: Adding tree builder for XR boats chart (file analysis)`);
                return '<a-entity id="tree" babia-treebuilder="field: treePath; split_by: /; from: data"></a-entity>';
            }
        }

        console.log(`CREATE_STRUCTURE: No tree builder needed for this configuration`);
        return '';
    }

    /**
     * Get appropriate SSE script based on analysis type (legacy method)
     */
    private static getSSEScript(analysisType: 'xr' | 'dom' | 'none', context: vscode.ExtensionContext): string {
        console.log(`CREATE_STRUCTURE: Selecting SSE script for analysis type: ${analysisType}`);

        try {
            let scriptFileName: string;

            switch (analysisType) {
                case 'xr':
                    scriptFileName = 'live_sse_fileXR.js';
                    break;
                case 'dom':
                    scriptFileName = 'live_sse_fileDOM.js';
                    break;
                case 'none':
                default:
                    // No SSE script needed
                    return '';
            }

            const scriptPath = path.join(context.extensionPath, 'templates', 'xr', 'sse', scriptFileName);

            if (!fs.existsSync(scriptPath)) {
                console.warn(`CREATE_STRUCTURE: SSE script not found at: ${scriptPath}`);
                return '';
            }

            const scriptContent = fs.readFileSync(scriptPath, 'utf8');
            console.log(`CREATE_STRUCTURE: Loaded SSE script: ${scriptFileName}`);
            
            // Return script wrapped in script tags for injection
            return `<script type="text/javascript">
${scriptContent}
</script>`;

        } catch (error) {
            console.error(`CREATE_STRUCTURE: Error loading SSE script:`, error);
            return '';
        }
    }

    /**
     * Replace all structural placeholders in template
     */
    public static replaceStructuralPlaceholders(
        template: string, 
        placeholders: Map<string, string>
    ): string {
        console.log('CREATE_STRUCTURE: Replacing structural placeholders');

        let result = template;

        // Replace placeholders with multiple formats: {{PLACEHOLDER}} and ${PLACEHOLDER}
        for (const [placeholder, value] of placeholders) {
            const patterns = [
                new RegExp(`\\$\\{${this.escapeRegex(placeholder)}\\}`, 'g'),
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g')
            ];

            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }

        // Check for unresolved structural placeholders
        const unresolvedPlaceholders = result.match(/\{\{[^}]+\}\}|\$\{[^}]+\}/g);
        if (unresolvedPlaceholders) {
            console.warn(`CREATE_STRUCTURE: Unresolved structural placeholders found:`, unresolvedPlaceholders);
        }

        console.log('CREATE_STRUCTURE: Structural placeholders replaced');
        return result;
    }

    /**
     * Create environment-specific placeholders
     */
    public static createEnvironmentPlaceholders(
        visualizationSettings: VisualizationSettings
    ): Map<string, string> {
        const placeholders = new Map<string, string>();

        placeholders.set('ENVIRONMENT_PRESET', visualizationSettings.environment);
        placeholders.set('BACKGROUND_COLOR', visualizationSettings.backgroundColor);
        placeholders.set('GROUND_COLOR', visualizationSettings.groundColor);
        placeholders.set('PALETTE', visualizationSettings.palette);

        console.log(`CREATE_STRUCTURE: Created environment placeholders`);
        return placeholders;
    }

    /**
     * Create data source placeholders
     */
    public static createDataSourcePlaceholders(dataSource: string): Map<string, string> {
        const placeholders = new Map<string, string>();

        placeholders.set('DATA_SOURCE', dataSource);
        placeholders.set('DATA_PATH', dataSource);
        placeholders.set('JSON_SOURCE', dataSource);

        console.log(`CREATE_STRUCTURE: Created data source placeholders`);
        return placeholders;
    }

    /**
     * Create metadata placeholders
     */
    public static createMetadataPlaceholders(
        title: string, 
        analysisType: string = 'unknown'
    ): Map<string, string> {
        const placeholders = new Map<string, string>();

        placeholders.set('TITLE', title);
        placeholders.set('PAGE_TITLE', title);
        placeholders.set('ANALYSIS_TYPE', analysisType);
        placeholders.set('TIMESTAMP', new Date().toISOString());
        placeholders.set('NONCE', generateNonce());

        console.log(`CREATE_STRUCTURE: Created metadata placeholders`);
        return placeholders;
    }

    /**
     * Combine multiple placeholder maps
     */
    public static combinePlaceholders(...placeholderMaps: Map<string, string>[]): Map<string, string> {
        const combined = new Map<string, string>();

        for (const map of placeholderMaps) {
            for (const [key, value] of map) {
                combined.set(key, value);
            }
        }

        console.log(`CREATE_STRUCTURE: Combined ${combined.size} total placeholders`);
        return combined;
    }

    /**
     * Escape special regex characters
     */
    private static escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Get available analysis types for SSE script selection
     */
    public static getAvailableAnalysisTypes(): string[] {
        return ['xr', 'dom', 'none'];
    }

    /**
     * Validate analysis type
     */
    public static isValidAnalysisType(type: string): type is 'xr' | 'dom' | 'none' {
        return ['xr', 'dom', 'none'].includes(type);
    }
}


