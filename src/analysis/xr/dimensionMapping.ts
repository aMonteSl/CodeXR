import * as vscode from 'vscode';

// Available fields for analysis visualization
export const ANALYSIS_FIELDS = [
  { key: 'complexity', displayName: 'Complexity', description: 'Cyclomatic complexity of functions' },
  { key: 'linesCount', displayName: 'Lines Count', description: 'Number of lines in functions' },
  { key: 'parameters', displayName: 'Parameters', description: 'Number of parameters in functions' },
  { key: 'functionName', displayName: 'Function Name', description: 'Name identifier of functions (categorical)' },
  { key: 'cyclomaticDensity', displayName: 'Cyclomatic Density', description: 'Complexity density relative to function size (complexity/lines)' }
];

// ✅ FIXED: CONFIGURACIÓN DE DIMENSIONES POR TIPO DE CHART - Now matches actual chart components exactly
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
  // ✅ FIXED: Cylinder chart - now matches babia-cyls component exactly
  cyls: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for cylinder heights' },
    { key: 'radius', label: 'Radius', description: 'Values for cylinder radius' }
  ],
  // ✅ ADDED: Alternative mapping for "cylinders" name
  cylinders: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for cylinder heights' },
    { key: 'radius', label: 'Radius', description: 'Values for cylinder radius' }
  ],
  // ✅ NEW: Bubbles chart - matches babia-bubbles component exactly
  bubbles: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' },
    { key: 'height', label: 'Height', description: 'Values for bubble heights' },
    { key: 'radius', label: 'Radius', description: 'Values for bubble radius' }
  ],
  barsmap: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for bar heights' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' }
  ],
  // ✅ FIXED: Pie chart - now uses "key" and "size" to match babia-pie component
  pie: [
    { key: 'key', label: 'Key', description: 'Categories for pie segments' },
    { key: 'size', label: 'Size', description: 'Values for segment sizes' }
  ],
  // ✅ FIXED: Donut chart - now uses "key" and "size" to match babia-doughnut component
  donut: [
    { key: 'key', label: 'Key', description: 'Categories for donut segments' },
    { key: 'size', label: 'Size', description: 'Values for segment sizes' }
  ]
};

/**
 * ✅ ENHANCED: Get available dimensions for a chart type with fallback and normalization
 */
export function getChartDimensions(chartType: string): Array<{key: string, label: string, description: string}> {
  // ✅ TECHNICAL FIX: Normalize chart type to handle different naming conventions
  const normalizedType = normalizeChartType(chartType);
  
  const dimensions = CHART_DIMENSIONS[normalizedType as keyof typeof CHART_DIMENSIONS];
  
  if (dimensions) {
    console.log(`📊 Chart dimensions for ${chartType} (normalized: ${normalizedType}):`, dimensions);
    return dimensions;
  }
  
  // ✅ FALLBACK: Default to boats if chart type not found
  console.warn(`⚠️ No dimensions found for chart type: ${chartType}, using boats fallback`);
  return CHART_DIMENSIONS.boats;
}

/**
 * ✅ EXPORTED: Normalizes chart type names to handle different naming conventions
 */
