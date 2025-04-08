"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDataSource = collectDataSource;
exports.collectChartData = collectChartData;
exports.extractDimensions = extractDimensions;
exports.processCSVData = processCSVData;
exports.convertCSVtoJSON = convertCSVtoJSON;
exports.loadData = loadData;
exports.collectDimensions = collectDimensions;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chartModel_1 = require("../babiaxr/models/chartModel");
/**
 * Collects information about the data source
 * @returns Path to the selected data file
 */
async function collectDataSource(context) {
    // Show options to choose the type of data source
    const sourceType = await vscode.window.showQuickPick([
        { label: '$(file) Local File', id: 'local', description: 'Select CSV or JSON file from your computer' },
        { label: '$(beaker) Sample Data', id: 'sample', description: 'Use predefined dataset' }
    ], {
        placeHolder: 'Select the data source',
        title: 'Data source for visualization'
    });
    if (!sourceType)
        return undefined;
    switch (sourceType.id) {
        case 'local':
            // Select local file using a dialog
            const options = {
                canSelectMany: false,
                openLabel: 'Select data file',
                filters: { 'Data Files': ['csv', 'json'] }
            };
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0)
                return undefined;
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
                    }
                    catch (error) {
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
                const selectedFile = await vscode.window.showQuickPick(files, {
                    placeHolder: 'Select an example dataset',
                    title: 'Available example datasets'
                });
                if (!selectedFile)
                    return undefined;
                vscode.window.showInformationMessage(`Loading example data from: ${selectedFile.label}`);
                return selectedFile.value;
            }
            catch (error) {
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
 * @param chartType The type of chart
 * @returns Chart data or undefined if cancelled
 */
async function collectChartData(chartType, context) {
    try {
        // Ask for chart title
        const title = await vscode.window.showInputBox({
            prompt: 'Chart title',
            placeHolder: 'My BabiaXR Visualization',
            value: `${chartType} - ${new Date().toLocaleDateString()}`
        });
        if (!title)
            return undefined;
        // Use the new function to collect the data source
        const dataSource = await collectDataSource(context);
        if (!dataSource)
            return undefined;
        // Extract dimensions automatically
        const dimensions = await extractDimensions(dataSource);
        // Set selection limits and information based on chart type
        let maxSelections;
        let minSelections;
        let infoMessage;
        if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
            maxSelections = 3;
            minSelections = 3;
            infoMessage = 'Select exactly 3 attributes for the chart:\n• The 1st selected will be the X axis\n• The 2nd will be the height of the bars\n• The 3rd will be the Z axis';
        }
        else if (chartType === chartModel_1.ChartType.BARS_CHART || chartType === chartModel_1.ChartType.CYLS_CHART) {
            maxSelections = 2;
            minSelections = 2;
            infoMessage = 'Select exactly 2 attributes for the chart:\n• The 1st selected will be the X axis\n• The 2nd will be the height of the cylinders';
        }
        else if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
            maxSelections = 2;
            minSelections = 2;
            infoMessage = 'Select exactly 2 attributes for the chart:\n• The 1st selected will be the Key (categories/slices)\n• The 2nd will be the Size (numeric values)';
        }
        else {
            maxSelections = dimensions.length;
            minSelections = 1;
            infoMessage = 'Select attributes to visualize';
        }
        // Show information to the user
        vscode.window.showInformationMessage(infoMessage);
        // Create a QuickPick instance
        const quickPick = vscode.window.createQuickPick();
        // Try to find numeric columns for better suggestions
        const numericColumns = dimensions.filter(dim => {
            try {
                const data = loadData(dataSource);
                return data.length > 0 && typeof data[0][dim] === 'number';
            }
            catch {
                return false;
            }
        });
        // Auto-select the minimum required dimensions with descriptive labels
        if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
            // For barsmap, try to select appropriate dimensions
            const xAxisField = dimensions.find(d => !numericColumns.includes(d)) || dimensions[0]; // Categorical for X
            const heightField = numericColumns[0] || dimensions[1] || dimensions[0]; // Numeric for height
            // Try to find another categorical field for Z if available
            const zAxisField = dimensions.find(d => !numericColumns.includes(d) && d !== xAxisField) ||
                dimensions.find(d => d !== xAxisField && d !== heightField) ||
                dimensions[2] || dimensions[0];
            // Return to simpler item format without detailed hints
            quickPick.items = dimensions.map(d => ({
                label: d,
                picked: d === xAxisField || d === heightField || d === zAxisField
            }));
        }
        else if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
            // For pie/donut, try to select one categorical and one numeric field
            const categoricalField = dimensions.find(d => !numericColumns.includes(d)) || dimensions[0];
            const numericField = numericColumns[0] || dimensions[1] || dimensions[0];
            quickPick.items = dimensions.map(d => {
                const isNumeric = numericColumns.includes(d);
                return {
                    label: d,
                    description: d === categoricalField ? "(Key - Categories)" :
                        d === numericField ? "(Size - Values)" : "",
                    detail: isNumeric ? "Numeric field - good for Size" :
                        "Text field - good for Key",
                    picked: d === categoricalField || d === numericField
                };
            });
        }
        else {
            // Standard items for other chart types - preselect first minSelections dimensions
            quickPick.items = dimensions.map((d, index) => ({
                label: d,
                picked: index < minSelections // Auto-select minimum required
            }));
        }
        quickPick.canSelectMany = true;
        quickPick.placeholder = `Select ${minSelections === maxSelections ? 'exactly ' + minSelections : minSelections + '-' + maxSelections} dimensions`;
        quickPick.title = 'Available dimensions in the data';
        // For tracking previous selections
        let previousSelection = quickPick.items.filter(item => item.picked);
        // Handle selection changes
        quickPick.onDidChangeSelection(items => {
            // Find the newly selected item (if any)
            const newlySelected = items.find(item => !previousSelection.some(prev => prev.label === item.label));
            if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
                if (items.length > maxSelections && newlySelected) {
                    // Replace the third item with the newly selected one to maintain exactly 3
                    const keepItems = [...previousSelection.slice(0, 2), newlySelected];
                    quickPick.selectedItems = keepItems;
                    // Show user what each dimension represents after the change
                    const message = keepItems.map((item, idx) => {
                        const roles = ["X axis (Horizontal)", "Height (Vertical)", "Z axis (Depth)"];
                        return `${roles[idx]}: "${item.label}"`;
                    }).join(', ');
                    vscode.window.showInformationMessage(`Updated selection: ${message}`);
                    previousSelection = keepItems;
                }
                else if (items.length <= maxSelections) {
                    // Allow any selection (even below minimum) but track changes
                    previousSelection = Array.from(items);
                    // If they have valid selections, show meaningful labels
                    if (items.length > 0) {
                        const message = items.map((item, idx) => {
                            const roles = ["X axis (Horizontal)", "Height (Vertical)", "Z axis (Depth)"];
                            const role = idx < roles.length ? roles[idx] : `Dimension ${idx + 1}`;
                            return `${role}: "${item.label}"`;
                        }).join(', ');
                        vscode.window.showInformationMessage(message);
                    }
                }
            }
            else if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
                if (items.length > maxSelections && newlySelected) {
                    // Smart replacement for pie/donut: swap the second item with the new one
                    const keepItems = [previousSelection[0], newlySelected];
                    quickPick.selectedItems = keepItems;
                    // Show updated selection
                    const message = `Key: "${keepItems[0].label}", Size: "${keepItems[1].label}"`;
                    vscode.window.showInformationMessage(`Updated selection: ${message}`);
                    previousSelection = keepItems;
                }
                else {
                    // Allow any selection (even below minimum) but track changes
                    previousSelection = Array.from(items);
                    // If they have exactly 2 selections, show meaningful labels
                    if (items.length === 2) {
                        const message = `Key: "${items[0].label}", Size: "${items[1].label}"`;
                        vscode.window.showInformationMessage(message);
                    }
                }
            }
            else if (chartType === chartModel_1.ChartType.BARS_CHART || chartType === chartModel_1.ChartType.CYLS_CHART) {
                if (items.length > maxSelections && newlySelected) {
                    // Smart replacement for 2D visualization: swap the second item with the new one
                    const keepItems = [previousSelection[0], newlySelected];
                    quickPick.selectedItems = keepItems;
                    // Show updated selection
                    const message = `X axis: "${keepItems[0].label}", Height: "${keepItems[1].label}"`;
                    vscode.window.showInformationMessage(`Updated selection: ${message}`);
                    previousSelection = keepItems;
                }
                else {
                    // Allow any selection (even below minimum) but track changes
                    previousSelection = Array.from(items);
                    // If they have exactly 2 selections, show meaningful labels
                    if (items.length === 2) {
                        const message = `X axis: "${items[0].label}", Height: "${items[1].label}"`;
                        vscode.window.showInformationMessage(message);
                    }
                }
            }
            else {
                previousSelection = Array.from(items);
            }
        });
        // Handle acceptance (when user presses Enter)
        return new Promise(resolve => {
            quickPick.onDidAccept(() => {
                const selectedItems = quickPick.selectedItems;
                // Validate selection count - this is where minimum is enforced
                if (selectedItems.length < minSelections) {
                    vscode.window.showErrorMessage(`Please select at least ${minSelections} dimension(s) before continuing`);
                    return; // Don't proceed - keep dialog open
                }
                quickPick.hide();
                // Create the chart data object and resolve the promise
                resolve({
                    title,
                    dataSource,
                    dimensions: selectedItems.map(item => item.label),
                    description: `Chart created from ${dataSource.split('/').pop()}`
                });
            });
            quickPick.onDidHide(() => {
                quickPick.dispose();
                resolve(undefined);
            });
            quickPick.show();
        });
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error collecting chart data: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Automatically extracts available dimensions from a data file
 * @param dataSource Path to the local file
 * @returns Array with the names of available dimensions
 */
