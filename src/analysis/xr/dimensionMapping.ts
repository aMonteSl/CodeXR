import * as vscode from 'vscode';
import { getChartTemplateDefaultDimensions } from './chartTemplates';

// Available fields for file-level analysis visualization
export const FILE_ANALYSIS_FIELDS = [
  { key: 'complexity', displayName: 'Complexity', description: 'Cyclomatic complexity of functions' },
  { key: 'linesCount', displayName: 'Lines Count', description: 'Number of lines in functions' },
  { key: 'parameters', displayName: 'Parameters', description: 'Number of parameters in functions' },
  { key: 'functionName', displayName: 'Function Name', description: 'Name identifier of functions (categorical)' },
  { key: 'cyclomaticDensity', displayName: 'Cyclomatic Density', description: 'Complexity density relative to function size (complexity/lines)' }
];

// Available fields for directory-level analysis visualization
export const DIRECTORY_ANALYSIS_FIELDS = [
  { key: 'fileSizeBytes', displayName: 'File Size (Bytes)', description: 'Size of the file in bytes' },
  { key: 'meanDensity', displayName: 'Mean Density', description: 'Average cyclomatic density across file functions' },
  { key: 'meanParameters', displayName: 'Mean Parameters', description: 'Average number of parameters per function in file' },
  { key: 'classCount', displayName: 'Class Count', description: 'Number of classes in the file' },
  { key: 'language', displayName: 'Language', description: 'Programming language of the file (categorical)' },
  { key: 'functionCount', displayName: 'Function Count', description: 'Total number of functions in the file' },
  { key: 'totalLines', displayName: 'Total Lines', description: 'Total lines of code in the file' },
  { key: 'meanComplexity', displayName: 'Mean Complexity', description: 'Average cyclomatic complexity of functions in the file' },
  { key: 'fileName', displayName: 'File Name', description: 'Name of the file (categorical)' }
];

// Backward compatibility - points to file analysis fields
export const ANALYSIS_FIELDS = FILE_ANALYSIS_FIELDS;

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
  barsmap: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'height', label: 'Height', description: 'Values for bar heights' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' }
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
  cylsmap: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' },
    { key: 'height', label: 'Height', description: 'Values for cylinder heights' },
    { key: 'radius', label: 'Radius', description: 'Values for cylinder radius' }
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
  ],
  // ✅ NEW: Bubbles chart - matches babia-bubbles component exactly
  bubbles: [
    { key: 'x_axis', label: 'X-Axis', description: 'Categories for the X axis' },
    { key: 'z_axis', label: 'Z-Axis', description: 'Categories for the Z axis' },
    { key: 'height', label: 'Height', description: 'Values for bubble heights' },
    { key: 'radius', label: 'Radius', description: 'Values for bubble radius' }
  ]
};

/**
 * ✅ NEW: Get available analysis fields based on analysis type
 * @param analysisType Analysis type (File or Directory)
 * @returns Array of available fields for the analysis type
 */
export function getAnalysisFields(analysisType: string = 'File'): Array<{key: string, displayName: string, description: string}> {
  return analysisType === 'Directory' ? DIRECTORY_ANALYSIS_FIELDS : FILE_ANALYSIS_FIELDS;
}

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
  
  // Handle cylsmap first (more specific)
  if (lower.includes('cylsmap')) {
    return 'cylsmap';
  }
  
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
    'cylsmap': 'cylsmap',
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
}

/**
 * Get dimension mapping for a specific chart type and analysis type
 */
export function getDimensionMapping(chartType: string, context: vscode.ExtensionContext, analysisType: string = 'File'): Record<string, string> {
  // ✅ TECHNICAL FIX: Use normalized chart type for consistent storage keys
  const normalizedType = normalizeChartType(chartType);
  const storageKey = `codexr.analysis.dimensionMapping.${analysisType.toLowerCase()}.${normalizedType}`;
  const mapping = context.globalState.get<Record<string, string>>(storageKey);
  
  if (mapping) {
    console.log(`📊 Retrieved saved mapping for ${analysisType} ${chartType} (${normalizedType}):`, mapping);
    return mapping;
  }
  
  // Try fallback to old format for backward compatibility (File analysis only)
  if (analysisType === 'File') {
    const oldStorageKey = `codexr.analysis.dimensionMapping.${normalizedType}`;
    const oldMapping = context.globalState.get<Record<string, string>>(oldStorageKey);
    if (oldMapping) {
      console.log(`📊 Retrieved old format mapping for ${chartType} (${normalizedType}):`, oldMapping);
      return oldMapping;
    }
  }
  
  // Use chart template default mappings
  const defaultMapping = getChartTemplateDefaultDimensions(normalizedType, analysisType);
  console.log(`📊 Using default mapping for ${analysisType} ${chartType} (${normalizedType}):`, defaultMapping);
  
  return defaultMapping;
}

/**
 * ✅ ENHANCED: Set dimension mapping with proper chart type normalization and analysis type support
 */
