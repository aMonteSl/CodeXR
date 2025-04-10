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
const chartModel_1 = require("../models/chartModel");
/**
 * Collects information about the data source
 * @returns Path to the selected data file
 */
async function collectDataSource(context) {
    // Show options to choose the type of data source
    const sourceType = await vscode.window.showQuickPick([
        { label: '$(file) Local File', id: 'local', description: 'Select JSON file from your computer' },
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
                filters: { 'Data Files': ['json'] }
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
 */
async function collectChartData(chartType, context) {
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
        // 3. Process data
        const data = loadData(dataSource);
        const dimensions = await collectDimensions(data, chartType);
        if (!dimensions || dimensions.length === 0) {
            return undefined; // User canceled
        }
        // 4. Process data
        return {
            title,
            dataSource,
            dimensions,
            xKey: dimensions[0],
            yKey: dimensions[1],
            zKey: dimensions.length > 2 ? dimensions[2] : undefined
        };
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
    // Determine required dimensions based on chart type
    const getDimensionLimits = () => {
        switch (chartType) {
            case chartModel_1.ChartType.BARSMAP_CHART:
                return { min: 3, max: 3, description: 'X axis, height, and Z axis (group)' };
            case chartModel_1.ChartType.BARS_CHART:
            case chartModel_1.ChartType.CYLS_CHART:
            case chartModel_1.ChartType.PIE_CHART:
            case chartModel_1.ChartType.DONUT_CHART:
                return { min: 2, max: 2, description: 'Category and value' };
            default:
                return { min: 1, max: 2, description: 'At least category required' };
        }
    };
    const limits = getDimensionLimits();
    const exactCount = limits.min === limits.max;
    // Create QuickPick for dimension selection
    const picker = vscode.window.createQuickPick();
    picker.title = exactCount ?
        `Select exactly ${limits.min} dimension${limits.min > 1 ? 's' : ''}` :
        `Select ${limits.min}-${limits.max} dimensions`;
    picker.placeholder = `For ${chartType}: ${limits.description}`;
    picker.canSelectMany = true;
    // For barsmap, show a more helpful message
    if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
        vscode.window.showInformationMessage('Barsmap charts require exactly 3 dimensions:\n' +
            '• 1st selected = X axis (horizontal categories)\n' +
            '• 2nd selected = Height of bars (values)\n' +
            '• 3rd selected = Z axis (groups for organization)');
    }
    else if (limits.max === 2) {
        vscode.window.showInformationMessage(`This chart type requires exactly ${limits.max} dimensions:\n` +
            '• 1st selected = Categories/Names\n' +
            '• 2nd selected = Values/Sizes');
    }
    // Create items with descriptions based on likely data content
    picker.items = fields.map(field => {
        // Try to determine if this field contains numeric values
        const isNumeric = data.every(item => !isNaN(parseFloat(item[field])) &&
            typeof item[field] !== 'boolean' &&
            item[field] !== null);
        const isText = data.every(item => typeof item[field] === 'string' &&
            isNaN(parseFloat(item[field])));
        let description = `Field: ${field}`;
        if (isNumeric) {
            description += ' (Numeric - good for values/heights)';
        }
        else if (isText) {
            description += ' (Text - good for categories)';
        }
        return {
            label: field,
            description: description,
            picked: false
        };
    });
    // Track selections and handle auto-deselection
    let currentSelections = [];
    // Function to update information message based on current selections
    const updateAxisMessage = (selectedItems) => {
        const selectedLabels = selectedItems.map(item => item.label);
        if (selectedLabels.length === 0) {
            // No message if no selections yet
            return;
        }
        // Build message based on chart type and number of selections
        let message = 'Current selections: ';
        if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
            if (selectedLabels.length >= 1) {
                message += `X-axis: ${selectedLabels[0]} `;
            }
            if (selectedLabels.length >= 2) {
                message += `| Height: ${selectedLabels[1]} `;
            }
            if (selectedLabels.length >= 3) {
                message += `| Z-axis (groups): ${selectedLabels[2]}`;
            }
        }
        else if (chartType === chartModel_1.ChartType.BARS_CHART || chartType === chartModel_1.ChartType.CYLS_CHART) {
            if (selectedLabels.length >= 1) {
                message += `Categories: ${selectedLabels[0]} `;
            }
            if (selectedLabels.length >= 2) {
                message += `| Heights: ${selectedLabels[1]}`;
            }
        }
        else if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
            if (selectedLabels.length >= 1) {
                message += `Segments: ${selectedLabels[0]} `;
            }
            if (selectedLabels.length >= 2) {
                message += `| Values: ${selectedLabels[1]}`;
            }
        }
        // Update picker placeholder with current selections
        picker.placeholder = message;
        // Also show an information message for immediate feedback
        // Only show for significant changes (first selection, second selection, etc.)
        if (selectedLabels.length === 1 || selectedLabels.length === 2 || selectedLabels.length === 3) {
            vscode.window.showInformationMessage(message);
        }
    };
    return new Promise((resolve) => {
        // Mantener un array para rastrear el orden de selección del usuario
        let userSelectionOrder = [];
        // Handle selection changes
        picker.onDidChangeSelection(items => {
            const currentLabels = items.map(item => item.label);
            // Si no hay selecciones, simplemente limpiar el orden
            if (currentLabels.length === 0) {
                userSelectionOrder = [];
                currentSelections = items;
                updateAxisMessage(currentSelections);
                return;
            }
            // 1. Procesar selecciones eliminadas
            userSelectionOrder = userSelectionOrder.filter(label => currentLabels.includes(label));
            // 2. Agregar nuevas selecciones al final
            const newSelections = currentLabels.filter(label => !userSelectionOrder.includes(label));
            userSelectionOrder = [...userSelectionOrder, ...newSelections];
            // 3. Si hay demasiadas selecciones, mantener solo las primeras 'max'
            if (userSelectionOrder.length > limits.max) {
                userSelectionOrder = userSelectionOrder.slice(0, limits.max);
            }
            // 4. Reordenar las selecciones actuales según userSelectionOrder
            // Esto es clave: forzamos que las selecciones estén en el orden que el usuario las hizo
            const orderedSelections = userSelectionOrder
                .map(label => items.find(item => item.label === label))
                .filter((item) => item !== undefined);
            // 5. Actualizar las selecciones en el picker para respetar el orden
            if (orderedSelections.length !== items.length ||
                !areSelectionsEqual(orderedSelections, items)) {
                picker.selectedItems = orderedSelections;
            }
            currentSelections = orderedSelections;
            updateAxisMessage(currentSelections);
        });
        // Función auxiliar para comparar si dos arrays de selecciones son iguales
        function areSelectionsEqual(a, b) {
            if (a.length !== b.length)
                return false;
            for (let i = 0; i < a.length; i++) {
                if (a[i].label !== b[i].label)
                    return false;
            }
            return true;
        }
        // El resto del código sigue igual...
        picker.onDidAccept(() => {
            // Usar userSelectionOrder para asegurar el orden correcto
            // en lugar de picker.selectedItems que podría tener un orden diferente
            const selections = userSelectionOrder;
            // Validate selections based on chart type
            if (exactCount && selections.length !== limits.min) {
                vscode.window.showWarningMessage(`This chart type requires exactly ${limits.min} dimension${limits.min > 1 ? 's' : ''}.`);
                return; // Don't close the picker, let the user fix their selection
            }
            else if (selections.length < limits.min) {
                vscode.window.showWarningMessage(`Please select at least ${limits.min} dimension${limits.min > 1 ? 's' : ''}.`);
                return; // Don't close the picker, let the user fix their selection
            }
            // Show final selection message before closing
            let finalMessage = 'Selected dimensions: ';
            if (chartType === chartModel_1.ChartType.BARSMAP_CHART) {
                finalMessage += `X-axis: ${selections[0]}, Height: ${selections[1]}, Z-axis: ${selections[2]}`;
            }
            else if (chartType === chartModel_1.ChartType.BARS_CHART || chartType === chartModel_1.ChartType.CYLS_CHART) {
                finalMessage += `Categories: ${selections[0]}, Heights: ${selections[1]}`;
            }
            else if (chartType === chartModel_1.ChartType.PIE_CHART || chartType === chartModel_1.ChartType.DONUT_CHART) {
                finalMessage += `Segments: ${selections[0]}, Values: ${selections[1]}`;
            }
            else {
                finalMessage += selections.join(', ');
            }
            vscode.window.showInformationMessage(finalMessage);
            picker.hide();
            resolve(selections);
        });
        picker.onDidHide(() => {
            picker.dispose();
            if (!userSelectionOrder || userSelectionOrder.length === 0) {
                resolve(undefined);
            }
        });
        picker.show();
    });
}
//# sourceMappingURL=dataCollector.js.map