import { ChartMetadata } from '../models/chartModels';
import { chartTemplates } from '../charts/templateCharts';

/**
 * BabiaXR Chart Registry
 * Central registry for available chart types and their metadata
 */
export class BabiaChartRegistry {
    private static instance: BabiaChartRegistry;
    private charts: Map<string, ChartMetadata> = new Map();

    private constructor() {
        this.initializeCharts();
    }

    /**
     * Get the singleton instance
     */
    public static getInstance(): BabiaChartRegistry {
        if (!BabiaChartRegistry.instance) {
            BabiaChartRegistry.instance = new BabiaChartRegistry();
        }
        return BabiaChartRegistry.instance;
    }

    /**
     * Initialize all chart definitions from templates
     */
    private initializeCharts(): void {
        // Register all chart templates
        for (const chartTemplate of chartTemplates) {
            this.charts.set(chartTemplate.id, chartTemplate);
        }

        console.log('BABIA_TEMPLATES: Initialized chart registry with chart templates');
    }

    /**
     * Register a new chart type
     */
    public registerChart(chart: ChartMetadata): void {
        this.charts.set(chart.id, chart);
        console.log(`BABIA_TEMPLATES: Registered chart type '${chart.id}'`);
    }

    /**
     * Get a chart by ID
     */
    public getChart(chartId: string): ChartMetadata | undefined {
        return this.charts.get(chartId);
    }

    /**
     * Get all available charts
     */
    public getAllCharts(): ChartMetadata[] {
        return Array.from(this.charts.values());
    }

    /**
     * Get charts by category
     */
    public getChartsByCategory(category: string): ChartMetadata[] {
        return Array.from(this.charts.values()).filter(chart => chart.category === category);
    }

    /**
     * Check if a chart type exists
     */
    public hasChart(chartId: string): boolean {
        return this.charts.has(chartId);
    }

    /**
     * Get all available chart IDs
     */
    public getChartIds(): string[] {
        return Array.from(this.charts.keys());
    }

    /**
     * Get chart names for display
     */
    public getChartNames(): Array<{ id: string; name: string; description: string }> {
        return Array.from(this.charts.values()).map(chart => ({
            id: chart.id,
            name: chart.name,
            description: chart.description
        }));
    }
}
