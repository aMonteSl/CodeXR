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
exports.chartComponents = void 0;
exports.getTemplateFileName = getTemplateFileName;
exports.loadTemplate = loadTemplate;
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.createVariableMap = createVariableMap;
exports.isUrl = isUrl;
exports.processTemplate = processTemplate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chartModel_1 = require("../models/chartModel");
/**
 * Get the template file name for a chart type
 */
function getTemplateFileName(chartType) {
    return 'chart-template.html';
}
/**
 * Loads a template from the templates directory
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
 */
function createVariableMap(chartSpecification) {
    const { data } = chartSpecification;
    // We use a generic value that will be replaced when saving
    const dataSource = "data.json";
    // Prepare individual dimensions for the axes
    const xDimension = data.dimensions[0] || 'product';
    const yDimension = data.dimensions[1] || 'sales';
    // Compose the third axis if it exists
    let zDimensionAttr = '';
    if (data.dimensions.length > 2) {
        zDimensionAttr = `z_axis: ${data.dimensions[2]};`;
    }
    // Default values for options
    let height = 1;
    let width = 2;
    let barRotation = "0 0 0"; // For vertical orientation
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
    };
    return variableMap;
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
exports.chartComponents = {
    [chartModel_1.ChartType.BAR_CHART]: `
        <!-- Bar Chart -->
        <a-entity babia-barsmap="from: data; 
                  legend: true; 
                  tooltip: true;
                  palette: ubuntu;
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  \${Z_DIMENSION_ATTR}
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 1 -3" 
                  scale="1 1 1"
                  rotation="\${BAR_ROTATION}">
        </a-entity>`,
    [chartModel_1.ChartType.PIE_CHART]: `
        <!-- Pie Chart -->
        <a-entity babia-pie="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: ubuntu;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>`,
    // Space for future charts
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
    // Replace the placeholder with the chart component
    let processedHtml = templateContent.replace('<!-- CHART_COMPONENT_PLACEHOLDER -->', exports.chartComponents[chartSpec.type]);
    // Replace variables in the template
    for (const [key, value] of Object.entries(variableMap)) {
        const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
        processedHtml = processedHtml.replace(regex, String(value));
    }
    return {
        html: processedHtml,
        originalDataPath: chartSpec.data.dataSource,
        isRemoteData: isUrl(chartSpec.data.dataSource)
    };
}
//# sourceMappingURL=templateManager.js.map