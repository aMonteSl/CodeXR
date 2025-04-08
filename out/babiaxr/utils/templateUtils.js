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
exports.loadChartTemplate = loadChartTemplate;
exports.processTemplate = processTemplate;
exports.saveTemplateToFile = saveTemplateToFile;
exports.getEnvironmentPresets = getEnvironmentPresets;
exports.getChartPalettes = getChartPalettes;
exports.getComponentNameForChartType = getComponentNameForChartType;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Loads the chart template file
 * @param context VS Code extension context
 * @returns Template content as string
 */
function loadChartTemplate(context) {
    try {
        // Get template file path
        const templatePath = path.join(context.extensionPath, 'templates', 'chart-template.html');
        // Read template content
        return fs.readFileSync(templatePath, 'utf-8');
    }
    catch (error) {
        console.error('Error loading chart template:', error);
        throw new Error(`Failed to load chart template: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Replace template placeholders with actual values
 * @param template Template string with placeholders
 * @param variables Values to replace placeholders with
 * @param chartConfig Chart-specific configuration
 * @returns Processed template with replaced values
 */
function processTemplate(template, variables, chartConfig) {
    // First replace general variables
    let result = template
        .replace(/\${TITLE}/g, variables.title)
        .replace(/\${BACKGROUND_COLOR}/g, variables.backgroundColor)
        .replace(/\${ENVIRONMENT_PRESET}/g, variables.environmentPreset)
        .replace(/\${GROUND_COLOR}/g, variables.groundColor)
        .replace(/\${DATA_SOURCE}/g, variables.dataSource)
        .replace(/\${CHART_PALETTE}/g, variables.chartPalette);
    // Generate chart component HTML
    const chartComponent = generateChartComponent(chartConfig, variables.chartPalette);
    // Replace chart component placeholder
    result = result.replace('<!-- CHART_COMPONENT_PLACEHOLDER -->', chartComponent);
    return result;
}
/**
 * Generate chart component HTML based on chart type
 * @param config Chart configuration
 * @param palette Color palette to use
 * @returns Chart component HTML
 */
function generateChartComponent(config, palette) {
    // Base attributes that all charts have
    let attributes = `
    id="visualization"
    from="data"
    palette="${palette}"
    x="${config.xkey}" 
    y="${config.ykey}"
    ${config.position ? `position="${config.position}"` : ''}
    ${config.scale ? `scale="${config.scale}"` : ''}
    ${config.rotation ? `rotation="${config.rotation}"` : ''}`;
    // Add optional attributes if present
    if (config.zkey) {
        attributes += `\n    z="${config.zkey}"`;
    }
    if (config.radiuskey) {
        attributes += `\n    radius="${config.radiuskey}"`;
    }
    if (config.heightkey) {
        attributes += `\n    height="${config.heightkey}"`;
    }
    // Generate full chart entity
    return `
        <!-- Visualization component -->
        <a-entity ${config.component}
${attributes}></a-entity>`;
}
/**
 * Save processed template to a file
 * @param content Content to save
 * @param targetPath Path where to save the file
 * @returns Promise that resolves when file is saved
 */
async function saveTemplateToFile(content, targetPath) {
    try {
        // Ensure directory exists
        const directory = path.dirname(targetPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Write file
        fs.writeFileSync(targetPath, content, 'utf-8');
    }
    catch (error) {
        console.error('Error saving template to file:', error);
        throw new Error(`Failed to save template: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Gets available environment presets from A-Frame
 * @returns Array of preset names
 */
function getEnvironmentPresets() {
    return [
        'none',
        'default',
        'forest',
        'egypt',
        'dream',
        'volcano',
        'arches',
        'tron',
        'japan',
        'threetowers',
        'poison',
        'alien',
        'osiris',
        'moon',
        'contact',
        'canyon'
    ];
}
/**
 * Gets available color palettes for charts
 * @returns Array of palette names
 */
function getChartPalettes() {
    return [
        'ubuntu',
        'greens',
        'blues',
        'reds',
        'gray',
        'supermagenta',
        'cool',
        'rainbow',
        'tarnish',
        'warm',
        'goldgreen',
        'random'
    ];
}
/**
 * Get component name for a specific chart type
 * @param chartType Component type from enum
 * @returns A-Frame component name
 */
function getComponentNameForChartType(chartType) {
    const componentMap = {
        'bars': 'babia-barchart',
        'barsmap': 'babia-barsmap',
        'cylinders': 'babia-cylinders',
        'pie': 'babia-piechart',
        'donut': 'babia-torusmap',
        'bubbles': 'babia-bubbles',
        'scatter': 'babia-scatterplot'
    };
    return componentMap[chartType] || 'babia-barchart';
}
//# sourceMappingURL=templateUtils.js.map