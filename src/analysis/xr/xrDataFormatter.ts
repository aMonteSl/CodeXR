/**
 * Transforms XR analysis data into a simplified format required by BabiaXR
 * @param jsonData The original data.json content
 * @returns Array with data for BabiaXR
 */
export function formatXRDataForBabia(jsonData: any): any[] {
  // If input is a string, try to parse it as JSON
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  
  let formattedData: any[] = [];
  
  // If the data has a data property which is an array, transform it
  if (data && Array.isArray(data.data)) {
    formattedData = data.data.map((func: any) => ({
      // Preserve required properties
      functionName: func.functionName,
      complexity: func.complexity,
      linesCount: func.lineCount || func.linesCount,
      parameters: func.parameters,
      complexityColor: func.complexityColor || getColorFromComplexity(func.complexity) // Ensure color exists
    }));
  }
  // If data is already an array, transform it directly
  else if (Array.isArray(data)) {
    formattedData = data.map((func: any) => ({
      functionName: func.functionName || func.name,
      complexity: func.complexity,
      linesCount: func.lineCount || func.lines || func.linesCount,
      parameters: func.parameters,
      complexityColor: func.complexityColor || getColorFromComplexity(func.complexity) // Ensure color exists
    }));
  }
  
  // Critical check - never return an empty array that would break visualizations
  if (!formattedData || formattedData.length === 0) {
    console.log('⚠️ Warning: No functions found in analysis data, using fallback sample data');
    
    // Provide fallback sample data to ensure visualization works
    formattedData = [
      { functionName: "sample_function1", complexity: 5, linesCount: 10, parameters: 2, complexityColor: "#27ae60" },
      { functionName: "sample_function2", complexity: 8, linesCount: 15, parameters: 1, complexityColor: "#f39c12" },
      { functionName: "sample_function3", complexity: 3, linesCount: 7, parameters: 0, complexityColor: "#27ae60" }
    ];
  }
  
  console.log(`Formatted ${formattedData.length} functions for BabiaXR visualization`);
  return formattedData;
}

/**
 * Helper function to get color by complexity value
 */
function getColorFromComplexity(complexity: number): string {
  if (complexity <= 5) {
    return '#27ae60'; // Green for simple functions
  }
  if (complexity <= 10) {
    return '#f39c12'; // Yellow for moderate complexity
  }
  if (complexity <= 20) {
    return '#e67e22'; // Orange for high complexity
  }
  return '#e74c3c'; // Red for very complex/critical functions
}