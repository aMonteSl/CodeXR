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
exports.generateXRAnalysisHTML = generateXRAnalysisHTML;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const utils_1 = require("../utils");
const xrDataTransformer_1 = require("./xrDataTransformer");
/**
 * Generates HTML content for XR analysis visualization
 * @param analysisResult Analysis result to visualize
 * @param dataPath Path to the JSON data file
 * @param context Extension context
 * @returns Generated HTML content
 */
async function generateXRAnalysisHTML(analysisResult, dataPath, context) {
    // Get the template
    const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'analysis-xr-template.html');
    let templateContent = await fs.readFile(templatePath, 'utf8');
    // Get environmental settings from global state (reuse BabiaXR settings)
    const backgroundColor = context.globalState.get('babiaBackgroundColor') || '#112233';
    const environmentPreset = context.globalState.get('babiaEnvironmentPreset') || 'forest';
    const groundColor = context.globalState.get('babiaGroundColor') || '#445566';
    const chartPalette = context.globalState.get('babiaChartPalette') || 'ubuntu';
    // Calculate complexity metrics for display
    const functionCount = analysisResult.functions.length;
    const avgComplexity = analysisResult.complexity.averageComplexity.toFixed(1);
    const maxComplexity = analysisResult.complexity.maxComplexity;
    // Calculate complexity distribution
    const complexityLow = analysisResult.functions.filter(f => f.complexity <= 5).length;
    const complexityMedium = analysisResult.functions.filter(f => f.complexity > 5 && f.complexity <= 10).length;
    const complexityHigh = analysisResult.functions.filter(f => f.complexity > 10 && f.complexity <= 20).length;
    const complexityCritical = analysisResult.functions.filter(f => f.complexity > 20).length;
    // Transform the analysis data for XR visualization
    const transformedData = (0, xrDataTransformer_1.transformAnalysisDataForXR)(analysisResult);
    // Create chart title and description
    const chartTitle = `Code Complexity: ${analysisResult.fileName}`;
    const chartDescription = `Analysis of ${analysisResult.language} code with ${functionCount} functions and ${analysisResult.lineCount.total} lines of code`;
    // Get icon path
    const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg')).toString();
    // Create variable replacements
    const replacements = {
        // Basic visualization settings
        '${TITLE}': chartTitle,
        '${DESCRIPTION}': chartDescription,
        '${BACKGROUND_COLOR}': backgroundColor,
        '${ENVIRONMENT_PRESET}': environmentPreset,
        '${GROUND_COLOR}': groundColor,
        '${CHART_PALETTE}': chartPalette,
        '${DATA_SOURCE}': dataPath,
        // Chart axis configuration
        '${X_DIMENSION}': 'functionName',
        '${Y_DIMENSION}': 'complexity',
        '${X_AXIS_TITLE}': 'Function Names',
        '${Y_AXIS_TITLE}': 'Cyclomatic Complexity',
        // File information
        '${FILE_NAME}': analysisResult.fileName,
        '${FILE_PATH}': analysisResult.filePath,
        '${LANGUAGE}': analysisResult.language,
        '${TIMESTAMP}': new Date(analysisResult.timestamp).toLocaleString(),
        // Code metrics
        '${TOTAL_LINES}': analysisResult.lineCount.total.toString(),
        '${CODE_LINES}': analysisResult.lineCount.code.toString(),
        '${COMMENT_LINES}': analysisResult.lineCount.comment.toString(),
        '${COMMENTS_PERCENTAGE}': (analysisResult.lineCount.comment / analysisResult.lineCount.total * 100).toFixed(1),
        // Complexity metrics
        '${FUNCTION_COUNT}': functionCount.toString(),
        '${AVG_COMPLEXITY}': avgComplexity,
        '${MAX_COMPLEXITY}': maxComplexity.toString(),
        '${COMPLEXITY_CLASS}': (0, utils_1.classifyComplexity)(analysisResult.complexity.averageComplexity),
        // Complexity distribution
        '${COMPLEXITY_LOW}': complexityLow.toString(),
        '${COMPLEXITY_MEDIUM}': complexityMedium.toString(),
        '${COMPLEXITY_HIGH}': complexityHigh.toString(),
        '${COMPLEXITY_CRITICAL}': complexityCritical.toString(),
        // Icon path
        '${ICON_PATH}': iconPath
    };
    // Replace all placeholders in the template
    for (const [key, value] of Object.entries(replacements)) {
        // Escape special characters in key before using in RegExp
        const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        templateContent = templateContent.replace(new RegExp(escapedKey, 'g'), value);
    }
    return templateContent;
}
//# sourceMappingURL=xrTemplateUtils.js.map