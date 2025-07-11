import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Ensures that the user data directory exists
 * @param context Extension context
 * @returns Path to the user data directory
 */
export function ensureUserDataDirectory(context: vscode.ExtensionContext): string {
  // Create base generated directory
  const baseDir = path.join(context.extensionPath, 'generated');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
  }
  
  // Create data subdirectory
  const dataDir = path.join(baseDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }
  
  return dataDir;
}

/**
 * Reorders JSON attributes based on user-selected dimensions
 * @param data Original JSON data array
 * @param dimensions Array of dimensions selected by the user, in order of selection
 * @returns JSON data with reordered attributes
 */
function reorderJsonAttributes(data: any[], dimensions: string[]): any[] {
  return data.map(item => {
    // Create new object with selected dimensions first, in the selected order
    const reorderedItem: any = {};
    
    // First add the selected dimensions in order
    dimensions.forEach(dim => {
      if (item.hasOwnProperty(dim)) {
        reorderedItem[dim] = item[dim];
      }
    });
    
    // Then add any remaining properties
    Object.keys(item).forEach(key => {
      if (!dimensions.includes(key)) {
        reorderedItem[key] = item[key];
      }
    });

    // Ensure cyclomaticDensity is calculated if missing
    if (!reorderedItem.cyclomaticDensity && reorderedItem.complexity && (reorderedItem.linesCount || reorderedItem.lineCount)) {
      const lines = reorderedItem.linesCount || reorderedItem.lineCount;
      reorderedItem.cyclomaticDensity = lines > 0 ? Number((reorderedItem.complexity / lines).toFixed(3)) : 0;
    }

    return reorderedItem;
  });
}

/**
 * Analyzes selected dimensions to check if grouping would make sense (for warning only)
 * @param data Original data array
 * @param dimensions User-selected dimensions
 * @returns Analysis result with grouping information
 */
export async function analyzeForPotentialGrouping(data: any[], dimensions: string[]): Promise<boolean> {
  // If less than 2 dimensions, no grouping possible
  if (dimensions.length < 2) {
    return false;
  }
  
  // Check if first dimension has repeated values
  const firstDimension = dimensions[0];
  const uniqueValues = new Set(data.map(item => item[firstDimension]));
  
  // If first dimension has unique values, no grouping needed
  if (uniqueValues.size === data.length) {
    return false;
  }
  
  // Check if there are numeric fields that could potentially be aggregated
  const hasNumericDimensions = dimensions.some(dim => {
    return data.every(item => 
      typeof item[dim] === 'number' || 
      (typeof item[dim] === 'string' && !isNaN(parseFloat(item[dim])))
    );
  });
  
  // If there are repeated values and numeric fields, grouping could make sense
  return hasNumericDimensions;
}

/**
 * Processes JSON data based on user-selected dimensions
 * Only reorders attributes, never groups or modifies the data
 * @param data Original JSON data array
 * @param dimensions Array of dimensions selected by the user, in order of selection
 * @param context VS Code extension context
 * @returns Processed JSON data with reordered attributes, or undefined if user cancels
 */
export async function processJsonData(
  data: any[], 
  dimensions: string[],
  context: vscode.ExtensionContext
): Promise<any[] | undefined> {
  if (!data || !data.length || !dimensions || !dimensions.length) {
    return data;
  }

  // Check if grouping might make sense, but only to show a warning
  const potentialGrouping = await analyzeForPotentialGrouping(data, dimensions);
  
  // If potential grouping is detected, show informative message
  if (potentialGrouping) {
    // Get information about the first selected dimension
    const firstDim = dimensions[0];
    
    // Count how many unique values the first dimension has
    const uniqueValues = new Set(data.map(item => item[firstDim]));
    const totalRows = data.length;
    
    // Prepare detailed message
    let message = `⚠️ Potentially confusing visualization ⚠️\n\n`;
    message += `You selected "${firstDim}" as your first dimension, but it has repeated values (${uniqueValues.size} unique values for ${totalRows} data rows).\n\n`;
    message += `This might lead to multiple data points overlapping in your visualization.\n\n`;
    message += `Do you want to continue with your current selection?`;
    
    // Show warning message with simple options
    const userChoice = await vscode.window.showWarningMessage(
      message,
      { 
        modal: true,
        // Esta opción desactiva los botones estándar
        detail: 'Choose Continue to proceed with current selection.'
      },
      // Solo definimos un botón explícito para continuar
      'Continue'
    );

    // Si no se seleccionó 'Continue', significa que el usuario canceló
    if (userChoice !== 'Continue') {
      return undefined; // User wants to change dimensions
    }
  }
  
  // Just reorder attributes, never group the data
  return reorderJsonAttributes(data, dimensions);
}

/**
 * Creates a processed copy of the JSON file with reordered attributes
 * @param sourceFilePath Original JSON file path
 * @param dimensions Selected dimensions
 * @param context VS Code extension context
 * @returns Path to the processed JSON file or undefined if user cancels
 */
export async function createProcessedJsonFile(
  sourceFilePath: string, 
  dimensions: string[],
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  // Read the original data
  const rawData = fs.readFileSync(sourceFilePath, 'utf8');
  const data = JSON.parse(rawData);
  
  // Process the data - only reorder attributes
  const processedData = await processJsonData(data, dimensions, context);
  
  // If user cancelled, return undefined
  if (!processedData) {
    return undefined;
  }
  
  // Create a unique filename for the processed file
  const timestamp = new Date().getTime();
  const originalFilename = path.basename(sourceFilePath, path.extname(sourceFilePath));
  const processedFilename = `temp_${originalFilename}_${timestamp}.json`;
  
  // Create a directory for temporary files in the extension's global storage path
  const tempDir = path.join(context.globalStorageUri.fsPath, 'temp');
  
  // Ensure the directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const destinationPath = path.join(tempDir, processedFilename);
  
  // Write the processed data to the file
  fs.writeFileSync(destinationPath, JSON.stringify(processedData, null, 2), 'utf8');
  
  // Register this file for cleanup when VS Code shuts down
  context.subscriptions.push({
    dispose: () => {
      try {
        if (fs.existsSync(destinationPath)) {
          fs.unlinkSync(destinationPath);
        }
      } catch (error) {
        console.error(`Error cleaning up temporary file during dispose: ${error}`);
      }
    }
  });
  
  return destinationPath;
}

/**
 * Cleans up temporary files created during processing
 * @param filePath Path to the temporary file to clean up
 */
export function cleanupTemporaryFile(filePath: string | undefined): void {
  if (!filePath) {
    return;
  }
  
  console.log(`Scheduled cleanup for temporary file: ${filePath}`);
}