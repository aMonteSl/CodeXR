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
exports.XRTemplateRenderer = void 0;
const path = __importStar(require("path"));
const analysisSettingsStorage_1 = require("../../utils/analysisSettingsStorage");
const templateProcessor_1 = require("../../babia_templates/processing/templateProcessor");
/**
 * XR Template Renderer for File Analysis
 * Delegates to centralized TemplateProcessor for HTML generation
 */
class XRTemplateRenderer {
    /**
     * Generate and save index.html for XR file analysis using centralized TemplateProcessor
     *
     * @param context - VS Code extension context
     * @param analysisFolder - URI of the analysis folder (contains data.json)
     * @param filePath - Original file path being analyzed
     * @param analysisData - Analysis data object
     */
    static async generateXRVisualization(context, analysisFolder, filePath, analysisData) {
        console.log(`[XR_TEMPLATE_RENDERER] Generating XR visualization for ${path.basename(filePath)} using centralized TemplateProcessor`);
        try {
            // Get current chart configuration
            const chartType = await analysisSettingsStorage_1.AnalysisSettingsStorage.getChartTypeFile(context);
            const dimensionMappings = await analysisSettingsStorage_1.AnalysisSettingsStorage.getDimensionMappingFile(context);
            console.log(`[XR_TEMPLATE_RENDERER] Using chart type: ${chartType}`);
            console.log(`[XR_TEMPLATE_RENDERER] Dimension mappings:`, dimensionMappings);
            // Convert field names to XR format if needed
            const mappings = dimensionMappings.map(mapping => ({
                dimension: mapping.dimension,
                dataField: this.convertToXRFieldName(mapping.dataField),
                label: mapping.label
            }));
            // Prepare output path for index.html
            const indexHtmlPath = path.join(analysisFolder.fsPath, 'index.html');
            // Use centralized TemplateProcessor to generate the complete XR visualization
            const result = await templateProcessor_1.TemplateProcessor.generateXRVisualization(chartType, mappings, `File Analysis: ${path.basename(filePath)}`, './data.json', context, indexHtmlPath);
            if (!result.success) {
                console.error(`[XR_TEMPLATE_RENDERER] TemplateProcessor failed:`, result.error);
                throw new Error(`Template processing failed: ${result.error}`);
            }
            console.log(`[XR_TEMPLATE_RENDERER] Successfully generated index.html using TemplateProcessor at: ${indexHtmlPath}`);
        }
        catch (error) {
            console.error(`[XR_TEMPLATE_RENDERER] Failed to generate XR visualization:`, error);
            throw error;
        }
    }
    /**
     * Convert field names from static analysis format to XR format
     * Maps legacy field names to standardized XR field names
     */
    static convertToXRFieldName(fieldName) {
        const fieldMappings = {
            'ccn': 'complexity',
            'lines_count': 'lineCount',
            'line_start': 'lineStart',
            'line_end': 'lineEnd',
            'function_name': 'fileName',
            'nloc': 'lineCount',
            'parameters': 'parameters',
            'max_nesting_depth': 'maxNestingDepth',
            'cyclomatic_density': 'cyclomaticDensity'
        };
        return fieldMappings[fieldName] || fieldName;
    }
}
exports.XRTemplateRenderer = XRTemplateRenderer;
//# sourceMappingURL=xrTemplateRenderer.js.map