export async function setDimensionMapping(
  context: vscode.ExtensionContext, 
  chartType: string, 
  dimensionKey: string, 
  value: string,
  analysisType: string = 'File'
): Promise<void> {
  console.log(`🔧 Setting dimension mapping: ${analysisType} ${chartType}.${dimensionKey} = ${value}`);
  
  // ✅ TECHNICAL FIX: Use normalized chart type for consistent storage
  const normalizedType = normalizeChartType(chartType);
  
  // Obtener el mapping actual
  const currentMapping = getDimensionMapping(chartType, context, analysisType);
  
  // Actualizar la dimensión específica
  const updatedMapping = {
    ...currentMapping,
    [dimensionKey]: value
  };
  
  // Guardar el mapping actualizado con normalized type and analysis type
  const storageKey = `codexr.analysis.dimensionMapping.${analysisType.toLowerCase()}.${normalizedType}`;
  await context.globalState.update(storageKey, updatedMapping);
  
  console.log(`✅ Updated mapping for ${analysisType} ${chartType} (${normalizedType}):`, updatedMapping);
  console.log(`💾 Saved to storage key: ${storageKey}`);
}

/**
 * ✅ NEW: Validates that a dimension mapping is complete for a chart type and analysis type
 * @param chartType Chart type to validate
 * @param context Extension context
 * @param analysisType Analysis type (File or Directory)
 * @returns Validation result with missing dimensions
 */
export function validateDimensionMapping(
  chartType: string, 
  context: vscode.ExtensionContext,
  analysisType: string = 'File'
): { isValid: boolean; missingDimensions: string[] } {
  const requiredDimensions = getChartDimensions(chartType);
  const currentMapping = getDimensionMapping(chartType, context, analysisType);
  
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
 * @param analysisType Analysis type (File or Directory)
 * @returns Formatted summary string
 */
export function getDimensionMappingSummary(
  chartType: string, 
  context: vscode.ExtensionContext,
  analysisType: string = 'File'
): string {
  const dimensions = getChartDimensions(chartType);
  const mapping = getDimensionMapping(chartType, context, analysisType);
  const availableFields = getAnalysisFields(analysisType);
  
  const mappingEntries = dimensions.map(dim => {
    const fieldValue = mapping[dim.key];
    const fieldName = availableFields.find(f => f.key === fieldValue)?.displayName || fieldValue || 'Not mapped';
    return `${dim.label}: ${fieldName}`;
  });
  
  return mappingEntries.join(' • ');
}

/**
 * Get numeric analysis fields for field type validation
 */
export function getNumericAnalysisFields(analysisType: string = 'File'): Array<{key: string, displayName: string, description: string}> {
  const allFields = getAnalysisFields(analysisType);
  
  // Define numeric fields for each analysis type
  const numericFieldKeys = analysisType === 'Directory' 
    ? ['fileSizeBytes', 'meanDensity', 'meanParameters', 'classCount', 'functionCount', 'totalLines', 'meanComplexity']
    : ['complexity', 'linesCount', 'parameters', 'cyclomaticDensity'];
  
  return allFields.filter(field => numericFieldKeys.includes(field.key));
}

/**
 * Get categorical analysis fields for field type validation
 */
export function getCategoricalAnalysisFields(analysisType: string = 'File'): Array<{key: string, displayName: string, description: string}> {
  const allFields = getAnalysisFields(analysisType);
  
  // Define categorical fields for each analysis type
  const categoricalFieldKeys = analysisType === 'Directory'
    ? ['language', 'fileName']
    : ['functionName'];
  
  return allFields.filter(field => categoricalFieldKeys.includes(field.key));
}

/**
 * Get filtered fields based on chart type and dimension requirements
 */
export function getFilteredAnalysisFields(
  analysisType: string = 'File',
  chartType: string,
  dimensionKey: string
): Array<{key: string, displayName: string, description: string}> {
  
  // For pie and donut charts, filter 'size' dimension to numeric fields only
  if ((chartType === 'pie' || chartType === 'donut') && dimensionKey === 'size') {
    console.log(`🥧 Filtering size dimension for ${chartType} chart to numeric fields only`);
    return getNumericAnalysisFields(analysisType);
  }
  
  // For bars and barsmap charts, filter 'height' dimension to numeric fields only
  if ((chartType === 'bars' || chartType === 'barsmap') && dimensionKey === 'height') {
    console.log(`📊 Filtering height dimension for ${chartType} chart to numeric fields only`);
    return getNumericAnalysisFields(analysisType);
  }
  
  // For cyls, cylsmap, and bubbles charts, filter 'height' and 'radius' dimensions to numeric fields only
  if ((chartType === 'cyls' || chartType === 'cylsmap' || chartType === 'bubbles') && (dimensionKey === 'height' || dimensionKey === 'radius')) {
    console.log(`🏛️ Filtering ${dimensionKey} dimension for ${chartType} chart to numeric fields only`);
    return getNumericAnalysisFields(analysisType);
  }
  
  // For bars and barsmap charts, filter 'height' dimension to numeric fields only
  if ((chartType === 'bars' || chartType === 'barsmap') && dimensionKey === 'height') {
    console.log(`🏛️ Filtering ${dimensionKey} dimension for ${chartType} chart to numeric fields only`);
    return getNumericAnalysisFields(analysisType);
  }
  
  // For pie and donut charts, filter 'size' dimension to numeric fields only
  if ((chartType === 'pie' || chartType === 'donut') && dimensionKey === 'size') {
    console.log(`🏛️ Filtering ${dimensionKey} dimension for ${chartType} chart to numeric fields only`);
    return getNumericAnalysisFields(analysisType);
  }
  
  // For boats charts, all fields can be any type (no filtering)
  if (chartType === 'boats') {
    console.log(`📊 No filtering for boats chart - all fields allowed for ${dimensionKey} dimension`);
    return getAnalysisFields(analysisType);
  }
  
  // For all other cases, return all available fields
  return getAnalysisFields(analysisType);
}
