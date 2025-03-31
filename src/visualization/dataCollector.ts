import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChartType, ChartData } from '../models/chartModel';

/**
 * Collects information about the data source
 * @returns Path to the selected data file
 */
export async function collectDataSource(): Promise<string | undefined> {
  // Show options to choose the type of data source
  const sourceType = await vscode.window.showQuickPick(
    [
      { label: '$(file) Local File', id: 'local', description: 'Select CSV or JSON file from your computer' },
      { label: '$(beaker) Sample Data', id: 'sample', description: 'Use predefined dataset' }
    ],
    { 
      placeHolder: 'Select the data source',
      title: 'Data source for visualization'
    }
  );
  
  if (!sourceType) return undefined;
  
  switch (sourceType.id) {
    case 'local':
      // Select local file using a dialog
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Select data file',
        filters: { 'Data Files': ['csv', 'json'] }
      };
      
      const fileUri = await vscode.window.showOpenDialog(options);
      if (!fileUri || fileUri.length === 0) return undefined;
      return fileUri[0].fsPath;
      
    case 'sample':
      // Get extension path more robustly
      let extensionPath = '';
      
      // Attempt 1: Get from the extensions API
      try {
        // Use the correct ID of your extension - must match package.json
        const extension = vscode.extensions.getExtension('Your.integracionvsaframe');
        if (extension) {
          extensionPath = extension.extensionUri.fsPath;
        }
      } catch (error) {
        console.log('Error getting extension by ID:', error);
      }
      
      // Attempt 2: Use the current workspace
      if (!extensionPath && vscode.workspace.workspaceFolders?.length) {
        extensionPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }
      
      // Attempt 3: Get directly from __dirname (if we're in development)
      if (!extensionPath) {
        // This line assumes this file is in src/visualization/dataCollector.ts
        extensionPath = path.resolve(__dirname, '../..');
      }
      
      if (!extensionPath) {
        vscode.window.showErrorMessage('Could not determine the extension path');
        return undefined;
      }
      
      console.log(`Extension path: ${extensionPath}`);
      
      // Define possible locations where examples might be
      const possiblePaths = [
        // Automatically detected path
        path.join(extensionPath, 'examples', 'data'),
        // The correct location that we know
        '/home/adrian/integracionvsaframe/examples/data',
        // Relative path (if we're in development)
        path.resolve(__dirname, '../..', 'examples', 'data')
      ];
      
      let examplesPath = '';
      
      // Find the first path that exists
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          examplesPath = testPath;
          console.log(`Found valid examples path: ${examplesPath}`);
          break;
        }
      }
      
      if (!examplesPath) {
        vscode.window.showErrorMessage('Could not find example files in any known location.');
        return undefined;
      }
      
      // Build the full path to examples using the correct path
      const salesPath = path.join(examplesPath, 'ventas.json');
      const populationPath = path.join(examplesPath, 'poblacion.json');
      const temperaturePath = path.join(examplesPath, 'temperatura.json');
      
      // Verify that the files exist before offering them
      let availableDatasets = [];
      
      if (fs.existsSync(salesPath)) {
        availableDatasets.push({ 
          label: 'Sales by Product and Quarter', 
          value: salesPath, 
          description: 'Sales data by product and quarter (JSON)' 
        });
      } else {
        console.log(`File not found: ${salesPath}`);
      }
      
      if (fs.existsSync(populationPath)) {
        availableDatasets.push({ 
          label: 'Population by Country', 
          value: populationPath, 
          description: 'Demographic data grouped by continent (JSON)' 
        });
      } else {
        console.log(`File not found: ${populationPath}`);
      }
      
      if (fs.existsSync(temperaturePath)) {
        availableDatasets.push({ 
          label: 'Temperatures by City', 
          value: temperaturePath, 
          description: 'Temperature data by city and season (JSON)' 
        });
      } else {
        console.log(`File not found: ${temperaturePath}`);
      }
      
      if (availableDatasets.length === 0) {
        vscode.window.showErrorMessage('No example data files found. Check the folder structure.');
        return undefined;
      }
      
      // Offer predefined example datasets
      const sampleDataset = await vscode.window.showQuickPick(
        availableDatasets,
        { 
          placeHolder: 'Select an example dataset',
          title: 'Example data included in the extension'
        }
      );
      
      return sampleDataset?.value;
  }
  
  return undefined;
}

/**
 * Collects chart data from the user
 * @param chartType The type of chart
 * @returns Chart data or undefined if cancelled
 */
