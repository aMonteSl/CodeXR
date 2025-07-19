/**
 * BabiaXR Templates System
 * Entry point for the chart template system
 */

// Export models
export * from './models/chartModels';

// Export chart templates
export { chartTemplates } from './charts/templateCharts';

// Export registry
export { BabiaChartRegistry } from './registry/chartRegistry';

// Export processing utilities
export { DimensionValidator } from './processing/dimensionValidator';
export { TemplateProcessor } from './processing/templateProcessor';

// Re-export key types for convenience
export type {
    ChartMetadata,
    DimensionMapping,
    VisualizationConfig,
    TemplateProcessingResult,
    ChartValidationResult,
    ChartDimension
} from './models/chartModels';
