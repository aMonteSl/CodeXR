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
exports.getTemplateFileName = getTemplateFileName;
exports.loadTemplate = loadTemplate;
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.createVariableMap = createVariableMap;
exports.processTemplate = processTemplate;
exports.saveHtmlToFile = saveHtmlToFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const chartModel_1 = require("../models/chartModel");
/**
 * Gets the appropriate template file name for a chart type
 * @param chartType The type of chart
 * @returns Template file name
 */
function getTemplateFileName(chartType) {
    switch (chartType) {
        case chartModel_1.ChartType.BAR_CHART:
            return 'bar-chart.html';
        case chartModel_1.ChartType.PIE_CHART:
            return 'pie-chart.html';
        case chartModel_1.ChartType.SCATTER_PLOT:
            return 'scatter-plot.html';
        case chartModel_1.ChartType.NETWORK_GRAPH:
            return 'network-graph.html';
        default:
            throw new Error(`Unsupported chart type: ${chartType}`);
    }
}
/**
 * Loads a template from the templates directory
 * @param context Extension context
 * @param templateFileName Name of the template file
 * @returns The template content as a string
 */
function loadTemplate(context, templateFileName) {
    try {
        const templatePath = path.join(context.extensionPath, 'templates', templateFileName);
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Template not found: ${templateFileName}`);
        }
        return fs.readFileSync(templatePath, 'utf8');
    }
    catch (error) {
        throw new Error(`Error loading template: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Replaces variables in a template with actual values
 * @param template The template string with placeholders
 * @param variables Object containing variable mappings
 * @returns Processed string with variables replaced
 */
function replaceTemplateVariables(template, variables) {
    let result = template;
    // Replace each variable in the template
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        result = result.replace(regex, String(value));
    }
    return result;
}
/**
 * Creates variable mappings from chart data
 * @param chartData The chart data
 * @returns Object with variable mappings for template replacement
 */
function createVariableMap(chartSpecification) {
    const { data } = chartSpecification;
    // Sanitizar la ruta de los datos si es local o remota
    let dataSource = data.dataSource;
    // Para rutas locales o URLs que han sido descargadas a archivos locales
    if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
        // En todos los casos, usamos solo el nombre del archivo para la referencia en HTML
        dataSource = path.basename(dataSource);
    }
    // Preparar dimensiones individuales para los ejes
    const xDimension = data.dimensions[0] || 'producto';
    const yDimension = data.dimensions[1] || 'ventas';
    // Componer el tercer eje si existe, o dejarlo vacío
    let zDimensionAttr = '';
    if (data.dimensions.length > 2) {
        zDimensionAttr = `z_axis: ${data.dimensions[2]};`;
    }
    // Valores predeterminados para opciones
    let height = 1;
    let width = 2;
    let barRotation = "0 0 0"; // Valor por defecto para orientación vertical
    // Si hay opciones específicas, usarlas
    if (chartSpecification.options) {
        // ...existing code...
    }
    // Crear mapa de variables
    const variableMap = {
        TITLE: data.title,
        DATA_SOURCE: dataSource, // Ahora esto siempre será el nombre del archivo local
        X_DIMENSION: xDimension,
        Y_DIMENSION: yDimension,
        Z_DIMENSION_ATTR: zDimensionAttr,
        HEIGHT: height,
        WIDTH: width,
        BAR_ROTATION: barRotation,
        DESCRIPTION: data.description || '',
        CHART_TYPE: chartSpecification.type,
    };
    return variableMap;
}
/**
 * Verifica si una cadena es una URL válida
 * @param str Cadena a verificar
 * @returns true si es una URL, false en caso contrario
 */
