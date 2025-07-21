import { ChartMetadata, DimensionMapping, VisualizationConfig, TemplateProcessingResult } from '../models/chartModels';
import { DimensionValidator } from './dimensionValidator';
import { chartTemplates } from '../charts/templateCharts';
import { getVisualizationConfiguration, VisualizationSettings } from '../../utils/getVisualizationConfiguration';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * BabiaXR Template Processor
 * Main and centralized processor for generating XR visualization HTML files
 * Handles template processing, placeholder replacement, and HTML generation
 */
export class TemplateProcessor {

    /**
     * Main method to generate complete XR visualization index.html
     * This is the centralized method that both visualize data and XR analysis should use
     */
    public static async generateXRVisualization(
        chartId: string,
        mappings: DimensionMapping[],
        title: string,
        dataSource: string,
        context: vscode.ExtensionContext,
        outputPath: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('TEMPLATE_PROCESSOR: Starting XR visualization generation');
            console.log('TEMPLATE_PROCESSOR: Chart ID:', chartId);
            console.log('TEMPLATE_PROCESSOR: Mappings:', mappings);
            console.log('TEMPLATE_PROCESSOR: Title:', title);
            console.log('TEMPLATE_PROCESSOR: Data source:', dataSource);

            // Find the chart template
            const chart = chartTemplates.find(c => c.id === chartId);
            if (!chart) {
                return { success: false, error: `Chart type '${chartId}' not found` };
            }

            // Get visualization settings
            const visualizationSettings = await this.getVisualizationSettings();
            console.log('TEMPLATE_PROCESSOR: Using visualization settings:', visualizationSettings);

            // Load XR base template
            const xrTemplate = await this.loadXRTemplate(context);
            if (!xrTemplate) {
                return { success: false, error: 'Failed to load XR template' };
            }

            // Generate chart component HTML
            const chartComponent = await this.generateChartComponent(chart, mappings, title, visualizationSettings.palette);
            
            // Replace all placeholders in the XR template
            const finalHtml = this.replaceXRTemplatePlaceholders(xrTemplate, {
                title,
                dataSource,
                chartComponent,
                ...visualizationSettings
            });

            // Write the final HTML file
            fs.writeFileSync(outputPath, finalHtml, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Generated XR visualization HTML at:', outputPath);

            return { success: true };

        } catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error generating XR visualization:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Get visualization settings (palette, environment, colors)
     */
    private static async getVisualizationSettings(): Promise<VisualizationSettings> {
        return await getVisualizationConfiguration();
    }

    /**
     * Load XR base template from templates/xr/xr-visualization.html
     */
    private static async loadXRTemplate(context: vscode.ExtensionContext): Promise<string | null> {
        try {
            const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'xr-visualization.html');
            
            if (!fs.existsSync(templatePath)) {
                console.error('TEMPLATE_PROCESSOR: XR template not found at:', templatePath);
                return null;
            }

            const template = fs.readFileSync(templatePath, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Loaded XR template from:', templatePath);
            return template;

        } catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error loading XR template:', error);
            return null;
        }
    }

    /**
     * Generate chart component HTML using the chart template
     */
    private static async generateChartComponent(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
        title: string,
        palette: string
    ): Promise<string> {
        console.log('TEMPLATE_PROCESSOR: Generating chart component for:', chart.id);

        // Create configuration for chart processing
        const config: VisualizationConfig = {
            chartType: chart.id,
            title: title,
            dataFilePath: 'data.json',
            dimensionMappings: mappings,
            options: {
                palette: palette
            }
        };

        // Process the chart template
        const result = await this.processTemplate(chart, mappings, config);
        
        if (!result.success) {
            console.error('TEMPLATE_PROCESSOR: Chart component generation failed:', result.error);
            return `<!-- Chart generation error: ${result.error || 'Unknown error'} -->`;
        }

        console.log('TEMPLATE_PROCESSOR: Chart component generated successfully');
        return result.html || '';
    }

    /**
     * Replace all placeholders in the XR template
     */
    private static replaceXRTemplatePlaceholders(
        template: string,
        values: {
            title: string;
            dataSource: string;
            chartComponent: string;
            palette: string;
            environment: string;
            backgroundColor: string;
            groundColor: string;
        }
    ): string {
        console.log('TEMPLATE_PROCESSOR: Replacing XR template placeholders');

        let result = template;

        // Define placeholder replacements
        const replacements = {
            'TITLE': values.title,
            'DATA_SOURCE': values.dataSource,
            'CHART_COMPONENT': values.chartComponent,
            'CHART_PALETTE': values.palette,
            'ENVIRONMENT_PRESET': values.environment,
            'BACKGROUND_COLOR': values.backgroundColor,
            'GROUND_COLOR': values.groundColor,
            'TREE_BUILDER': '', // Not needed for basic charts
            'ICON_PATH': '' // Optional
        };

        // Replace all placeholders
        for (const [placeholder, value] of Object.entries(replacements)) {
            const patterns = [
                new RegExp(`\\$\\{${this.escapeRegex(placeholder)}\\}`, 'g'),
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g')
            ];

            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }

        console.log('TEMPLATE_PROCESSOR: XR template placeholders replaced');
        return result;
    }

