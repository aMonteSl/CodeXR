import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChartSpecification, TemplateVariableMap } from '../models/chartModel';

/**
 * Template variable definitions
 */
export interface TemplateVariables {
  /** Title of the visualization */
  title: string;
  /** Background color in hexadecimal format */
  backgroundColor: string;
  /** A-Frame environment preset */
  environmentPreset: string;
  /** Ground color in hexadecimal format */
  groundColor: string;
  /** URL or path to data source */
  dataSource: string;
  /** Chart color palette */
  chartPalette: string;
  /** Chart component specific attributes */
  chartAttributes: string;
}

/**
 * Chart configuration for BabiaXR
 */
export interface ChartConfig {
  /** Chart component name */
  component: string;
  /** Data key for X axis */
  xkey: string;
  /** Data key for Y axis */
  ykey: string;
  /** Data key for Z axis (optional) */
  zkey?: string;
  /** Data key for radius (optional) */
  radiuskey?: string;
  /** Data key for height (optional) */
  heightkey?: string;
  /** Position of the chart */
  position: string;
  /** Scale of the chart */
  scale?: string;
  /** Rotation of the chart */
  rotation?: string;
}

/**
 * Loads the chart template file
 * @param context VS Code extension context
 * @returns Template content as string
 */
export function loadChartTemplate(context: vscode.ExtensionContext): string {
  try {
    // Get template file path
    const templatePath = path.join(context.extensionPath, 'templates', 'chart-template.html');
    
    // Read template content
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    console.error('Error loading chart template:', error);
    throw new Error(`Failed to load chart template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Replace template placeholders with actual values
 * @param template Template string with placeholders
 * @param variables Values to replace placeholders with
 * @param chartConfig Chart-specific configuration
 * @returns Processed template with replaced values
 */
export function processTemplate(
  template: string, 
  variables: TemplateVariables,
  chartConfig: ChartConfig
): string {
  // First replace general variables
  let result = template
    .replace(/\${TITLE}/g, variables.title)
    .replace(/\${BACKGROUND_COLOR}/g, variables.backgroundColor)
    .replace(/\${ENVIRONMENT_PRESET}/g, variables.environmentPreset)
    .replace(/\${GROUND_COLOR}/g, variables.groundColor)
    .replace(/\${DATA_SOURCE}/g, variables.dataSource)
    .replace(/\${CHART_PALETTE}/g, variables.chartPalette);
  
  // Generate chart component HTML
  const chartComponent = generateChartComponent(chartConfig, variables.chartPalette);
  
  // Replace chart component placeholder
  result = result.replace('<!-- CHART_COMPONENT_PLACEHOLDER -->', chartComponent);
  
  return result;
}

/**
 * Generate chart component HTML based on chart type
 * @param config Chart configuration
 * @param palette Color palette to use
 * @returns Chart component HTML
 */
function generateChartComponent(config: ChartConfig, palette: string): string {
  // Base attributes that all charts have
  let attributes = `
    id="visualization"
    from="data"
    palette="${palette}"
    x="${config.xkey}" 
    y="${config.ykey}"
    ${config.position ? `position="${config.position}"` : ''}
    ${config.scale ? `scale="${config.scale}"` : ''}
    ${config.rotation ? `rotation="${config.rotation}"` : ''}`;
  
  // Add optional attributes if present
  if (config.zkey) {
    attributes += `\n    z="${config.zkey}"`;
  }
  
  if (config.radiuskey) {
    attributes += `\n    radius="${config.radiuskey}"`;
  }
  
  if (config.heightkey) {
    attributes += `\n    height="${config.heightkey}"`;
  }
  
  // Generate full chart entity
  return `
        <!-- Visualization component -->
        <a-entity ${config.component}
${attributes}></a-entity>`;
}

/**
 * Save processed template to a file
 * @param content Content to save
 * @param targetPath Path where to save the file
 * @returns Promise that resolves when file is saved
 */
export async function saveTemplateToFile(content: string, targetPath: string): Promise<void> {
  try {
    // Ensure directory exists
    const directory = path.dirname(targetPath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(targetPath, content, 'utf-8');
  } catch (error) {
    console.error('Error saving template to file:', error);
    throw new Error(`Failed to save template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets available environment presets from A-Frame
 * @returns Array of preset names
 */
export function getEnvironmentPresets(): string[] {
  return [
    'none',
    'default',
    'forest',
    'egypt',
    'dream',
    'volcano',
    'arches',
    'tron',
    'japan',
    'threetowers',
    'poison',
    'alien',
    'osiris',
    'moon',
    'contact',
    'canyon'
  ];
}

/**
 * Gets available color palettes for charts
 * @returns Array of palette names
 */
export function getChartPalettes(): string[] {
  return [
    'ubuntu',
    'greens',
    'blues',
    'reds',
    'gray',
    'supermagenta',
    'cool',
    'rainbow',
    'tarnish',
    'warm',
    'goldgreen',
    'random'
  ];
}

/**
 * Get component name for a specific chart type
 * @param chartType Component type from enum
 * @returns A-Frame component name
 */
export function getComponentNameForChartType(chartType: string): string {
  const componentMap: {[key: string]: string} = {
    'bars': 'babia-barchart',
    'barsmap': 'babia-barsmap',
    'cylinders': 'babia-cylinders',
    'pie': 'babia-piechart',
    'donut': 'babia-torusmap',
    'bubbles': 'babia-bubbles',
    'scatter': 'babia-scatterplot'
  };
  
  return componentMap[chartType] || 'babia-barchart';
}

/**
 * Create a variable map for template processing
 * @param chartSpecification Chart specification object
 * @returns Template variable map
 */
export function createVariableMap(chartSpecification: ChartSpecification): TemplateVariableMap {
  const { data } = chartSpecification;
  
  // We use a generic value that will be replaced when saving
  const dataSource = "data.json";
  
  // Extract the filename from the data source path or URL
  const dataSourceName = data.dataSource.split('/').pop() || 'Unknown Source';
  
  // IMPORTANT: Use the dimensions property that preserves the original selection order
  const dimensions = data.dimensions || [];
  
  // For Barsmap charts, ensure each dimension is assigned to the correct property
  const xDimension = dimensions[0] || data.xKey || 'category';
  const yDimension = dimensions[1] || data.yKey || 'value';
  
  // Compose the third axis if it exists
  let zDimensionAttr = '';
  let zDimensionText = 'No Z dimension selected';
  if (dimensions.length > 2 && dimensions[2]) {
    const zDimension = dimensions[2];
    zDimensionAttr = `z_axis: ${zDimension};`;
    zDimensionText = `Z: ${zDimension}`;
  } else if (data.zKey) {
    zDimensionAttr = `z_axis: ${data.zKey};`;
    zDimensionText = `Z: ${data.zKey}`;
  }
  
  // Add a heightMax property to ensure bars are visible
  let height = chartSpecification.options?.height || 10;
  let heightMax = "heightMax: 15;";
  
  // Environment variables with default values
  const backgroundColor = data.environment?.backgroundColor || '#112233';
  const environmentPreset = data.environment?.environmentPreset || 'forest';
  const groundColor = data.environment?.groundColor || '#445566';
  const chartPalette = data.environment?.chartPalette || 'ubuntu';
  
  const variableMap: TemplateVariableMap = {
    TITLE: data.title || 'Data Visualization',
    DATA_SOURCE: dataSource,
    DATA_SOURCE_NAME: dataSourceName,
    X_DIMENSION: xDimension,
    Y_DIMENSION: yDimension,
    Z_DIMENSION_ATTR: zDimensionAttr,
    Z_DIMENSION_TEXT: zDimensionText,
    HEIGHT: height,
    HEIGHT_MAX: heightMax,
    BACKGROUND_COLOR: backgroundColor,
    ENVIRONMENT_PRESET: environmentPreset,
    GROUND_COLOR: groundColor,
    CHART_PALETTE: chartPalette
  };
  
  return variableMap;
}