function isUrl(str) {
    try {
        new URL(str);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Processes a template for a specific chart
 * @param context Extension context
 * @param chartSpec Chart specification
 * @returns Processed HTML content and original data path if it was a local file
 */
async function processTemplate(context, chartSpec) {
    // Get the correct template file
    const templateFileName = getTemplateFileName(chartSpec.type);
    // Load the template
    const template = loadTemplate(context, templateFileName);
    // Variable para almacenar la ruta original si es un archivo local
    let originalDataPath;
    let dataSource = chartSpec.data.dataSource;
    let isRemoteData = false;
    try {
        // Verificar si es una URL
        if (isUrl(dataSource)) {
            isRemoteData = true;
            originalDataPath = dataSource;
            // Importamos las funciones desde babiaxrManager
            const { convertCSVtoJSON, fetchDataFromUrl } = require('../babiaxrManager');
            // Para URLs de CSV, necesitamos convertirlas a JSON
            if (dataSource.toLowerCase().endsWith('.csv')) {
                try {
                    // Convertir CSV a JSON y obtener la ruta temporal
                    const jsonPath = await convertCSVtoJSON(dataSource);
                    // Actualizar la ruta de datos para que use el JSON generado
                    chartSpec.data.dataSource = jsonPath;
                    dataSource = jsonPath;
                    // Mostrar mensaje informativo
                    vscode.window.showInformationMessage(`CSV remoto procesado y guardado como ${path.basename(jsonPath)}`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error procesando CSV remoto: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            // Para URLs JSON, también las descargamos para tener una copia local
            else if (dataSource.toLowerCase().endsWith('.json')) {
                try {
                    const content = await fetchDataFromUrl(dataSource);
                    let jsonData;
                    try {
                        jsonData = JSON.parse(content);
                    }
                    catch (parseError) {
                        throw new Error(`El archivo no es un JSON válido: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
                    }
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (!workspaceFolders) {
                        throw new Error('No hay un espacio de trabajo abierto para guardar los datos temporales');
                    }
                    // Crear un nombre de archivo basado en la URL
                    const urlObj = new URL(dataSource);
                    const fileName = path.basename(urlObj.pathname) || 'remote-data.json';
                    const jsonPath = path.join(workspaceFolders[0].uri.fsPath, fileName);
                    // Guardar los datos procesados
                    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
                    // Actualizar la ruta de datos
                    chartSpec.data.dataSource = jsonPath;
                    dataSource = jsonPath;
                    // Mostrar mensaje informativo
                    vscode.window.showInformationMessage(`JSON remoto descargado y guardado como ${path.basename(jsonPath)}`);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error procesando JSON remoto: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        // Si la fuente de datos es local, guardamos la ruta original
        else if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
            originalDataPath = dataSource;
            // Si es un archivo CSV, lo convertimos a JSON
            if (dataSource.toLowerCase().endsWith('.csv')) {
                // Importamos la función desde babiaxrManager
                const { convertCSVtoJSON } = require('../babiaxrManager');
                try {
                    // Convertir CSV a JSON
                    const jsonPath = await convertCSVtoJSON(dataSource);
                    // Actualizar la ruta de datos para que use el JSON generado
                    chartSpec.data.dataSource = jsonPath;
                    dataSource = jsonPath;
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error procesando CSV local: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error procesando la fuente de datos: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Create variable map
    const variables = createVariableMap(chartSpec);
    // Replace variables in template
    const html = replaceTemplateVariables(template, variables);
    return { html, originalDataPath, isRemoteData };
}
/**
 * Saves processed HTML content to a file
 * @param content HTML content to save
 * @param defaultName Suggested file name
 * @param originalDataPath Optional path to the original data file
 * @returns Path to the saved file or undefined if user cancelled
 */
async function saveHtmlToFile(content, defaultName, originalDataPath, isRemoteData) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace is open to save the visualization');
    }
    // Create default URI in the first workspace folder
    const defaultUri = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, defaultName));
    // Show save dialog
    const fileUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: {
            'HTML Files': ['html']
        },
        title: 'Save BabiaXR Visualization'
    });
    if (!fileUri) {
        return undefined; // User cancelled the operation
    }
    // Save the content to the file
    try {
        // Guardar el HTML
        fs.writeFileSync(fileUri.fsPath, content);
        // Si hay un archivo de datos...
        if (originalDataPath) {
            // Para datos remotos que se han descargado localmente
            if (isRemoteData) {
                // El archivo JSON ya se ha generado, necesitamos copiarlo
                let localJsonPath;
                if (originalDataPath.toLowerCase().endsWith('.csv')) {
                    // Para URLs de CSV, el archivo JSON se generó en el workspace
                    const urlObj = new URL(originalDataPath);
                    const fileName = path.basename(urlObj.pathname).replace(/\.csv$/i, '.json');
                    localJsonPath = path.join(workspaceFolders[0].uri.fsPath, fileName);
                }
                else if (originalDataPath.toLowerCase().endsWith('.json')) {
                    // Para URLs de JSON, el archivo se descargó con el mismo nombre
                    const urlObj = new URL(originalDataPath);
                    const fileName = path.basename(urlObj.pathname);
                    localJsonPath = path.join(workspaceFolders[0].uri.fsPath, fileName);
                }
                // Copiar el JSON generado al directorio del HTML
                if (localJsonPath && fs.existsSync(localJsonPath)) {
                    const jsonFileName = path.basename(localJsonPath);
                    const targetJsonPath = path.join(path.dirname(fileUri.fsPath), jsonFileName);
                    fs.copyFileSync(localJsonPath, targetJsonPath);
                    console.log(`Copiado archivo JSON desde ${localJsonPath} a ${targetJsonPath}`);
                }
            }
            // Para archivos locales (código existente)
            else {
                // Si el archivo original era CSV, también copiamos el JSON generado
                if (originalDataPath.toLowerCase().endsWith('.csv')) {
                    // Copiamos el JSON asociado
                    const jsonPath = originalDataPath.replace(/\.csv$/i, '.json');
                    const jsonFileName = path.basename(jsonPath);
                    const targetJsonPath = path.join(path.dirname(fileUri.fsPath), jsonFileName);
                    if (fs.existsSync(jsonPath)) {
                        fs.copyFileSync(jsonPath, targetJsonPath);
                        console.log(`Copiado archivo JSON desde ${jsonPath} a ${targetJsonPath}`);
                    }
                }
                else {
                    // Copiar el archivo de datos original
                    const dataFileName = path.basename(originalDataPath);
                    const targetDataPath = path.join(path.dirname(fileUri.fsPath), dataFileName);
                    fs.copyFileSync(originalDataPath, targetDataPath);
                    console.log(`Copiado archivo de datos desde ${originalDataPath} a ${targetDataPath}`);
                }
            }
        }
        return fileUri.fsPath;
    }
    catch (error) {
        throw new Error(`Error saving file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=templateUtils.js.map