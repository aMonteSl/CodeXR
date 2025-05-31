import * as vscode from 'vscode';

// ✅ DEFINIR TODOS LOS CAMPOS DISPONIBLES PARA ANÁLISIS
export const ANALYSIS_FIELDS = [
  { key: 'complexity', label: 'Complexity', description: 'Cyclomatic complexity of functions' },
  { key: 'linesCount', label: 'Lines Count', description: 'Number of lines in functions' },
  { key: 'parameters', label: 'Parameters', description: 'Number of parameters in functions' }
];

// ✅ CONFIGURACIÓN DE DIMENSIONES POR TIPO DE CHART
export const CHART_DIMENSIONS = {
  boats: [
    { key: 'area', label: 'Area', description: 'Controls the base area of boats' },
    { key: 'height', label: 'Height', description: 'Controls the height of boats' },
    { key: 'color', label: 'Color', description: 'Controls the color mapping' }
  ],
  bars: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for bar heights' }
  ],
  cyls: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for cylinder heights' },
    { key: 'radius', label: 'Radius', description: 'Values for cylinder radius' }
  ],
  barsmap: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for bar heights' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' }
  ],
  pie: [
    { key: 'key', label: 'Segments', description: 'Categories for pie segments' },
    { key: 'size', label: 'Size', description: 'Values for segment sizes' }
  ],
  donut: [
    { key: 'key', label: 'Segments', description: 'Categories for donut segments' },
    { key: 'size', label: 'Size', description: 'Values for segment sizes' }
  ]
};

/**
 * Get available dimensions for a chart type
 */
export function getChartDimensions(chartType: string): Array<{key: string, label: string, description: string}> {
  return CHART_DIMENSIONS[chartType as keyof typeof CHART_DIMENSIONS] || CHART_DIMENSIONS.boats;
}

/**
 * Get dimension mapping for a specific chart type
 */
export function getDimensionMapping(chartType: string, context: vscode.ExtensionContext): Record<string, string> {
  const storageKey = `codexr.analysis.dimensionMapping.${chartType}`;
  const mapping = context.globalState.get<Record<string, string>>(storageKey);
  
  if (mapping) {
    console.log(`📊 Retrieved mapping for ${chartType}:`, mapping);
    return mapping;
  }
  
  // ✅ MAPEOS POR DEFECTO ESPECÍFICOS PARA CADA TIPO
  const defaultMappings = {
    boats: {
      area: 'parameters',      // ✅ CONFIRMAR DEFAULT
      height: 'linesCount',    // ✅ CONFIRMAR DEFAULT
      color: 'complexity'      // ✅ CONFIRMAR DEFAULT
    },
    bars: {
      x_axis: 'complexity',
      height: 'linesCount'
    },
    cyls: {
      x_axis: 'complexity',
      height: 'linesCount',
      radius: 'parameters'
    },
    barsmap: {
      x_axis: 'complexity',
      height: 'linesCount',
      z_axis: 'parameters'
    },
    pie: {
      key: 'complexity',
      size: 'linesCount'
    },
    donut: {
      key: 'complexity',
      size: 'linesCount'
    }
  };
  
  const defaultMapping = defaultMappings[chartType as keyof typeof defaultMappings] || defaultMappings.boats;
  console.log(`📊 Using default mapping for ${chartType}:`, defaultMapping);
  
  return defaultMapping;
}

/**
 * Set dimension mapping for a specific chart type
 */
export function setDimensionMapping(
  chartType: string, 
  mapping: Record<string, string>, 
  context: vscode.ExtensionContext
): void {
  const storageKey = `codexr.analysis.dimensionMapping.${chartType}`;
  context.globalState.update(storageKey, mapping);
  console.log(`💾 Saved mapping for ${chartType}:`, mapping);
}
