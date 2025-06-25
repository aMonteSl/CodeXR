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
exports.createBabiaXRVisualization = createBabiaXRVisualization;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const chartModel_1 = require("../babiaxr/models/chartModel");
/**
 * Get the template file name for a chart type
 */
function getTemplateFileName(chartType) {
    return 'chart-template.html';
}
/**
 * Loads and processes an HTML template
 * @param templateName Name of the template file (without path)
 * @param replacements Key-value pairs for template variable replacements
 * @param extensionUri Extension URI
 * @returns Processed HTML content
 */
async function loadTemplate(templateName, replacements, extensionUri) {
    try {
        const templatePath = path.join(extensionUri.fsPath, 'templates', 'analysis', templateName);
        // Check if template exists
        if (fs.existsSync(templatePath)) {
            // Read template content
            let content = fs.readFileSync(templatePath, 'utf-8');
            // Replace all variables with their values
            for (const [key, value] of Object.entries(replacements)) {
                content = content.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
            }
            return content;
        }
        else {
            throw new Error(`Template not found: ${templatePath}`);
        }
    }
    catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        throw error;
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
 */
function createVariableMap(chartSpecification) {
    const { data } = chartSpecification;
    // We use a generic value that will be replaced when saving
    const dataSource = "data.json";
    // Prepare individual dimensions for the axes using the data properties
    // with fallbacks in case dimensions array is undefined
    const dimensions = data.dimensions || [];
    const xDimension = dimensions[0] || data.xKey || 'product';
    const yDimension = dimensions[1] || data.yKey || 'sales';
    // Compose the third axis if it exists
    let zDimensionAttr = '';
    if (dimensions.length > 2 && dimensions[2]) {
        zDimensionAttr = `z_axis: ${dimensions[2]};`;
    }
    else if (data.zKey) {
        // Fallback to zKey if no dimensions[2]
        zDimensionAttr = `z_axis: ${data.zKey};`;
    }
    // Default values for options
    let height = 1;
    let width = 2;
    let barRotation = "0 0 0"; // For vertical orientation
    // Environment variables with defaults
    const backgroundColor = data.environment?.backgroundColor || '#112233';
    const environmentPreset = data.environment?.environmentPreset || 'forest';
    const groundColor = data.environment?.groundColor || '#445566';
    const chartPalette = data.environment?.chartPalette || 'ubuntu';
    // Create variable map
    const variableMap = {
        TITLE: data.title,
        DATA_SOURCE: dataSource,
        X_DIMENSION: xDimension,
        Y_DIMENSION: yDimension,
        Z_DIMENSION_ATTR: zDimensionAttr,
        HEIGHT: height,
        WIDTH: width,
        BAR_ROTATION: barRotation,
        DESCRIPTION: data.description || '',
        CHART_TYPE: chartSpecification.type,
        BACKGROUND_COLOR: backgroundColor,
        ENVIRONMENT_PRESET: environmentPreset,
        GROUND_COLOR: groundColor,
        CHART_PALETTE: chartPalette
    };
    return variableMap; // Don't forget to return the variable map!
}
/**
 * Checks if a string is a valid URL
 * @param str String to check
 * @returns true if it's a URL, false otherwise
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
 * Map of chart components to insert in the template
 */
const chartComponents = {
    [chartModel_1.ChartType.BARSMAP_CHART]: `
        <!-- Barsmap Chart -->
        <a-entity babia-barsmap="from: data; 
                  legend: true; 
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  \${Z_DIMENSION_ATTR}
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3" 
                  scale="1 1 1">
        </a-entity>`,
    [chartModel_1.ChartType.BARS_CHART]: `
        <!-- Bars Chart -->
        <a-entity babia-bars="from: data;
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3"
                  scale="1 1 1">
        </a-entity>`,
    [chartModel_1.ChartType.CYLS_CHART]: `
        <!-- Cylinder Chart -->
        <a-entity babia-cyls="from: data;
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3"
                  scale="1 1 1">
        </a-entity>`,
    [chartModel_1.ChartType.DONUT_CHART]: `
        <!-- Donut Chart -->
        <a-entity babia-doughnut="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>`,
    [chartModel_1.ChartType.PIE_CHART]: `
        <!-- Pie Chart -->
        <a-entity babia-pie="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>`,
    [chartModel_1.ChartType.BUBBLES_CHART]: `
        <!-- Bubbles Chart -->
        <a-entity babia-bubbles="from: data;
                  legend: true;
                  tooltip: true;
                  animation: true;
                  palette: \${CHART_PALETTE};
                  x_axis: \${X_DIMENSION};
                  z_axis: \${Z_DIMENSION};
                  height: \${Y_DIMENSION};
                  radius: \${RADIUS_DIMENSION};
                  heightMax: 15;
                  radiusMax: 1;
                  title: \${TITLE};
                  titleColor: #FFFFFF;
                  titlePosition: 0 10 0;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3"
                  scale="1 1 1">
        </a-entity>`,
    [chartModel_1.ChartType.SCATTER_PLOT]: "",
    [chartModel_1.ChartType.NETWORK_GRAPH]: ""
};
/**
 * Process a template with variable values from a chart specification
 */
async function processTemplate(context, chartSpec) {
    // Get template file
    const templatePath = path.join(context.extensionPath, 'templates', 'chart-template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    // Get variable mapping
    const variableMap = createVariableMap(chartSpec);
    // Get chart component template
    const chartComponent = chartComponents[chartSpec.type];
    // Replace the placeholder with the chart component
    let processedHtml = templateContent.replace('<!-- CHART_COMPONENT_PLACEHOLDER -->', chartComponent);
    // Replace variables in the template
    for (const [key, value] of Object.entries(variableMap)) {
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        processedHtml = processedHtml.replace(regex, String(value));
    }
    // Remove inline comments that might break a-frame attribute parsing
    // This regex targets specifically comments inside attribute strings
    processedHtml = processedHtml.replace(/([a-z\-]+="[^"]*)(\/\/[^"]*?)([^"]*")/gi, '$1$3');
    return {
        html: processedHtml,
        originalDataPath: chartSpec.data.dataSource,
        isRemoteData: isUrl(chartSpec.data.dataSource)
    };
}
/**
 * Saves processed HTML content to a file and copies related data files
 */
async function saveHtmlToFile(html, fileName, originalDataPath, isRemoteData = false) {
    try {
        // Request directory name
        const projectName = await vscode.window.showInputBox({
            prompt: 'Name of the directory for the visualization',
            placeHolder: 'my-visualization',
            value: path.basename(fileName, '.html').toLowerCase().replace(/\s+/g, '-')
        });
        if (!projectName)
            return undefined;
        // Determine base directory
        let baseDir = vscode.workspace.workspaceFolders ?
            vscode.workspace.workspaceFolders[0].uri.fsPath :
            require('os').homedir();
        // Request location
        const dirOptions = {
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select folder for the project'
        };
        const selectedDir = await vscode.window.showOpenDialog(dirOptions);
        if (selectedDir && selectedDir.length > 0) {
            baseDir = selectedDir[0].fsPath;
        }
        // Create project directory
        const projectDir = path.join(baseDir, projectName);
        // Handle existing directory case
        if (fs.existsSync(projectDir)) {
            const overwrite = await vscode.window.showWarningMessage(`The folder '${projectName}' already exists. Do you want to overwrite its contents?`, 'Overwrite', 'Cancel');
            if (overwrite !== 'Overwrite') {
                return undefined;
            }
        }
        else {
            fs.mkdirSync(projectDir, { recursive: true });
        }
        // Save the HTML file in the project folder
        const htmlPath = path.join(projectDir, 'index.html');
        // Copy the JSON data file
        if (originalDataPath && !isRemoteData) {
            const dataFileName = path.basename(originalDataPath);
            const destDataPath = path.join(projectDir, dataFileName);
            try {
                // Copy the file
                fs.copyFileSync(originalDataPath, destDataPath);
                // Update the URL in the HTML with proper regex
                html = html.replace(/babia-queryjson="url: .*?"/, `babia-queryjson="url: ./${dataFileName}"`);
                // Log success for debugging
                console.log(`Copied data file from ${originalDataPath} to ${destDataPath}`);
            }
            catch (error) {
                console.error(`Error copying data file: ${error}`);
                vscode.window.showErrorMessage(`Error copying data file: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // Save the HTML
        fs.writeFileSync(htmlPath, html);
        // Success message
        vscode.window.showInformationMessage(`Visualization created in: ${projectDir}`, 'Open folder').then(selection => {
            if (selection === 'Open folder') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
            }
        });
        return htmlPath;
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error saving project: ${error}`);
        return undefined;
    }
}
/**
 * Creates a BabiaXR visualization
 */
async function createBabiaXRVisualization(chartType, chartData, context) {
    try {
        // Log the data source for debugging
        console.log(`Data source: ${chartData.dataSource}`);
        // Validate data source
        if (!chartData.dataSource || (typeof chartData.dataSource === 'string' && chartData.dataSource.trim() === '')) {
            throw new Error('Invalid data source');
        }
        // Check if file exists (if it's a local path)
        if (!isUrl(chartData.dataSource) && !fs.existsSync(chartData.dataSource)) {
            throw new Error(`Data file not found: ${chartData.dataSource}`);
        }
        // Código adicional aquí
        return undefined; // Valor de retorno provisional
    }
    catch (error) {
        vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
//# sourceMappingURL=templateUtils.js.map