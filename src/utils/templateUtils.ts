import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChartType, ChartData, TemplateVariableMap, ChartSpecification } from '../models/chartModel';

/**
 * Data structure representing a processed template
 */
interface ProcessedTemplate {
  html: string;
  originalDataPath?: string;
  isRemoteData: boolean;
}

/**
 * Get the template file name for a chart type
 */
export function getTemplateFileName(chartType: ChartType): string {
  return 'chart-template.html';
}

/**
 * Loads a template from the templates directory
 */
export function loadTemplate(context: vscode.ExtensionContext, templateFileName: string): string {
  try {
    const templatePath = path.join(context.extensionPath, 'templates', templateFileName);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templateFileName}`);
    }
    
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    throw new Error(`Error loading template: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Replaces variables in a template with actual values
 * @param template The template string with placeholders
 * @param variables Object containing variable mappings
 * @returns Processed string with variables replaced
 */
export function replaceTemplateVariables(template: string, variables: TemplateVariableMap): string {
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
export function createVariableMap(chartSpecification: ChartSpecification): TemplateVariableMap {
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
  let height: number = 1;
  let width: number = 2;
  let barRotation: string = "0 0 0"; // For vertical orientation
  
  // Create variable map
  const variableMap: TemplateVariableMap = {
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
function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Map of chart components to insert in the template
 */
const chartComponents: Record<ChartType, string> = {
  [ChartType.BARSMAP_CHART]: `
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
  
  [ChartType.DONUT_CHART]: `
        <!-- Donut Chart -->
        <a-entity babia-doughnut="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  tooltip: true;
                  palette: \${CHART_PALETTE};
                  donutRadius: 0.5;
                  tooltip_position: top;
                  tooltip_show_always: false;
                  tooltip_height: 0.3"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>`,
  
  [ChartType.PIE_CHART]: `
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
  
  [ChartType.SCATTER_PLOT]: "",
  [ChartType.NETWORK_GRAPH]: ""
};

/**
 * Process a template with variable values from a chart specification
 */
export async function processTemplate(context: vscode.ExtensionContext, chartSpec: ChartSpecification): Promise<ProcessedTemplate> {
  // Get template file
  const templatePath = path.join(context.extensionPath, 'templates', 'chart-template.html');
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Get variable mapping
  const variableMap = createVariableMap(chartSpec);
  
  // Replace the placeholder with the chart component
  let processedHtml = templateContent.replace(
    '<!-- CHART_COMPONENT_PLACEHOLDER -->', 
    chartComponents[chartSpec.type]
  );
  
  // Replace variables in the template
  for (const [key, value] of Object.entries(variableMap)) {
    const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, String(value));
  }
  
  return {
    html: processedHtml,
    originalDataPath: chartSpec.data.dataSource,
    isRemoteData: false
  };
}

/**
 * Saves processed HTML content to a file and copies related data files
 */
export async function saveHtmlToFile(
  html: string, 
  fileName: string, 
  originalDataPath?: string, 
  isRemoteData: boolean = false
): Promise<string | undefined> {
  try {
    // Request directory name
    const projectName = await vscode.window.showInputBox({
      prompt: 'Name of the directory for the visualization',
      placeHolder: 'my-visualization',
      value: path.basename(fileName, '.html').toLowerCase().replace(/\s+/g, '-')
    });
    
    if (!projectName) return undefined;
    
    // Determine base directory
    let baseDir = vscode.workspace.workspaceFolders ? 
      vscode.workspace.workspaceFolders[0].uri.fsPath : 
      require('os').homedir();
    
    // Request location
    const dirOptions: vscode.OpenDialogOptions = {
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
      const overwrite = await vscode.window.showWarningMessage(
        `The folder '${projectName}' already exists. Do you want to overwrite its contents?`,
        'Overwrite', 'Cancel'
      );
      
      if (overwrite !== 'Overwrite') {
        return undefined;
      }
    } else {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Save the HTML file in the project folder
    const htmlPath = path.join(projectDir, 'index.html');
    
    // Copy the JSON data file
    if (originalDataPath && !isRemoteData) {
      const dataFileName = path.basename(originalDataPath);
      const destDataPath = path.join(projectDir, dataFileName);
      
      // Copy the file
      fs.copyFileSync(originalDataPath, destDataPath);
      
      // Update the URL in the HTML
      html = html.replace(/babia-queryjson="url: .*?"/, `babia-queryjson="url: ${dataFileName}"`);
    }
    
    // Save the HTML
    fs.writeFileSync(htmlPath, html);
    
    // Success message
    vscode.window.showInformationMessage(
      `Visualization created in: ${projectDir}`,
      'Open folder'
    ).then(selection => {
      if (selection === 'Open folder') {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
      }
    });
    
    return htmlPath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error saving project: ${error}`);
    return undefined;
  }
}