    /**
     * Process a chart template with given configuration and mappings
     */
    public static async processTemplate(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
        config: VisualizationConfig
    ): Promise<TemplateProcessingResult> {
        
        // Validate dimensions first
        const validation = DimensionValidator.validateMappings(chart, mappings);
        if (!validation.isValid) {
            return {
                success: false,
                html: '',
                error: validation.errors.join('; '),
                warnings: validation.warnings
            };
        }

        try {
            // Start with the base template
            let html = chart.htmlTemplate;

            // Create placeholder replacements map
            const replacements = this.createPlaceholderReplacements(chart, mappings, config);

            // Replace all placeholders
            html = this.replacePlaceholders(html, replacements);

            // Validate final HTML
            const htmlValidation = this.validateGeneratedHtml(html);
            if (!htmlValidation.isValid) {
                return {
                    success: false,
                    html: '',
                    error: htmlValidation.error || 'Generated HTML is invalid',
                    warnings: validation.warnings
                };
            }

            return {
                success: true,
                html: html,
                warnings: validation.warnings
            };

        } catch (error) {
            return {
                success: false,
                html: '',
                error: `Template processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                warnings: validation.warnings
            };
        }
    }

    /**
     * Create map of placeholder replacements based on mappings and config
     */
    private static createPlaceholderReplacements(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
        config: VisualizationConfig
    ): Map<string, string> {
        const replacements = new Map<string, string>();

        // Add basic configuration replacements
        replacements.set('TITLE', config.title || chart.name);
        replacements.set('DATA_SOURCE', config.dataFilePath || 'data.json');
        replacements.set('CHART_ID', `chart-${chart.id}-${Date.now()}`);

        // Add dimension-specific replacements
        for (const mapping of mappings) {
            const dimension = chart.dimensions.find(d => d.name === mapping.dimension);
            if (dimension) {
                // Create various placeholder formats for the dimension
                const upperDimension = mapping.dimension.toUpperCase();
                const fieldName = mapping.dataField;

                replacements.set(`${upperDimension}_FIELD`, fieldName);
                replacements.set(`${mapping.dimension}_field`, fieldName);
                replacements.set(mapping.dimension, fieldName);

                // Special common dimension mappings
                switch (mapping.dimension.toLowerCase()) {
                    case 'key':
                    case 'category':
                        replacements.set('KEY_FIELD', fieldName);
                        replacements.set('CATEGORY_FIELD', fieldName);
                        break;
                    case 'size':
                    case 'value':
                        replacements.set('SIZE_FIELD', fieldName);
                        replacements.set('VALUE_FIELD', fieldName);
                        break;
                    case 'height':
                        replacements.set('HEIGHT_FIELD', fieldName);
                        break;
                    case 'color':
                        replacements.set('COLOR_FIELD', fieldName);
                        break;
                }
            }
        }

        // Add chart-specific attributes
        if (config.options) {
            for (const [key, value] of Object.entries(config.options)) {
                replacements.set(key.toUpperCase(), String(value));
                replacements.set(key, String(value));
            }
        }

        return replacements;
    }

    /**
     * Replace placeholders in template with actual values
     */
    private static replacePlaceholders(template: string, replacements: Map<string, string>): string {
        let result = template;

        // Replace {{PLACEHOLDER}} format
        for (const [placeholder, value] of replacements) {
            const patterns = [
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g'),
                new RegExp(`\\$\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}`, 'g')
            ];

            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }

        // Check for remaining unresolved placeholders and warn
        const unresolvedPlaceholders = result.match(/\{\{[^}]+\}\}|\$\{[^}]+\}/g);
        if (unresolvedPlaceholders) {
            console.warn('Unresolved placeholders found:', unresolvedPlaceholders);
        }

        return result;
    }

    /**
     * Escape special regex characters
     */
    private static escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Basic validation of generated HTML
     */
    private static validateGeneratedHtml(html: string): { isValid: boolean; error?: string } {
        // Check for basic HTML structure
        if (!html || html.trim() === '') {
            return { isValid: false, error: 'Generated HTML is empty' };
        }

        // Check for remaining unresolved placeholders
        const unresolvedPlaceholders = html.match(/\{\{[^}]+\}\}/g);
        if (unresolvedPlaceholders && unresolvedPlaceholders.length > 0) {
            return { 
                isValid: false, 
                error: `Unresolved placeholders: ${unresolvedPlaceholders.join(', ')}` 
            };
        }

        // Check for BabiaXR components
        if (!html.includes('babia-') && !html.includes('a-entity')) {
            return { 
                isValid: false, 
                error: 'Generated HTML does not contain BabiaXR components' 
            };
        }

        return { isValid: true };
    }

    /**
     * Get available placeholders for a chart
     */
    public static getAvailablePlaceholders(chart: ChartMetadata): string[] {
        const placeholders = [
            'TITLE',
            'DATA_SOURCE', 
            'CHART_ID'
        ];

        // Add dimension-based placeholders
        for (const dimension of chart.dimensions) {
            const upperDimension = dimension.name.toUpperCase();
            placeholders.push(`${upperDimension}_FIELD`);
        }

        return placeholders;
    }

    /**
     * Preview template with sample data for testing
     */
    public static async previewTemplate(
        chart: ChartMetadata,
        sampleMappings?: DimensionMapping[]
    ): Promise<string> {
        const defaultMappings = sampleMappings || chart.dimensions.map(dim => ({
            dimension: dim.name,
            dataField: `sample_${dim.name}`
        }));

        const defaultConfig: VisualizationConfig = {
            chartType: chart.id,
            title: `Sample ${chart.name}`,
            dataFilePath: 'sample-data.json',
            dimensionMappings: defaultMappings
        };

        const result = await this.processTemplate(chart, defaultMappings, defaultConfig);
        return result.success ? (result.html || '') : `<!-- Error: ${result.error || 'Unknown error'} -->`;
    }
}
