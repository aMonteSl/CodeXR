import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileAnalysisResult } from '../model';
import { transformAnalysisDataForXR } from './xrDataTransformer';
import { generateChartHTML } from './chartComponents'; // ✅ Cambiar el import

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
  
  // Get environmental settings
  const backgroundColor = context.globalState.get<string>('babiaBackgroundColor') || '#202020';
  const environmentPreset = context.globalState.get<string>('babiaEnvironmentPreset') || 'egypt';
  const groundColor = context.globalState.get<string>('babiaGroundColor') || '#B10DC9';
  
  // ✅ OBTENER TIPO DE CHART DESDE LA CONFIGURACIÓN GLOBAL
  const chartType = context.globalState.get<string>('codexr.analysis.chartType') || 'boats';
  
  console.log('🎯 Chart type from settings:', chartType);
  console.log('🎯 All global state keys:', context.globalState.keys());
  
  // Create chart title
  const chartTitle = `Code Complexity: ${analysisResult.fileName}`;
  
  // Get icon path
  const iconPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'icon.svg')).toString();
  
  // ✅ GENERAR EL HTML DEL CHART CON EL TIPO CORRECTO
  const chartComponentHTML = generateChartHTML(chartType, context, chartTitle);
  
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
  } else {
    console.log('✅ Chart component placeholder replaced successfully');
  }
  
  return processedTemplate;
}