export async function collectChartData(chartType: ChartType): Promise<ChartData | undefined> {
  try {
    // Ask for chart title
    const title = await vscode.window.showInputBox({
      prompt: 'Chart title',
      placeHolder: 'My BabiaXR Visualization',
      value: `${chartType} - ${new Date().toLocaleDateString()}`
    });
    
    if (!title) return undefined;
    
    // Use the new function to collect the data source
    const dataSource = await collectDataSource();
    
    if (!dataSource) return undefined;
    
    // Extract dimensions automatically
    const dimensions = await extractDimensions(dataSource);

    // Information about how dimensions will be used for Bar Chart
    let maxSelections = 3;
    let minSelections = 2;
    let infoMessage = 'Select between 2 and 3 attributes for the chart:\n• The 1st selected will be the X axis\n• The 2nd will be the height of the bars\n• The 3rd (optional) will be the Z axis';
    
    if (chartType !== ChartType.BAR_CHART) {
      maxSelections = dimensions.length;
      minSelections = 1;
      infoMessage = 'Select attributes to visualize';
    }
    
    // Show information to the user
    vscode.window.showInformationMessage(infoMessage);
    
    // Create a QuickPick instance instead of using showQuickPick directly
    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem>();
    quickPick.items = dimensions.map(d => ({ 
      label: d, 
      picked: d === dimensions[0] || d === dimensions[1] 
    }));
    quickPick.canSelectMany = true;
    quickPick.placeholder = `Select ${minSelections}-${maxSelections} dimensions to visualize`;
    quickPick.title = 'Available dimensions in the data';
    
    // Preselect initial dimensions
    if (dimensions.length >= 2) {
      quickPick.selectedItems = [
        quickPick.items[0],
        quickPick.items[1]
      ];
    }
    
    // Variable to track previous selection
    let previousSelection: readonly vscode.QuickPickItem[] = [];
    
    // Initialize with initial selection
    if (quickPick.selectedItems.length > 0) {
      previousSelection = Array.from(quickPick.selectedItems);
    }
    
    // Limit the number of selections for bar charts
    quickPick.onDidChangeSelection(items => {
      if (chartType === ChartType.BAR_CHART) {
        // Case 1: Trying to select more than maximum
        if (items.length > maxSelections) {
          vscode.window.showErrorMessage(`For a bar chart, select maximum ${maxSelections} dimensions.`);
          // Keep only the first maxSelections elements
          quickPick.selectedItems = items.slice(0, maxSelections);
        } 
        // Case 2: Trying to deselect below minimum
        else if (items.length < minSelections) {
          vscode.window.showErrorMessage(`You must select at least ${minSelections} dimensions for this chart type.`);
          
          // Determine which item was attempted to be deselected
          const deselectedItems = previousSelection.filter(prev => 
            !items.some(current => current.label === prev.label)
          );
          
          // Restore previous selection to maintain minimum
          quickPick.selectedItems = previousSelection;
        }
        // Update previous selection when valid
        else {
          previousSelection = Array.from(items);
        }
      } else {
        // For other chart types, only check minimum
        if (items.length < minSelections) {
          vscode.window.showErrorMessage(`You must select at least ${minSelections} dimension for this chart type.`);
          
          // Restore previous selection
          if (previousSelection.length >= minSelections) {
            quickPick.selectedItems = previousSelection;
          }
        } else {
          previousSelection = Array.from(items);
        }
      }
    });
    
    // Show the QuickPick and wait until user accepts or cancels
    quickPick.show();
    
    const selectedDimensions = await new Promise<vscode.QuickPickItem[] | undefined>(resolve => {
      // When user confirms selection
      quickPick.onDidAccept(() => {
        if (quickPick.selectedItems.length < minSelections) {
          // Show error if selected less than required
          vscode.window.showErrorMessage(`You must select at least ${minSelections} dimensions for this chart type.`);
          // Don't close the QuickPick, allow correcting the selection
        } else if (chartType === ChartType.BAR_CHART && quickPick.selectedItems.length > maxSelections) {
          // This case shouldn't happen due to previous limitation, but included for safety
          vscode.window.showErrorMessage(`For a bar chart, select maximum ${maxSelections} dimensions.`);
        } else {
          // Valid selection, resolve the promise
          resolve(quickPick.selectedItems.length > 0 ? Array.from(quickPick.selectedItems) : undefined);
          quickPick.hide();
        }
      });
      
      // When the QuickPick is closed (cancel)
      quickPick.onDidHide(() => {
        resolve(undefined);
        quickPick.dispose();
      });
    });

    // If no selection, end
    if (!selectedDimensions || selectedDimensions.length === 0) {
      return undefined;
    }
    
    // Use the selected dimensions
    return {
      title,
      dataSource,
      dimensions: selectedDimensions.map(d => d.label),
      createdAt: Date.now()
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error collecting chart data: ${error instanceof Error ? error.message : String(error)}`);
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