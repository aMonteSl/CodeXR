"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BabiaChartRegistry = void 0;
const templateCharts_1 = require("../charts/templateCharts");
/**
 * BabiaXR Chart Registry
 * Central registry for available chart types and their metadata
 */
class BabiaChartRegistry {
    static instance;
    charts = new Map();
    constructor() {
        this.initializeCharts();
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!BabiaChartRegistry.instance) {
            BabiaChartRegistry.instance = new BabiaChartRegistry();
        }
        return BabiaChartRegistry.instance;
    }
    /**
     * Initialize all chart definitions from templates
     */
    initializeCharts() {
        // Register all chart templates
        for (const chartTemplate of templateCharts_1.chartTemplates) {
            this.charts.set(chartTemplate.id, chartTemplate);
        }
        console.log('BABIA_TEMPLATES: Initialized chart registry with chart templates');
    }
    /**
     * Register a new chart type
     */
    registerChart(chart) {
        this.charts.set(chart.id, chart);
        console.log(`BABIA_TEMPLATES: Registered chart type '${chart.id}'`);
    }
    /**
     * Get a chart by ID
     */
    getChart(chartId) {
        return this.charts.get(chartId);
    }
    /**
     * Get all available charts
     */
    getAllCharts() {
        return Array.from(this.charts.values());
    }
    /**
     * Get charts by category
     */
    getChartsByCategory(category) {
        return Array.from(this.charts.values()).filter(chart => chart.category === category);
    }
    /**
     * Check if a chart type exists
     */
    hasChart(chartId) {
        return this.charts.has(chartId);
    }
    /**
     * Get all available chart IDs
     */
    getChartIds() {
        return Array.from(this.charts.keys());
    }
    /**
     * Get chart names for display
     */
    getChartNames() {
        return Array.from(this.charts.values()).map(chart => ({
            id: chart.id,
            name: chart.name,
            description: chart.description
        }));
    }
}
exports.BabiaChartRegistry = BabiaChartRegistry;
//# sourceMappingURL=chartRegistry.js.map