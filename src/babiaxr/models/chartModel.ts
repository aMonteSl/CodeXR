/**
 * Types of charts available in BabiaXR
 */
export enum ChartType {
    BARSMAP_CHART = 'Barsmap Chart',
    BARS_CHART = 'Bars Chart',
    CYLS_CHART = 'Cylinder Chart', // Add this new type
    PIE_CHART = 'Pie Chart',
    DONUT_CHART = 'Donut Chart',
    SCATTER_PLOT = 'Scatter Plot',
    NETWORK_GRAPH = 'Network Graph'
}

/**
 * Base configuration for all chart types
 */
export interface ChartData {
    /** Title of the chart */
    title: string;
    
    /** URL or path to the data source (CSV/JSON) */
    dataSource: string;

    /** Original URL or path to the data source */
    originalDataSource?: string;

    /** Key for x-axis data */
    xKey: string;

    /** Key for y-axis data */
    yKey: string;

    /** Key for z-axis data (optional) */
    zKey?: string;

    /** Columns to visualize */
    dimensions?: string[];
    
    /** Optional description for the chart */
    description?: string;
    
    /** Creation timestamp */
    createdAt?: number;

    /** Chart-specific options */
    options?: {
        /** Add this option for pie charts */
        isDonut?: boolean;

        /** Add this for customizing the donut size */
        donutRadius?: number;
    };

    /** Environment configuration */
    environment?: EnvironmentOptions;

    /** Position in 3D space (x y z) - will be set by default */
    position?: string;

    /** Scale in 3D space (x y z) - will be set by default */
    scale?: string;

    /** Rotation in 3D space (x y z) - will be set by default */
    rotation?: string;

    /** Height of the visualization - will be set by default */
    height?: string | number;
}

/**
 * Bar chart specific configuration
 */
export interface BarChartOptions {
    /** Whether to use vertical or horizontal bars */
    horizontal?: boolean;
    
    /** Height of the visualization in meters */
    height?: number;
    
    /** Width of the visualization in meters */
    width?: number;
    
    /** Color scheme for the bars */
    colorScheme?: string;
}

/**
 * Pie chart specific configuration
 */
export interface PieChartOptions {
    /** Size (diameter) of the pie in meters */
    size?: number;
    
    /** Height/thickness of the pie in meters */
    height?: number;
    
    /** Whether to add labels */
    showLabels?: boolean;
    
    /** Whether to show as donut chart */
    donut?: boolean;
}

/**
 * Donut chart specific configuration
 */
export interface DonutChartOptions {
    /** Size (diameter) of the donut in meters */
    size?: number;
    
    /** Height/thickness of the donut in meters */
    height?: number;
    
    /** Inner radius ratio (0.1-0.9) */
    donutRadius?: number;
}

/**
 * Time series specific configuration
 */
export interface TimeSeriesOptions {
    /** Column containing time data */
    timeColumn: string;
    
    /** Date format (if needed) */
    timeFormat?: string;
    
    /** Whether to show as area chart */
    area?: boolean;
    
    /** Width of the visualization in meters */
    width?: number;
    
    /** Height of the visualization in meters */
    height?: number;
}

/**
 * Common 3D options for all chart types
 */
export interface Chart3DOptions {
    /** Position in 3D space (x y z) */
    position?: string;
    /** Scale in 3D space (x y z) */
    scale?: string;
    /** Rotation in 3D space (x y z) */
    rotation?: string;
    /** Height multiplier for charts */
    height?: number;
}

/**
 * Complete chart specification with all options
 */
export interface ChartSpecification {
    /** Basic chart metadata and data source */
    data: ChartData;
    
    /** Type of chart to create */
    type: ChartType;
    
    /** Chart-specific options combined with 3D options */
    options: Chart3DOptions;
    
    /** Path to the generated HTML file (if saved) */
    outputPath?: string;
}

/**
 * Chart template mapping
 */
export interface ChartTemplate {
    /** Type of chart this template is for */
    chartType: ChartType;
    
    /** File name of the template */
    fileName: string;
    
    /** Description of the template */
    description: string;
}

/**
 * Variable mapping for template replacement
 */
export interface TemplateVariableMap {
    [key: string]: string | number | boolean;
}

/**
 * Environment configuration for visualizations
 */
export interface EnvironmentOptions {
    /** Background color of the scene */
    backgroundColor: string;
    
    /** Environment preset (forest, starry, dream, etc) */
    environmentPreset: string;
    
    /** Ground color for the environment */
    groundColor: string;
    
    /** Color palette for charts */
    chartPalette: string;
}