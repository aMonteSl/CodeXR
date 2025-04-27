/**
 * Transforms XR analysis data into a simplified format required by BabiaXR
 * Ensures we never return an empty array that would break visualizations
 * 
 * @param jsonData The original data.json content
 * @returns Array with data for BabiaXR, with fallback data if empty
 */
export function formatXRDataForBabia(jsonData: any): any[] {
  // If input is a string, try to parse it as JSON
  const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  
  let formattedData: any[] = [];
  
  // If the data has a data property which is an array, transform it
  if (data && Array.isArray(data.data)) {
    formattedData = data.data.map((func: any) => ({
      // Required transformations - using correct property names
      functionName: func.functionName,    // For x-axis
      complexity: func.complexity,        // For height
      linesCount: func.lineCount,         // Keeping as linesCount as requested
      parameters: func.parameters         // Additional data
    }));
  }
  // If data is already an array, transform it directly
  else if (Array.isArray(data)) {
    formattedData = data.map((func: any) => ({
      functionName: func.functionName || func.model,
      complexity: func.complexity,
      linesCount: func.lineCount || func.lines || func.linesCount,
      parameters: func.parameters
    }));
  }
  
  // Critical check - never return an empty array that would break visualizations
  if (!formattedData || formattedData.length === 0) {
    console.log('⚠️ Warning: No functions found in analysis data, using fallback sample data');
    
    // Provide fallback sample data to ensure visualization works
    formattedData = [
      { functionName: "sample_function1", complexity: 5, linesCount: 10, parameters: 2 },
      { functionName: "sample_function2", complexity: 8, linesCount: 15, parameters: 1 },
      { functionName: "sample_function3", complexity: 3, linesCount: 7, parameters: 0 }
    ];
  }
  
  console.log(`Formatted ${formattedData.length} functions for BabiaXR visualization`);
  return formattedData;
}