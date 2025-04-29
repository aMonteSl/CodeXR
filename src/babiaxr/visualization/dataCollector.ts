import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChartType, ChartData } from '../models/chartModel';
import { 
  createProcessedJsonFile, 
} from '../utils/dataProcessor';

/**
 * Collects information about the data source
 * @returns Path to the selected data file
 */
export async function collectDataSource(context: vscode.ExtensionContext): Promise<string | undefined> {
  // Show options to choose the type of data source
  const sourceType = await vscode.window.showQuickPick(
    [
      { label: '$(file) Local File', id: 'local', description: 'Select JSON file from your computer' },
      { label: '$(beaker) Sample Data', id: 'sample', description: 'Use predefined dataset' }
    ],
    { 
      placeHolder: 'Select the data source',
      title: 'Data source for visualization'
    }
  );
  
  if (!sourceType) {
    return undefined;
  }
  
  switch (sourceType.id) {
    case 'local':
      // Select local file using a dialog
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select data file',
        filters: { 'Data Files': ['json'] }
      };
      
      const fileUri = await vscode.window.showOpenDialog(options);
      if (!fileUri || fileUri.length === 0) {
        return undefined;
      }
      return fileUri[0].fsPath;
      
    case 'sample':
      try {
        // Define the path to example data using extension context
        const exampleDataPath = path.join(context.extensionPath, 'examples', 'data');
        
        // Check if the directory exists
        if (!fs.existsSync(exampleDataPath)) {
          vscode.window.showErrorMessage(`Example data directory not found: ${exampleDataPath}`);
          return undefined;
        }
        
        // Get all JSON files in the directory
        const files = fs.readdirSync(exampleDataPath)
          .filter(file => file.endsWith('.json'))
          .map(file => {
            const fullPath = path.join(exampleDataPath, file);
            // Try to read the first few characters to check if it's valid JSON
            try {
              const fileContent = fs.readFileSync(fullPath, 'utf8');
              const firstItem = JSON.parse(fileContent);
              // If we can parse it and it's an array with at least one item, it's valid
              const valid = Array.isArray(firstItem) && firstItem.length > 0;
              
              // Extract a nice display name from the filename
              const displayName = file
                .replace('.json', '')
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
                
              return {
                label: displayName,
                value: fullPath,
                description: `${valid ? fileContent.length : 'Invalid'} bytes`,
                valid
              };
            } catch (error) {
              console.error(`Error reading JSON file ${file}:`, error);
              return {
                label: file,
                value: fullPath,
                description: 'Error: Invalid JSON',
                valid: false
              };
            }
          })
          // Filter out invalid files
          .filter(file => file.valid);
        
        if (files.length === 0) {
          vscode.window.showErrorMessage('No valid JSON example files found in examples/data directory.');
          return undefined;
        }
        
        // Show QuickPick with all valid JSON files
        const selectedFile = await vscode.window.showQuickPick(
          files,
          { 
            placeHolder: 'Select an example dataset',
            title: 'Available example datasets'
          }
        );
        
        if (!selectedFile) return undefined;
        
        vscode.window.showInformationMessage(`Loading example data from: ${selectedFile.label}`);
        return selectedFile.value;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Error loading example data: ${errorMessage}`);
        console.error('Error in sample data selection:', error);
        return undefined;
      }
  }
  
  return undefined;
}

/**
 * Collects chart data from the user
 */
export async function collectChartData(chartType: ChartType, context: vscode.ExtensionContext): Promise<ChartData | undefined> {
  try {
    // 1. Title
    const title = await vscode.window.showInputBox({
      prompt: `Enter title for your ${chartType}`,
      placeHolder: 'My Data Visualization',
      value: `${chartType} - ${new Date().toLocaleDateString()}`
    });
    
    if (!title) {
      return undefined; // User canceled
    }
    
    // 2. Data source
    const dataSource = await collectDataSource(context);
    
    if (!dataSource) {
      return undefined; // User canceled
    }
    
    // Loop until successful dimension selection and processing
    let dimensionsSelected = false;
    let dimensions: string[] | undefined;
    let processedJsonPath: string | undefined;
    
    while (!dimensionsSelected) {
      // 3. Process data
      const data = loadData(dataSource);
      dimensions = await collectDimensions(data, chartType);
      
      if (!dimensions || dimensions.length === 0) {
        return undefined; // User canceled
      }
      
      // 4. Create processed JSON file with validation
      processedJsonPath = await createProcessedJsonFile(dataSource, dimensions, context);
      
      // If processedJsonPath is undefined, the user canceled grouping
      if (!processedJsonPath) {
        const tryAgain = await vscode.window.showInformationMessage(
          'Would you like to select different dimensions?',
          'Yes', 'No'
        );
        
        if (tryAgain !== 'Yes') {
          return undefined; // User doesn't want to try again
        }
        // Loop continues to ask for dimensions again
      } else {
        // Success! Exit the loop
        dimensionsSelected = true;
      }
    }
    
    // 5. Return chart data
    const chartData: ChartData = {
      title,
      dataSource: processedJsonPath!, // Use the processed JSON 
      originalDataSource: dataSource, // Keep reference to original
      dimensions: dimensions!, 
      xKey: dimensions![0],
      yKey: dimensions![1],
      zKey: dimensions!.length > 2 ? dimensions![2] : undefined
    };
    
    return chartData;
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error collecting chart data: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

/**
 * Automatically extracts available dimensions from a data file
 * @param dataSource Path to the local file
 * @returns Array with the names of available dimensions
 */
export async function extractDimensions(dataSource: string): Promise<string[]> {
  try {
    const fileContent = fs.readFileSync(dataSource, 'utf8');
    
    if (dataSource.toLowerCase().endsWith('.json')) {
      const data = JSON.parse(fileContent);
      
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return Object.keys(data[0]);
      }
    } 
    else if (dataSource.toLowerCase().endsWith('.csv')) {
      const firstLine = fileContent.split('\n')[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const lines = fileContent.split('\n');
      if (lines.length > 0) {
        return lines[0].split(separator).map(header => header.trim());
      }
    }
    
    return ['name', 'value'];
  } catch (error) {
    vscode.window.showWarningMessage(`Could not extract dimensions: ${error}`);
    return ['name', 'value']; // Default values in case of error
  }
}

/**
 * Processes and loads data from a CSV file
 * @param filePath Path to the CSV file
 * @returns Object with processed data in usable format
 */
export function processCSVData(filePath: string): any[] {
  // Read the file content
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    throw new Error('The CSV file is empty');
  }
  
  // Automatically detect the separator
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  
  // Extract headers (first line)
  const headers = lines[0].split(separator).map(header => header.trim());
  
  // Process all data lines
  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(val => val.trim());
    
    // Create object with corresponding values
    const item: any = {};
    headers.forEach((header, index) => {
      // Try to convert to number if possible
      const value = values[index];
      if (value && !isNaN(Number(value))) {
        item[header] = Number(value);
      } else {
        item[header] = value;
      }
    });
    
    // Only add if there are valid values
    if (Object.keys(item).length > 0) {
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Converts a CSV file to JSON and saves it in the same directory
 * @param csvPath Path to the CSV file
 * @returns Path to the created JSON file
 */
export function convertCSVtoJSON(csvPath: string): string {
  // Process CSV data
  const jsonData = processCSVData(csvPath);
  
  // Create path for the new JSON file
  const jsonPath = csvPath.replace(/\.csv$/i, '.json');
  
  // Save the JSON
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  return jsonPath;
}

/**
 * Loads data from a local file
 * @param dataSource Path to the file
 * @returns Array with loaded data
 */
export function loadData(dataSource: string): any[] {
  // For local files 
  if (dataSource.toLowerCase().endsWith('.json')) {
    const fileContent = fs.readFileSync(dataSource, 'utf8');
    return JSON.parse(fileContent);
  } 
  else if (dataSource.toLowerCase().endsWith('.csv')) {
    return processCSVData(dataSource);
  }
  else {
    throw new Error('Unsupported file format. Use CSV or JSON.');
  }
}

/**
 * Collects dimensions to use for visualization sequentially
 */
export async function collectDimensions(data: any[], chartType: ChartType): Promise<string[] | undefined> {
  try {
    // Extract field names from the first data item
    const fields = Object.keys(data[0] || {});
    
    if (fields.length === 0) {
      vscode.window.showErrorMessage('No fields found in the data');
      return undefined;
    }
    
    // Define required dimensions based on chart type - extract this to a separate function
    const dimensions = getDimensionsByChartType(chartType);
    
    // We'll collect dimensions sequentially with ability to go back
    const selectedDimensions: string[] = [];
    const allFields = [...fields]; // Keep a copy of all fields
    
    // Show an initial informative message about the selection process
    const totalSteps = dimensions.length;
    vscode.window.showInformationMessage(
      `You'll select ${totalSteps} dimensions for your ${chartType}. You can go back to change previous selections.`
    );
    
    // Start from the first dimension
    let currentDimensionIndex = 0;
    
    // Loop until all required dimensions are selected or user cancels
    while (currentDimensionIndex < dimensions.length) {
      const result = await handleDimensionSelection(
        dimensions, 
        currentDimensionIndex, 
        selectedDimensions, 
        allFields,
        data,
        chartType
      );
      
      if (result.action === 'cancel') {
        return undefined;
      }
      
      // Update dimension index and selections based on result
      currentDimensionIndex = result.newIndex;
      if (result.updatedSelections) {
        // Copy updated selections
        for (let i = 0; i < result.updatedSelections.length; i++) {
          if (i < selectedDimensions.length) {
            selectedDimensions[i] = result.updatedSelections[i];
          } else {
            selectedDimensions.push(result.updatedSelections[i]);
          }
        }
      }
    }
    
    // Final validation - ensure we have the minimum required dimensions
    const minDimensions = chartType === ChartType.CYLS_CHART ? 2 : dimensions.length;
    if (selectedDimensions.length < minDimensions) {
      vscode.window.showErrorMessage(
        `This chart type requires at least ${minDimensions} dimensions, but only ${selectedDimensions.length} were selected.`
      );
      return undefined;
    }
    
    // Show final confirmation message with all selections
    showFinalSelectionMessage(chartType, selectedDimensions);
    
    return selectedDimensions;
  } catch (error) {
    vscode.window.showErrorMessage(`Error collecting dimensions: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Get dimensions configuration based on chart type
 */
function getDimensionsByChartType(chartType: ChartType): {id: string, name: string, description: string}[] {
  switch (chartType) {
    case ChartType.BARSMAP_CHART:
      return [
        { id: 'x', name: 'X axis', description: 'Select the X axis (categories)' },
        { id: 'height', name: 'Height', description: 'Select the Height axis (values)' },
        { id: 'z', name: 'Z axis', description: 'Select the Z axis (groups)' }
      ];
    case ChartType.CYLS_CHART:
      return [
        { id: 'x', name: 'X axis', description: 'Select the X axis (categories)' },
        { id: 'height', name: 'Height', description: 'Select the Height axis (values)' },
        { id: 'radius', name: 'Radius', description: 'Select the Radius axis (optional)' }
      ];
    case ChartType.BARS_CHART:
      return [
        { id: 'x', name: 'Categories', description: 'Select the Categories axis (X)' },
        { id: 'height', name: 'Values', description: 'Select the Values axis (heights)' }
      ];
    case ChartType.PIE_CHART:
    case ChartType.DONUT_CHART:
      return [
        { id: 'segments', name: 'Segments', description: 'Select the Segments axis (categories)' },
        { id: 'values', name: 'Values', description: 'Select the Values axis (sizes)' }
      ];
    default:
      return [
        { id: 'dim1', name: 'First dimension', description: 'Select the first dimension' },
        { id: 'dim2', name: 'Second dimension', description: 'Select the second dimension' }
      ];
  }
}

/**
 * Handle the selection of a single dimension
 */
async function handleDimensionSelection(
  dimensions: {id: string, name: string, description: string}[],
  currentIndex: number,
  currentSelections: string[],
  allFields: string[],
  data: any[],
  chartType: ChartType
): Promise<{action: 'continue' | 'cancel', newIndex: number, updatedSelections?: string[]}> {
  // Get current dimension info
  const dimension = dimensions[currentIndex];
  const totalSteps = dimensions.length;
  const isOptional = dimension.id === 'radius' && chartType === ChartType.CYLS_CHART;
  
  // Skip optional dimension if we've used all fields
  if (isOptional && currentSelections.length >= allFields.length) {
    return { action: 'continue', newIndex: currentIndex + 1 };
  }
  
  // Calculate available fields (exclude already selected ones unless we're editing this dimension)
  const availableFields = allFields.filter(field => {
    const indexInSelected = currentSelections.indexOf(field);
    return indexInSelected === -1 || indexInSelected === currentIndex;
  });
  
  // Create items for the picker with field analysis
  const items = createFieldItems(availableFields, data, dimension, currentSelections, currentIndex);
  
  // Add navigation buttons
  if (currentIndex > 0) {
    items.unshift({
      label: '$(arrow-left) Go Back',
      description: `Return to ${dimensions[currentIndex - 1].name} selection`,
      alwaysShow: true
    });
  }
  
  // Add skip option for optional dimensions
  if (isOptional) {
    items.unshift({
      label: '$(debug-step-over) Skip this dimension',
      description: 'Continue without selecting this optional dimension',
      alwaysShow: true
    });
  }
  
  // Create and configure the picker
  const stepText = `Step ${currentIndex + 1}/${totalSteps}: `;
  const picker = vscode.window.createQuickPick();
  picker.title = `${stepText}${dimension.description}`;
  picker.placeholder = dimension.description;
  picker.items = items;
  picker.canSelectMany = false;
  
  // If we already have a selection for this dimension, preselect it
  if (currentSelections[currentIndex]) {
    const preselectedItem = items.find(item => item.label === currentSelections[currentIndex]);
    if (preselectedItem) {
      picker.activeItems = [preselectedItem];
    }
  }
  
  // Wait for user selection
  const selection = await handlePickerSelection(picker, isOptional);
  
  // Process the selection
  if (selection.action === 'cancel' && !isOptional) {
    return { action: 'cancel', newIndex: currentIndex };
  } else if (selection.action === 'back') {
    // Go back to previous dimension
    return { action: 'continue', newIndex: Math.max(0, currentIndex - 1) };
  } else if (selection.action === 'skip') {
    // Remove any existing selection for this dimension and move forward
    const newSelections = [...currentSelections];
    if (currentIndex < newSelections.length) {
      newSelections.splice(currentIndex, 1);
    }
    return { action: 'continue', newIndex: currentIndex + 1, updatedSelections: newSelections };
  } else if (selection.action === 'select' && selection.value) {
    // Update or add the selection
    const newSelections = [...currentSelections];
    if (currentIndex < newSelections.length) {
      newSelections[currentIndex] = selection.value;
    } else {
      newSelections.push(selection.value);
    }
    
    // Show progress message
    vscode.window.showInformationMessage(
      `Selected ${dimension.name}: ${selection.value}`
    );
    
    // Move to next dimension
    return { action: 'continue', newIndex: currentIndex + 1, updatedSelections: newSelections };
  }
  
  // Default case (should rarely happen)
  return { action: 'continue', newIndex: currentIndex };
}

/**
 * Create field items for the QuickPick
 */
function createFieldItems(
  availableFields: string[], 
  data: any[], 
  dimension: {id: string, name: string, description: string},
  selectedDimensions: string[],
  currentDimensionIndex: number
): vscode.QuickPickItem[] {
  return availableFields.map(field => {
    // Try to determine if this field contains numeric values
    const isNumeric = data.every(item => 
      !isNaN(parseFloat(item[field])) && 
      typeof item[field] !== 'boolean' && 
      item[field] !== null
    );
    
    const isText = data.every(item => 
      typeof item[field] === 'string' && 
      isNaN(parseFloat(item[field]))
    );
    
    let fieldDesc = '';
    if (isNumeric) {
      fieldDesc = ' (Numeric)';
      // Add recommendation based on dimension
      if (dimension.id === 'height' || dimension.id === 'values' || dimension.id === 'radius') {
        fieldDesc += ' ✓ Recommended for this dimension';
      }
    } else if (isText) {
      fieldDesc = ' (Text)';
      // Add recommendation based on dimension
      if (dimension.id === 'x' || dimension.id === 'segments' || dimension.id === 'z') {
        fieldDesc += ' ✓ Recommended for this dimension';
      }
    }
    
    // Mark if this field is currently selected for this dimension
    if (selectedDimensions[currentDimensionIndex] === field) {
      fieldDesc += ' [Current selection]';
    }
    
    return {
      label: field,
      description: fieldDesc
    };
  });
}

/**
 * Handle the QuickPick selection logic
 */
async function handlePickerSelection(
  picker: vscode.QuickPick<vscode.QuickPickItem>,
  isOptional: boolean
): Promise<{action: 'select' | 'back' | 'skip' | 'cancel', value?: string}> {
  return new Promise<{action: 'select' | 'back' | 'skip' | 'cancel', value?: string}>((resolve) => {
    picker.onDidAccept(() => {
      const selected = picker.selectedItems[0];
      if (!selected) {
        if (isOptional) {
          resolve({action: 'skip'});
        } else {
          resolve({action: 'cancel'});
        }
      } else if (selected.label === '$(arrow-left) Go Back') {
        resolve({action: 'back'});
      } else if (selected.label === '$(debug-step-over) Skip this dimension') {
        resolve({action: 'skip'});
      } else {
        resolve({action: 'select', value: selected.label});
      }
      picker.hide();
    });
    
    picker.onDidHide(() => {
      picker.dispose();
      if (!picker.selectedItems[0]) {
        resolve({action: 'cancel'});
      }
    });
    
    picker.show();
  });
}

/**
 * Show final selection confirmation message
 */
function showFinalSelectionMessage(chartType: ChartType, selectedDimensions: string[]): void {
  let finalMessage = 'Final selections: ';
  
  if (chartType === ChartType.BARSMAP_CHART) {
    finalMessage += `X-axis: ${selectedDimensions[0]}, Height: ${selectedDimensions[1]}, Z-axis: ${selectedDimensions[2]}`;
  } else if (chartType === ChartType.CYLS_CHART) {
    finalMessage += `X-axis: ${selectedDimensions[0]}, Height: ${selectedDimensions[1]}`;
    if (selectedDimensions.length > 2) {
      finalMessage += `, Radius: ${selectedDimensions[2]}`;
    }
  } else if (chartType === ChartType.BARS_CHART) {
    finalMessage += `Categories: ${selectedDimensions[0]}, Values: ${selectedDimensions[1]}`;
  } else if (chartType === ChartType.PIE_CHART || chartType === ChartType.DONUT_CHART) {
    finalMessage += `Segments: ${selectedDimensions[0]}, Values: ${selectedDimensions[1]}`;
  } else {
    finalMessage += selectedDimensions.join(', ');
  }
  
  vscode.window.showInformationMessage(finalMessage);
}