export function normalizeChartType(chartType: string): string {
  // Convert to lowercase for comparison
  const lower = chartType.toLowerCase();
  
  // Handle different cylinder chart naming
  if (lower.includes('cylinder') || lower.includes('cyls')) {
    return 'cyls';
  }
  
  // Handle bubbles chart naming
  if (lower.includes('bubble')) {
    return 'bubbles';
  }
  
  // Handle other chart types
  const typeMapping: Record<string, string> = {
    'boats': 'boats',
    'bars': 'bars',
    'barsmap': 'barsmap',
    'pie': 'pie',
    'donut': 'donut',
    'doughnut': 'donut',
    'cylinders': 'cyls',
    'cylinder': 'cyls',
    'cyls': 'cyls',
    'bubbles': 'bubbles',
    'bubble': 'bubbles'
  };
  
  // Try exact match first
  if (typeMapping[lower]) {
    return typeMapping[lower];
  }
  
  // Try partial matches
  for (const [key, value] of Object.entries(typeMapping)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  // Default fallback
  console.warn('⚠️ Unknown chart type:', chartType, 'using boats as fallback');
  return 'boats';
}  // ✅ ENHANCED: Default mappings updated to include functionName options
  const defaultMappings = {
    boats: {
      area: 'parameters',
      height: 'linesCount',
      color: 'complexity'
    },
    bars: {
      x_axis: 'functionName', // ✅ Use functionName for categorical X-axis
      height: 'linesCount'
    },
    // ✅ FIXED: Cylinder default mapping uses correct properties
    cyls: {
      x_axis: 'functionName', // ✅ Use functionName for categorical X-axis
      height: 'linesCount',
      radius: 'parameters'
    },
    // ✅ NEW: Bubbles default mapping uses babia-bubbles properties
    bubbles: {
      x_axis: 'functionName', // ✅ Use functionName for categorical X-axis
      z_axis: 'parameters',
      height: 'linesCount',
      radius: 'complexity'
    },
    barsmap: {
      x_axis: 'functionName', // ✅ Use functionName for categorical X-axis
      height: 'linesCount',
      z_axis: 'parameters'
    },
    // ✅ FIXED: Pie chart default mapping uses "key" and "size"
    pie: {
      key: 'functionName', // ✅ Use functionName for categorical segments
      size: 'linesCount'
    },
    // ✅ FIXED: Donut chart default mapping uses "key" and "size"
    donut: {
      key: 'functionName', // ✅ Use functionName for categorical segments
      size: 'linesCount'
    }
  };

/**
 * Get dimension mapping for a specific chart type
 */
export function getDimensionMapping(chartType: string, context: vscode.ExtensionContext): Record<string, string> {
  // ✅ TECHNICAL FIX: Use normalized chart type for consistent storage keys
  const normalizedType = normalizeChartType(chartType);
  const storageKey = `codexr.analysis.dimensionMapping.${normalizedType}`;
  const mapping = context.globalState.get<Record<string, string>>(storageKey);
  
  if (mapping) {
    console.log(`📊 Retrieved saved mapping for ${chartType} (${normalizedType}):`, mapping);
    return mapping;
  }
  
  const defaultMapping = defaultMappings[normalizedType as keyof typeof defaultMappings] || defaultMappings.boats;
  console.log(`📊 Using default mapping for ${chartType} (${normalizedType}):`, defaultMapping);
  
  return defaultMapping;
}

/**
 * ✅ ENHANCED: Set dimension mapping with proper chart type normalization
 */
export async function setDimensionMapping(
  context: vscode.ExtensionContext, 
  chartType: string, 
  dimensionKey: string, 
  value: string
): Promise<void> {
  console.log(`🔧 Setting dimension mapping: ${chartType}.${dimensionKey} = ${value}`);
  
  // ✅ TECHNICAL FIX: Use normalized chart type for consistent storage
  const normalizedType = normalizeChartType(chartType);
  
  // Obtener el mapping actual
  const currentMapping = getDimensionMapping(chartType, context);
  
  // Actualizar la dimensión específica
  const updatedMapping = {
    ...currentMapping,
    [dimensionKey]: value
  };
  
  // Guardar el mapping actualizado con normalized type
  const storageKey = `codexr.analysis.dimensionMapping.${normalizedType}`;
  await context.globalState.update(storageKey, updatedMapping);
  
  console.log(`✅ Updated mapping for ${chartType} (${normalizedType}):`, updatedMapping);
  console.log(`💾 Saved to storage key: ${storageKey}`);
}

/**
 * ✅ NEW: Validates that a dimension mapping is complete for a chart type
 * @param chartType Chart type to validate
 * @param context Extension context
 * @returns Validation result with missing dimensions
 */
export function validateDimensionMapping(
  chartType: string, 
  context: vscode.ExtensionContext
): { isValid: boolean; missingDimensions: string[] } {
  const requiredDimensions = getChartDimensions(chartType);
  const currentMapping = getDimensionMapping(chartType, context);
  
  const missingDimensions = requiredDimensions
    .map(dim => dim.key)
    .filter(key => !currentMapping[key]);
  
  return {
    isValid: missingDimensions.length === 0,
    missingDimensions
  };
}

/**
 * ✅ NEW: Gets a human-readable summary of current dimension mappings
 * @param chartType Chart type
 * @param context Extension context
 * @returns Formatted summary string
 */
export function getDimensionMappingSummary(
  chartType: string, 
  context: vscode.ExtensionContext
): string {
  const dimensions = getChartDimensions(chartType);
  const mapping = getDimensionMapping(chartType, context);
  
  const mappingEntries = dimensions.map(dim => {
    const fieldValue = mapping[dim.key];
    const fieldName = ANALYSIS_FIELDS.find(f => f.key === fieldValue)?.displayName || fieldValue || 'Not mapped';
    return `${dim.label}: ${fieldName}`;
  });
  
  return mappingEntries.join(' • ');
}
