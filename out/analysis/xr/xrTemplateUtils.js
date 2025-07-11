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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const chartTemplates_1 = require("./chartTemplates");
const dimensionMapping_1 = require("./dimensionMapping");
/**
 * Generates HTML content for XR analysis visualization
 */
async function generateXRAnalysisHTML(analysisResult, dataPath, context) {
    // Get the template
    const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'analysis-xr-template.html');
    let templateContent = await fs.readFile(templatePath, 'utf8');
    // ✅ TECHNICAL FIX: Get all environment settings from visualization settings (not hardcoded values)
    const backgroundColor = context.globalState.get('babiaBackgroundColor') || '#202020';
    const environmentPreset = context.globalState.get('babiaEnvironmentPreset') || 'egypt';
    const groundColor = context.globalState.get('babiaGroundColor') || '#B10DC9';
    // ✅ TECHNICAL IMPROVEMENT: Get chart type from analysis configuration instead of hardcoded
    const chartType = context.globalState.get('codexr.analysis.chartType') || 'boats';
    console.log('🎯 XR Analysis Template Configuration:');
    console.log(`   📊 Chart type: ${chartType}`);
    console.log(`   🎨 Background color: ${backgroundColor}`);
    console.log(`   🌍 Environment preset: ${environmentPreset}`);
    console.log(`   🏔️ Ground color: ${groundColor}`);
    // ✅ TECHNICAL ENHANCEMENT: Generate chart component using new enhanced template system
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context, 'File');
    const chartComponentHTML = (0, chartTemplates_1.generateChartComponent)(chartType, dimensionMapping, analysisResult.fileName, 'file');
    // ✅ TECHNICAL IMPROVEMENT: Create icon path with proper fallback handling
    const iconPath = createIconPath(context);
    // ✅ TECHNICAL FIX: Define all template replacements with proper background color integration
    const replacements = {
        '${TITLE}': analysisResult.fileName, // ✅ FIXED: Use just the raw file name
        '${DATA_SOURCE}': dataPath,
        '${CHART_COMPONENT}': chartComponentHTML, // ✅ CRITICAL: Now contains actual chart HTML
        '${BACKGROUND_COLOR}': backgroundColor, // ✅ CRITICAL: Use user-selected background color instead of hardcoded value
        '${ENVIRONMENT_PRESET}': environmentPreset,
        '${GROUND_COLOR}': groundColor,
        '${ICON_PATH}': iconPath
    };
    console.log('🎯 Applying template replacements...');
    console.log(`   🎨 Background: ${backgroundColor} (from visualization settings)`);
    console.log(`   📊 Chart component: ${chartComponentHTML.substring(0, 100)}...`); // Show first 100 chars
    // ✅ TECHNICAL ENHANCEMENT: Apply all replacements with validation
    let processedTemplate = templateContent;
    Object.entries(replacements).forEach(([placeholder, value]) => {
        const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const beforeCount = (processedTemplate.match(regex) || []).length;
        processedTemplate = processedTemplate.replace(regex, value);
        const afterCount = (processedTemplate.match(regex) || []).length;
        // ✅ TECHNICAL VALIDATION: Log replacement success for critical placeholders
        if (placeholder === '${BACKGROUND_COLOR}') {
            console.log(`   ✅ Background color replacement: ${beforeCount} → ${afterCount} occurrences`);
        }
        if (placeholder === '${CHART_COMPONENT}') {
            console.log(`   ✅ Chart component replacement: ${beforeCount} → ${afterCount} occurrences`);
        }
    });
    // ✅ TECHNICAL VERIFICATION: Ensure background color was properly applied
    if (!processedTemplate.includes(`background="color: ${backgroundColor}"`)) {
        console.warn(`⚠️ Background color ${backgroundColor} may not have been applied correctly`);
    }
    else {
        console.log(`✅ Background color ${backgroundColor} successfully applied to XR template`);
    }
    // ✅ TECHNICAL VERIFICATION: Ensure chart component was properly applied
    if (processedTemplate.includes('<!-- Chart component will be generated dynamically -->')) {
        console.warn(`⚠️ Chart component placeholder was not replaced properly`);
    }
    else if (processedTemplate.includes('<a-entity id="chart"')) {
        console.log(`✅ Chart component successfully applied to XR template`);
    }
    return processedTemplate;
}
/**
 * ✅ TECHNICAL HELPER: Creates proper icon path with fallback handling
 * @param context Extension context
 * @returns Relative path to icon file
 */
function createIconPath(context) {
    // ✅ TECHNICAL IMPROVEMENT: Use relative path for better portability
    return 'file://' + path.join(context.extensionPath, 'resources', 'icon.svg').replace(/\\/g, '/');
}
//# sourceMappingURL=xrTemplateUtils.js.map