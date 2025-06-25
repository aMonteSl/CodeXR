import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChartType, ChartData, TemplateVariableMap, ChartSpecification } from '../models/chartModel';
import { getDimensionMapping, normalizeChartType } from '../../analysis/xr/dimensionMapping'; // ✅ FIXED: Import both functions

/**
 * Data structure representing a processed template
 */
export interface ProcessedTemplate {
  html: string;
  originalDataPath?: string;
  isRemoteData: boolean;
}

/**
 * Get the template file name for a chart type
 */
export function getTemplateFileName(chartType: ChartType): string {
  return 'chart-template.html';
}

/**
 * Loads a template from the templates directory
 */
export function loadTemplate(context: vscode.ExtensionContext, templateFileName: string): string {
  try {
    const templatePath = path.join(context.extensionPath, 'templates', templateFileName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateFileName}`);
    }
    
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    throw new Error(`Error loading template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Replaces variables in a template with actual values
 * @param template The template string with placeholders
 * @param variables Object containing variable mappings
 * @returns Processed string with variables replaced
 */
export function replaceTemplateVariables(template: string, variables: TemplateVariableMap): string {
  let result = template;
  
  // Replace each variable in the template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

/**
 * Creates variable mappings from chart data
 */
export function createVariableMap(chartSpecification: ChartSpecification): TemplateVariableMap {
  const { data, type, options } = chartSpecification;
  
  // ✅ TECHNICAL ENHANCEMENT: Extract dimensions with proper validation
  const dimensions = data.dimensions || [];
  const xDimension = dimensions[0] || data.xKey || 'defaultX';
  const yDimension = dimensions[1] || data.yKey || 'defaultY';
  
  // ✅ TECHNICAL IMPROVEMENT: Handle radius dimension with fallback
  let radiusDimension = '';
  if (dimensions.length > 2) {
    radiusDimension = dimensions[2];
  }
  
  // ✅ TECHNICAL ENHANCEMENT: Configure Z-axis with proper attribute formatting
  let zDimensionAttr = '';
  let zDimensionText = '';
  if (dimensions.length > 2 && dimensions[2]) {
    const zDimension = dimensions[2];
    zDimensionAttr = `z_axis: ${zDimension};`;
    zDimensionText = `Z: ${zDimension}`;
  } else if (data.zKey) {
    zDimensionAttr = `z_axis: ${data.zKey};`;
    zDimensionText = `Z: ${data.zKey}`;
  } else {
    zDimensionText = 'No Z dimension selected';
  }
  
  // ✅ TECHNICAL CONFIGURATION: Set default options with proper validation
  let heightOpt: number = 1;
  let width: number = 2;
  let barRotation: string = "0 0 0"; // For vertical orientation
  
  // ✅ CRITICAL FIX: Get environment variables from global state (not data.environment)
  // This ensures consistency with visualization settings across all chart types
  const backgroundColor = data.environment?.backgroundColor || '#112233'; // ✅ PROPER: Use from environment or fallback
  const environmentPreset = data.environment?.environmentPreset || 'forest';
  const groundColor = data.environment?.groundColor || '#445566';
  const chartPalette = data.environment?.chartPalette || 'ubuntu';
  
  // ✅ TECHNICAL FIX: Define data source variables that were missing
  const dataSource = data.dataSource || './data.json';
  const dataSourceName = data.title || 'Chart Data';
  
  // ✅ TECHNICAL VALIDATION: Log environment settings for debugging
  console.log('🎨 Template Environment Configuration:');
  console.log(`   Background: ${backgroundColor}`);
  console.log(`   Environment: ${environmentPreset}`);
  console.log(`   Ground: ${groundColor}`);
  console.log(`   Palette: ${chartPalette}`);
  console.log(`   Data Source: ${dataSource}`);
  console.log(`   Data Source Name: ${dataSourceName}`);
  
  // Add the new dimension mappings
  const AREA = data.area || 'parameters';
  const HEIGHT_DIM = data.height || 'linesCount';
  const COLOR = data.color || 'complexity';
  
  // ✅ TECHNICAL ENHANCEMENT: Return comprehensive mapping with all required variables
  return {
    TITLE: data.title || 'Chart Visualization',
    DATA_SOURCE: dataSource, // ✅ FIXED: Now properly defined
    DATA_SOURCE_NAME: dataSourceName, // ✅ FIXED: Now properly defined
    X_DIMENSION: xDimension || 'category',
    Y_DIMENSION: yDimension || 'value',
    RADIUS_DIMENSION: radiusDimension || 'defaultRadius',
    Z_DIMENSION_ATTR: zDimensionAttr,
    Z_DIMENSION_TEXT: zDimensionText,
    POSITION: data.position || "0 1 -3",
    SCALE: data.scale || "1 1 1",
    ROTATION: data.rotation || "0 0 0",
    HEIGHT: heightOpt,
    WIDTH: width,
    BAR_ROTATION: barRotation,
    BACKGROUND_COLOR: backgroundColor, // ✅ CRITICAL: Ensure background color is properly passed
    ENVIRONMENT_PRESET: environmentPreset,
    GROUND_COLOR: groundColor,
    CHART_PALETTE: chartPalette,
    AREA: AREA,
    HEIGHT_DIM: HEIGHT_DIM,
    COLOR: COLOR
  };
}

/**
 * Checks if a string is a valid URL
 * @param str String to check
 * @returns true if it's a URL, false otherwise
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map of chart components to insert in the template
 */
export const chartComponents: Record<ChartType, string> = {
  [ChartType.BARS_CHART]: `
        <!-- Bars Chart -->
        <a-entity babia-bars="from: data;
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3"
                  scale="1 1 1">
        </a-entity>
        
        <!-- Info Panel -->
        <a-entity position="-5 2 -3">
          <a-plane color="#112244" width="3" height="2" opacity="0.8"></a-plane>
          <a-text value="Data Source: \${DATA_SOURCE_NAME}" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.7 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Fields Selected:" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.4 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="X: \${X_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0.2 0.01" 
                 anchor="left"></a-text>
          <a-text value="Height: \${Y_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0 0.01" 
                 anchor="left"></a-text>
        </a-entity>`,
  
  [ChartType.BARSMAP_CHART]: `
        <!-- Barsmap Chart -->
        <a-entity babia-barsmap="from: data; 
                  legend: true; 
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  \${Z_DIMENSION_ATTR}
                  heightMax: 15;
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3" 
                  scale="1 1 1">
        </a-entity>`,
  
  [ChartType.PIE_CHART]: `
        <!-- Pie Chart -->
        <a-entity babia-pie="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 3 0 -3;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>
        
        <!-- Info Panel -->
        <a-entity position="-5 2 -3">
          <a-plane color="#112244" width="3" height="2" opacity="0.8"></a-plane>
          <a-text value="Data Source: \${DATA_SOURCE_NAME}" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.7 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Fields Selected:" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.4 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Key: \${X_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0.2 0.01" 
                 anchor="left"></a-text>
          <a-text value="Size: \${Y_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0 0.01" 
                 anchor="left"></a-text>
        </a-entity>`,
  
  [ChartType.DONUT_CHART]: `
        <!-- Donut Chart -->
        <a-entity babia-doughnut="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  donutRadius: 0.5;
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 3 0 -3;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>
        
        <!-- Info Panel -->
        <a-entity position="-5 2 -3">
          <a-plane color="#112244" width="3" height="2" opacity="0.8"></a-plane>
          <a-text value="Data Source: \${DATA_SOURCE_NAME}" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.7 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Fields Selected:" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.4 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Key: \${X_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0.2 0.01" 
                 anchor="left"></a-text>
          <a-text value="Size: \${Y_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0 0.01" 
                 anchor="left"></a-text>
        </a-entity>`,

  [ChartType.CYLS_CHART]: `
  <!-- Cylinder Chart -->
  <a-entity babia-cyls="
    from: data;
    legend: true;
    axis: true;
    tooltip: true;
    palette: \${CHART_PALETTE};
    x_axis: \${X_DIMENSION};
    height: \${Y_DIMENSION};
    radius: \${RADIUS_DIMENSION};
    heightMax: 10;
    radiusMax: 1;
    title: \${TITLE};
    titleColor: #FFFFFF;
    titlePosition: 0 10 0;"
    position="\${POSITION}"
    scale="\${SCALE}">
  </a-entity>
  
  <!-- Info Panel -->
  <a-entity position="-5 2 -3">
    <a-plane color="#112244" width="3" height="2.5" opacity="0.8"></a-plane>
    <a-text value="Data Source: \${DATA_SOURCE_NAME}" 
           width="2.8" 
           color="white" 
           position="-1.4 0.9 0.01" 
           anchor="left"
           font="monoid"></a-text>
    <a-text value="Fields Selected:" 
           width="2.8" 
           color="white" 
           position="-1.4 0.6 0.01" 
           anchor="left"
           font="monoid"></a-text>
    <a-text value="X-Axis: \${X_DIMENSION}" 
           width="2.8" 
           color="#AAFFAA" 
           position="-1.2 0.3 0.01" 
           anchor="left"></a-text>
    <a-text value="Height: \${Y_DIMENSION}" 
           width="2.8" 
           color="#AAFFAA" 
           position="-1.2 0 0.01" 
           anchor="left"></a-text>
    <a-text value="Radius: \${RADIUS_DIMENSION}" 
           width="2.8" 
           color="#AAFFAA" 
           position="-1.2 -0.3 0.01" 
           anchor="left"></a-text>
  </a-entity>`,

  [ChartType.BUBBLES_CHART]: `
        <!-- Bubbles Chart -->
        <a-entity babia-bubbles="from: data;
                  legend: true;
                  tooltip: true;
                  animation: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  z_axis: \${Z_DIMENSION};
                  height: \${Y_DIMENSION};
                  radius: \${RADIUS_DIMENSION};
                  heightMax: 15;
                  radiusMax: 1;
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3"
                  scale="1 1 1">
        </a-entity>
        
        <!-- Info Panel -->
        <a-entity position="-5 2 -3">
          <a-plane color="#112244" width="3" height="2" opacity="0.8"></a-plane>
          <a-text value="Data Source: \${DATA_SOURCE_NAME}" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.7 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="Fields Selected:" 
                 width="2.8" 
                 color="white" 
                 position="-1.4 0.4 0.01" 
                 anchor="left"
                 font="monoid"></a-text>
          <a-text value="X: \${X_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0.2 0.01" 
                 anchor="left"></a-text>
          <a-text value="Z: \${Z_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 0.0 0.01" 
                 anchor="left"></a-text>
          <a-text value="Height: \${Y_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 -0.2 0.01" 
                 anchor="left"></a-text>
          <a-text value="Radius: \${RADIUS_DIMENSION}" 
                 width="2.8" 
                 color="#AAFFAA" 
                 position="-1.2 -0.4 0.01" 
                 anchor="left"></a-text>
        </a-entity>`,

  [ChartType.SCATTER_PLOT]: "",
  [ChartType.NETWORK_GRAPH]: ""
};

/**
 * Process a template with variable values from a chart specification
 */
export async function processTemplate(context: vscode.ExtensionContext, chartSpec: ChartSpecification): Promise<ProcessedTemplate> {
  // Get template file
  const templatePath = path.join(context.extensionPath, 'templates', 'chart-template.html');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Get variable mapping
  const variableMap = createVariableMap(chartSpec);
  
  // Replace the placeholder with the chart component
  let processedHtml = templateContent.replace(
    '<!-- CHART_COMPONENT_PLACEHOLDER -->', 
    chartComponents[chartSpec.type]
  );
  
  // Replace variables in the template
  for (const [key, value] of Object.entries(variableMap)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, String(value));
  }
  
  return {
    html: processedHtml,
    originalDataPath: chartSpec.data.dataSource,
    isRemoteData: isUrl(chartSpec.data.dataSource)
  };
}

/**
 * ✅ FUNCIÓN PARA OBTENER INFORMACIÓN DEL CHART GENERADO
 */
export function getChartInfo(
  chartType: string,
  context: vscode.ExtensionContext
): {
  type: string;
  component: string;
  dimensions: Record<string, string>;
  palette: string;
} {
  const dimensionMapping = getDimensionMapping(chartType, context);
  const chartPalette = context.globalState.get<string>('babiaChartPalette') || 'foxy';
  
  const componentMap: Record<string, string> = {
    boats: 'babia-boats',
    bars: 'babia-bars',
    cyls: 'babia-cyls',
    cylinders: 'babia-cyls',
    bubbles: 'babia-bubbles',    // ✅ NEW: Added bubbles mapping
    barsmap: 'babia-barsmap',
    pie: 'babia-pie',
    donut: 'babia-doughnut'
  };
  
  // ✅ TECHNICAL FIX: Use normalization
  const normalizedType = normalizeChartType(chartType);
  
  return {
    type: normalizedType,
    component: componentMap[normalizedType] || 'babia-boats',
    dimensions: dimensionMapping,
    palette: chartPalette
  };
}