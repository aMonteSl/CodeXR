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
exports.createBabiaXRVisualization = createBabiaXRVisualization;
exports.launchBabiaXRVisualization = launchBabiaXRVisualization;
exports.collectChartData = collectChartData;
exports.collectChartOptions = collectChartOptions;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const server_1 = require("./server");
const chartModel_1 = require("./models/chartModel");
const templateUtils_1 = require("./utils/templateUtils");
/**
 * Creates an HTML file with a BabiaXR visualization based on the selected template
 * @param chartType The type of chart to create
 * @param chartData Data for the chart
 * @param context Extension context
 * @returns Path to the created file or undefined if operation was cancelled
 */
async function createBabiaXRVisualization(chartType, chartData, context) {
    try {
        // Create a chart specification object
        const chartSpec = {
            type: chartType,
            data: chartData
        };
        // Process template with the chart specification
        const { html, originalDataPath } = (0, templateUtils_1.processTemplate)(context, chartSpec);
        // Get sanitized filename from chart title
        const fileName = `${chartData.title.replace(/\s+/g, '-')}.html`;
        // Save the HTML content to a file, passing the original data path if available
        const filePath = await (0, templateUtils_1.saveHtmlToFile)(html, fileName, originalDataPath);
        if (!filePath) {
            return undefined; // User cancelled the operation
        }
        // Open the file in the editor
        await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        return filePath;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Launches a server with the created BabiaXR visualization
 * @param filePath Path to the HTML file
 * @param context Extension context
 */
async function launchBabiaXRVisualization(filePath, context) {
    // Start HTTPS server (required for WebXR)
    await (0, server_1.startServer)(filePath, context, true, true);
}
/**
 * Recopila información sobre la fuente de datos de manera más amigable
 * @returns URL o ruta del archivo de datos seleccionado
 */
async function collectDataSource() {
    // 1. Mostrar opciones para elegir el tipo de fuente de datos
    const sourceType = await vscode.window.showQuickPick([
        { label: '$(file) Archivo local', id: 'local', description: 'Seleccionar archivo CSV o JSON del equipo' },
        { label: '$(cloud) URL remota', id: 'remote', description: 'Ingresar URL de datos online' },
        { label: '$(beaker) Datos de ejemplo', id: 'sample', description: 'Usar conjunto de datos predefinido' }
    ], {
        placeHolder: 'Seleccionar la fuente de los datos',
        title: 'Fuente de datos para la visualización'
    });
    if (!sourceType)
        return undefined;
    switch (sourceType.id) {
        case 'local':
            // Seleccionar archivo local mediante un diálogo
            const options = {
                canSelectMany: false,
                openLabel: 'Seleccionar archivo de datos',
                filters: { 'Archivos de datos': ['csv', 'json'] }
            };
            const fileUri = await vscode.window.showOpenDialog(options);
            if (!fileUri || fileUri.length === 0)
                return undefined;
            return fileUri[0].fsPath;
        case 'remote':
            // Para URLs, seguimos necesitando un input box
            return await vscode.window.showInputBox({
                prompt: 'Introduce la URL del archivo de datos',
                placeHolder: 'https://ejemplo.com/datos.csv',
                validateInput: input => {
                    // Validar que sea una URL válida
                    try {
                        new URL(input);
                        return null; // Sin error
                    }
                    catch {
                        return 'Por favor, introduce una URL válida';
                    }
                }
            });
        case 'sample':
            // Ofrecer datasets de ejemplo para elegir
            const sampleDataset = await vscode.window.showQuickPick([
                {
                    label: 'Datos demográficos',
                    value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv',
                    description: 'Población por países'
                },
                {
                    label: 'Ventas trimestrales',
                    value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv',
                    description: 'Ventas por trimestre'
                },
                {
                    label: 'Estadísticas de uso',
                    value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv',
                    description: 'Uso de plataforma'
                }
            ], {
                placeHolder: 'Selecciona un conjunto de datos de ejemplo',
            });
            return sampleDataset?.value;
    }
    return undefined;
}
/**
 * Collects chart data from the user
 * @param chartType The type of chart
 * @returns Chart data or undefined if cancelled
 */
async function collectChartData(chartType) {
    try {
        // Ask for chart title
        const title = await vscode.window.showInputBox({
            prompt: 'Título del gráfico',
            placeHolder: 'Mi visualización BabiaXR',
            value: `${chartType} - ${new Date().toLocaleDateString()}`
        });
        if (!title)
            return undefined;
        // Usar la nueva función para recopilar la fuente de datos
        const dataSource = await collectDataSource();
        if (!dataSource)
            return undefined;
        // Extraer dimensiones automáticamente
        const dimensions = await extractDimensions(dataSource);
        // Información sobre cómo se utilizarán las dimensiones para Bar Chart
        let maxSelections = 3;
        let minSelections = 2;
        let infoMessage = 'Selecciona entre 2 y 3 atributos para el gráfico:\n• El 1º seleccionado será el eje X\n• El 2º será la altura de las barras\n• El 3º (opcional) será el eje Z';
        if (chartType !== chartModel_1.ChartType.BAR_CHART) {
            maxSelections = dimensions.length;
            minSelections = 1;
            infoMessage = 'Selecciona los atributos para visualizar';
        }
        // Mostrar información al usuario
        vscode.window.showInformationMessage(infoMessage);
        // Mostrar un selector con las dimensiones encontradas
        const selectedDimensions = await vscode.window.showQuickPick(dimensions.map(d => ({ label: d, picked: d === dimensions[0] || d === dimensions[1] })), {
            canPickMany: true,
            placeHolder: `Selecciona ${minSelections}-${maxSelections} dimensiones para visualizar`,
            title: 'Dimensiones disponibles en los datos'
        });
        // Validar que se hayan seleccionado suficientes dimensiones
        if (!selectedDimensions || selectedDimensions.length < minSelections) {
            vscode.window.showErrorMessage(`Debes seleccionar al menos ${minSelections} dimensiones para este tipo de gráfico.`);
            return undefined;
        }
        // Validar que no se excedan las dimensiones máximas para bar chart
        if (chartType === chartModel_1.ChartType.BAR_CHART && selectedDimensions.length > maxSelections) {
            vscode.window.showErrorMessage(`Para un gráfico de barras, selecciona máximo ${maxSelections} dimensiones.`);
            return undefined;
        }
        // Usar las dimensiones seleccionadas
        return {
            title,
            dataSource,
            dimensions: selectedDimensions.map(d => d.label),
            createdAt: Date.now()
        };
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error recopilando datos del gráfico: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Collects chart-specific options based on chart type
 * @param chartType The type of chart
 * @returns Options object or undefined if cancelled
 */
async function collectChartOptions(chartType) {
    switch (chartType) {
        case chartModel_1.ChartType.BAR_CHART:
            return collectBarChartOptions();
        case chartModel_1.ChartType.PIE_CHART:
            return collectPieChartOptions();
        default:
            return {};
    }
}
/**
 * Collects options specific to bar charts
 * @returns Bar chart options
 */
async function collectBarChartOptions() {
    // Ask for horizontal orientation
    const horizontalResponse = await vscode.window.showQuickPick(['Vertical', 'Horizontal'], { placeHolder: 'Bar orientation' });
    if (!horizontalResponse)
        return undefined;
    return {
        horizontal: horizontalResponse === 'Horizontal',
        height: 1,
        width: 2
    };
}
/**
 * Collects options specific to pie charts
 * @returns Pie chart options
 */
async function collectPieChartOptions() {
    // Ask for donut style
    const donutResponse = await vscode.window.showQuickPick(['Standard Pie', 'Donut'], { placeHolder: 'Chart style' });
    if (!donutResponse)
        return undefined;
    return {
        size: 1.5,
        height: 0.2,
        donut: donutResponse === 'Donut',
        showLabels: true
    };
}
/**
 * Collects options specific to time series charts
 * @returns Time series options
 */
async function collectTimeSeriesOptions() {
    // Ask for time column
    const timeColumn = await vscode.window.showInputBox({
        prompt: 'Column containing time data',
        placeHolder: 'e.g., date, timestamp, year',
        value: 'date'
    });
    if (!timeColumn)
        return undefined;
    // Ask for area style
    const areaResponse = await vscode.window.showQuickPick(['Line', 'Area'], { placeHolder: 'Chart style' });
    if (!areaResponse)
        return undefined;
    return {
        timeColumn,
        area: areaResponse === 'Area',
        width: 3,
        height: 1
    };
}
/**
 * Extrae automáticamente las dimensiones disponibles de un archivo de datos
 * @param dataSource Ruta o URL al archivo de datos
 * @returns Array con los nombres de las dimensiones disponibles
 */
async function extractDimensions(dataSource) {
    try {
        let data;
        // Si es una ruta local
        if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
            const fileContent = fs.readFileSync(dataSource, 'utf8');
            // Determinar si es JSON o CSV por la extensión
            if (dataSource.toLowerCase().endsWith('.json')) {
                data = JSON.parse(fileContent);
                // Si tenemos un array con al menos un objeto, extraemos sus propiedades
                if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                    return Object.keys(data[0]);
                }
            }
            else if (dataSource.toLowerCase().endsWith('.csv')) {
                // Para CSV, asumimos que la primera línea contiene los encabezados
                const lines = fileContent.split('\n');
                if (lines.length > 0) {
                    return lines[0].split(',').map(header => header.trim());
                }
            }
        }
        // Para URLs y otros casos, devolvemos un conjunto predeterminado
        return ['nombre', 'valor'];
    }
    catch (error) {
        vscode.window.showWarningMessage(`No se pudieron extraer dimensiones automáticamente: ${error}`);
        return ['nombre', 'valor']; // Valores predeterminados en caso de error
    }
}
//# sourceMappingURL=babiaxrManager.js.map