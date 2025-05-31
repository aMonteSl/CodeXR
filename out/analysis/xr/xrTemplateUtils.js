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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const chartComponents_1 = require("./chartComponents"); // ✅ Cambiar el import
/**
 * Generates HTML content for XR analysis visualization
 */
async function generateXRAnalysisHTML(analysisResult, dataPath, context) {
    // Get the template
    const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'analysis-xr-template.html');
    let templateContent = await fs.readFile(templatePath, 'utf8');
    // Get environmental settings
    const backgroundColor = context.globalState.get('babiaBackgroundColor') || '#202020';
    const environmentPreset = context.globalState.get('babiaEnvironmentPreset') || 'egypt';
    const groundColor = context.globalState.get('babiaGroundColor') || '#B10DC9';
    // ✅ OBTENER TIPO DE CHART DESDE LA CONFIGURACIÓN GLOBAL
    const chartType = context.globalState.get('codexr.analysis.chartType') || 'boats';
    console.log('🎯 Chart type from settings:', chartType);
    console.log('🎯 All global state keys:', context.globalState.keys());
    // Create chart title
    const chartTitle = `Code Complexity: ${analysisResult.fileName}`;
    // Get icon path
    const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg')).toString();
    // ✅ GENERAR EL HTML DEL CHART CON EL TIPO CORRECTO
    const chartComponentHTML = (0, chartComponents_1.generateChartHTML)(chartType, context, chartTitle);
    console.log('🎯 Generated chart HTML length:', chartComponentHTML.length);
    console.log('🎯 Chart HTML preview:', chartComponentHTML.substring(0, 200) + '...');
    // ✅ APLICAR LOS REEMPLAZOS
    const replacements = {
        '${TITLE}': chartTitle,
        '${DATA_SOURCE}': dataPath,
        '${CHART_COMPONENT}': chartComponentHTML,
        '${BACKGROUND_COLOR}': backgroundColor,
        '${ENVIRONMENT_PRESET}': environmentPreset,
        '${GROUND_COLOR}': groundColor,
        '${ICON_PATH}': iconPath
    };
    console.log('🎯 Applying replacements...');
    // Aplicar reemplazos
    let processedTemplate = templateContent;
    Object.entries(replacements).forEach(([placeholder, value]) => {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        processedTemplate = processedTemplate.replace(regex, value);
    });
    // ✅ VERIFICAR QUE EL REEMPLAZO SE APLICÓ CORRECTAMENTE
    if (processedTemplate.includes('${CHART_COMPONENT}')) {
        console.error('🚨 Chart component placeholder was not replaced!');
        console.error('🚨 Template preview:', processedTemplate.substring(0, 500));
    }
    else {
        console.log('✅ Chart component placeholder replaced successfully');
    }
    return processedTemplate;
}
//# sourceMappingURL=xrTemplateUtils.js.map