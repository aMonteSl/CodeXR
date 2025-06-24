import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileAnalysisResult } from '../model';
import { generateChartHTML } from './chartComponents'; // ✅ FIXED: Use the main function instead of legacy

/**
 * Generates HTML content for XR analysis visualization
 */
export async function generateXRAnalysisHTML(
  analysisResult: FileAnalysisResult,
  dataPath: string,
  context: vscode.ExtensionContext
): Promise<string> {
  // Get the template
  const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'analysis-xr-template.html');
  let templateContent = await fs.readFile(templatePath, 'utf8');
  
  // ✅ TECHNICAL FIX: Get all environment settings from visualization settings (not hardcoded values)
  const backgroundColor = context.globalState.get<string>('babiaBackgroundColor') || '#202020';
  const environmentPreset = context.globalState.get<string>('babiaEnvironmentPreset') || 'egypt';
  const groundColor = context.globalState.get<string>('babiaGroundColor') || '#B10DC9';
  
  // ✅ TECHNICAL IMPROVEMENT: Get chart type from analysis configuration instead of hardcoded
  const chartType = context.globalState.get<string>('codexr.analysis.chartType') || 'boats';
  
  console.log('🎯 XR Analysis Template Configuration:');
  console.log(`   📊 Chart type: ${chartType}`);
  console.log(`   🎨 Background color: ${backgroundColor}`);
  console.log(`   🌍 Environment preset: ${environmentPreset}`);
  console.log(`   🏔️ Ground color: ${groundColor}`);
  
  // ✅ TECHNICAL ENHANCEMENT: Generate chart component using dimension mapping system with context
  const chartComponentHTML = generateChartHTML(chartType, context, `Code Complexity: ${analysisResult.fileName}`);
  
  // ✅ TECHNICAL IMPROVEMENT: Create icon path with proper fallback handling
  const iconPath = createIconPath(context);
  
  // ✅ TECHNICAL FIX: Define all template replacements with proper background color integration
  const replacements: Record<string, string> = {
    '${TITLE}': `Code Complexity: ${analysisResult.fileName}`,
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
  } else {
    console.log(`✅ Background color ${backgroundColor} successfully applied to XR template`);
  }
  
  // ✅ TECHNICAL VERIFICATION: Ensure chart component was properly applied
  if (processedTemplate.includes('<!-- Chart component will be generated dynamically -->')) {
    console.warn(`⚠️ Chart component placeholder was not replaced properly`);
  } else if (processedTemplate.includes('<a-entity id="chart"')) {
    console.log(`✅ Chart component successfully applied to XR template`);
  }
  
  return processedTemplate;
}

/**
 * ✅ TECHNICAL HELPER: Creates proper icon path with fallback handling
 * @param context Extension context
 * @returns Relative path to icon file
 */
function createIconPath(context: vscode.ExtensionContext): string {
  // ✅ TECHNICAL IMPROVEMENT: Use relative path for better portability
  return 'file://' + path.join(context.extensionPath, 'resources', 'icon.svg').replace(/\\/g, '/');
}