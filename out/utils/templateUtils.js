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
        case chartModel_1.ChartType.TIME_SERIES:
            return 'time-series.html';
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
    // Sanitizar la ruta de los datos si es local
    let dataSource = data.dataSource;
    if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
        // Convertir a URL relativa - usar solo el nombre del archivo
        dataSource = path.basename(dataSource);
    }
    // Preparar dimensiones individuales para el eje X e Y
    const xDimension = data.dimensions[0] ? `'${data.dimensions[0]}'` : "'producto'";
    const yDimension = data.dimensions[1] ? `'${data.dimensions[1]}'` : "'ventas'";
    // Valores predeterminados para opciones
    let height = 1;
    let width = 2;
    // Si hay opciones específicas, usarlas - usando el operador ?? para manejar undefined
    if (chartSpecification.options && 'height' in chartSpecification.options) {
        height = chartSpecification.options.height ?? height;
    }
    if (chartSpecification.options && 'width' in chartSpecification.options) {
        width = chartSpecification.options.width ?? width;
    }
    // Crear mapa de variables
    const variableMap = {
        TITLE: data.title,
        DATA_SOURCE: dataSource,
        X_DIMENSION: xDimension,
        Y_DIMENSION: yDimension,
        HEIGHT: height,
        WIDTH: width,
        DESCRIPTION: data.description || '',
        CHART_TYPE: chartSpecification.type,
    };
    return variableMap;
}
/**
 * Processes a template for a specific chart
 * @param context Extension context
 * @param chartSpec Chart specification
 * @returns Processed HTML content and original data path if it was a local file
 */
function processTemplate(context, chartSpec) {
    // Get the correct template file
    const templateFileName = getTemplateFileName(chartSpec.type);
    // Load the template
    const template = loadTemplate(context, templateFileName);
    // Variable para almacenar la ruta original si es un archivo local
    let originalDataPath;
    // Si la fuente de datos es local, guardamos la ruta original
    if (chartSpec.data.dataSource.startsWith('/') || chartSpec.data.dataSource.includes(':\\')) {
        originalDataPath = chartSpec.data.dataSource;
        // No modificamos chartSpec.data, solo el mapa de variables
    }
    // Create variable map
    const variables = createVariableMap(chartSpec);
    // Replace variables in template
    const html = replaceTemplateVariables(template, variables);
    return { html, originalDataPath };
}
/**
 * Saves processed HTML content to a file
 * @param content HTML content to save
 * @param defaultName Suggested file name
 * @param originalDataPath Optional path to the original data file
 * @returns Path to the saved file or undefined if user cancelled
 */
async function saveHtmlToFile(content, defaultName, originalDataPath) {
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
        // Si hay un archivo de datos local, copiarlo al mismo directorio que el HTML
        if (originalDataPath) {
            const dataFileName = path.basename(originalDataPath);
            const targetDataPath = path.join(path.dirname(fileUri.fsPath), dataFileName);
            // Copiar el archivo de datos junto al HTML
            fs.copyFileSync(originalDataPath, targetDataPath);
        }
        return fileUri.fsPath;
    }
    catch (error) {
        throw new Error(`Error saving file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
//# sourceMappingURL=templateUtils.js.map