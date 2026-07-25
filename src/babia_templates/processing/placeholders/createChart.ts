import { ChartMetadata, DimensionMapping } from '../../models/chartModels';
import { chartTemplates } from '../../charts/templateCharts';

/**
 * Chart Creator Module - Specialized for Chart Entity Creation
 * Focused solely on creating chart entities with dimension mappings
 * Part of the modular restructuring for cleaner architecture
 */
export class CreateChart {

    /**
     * Main method to create a chart entity with dimension mappings
     * Returns only the chart HTML component, no structural elements
     */
    public static createChartEntity(
        chartId: string,
        mappings: DimensionMapping[],
        title: string = 'Chart Visualization',
        palette: string = 'ubuntu'
    ): { success: boolean; chartHtml?: string; error?: string } {
        
        console.log(`CREATE_CHART: Creating chart entity with ID: ${chartId}`);
        console.log(`CREATE_CHART: Mappings:`, mappings);

        try {
            // Every chart — boats included — comes from the single canonical
            // template list; a duplicated boats fallback used to live here and
            // drifted from the real one.
            const chart = chartTemplates.find((candidate) => candidate.id === chartId) || null;
            if (!chart) {
                return { 
                    success: false, 
                    error: `Failed to get or create chart with ID: ${chartId}` 
                };
            }

            // Validate mappings against chart dimensions
            const validation = this.validateMappings(chart, mappings);
            if (!validation.isValid) {
                return { 
                    success: false, 
                    error: `Invalid mappings: ${validation.errors.join(', ')}` 
                };
            }

            // Create placeholders map for chart-specific placeholders
            const placeholders = this.createChartPlaceholders(chart, mappings, title, palette);

            // Replace placeholders in chart template
            const processedChartHtml = this.replacePlaceholders(chart.htmlTemplate, placeholders);

            console.log(`CREATE_CHART: Chart entity created successfully for: ${chartId}`);
            return { 
                success: true, 
                chartHtml: processedChartHtml 
            };

        } catch (error) {
            console.error(`CREATE_CHART: Error creating chart entity:`, error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Validate that mappings match chart dimensions
     */
    private static validateMappings(
        chart: ChartMetadata, 
        mappings: DimensionMapping[]
    ): { isValid: boolean; errors: string[] } {
        
        const errors: string[] = [];

        // Check that all required dimensions are mapped
        for (const dimension of chart.dimensions) {
            if (dimension.required) {
                const mapping = mappings.find(m => m.dimension === dimension.name);
                if (!mapping) {
                    errors.push(`Required dimension '${dimension.name}' is not mapped`);
                } else if (!mapping.dataField || mapping.dataField.trim() === '') {
                    errors.push(`Required dimension '${dimension.name}' has empty dataField`);
                }
            }
        }

        // Check that all mappings reference valid dimensions
        for (const mapping of mappings) {
            const dimension = chart.dimensions.find(d => d.name === mapping.dimension);
            if (!dimension) {
                errors.push(`Mapping references unknown dimension: '${mapping.dimension}'`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Create chart-specific placeholders map (no structural placeholders)
     */
    private static createChartPlaceholders(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
        title: string,
        palette: string
    ): Map<string, string> {
        
        const placeholders = new Map<string, string>();

        // Basic chart placeholders
        placeholders.set('TITLE', title);
        placeholders.set('PALETTE', palette);
        placeholders.set('CHART_ID', `chart-${chart.id}-${Date.now()}`);

        // Dimension-specific placeholders
        for (const mapping of mappings) {
            const dimension = chart.dimensions.find(d => d.name === mapping.dimension);
            if (dimension) {
                const fieldName = mapping.dataField;
                const upperDimension = mapping.dimension.toUpperCase();

                // Multiple placeholder formats for flexibility
                placeholders.set(`${upperDimension}_FIELD`, fieldName);
                placeholders.set(`${mapping.dimension}_field`, fieldName);
                placeholders.set(mapping.dimension, fieldName);

                // Special common dimension mappings
                switch (mapping.dimension.toLowerCase()) {
                    case 'area':
                        placeholders.set('AREA_FIELD', fieldName);
                        break;
                    case 'height':
                        placeholders.set('HEIGHT_FIELD', fieldName);
                        break;
                    case 'color':
                        placeholders.set('COLOR_FIELD', fieldName);
                        break;
                    case 'key':
                    case 'category':
                        placeholders.set('KEY_FIELD', fieldName);
                        placeholders.set('CATEGORY_FIELD', fieldName);
                        break;
                    case 'size':
                    case 'value':
                        placeholders.set('SIZE_FIELD', fieldName);
                        placeholders.set('VALUE_FIELD', fieldName);
                        break;
                    case 'x_axis':
                        placeholders.set('X_AXIS_FIELD', fieldName);
                        break;
                    case 'y_axis':
                        placeholders.set('Y_AXIS_FIELD', fieldName);
                        break;
                }
            }
        }

        console.log(`CREATE_CHART: Created ${placeholders.size} chart placeholders`);
        return placeholders;
    }

    /**
     * Replace placeholders in chart template with actual values
     */
    private static replacePlaceholders(template: string, placeholders: Map<string, string>): string {
        let result = template;

        // Replace placeholders with multiple formats: {{PLACEHOLDER}} and ${PLACEHOLDER}
        for (const [placeholder, value] of placeholders) {
            const patterns = [
                new RegExp(`\\{\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}\\}`, 'g'),
                new RegExp(`\\$\\{\\s*${this.escapeRegex(placeholder)}\\s*\\}`, 'g')
            ];

            for (const pattern of patterns) {
                result = result.replace(pattern, value);
            }
        }

        // Check for unresolved chart placeholders
        const unresolvedPlaceholders = result.match(/\{\{[^}]+\}\}|\$\{[^}]+\}/g);
        if (unresolvedPlaceholders) {
            console.warn(`CREATE_CHART: Unresolved chart placeholders found:`, unresolvedPlaceholders);
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
     * Get available charts with their dimensions
     */
    public static getAvailableCharts(): { id: string; name: string; dimensions: string[] }[] {
        return chartTemplates.map(chart => ({
            id: chart.id,
            name: chart.name,
            dimensions: chart.dimensions.map(d => d.name)
        }));
    }

    /**
     * Get chart metadata by ID
     */
    public static getChartMetadata(chartId: string): ChartMetadata | null {
        return chartTemplates.find(c => c.id === chartId) || null;
    }

    /**
     * Create default mappings for XR analysis (boats chart)
     */
    public static createDefaultXRMappings(): DimensionMapping[] {
        return [
            { dimension: 'area', dataField: 'parameters' },
            { dimension: 'height', dataField: 'lineCount' },
            { dimension: 'color', dataField: 'complexity' }
        ];
    }
}

