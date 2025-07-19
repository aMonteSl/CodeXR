/**
 * BabiaXR Templates System Demonstration
 * This script shows how to use the chart template system
 */

import { 
    BabiaChartRegistry, 
    TemplateProcessor, 
    DimensionValidator,
    ChartMetadata,
    DimensionMapping,
    VisualizationConfig 
} from '../babia_templates';

/**
 * Demonstration of the BabiaXR Templates System
 */
export class BabiaTemplatesDemo {

    /**
     * Demonstrate chart registry functionality
     */
    public static demonstrateRegistry(): void {
        console.log('=== BabiaXR Chart Registry Demo ===');
        
        const registry = BabiaChartRegistry.getInstance();
        
        // Get all available charts
        const charts = registry.getAllCharts();
        console.log(`Available charts: ${charts.length}`);
        
        for (const chart of charts) {
            console.log(`- ${chart.name} (${chart.id}): ${chart.description}`);
            console.log(`  Dimensions: ${chart.dimensions.map(d => d.name).join(', ')}`);
            console.log(`  Category: ${chart.category}`);
        }

        // Get charts by category
        const circularCharts = registry.getChartsByCategory('circular');
        console.log(`\nCircular charts: ${circularCharts.map(c => c.name).join(', ')}`);

        const linearCharts = registry.getChartsByCategory('linear');
        console.log(`Linear charts: ${linearCharts.map(c => c.name).join(', ')}`);

        const threeDCharts = registry.getChartsByCategory('3d');
        console.log(`3D charts: ${threeDCharts.map(c => c.name).join(', ')}`);
    }

    /**
     * Demonstrate dimension validation
     */
    public static demonstrateValidation(): void {
        console.log('\n=== Dimension Validation Demo ===');
        
        const registry = BabiaChartRegistry.getInstance();
        const donutChart = registry.getChart('donut');
        
        if (!donutChart) {
            console.log('Donut chart not found');
            return;
        }

        // Valid mappings
        const validMappings: DimensionMapping[] = [
            { dimension: 'key', dataField: 'category' },
            { dimension: 'size', dataField: 'value' }
        ];

        const validResult = DimensionValidator.validateMappings(donutChart, validMappings);
        console.log(`Valid mappings result: ${validResult.isValid}`);
        console.log(`Errors: ${validResult.errors.length}`);
        console.log(`Warnings: ${validResult.warnings.length}`);

        // Invalid mappings (missing required dimension)
        const invalidMappings: DimensionMapping[] = [
            { dimension: 'key', dataField: 'category' }
            // Missing 'size' dimension
        ];

        const invalidResult = DimensionValidator.validateMappings(donutChart, invalidMappings);
        console.log(`\nInvalid mappings result: ${invalidResult.isValid}`);
        console.log(`Errors: ${invalidResult.errors.join('; ')}`);
        console.log(`Warnings: ${invalidResult.warnings.join('; ')}`);
    }

    /**
     * Demonstrate template processing
     */
    public static async demonstrateTemplateProcessing(): Promise<void> {
        console.log('\n=== Template Processing Demo ===');
        
        const registry = BabiaChartRegistry.getInstance();
        const barChart = registry.getChart('bar');
        
        if (!barChart) {
            console.log('Bar chart not found');
            return;
        }

        // Create dimension mappings
        const mappings: DimensionMapping[] = [
            { dimension: 'key', dataField: 'product' },
            { dimension: 'height', dataField: 'sales' }
        ];

        // Create visualization config
        const config: VisualizationConfig = {
            chartType: 'bar',
            title: 'Monthly Sales by Product',
            dataFilePath: '/path/to/sales-data.json',
            dimensionMappings: mappings,
            options: {
                barColor: '#3498db',
                showGrid: true
            }
        };

        // Process template
        const result = await TemplateProcessor.processTemplate(barChart, mappings, config);
        
        console.log(`Processing successful: ${result.success}`);
        if (result.success) {
            console.log('Generated HTML length:', result.html?.length || 0);
            console.log('Warnings:', result.warnings?.length || 0);
        } else {
            console.log('Error:', result.error);
        }
    }

    /**
     * Demonstrate template preview
     */
    public static async demonstrateTemplatePreview(): Promise<void> {
        console.log('\n=== Template Preview Demo ===');
        
        const registry = BabiaChartRegistry.getInstance();
        const charts = registry.getAllCharts();
        
        for (const chart of charts.slice(0, 2)) { // Preview first 2 charts
            console.log(`\nPreviewing ${chart.name}...`);
            const preview = await TemplateProcessor.previewTemplate(chart);
            console.log(`Preview HTML length: ${preview.length}`);
            console.log('Contains BabiaXR components:', preview.includes('babia-'));
        }
    }

    /**
     * Run all demonstrations
     */
    public static async runAllDemos(): Promise<void> {
        console.log('🚀 Starting BabiaXR Templates System Demonstration\n');
        
        this.demonstrateRegistry();
        this.demonstrateValidation();
        await this.demonstrateTemplateProcessing();
        await this.demonstrateTemplatePreview();
        
        console.log('\n✅ All demonstrations completed successfully!');
    }
}
