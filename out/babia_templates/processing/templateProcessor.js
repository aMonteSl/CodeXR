"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateProcessor = void 0;
const dimensionValidator_1 = require("./dimensionValidator");
const templateCharts_1 = require("../charts/templateCharts");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * BabiaXR Template Processor
 * Main and centralized processor for generating XR visualization HTML files
 * Handles template processing, placeholder replacement, and HTML generation
 */
class TemplateProcessor {
    /**
     * Main method to generate complete XR visualization index.html
     * This is the centralized method that both visualize data and XR analysis should use
     */
    static async generateXRVisualization(chartId, mappings, title, dataSource, context, outputPath) {
        try {
            console.log('TEMPLATE_PROCESSOR: Starting XR visualization generation');
            console.log('TEMPLATE_PROCESSOR: Chart ID:', chartId);
            console.log('TEMPLATE_PROCESSOR: Mappings:', mappings);
            console.log('TEMPLATE_PROCESSOR: Title:', title);
            console.log('TEMPLATE_PROCESSOR: Data source:', dataSource);
            // Find the chart template
            const chart = templateCharts_1.chartTemplates.find(c => c.id === chartId);
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
        }
        catch (error) {
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
    static async getVisualizationSettings() {
        // Import visualization settings functions directly (no dynamic import needed)
        const { getSelectedPalette, getSelectedEnvironment, getSelectedBackgroundColor, getSelectedGroundColor } = require('../../visualization_settings');
        return {
            palette: await getSelectedPalette(),
            environment: await getSelectedEnvironment(),
            backgroundColor: await getSelectedBackgroundColor(),
            groundColor: await getSelectedGroundColor()
        };
    }
    /**
     * Load XR base template from templates/xr/xr-visualization.html
     */
    static async loadXRTemplate(context) {
        try {
            const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'xr-visualization.html');
            if (!fs.existsSync(templatePath)) {
                console.error('TEMPLATE_PROCESSOR: XR template not found at:', templatePath);
                return null;
            }
            const template = fs.readFileSync(templatePath, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Loaded XR template from:', templatePath);
            return template;
        }
        catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error loading XR template:', error);
            return null;
        }
    }
    /**
     * Generate chart component HTML using the chart template
     */
    static async generateChartComponent(chart, mappings, title, palette) {
        console.log('TEMPLATE_PROCESSOR: Generating chart component for:', chart.id);
        // Create configuration for chart processing
        const config = {
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
    static replaceXRTemplatePlaceholders(template, values) {
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
    static async processTemplate(chart, mappings, config) {
        // Validate dimensions first
        const validation = dimensionValidator_1.DimensionValidator.validateMappings(chart, mappings);
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
        }
        catch (error) {
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
    static createPlaceholderReplacements(chart, mappings, config) {
        const replacements = new Map();
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
    static replacePlaceholders(template, replacements) {
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
    static escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    /**
     * Basic validation of generated HTML
     */
    static validateGeneratedHtml(html) {
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
    static getAvailablePlaceholders(chart) {
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
    static async previewTemplate(chart, sampleMappings) {
        const defaultMappings = sampleMappings || chart.dimensions.map(dim => ({
            dimension: dim.name,
            dataField: `sample_${dim.name}`
        }));
        const defaultConfig = {
            chartType: chart.id,
            title: `Sample ${chart.name}`,
            dataFilePath: 'sample-data.json',
            dimensionMappings: defaultMappings
        };
        const result = await this.processTemplate(chart, defaultMappings, defaultConfig);
        return result.success ? (result.html || '') : `<!-- Error: ${result.error || 'Unknown error'} -->`;
    }
}
exports.TemplateProcessor = TemplateProcessor;
//# sourceMappingURL=templateProcessor.js.map