async function extractDimensions(dataSource) {
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
    }
    catch (error) {
        vscode.window.showWarningMessage(`Could not extract dimensions: ${error}`);
        return ['name', 'value']; // Default values in case of error
    }
}
/**
 * Processes and loads data from a CSV file
 * @param filePath Path to the CSV file
 * @returns Object with processed data in usable format
 */
function processCSVData(filePath) {
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
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(separator).map(val => val.trim());
        // Create object with corresponding values
        const item = {};
        headers.forEach((header, index) => {
            // Try to convert to number if possible
            const value = values[index];
            if (value && !isNaN(Number(value))) {
                item[header] = Number(value);
            }
            else {
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
function convertCSVtoJSON(csvPath) {
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
function loadData(dataSource) {
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
 * Collects dimensions to use for visualization
 */
async function collectDimensions(data, chartType) {
    // Extract field names from the first data item
    const fields = Object.keys(data[0] || {});
    if (fields.length === 0) {
        vscode.window.showErrorMessage('No fields found in the data');
        return undefined;
    }
    // For barsmap charts, we need exactly 3 dimensions (x, y, and z)
    const isBarsmapChart = chartType === chartModel_1.ChartType.BARSMAP_CHART;
    const expectedSelections = isBarsmapChart ? 3 : 2; // Exactly 3 for barsmap
    const minSelections = isBarsmapChart ? 3 : 1; // Require exactly 3 for barsmap
    // Create quickpick for dimension selection
    const picker = vscode.window.createQuickPick();
    picker.title = `Select ${isBarsmapChart ? 'exactly 3' : 'at least 1'} dimension${minSelections > 1 ? 's' : ''}`;
    picker.placeholder = isBarsmapChart ?
        'For Barsmap: 1st=x_axis, 2nd=height, 3rd=z_axis (all required)' :
        'Select dimensions for visualization';
    picker.canSelectMany = true;
    // For barsmap, show a more helpful message
    if (isBarsmapChart) {
        vscode.window.showInformationMessage('Barsmap charts require exactly 3 dimensions:\n' +
            '• 1st selected = X axis (horizontal)\n' +
            '• 2nd selected = Height of bars (vertical)\n' +
            '• 3rd selected = Z axis (depth)');
    }
    picker.items = fields.map(field => ({
        label: field,
        description: `Field: ${field}`,
        picked: false
    }));
    return new Promise((resolve) => {
        picker.onDidAccept(() => {
            const selections = picker.selectedItems.map(item => item.label);
            // Validate selections based on chart type
            if (isBarsmapChart) {
                if (selections.length !== 3) {
                    vscode.window.showErrorMessage('Barsmap charts require exactly 3 dimensions (x axis, height, and z axis)');
                    return; // Don't close picker yet
                }
            }
            else if (selections.length < minSelections) {
                vscode.window.showErrorMessage(`Please select at least ${minSelections} dimension${minSelections > 1 ? 's' : ''}`);
                return; // Don't close picker yet
            }
            picker.hide();
            resolve(selections);
        });
        picker.onDidHide(() => {
            picker.dispose();
            resolve(undefined);
        });
        picker.show();
    });
}
//# sourceMappingURL=dataCollector.js.map