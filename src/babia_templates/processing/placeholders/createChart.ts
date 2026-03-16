import { ChartMetadata, DimensionMapping } from '../../models/chartModels';
import { chartTemplates, DEFAULT_BOATS_LEGEND_TEXT } from '../../charts/templateCharts';

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
            // Get or create chart template
            const chart = this.getOrCreateChart(chartId);
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
     * Get existing chart from chartTemplates or create default boats chart
     */
    private static getOrCreateChart(chartId: string): ChartMetadata | null {
        // First try to find existing chart
        const existingChart = chartTemplates.find(c => c.id === chartId);
        if (existingChart) {
            console.log(`CREATE_CHART: Found existing chart: ${chartId}`);
            return existingChart;
        }

        // If not found and it's 'boats', create default boats chart
        if (chartId === 'boats') {
            console.log(`CREATE_CHART: Creating default boats chart`);
            return this.createDefaultBoatsChart();
        }

        // For other unknown charts, return null
        console.error(`CREATE_CHART: Unknown chart ID and cannot create default: ${chartId}`);
        return null;
    }

    /**
     * Create default boats chart with standard XR analysis dimensions
     */
    private static createDefaultBoatsChart(): ChartMetadata {
        return {
            id: 'boats',
            name: 'Boats Chart',
            description: 'XR Analysis Boats Chart with Parameters, Lines Count, and Complexity',
            category: 'geometric',
            dimensions: [
                {
                    name: 'area',
                    label: 'Area (Parameters)',
                    dataType: 'numeric',
                    required: true,
                    description: 'Function parameters count'
                },
                {
                    name: 'height',
                    label: 'Height (Lines Count)',
                    dataType: 'numeric',
                    required: true,
                    description: 'Lines of code count'
                },
                {
                    name: 'color',
                    label: 'Color (Complexity)',
                    dataType: 'any',
                    required: true,
                    description: 'Categorical or numeric field used for boat color grouping'
                }
            ],
            htmlTemplate: `<!-- XR Analysis Boats Chart -->
                <a-entity id="{{CHART_ID}}"
                    babia-boats="from: data;
                                 title: {{TITLE}};
                                 legend: true;
                                 legend_text: ${DEFAULT_BOATS_LEGEND_TEXT};
                                 height_building_legend: -0.5;
                                 legend_scale: 0.25;
                                 legend_lookat: [laser-controls];
                                 palette: {{PALETTE}};
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}};
                                 axis_name: true;
                                 extra: 1;
                                 separation: 0.5;
                                 zone_elevation: 0.01;
                                 height_quarter_legend_box: 0.01;
                                 height_quarter_legend_title: 2.5"
                    codexr-boats-pedestal="enabled: true;
                                           anchorX: 0;
                                           anchorY: 1;
                                           anchorZ: -18;
                                           uiDockEnabled: false;
                                           minPlanarOccupancyRatio: 0.82;
                                           minHeightOccupancyRatio: 0.68;
                                           buildingHeightBandEnabled: true;
                                           buildingHeightMinTarget: 0.42;
                                           buildingHeightMaxTarget: 1.22;
                                           buildingHeightToleranceRatio: 0.08;
                                           yScaleMin: 0.03;
                                           yScaleMax: 0.16;
                                           targetWidth: 5.614;
                                           targetHeight: 1.8;
                                           targetDepth: 3.218"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="0.01 0.05 0.01"
                    class="babiaxraycasterclass">
                </a-entity>`
        };
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

