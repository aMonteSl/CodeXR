/**
 * BabiaXR Template System Models
 * Core interfaces for chart metadata and dimension mapping
 */

/**
 * Supported data types for chart dimensions
 */
export type DimensionDataType = 'numeric' | 'text' | 'any';
export type DimensionValueRule = 'text-non-empty' | 'numeric-finite' | 'numeric-positive';

/**
 * Chart dimension definition
 */
export interface ChartDimension {
    /** Name of the dimension (e.g., 'key', 'size') */
    name: string;
    
    /** Display label for the dimension */
    label: string;
    
    /** Expected data type for this dimension */
    dataType: DimensionDataType;

    /** Optional runtime rule for validating mapped values */
    valueRule?: DimensionValueRule;
    
    /** Whether this dimension is required */
    required: boolean;
    
    /** Description of what this dimension represents */
    description?: string;
}

/**
 * Chart metadata definition
 */
export interface ChartMetadata {
    /** Unique identifier for the chart type */
    id: string;

    /** Runtime engine that renders this chart */
    engine?: 'babia' | 'codexr';

    /** A-Frame component used by the mapping/runtime layer */
    componentName?: string;
    
    /** Display name of the chart */
    name: string;
    
    /** Description of the chart */
    description: string;
    
    /** List of supported dimensions */
    dimensions: ChartDimension[];
    
    /** HTML template for the chart component */
    htmlTemplate: string;
    
    /** Category of the chart (e.g., 'circular', 'linear', '3d') */
    category: string;
}

/**
 * Dimension mapping configuration
 */
export interface DimensionMapping {
    /** Dimension name */
    dimension: string;
    
    /** Data field name to map to this dimension */
    dataField: string;
    
    /** Optional label override */
    label?: string;
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
    /** Selected chart type ID */
    chartType: string;
    
    /** Path to the JSON data file */
    dataFilePath: string;
    
    /** Dimension mappings */
    dimensionMappings: DimensionMapping[];
    
    /** Visualization title */
    title: string;
    
    /** Additional configuration options */
    options?: Record<string, any>;
}

/**
 * Template processing result
 */
export interface TemplateProcessingResult {
    /** Whether processing was successful */
    success: boolean;
    
    /** Generated HTML content */
    html?: string;
    
    /** Error message if processing failed */
    error?: string;
    
    /** Validation warnings */
    warnings?: string[];
}

/**
 * Chart validation result
 */
export interface ChartValidationResult {
    /** Whether the configuration is valid */
    isValid: boolean;
    
    /** Validation errors */
    errors: string[];
    
    /** Validation warnings */
    warnings: string[];
}
