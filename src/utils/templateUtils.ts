import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChartType, ChartData, TemplateVariableMap, ChartSpecification } from '../models/chartModel';

/**
 * Estructura de datos que representa una plantilla procesada
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
  
  // Usamos un valor genérico que se reemplazará al guardar
  const dataSource = "data.json";
  
  // Preparar dimensiones individuales para los ejes
  const xDimension = data.dimensions[0] || 'producto';
  const yDimension = data.dimensions[1] || 'ventas';
  
  // Componer el tercer eje si existe
  let zDimensionAttr = '';
  if (data.dimensions.length > 2) {
    zDimensionAttr = `z_axis: ${data.dimensions[2]};`;
  }
  
  // Valores predeterminados para opciones
  let height: number = 1;
  let width: number = 2;
  let barRotation: string = "0 0 0"; // Para orientación vertical
  
  // Crear mapa de variables
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
 * Verifica si una cadena es una URL válida
 * @param str Cadena a verificar
 * @returns true si es una URL, false en caso contrario
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
  [ChartType.BAR_CHART]: `
        <!-- Gráfico de barras -->
        <a-entity babia-barsmap="from: data; 
                  legend: true; 
                  palette: ubuntu;
                  x_axis: \${X_DIMENSION};
                  height: \${Y_DIMENSION};
                  \${Z_DIMENSION_ATTR}"
                  position="0 1 -3" 
                  scale="1 1 1"
                  rotation="\${BAR_ROTATION}">
        </a-entity>`,
        
  [ChartType.PIE_CHART]: `
        <!-- Gráfico circular -->
        <a-entity babia-pie="from: data;
                  key: \${X_DIMENSION};
                  size: \${Y_DIMENSION};
                  legend: true;
                  palette: ubuntu;"
                  position="0 2.5 -3"
                  rotation="90 0 0"
                  scale="2 2 2">
        </a-entity>`,
  
  // Espacio para futuros gráficos
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
    // Solicitar nombre del directorio
    const projectName = await vscode.window.showInputBox({
      prompt: 'Nombre del directorio para la visualización',
      placeHolder: 'mi-visualizacion',
      value: path.basename(fileName, '.html').toLowerCase().replace(/\s+/g, '-')
    });
    
    if (!projectName) return undefined;
    
    // Determinar directorio base
    let baseDir = vscode.workspace.workspaceFolders ? 
      vscode.workspace.workspaceFolders[0].uri.fsPath : 
      require('os').homedir();
    
    // Solicitar ubicación
    const dirOptions: vscode.OpenDialogOptions = {
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Seleccionar carpeta para el proyecto'
    };
    
    const selectedDir = await vscode.window.showOpenDialog(dirOptions);
    if (selectedDir && selectedDir.length > 0) {
      baseDir = selectedDir[0].fsPath;
    }
    
    // Crear directorio del proyecto
    const projectDir = path.join(baseDir, projectName);
    
    // Manejar caso de directorio existente
    if (fs.existsSync(projectDir)) {
      const overwrite = await vscode.window.showWarningMessage(
        `La carpeta '${projectName}' ya existe. ¿Deseas sobrescribir su contenido?`,
        'Sobrescribir', 'Cancelar'
      );
      
      if (overwrite !== 'Sobrescribir') {
        return undefined;
      }
    } else {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    
    // Guardar el archivo HTML en la carpeta del proyecto
    const htmlPath = path.join(projectDir, 'index.html');
    
    // Copiar el archivo de datos JSON
    if (originalDataPath && !isRemoteData) {
      const dataFileName = path.basename(originalDataPath);
      const destDataPath = path.join(projectDir, dataFileName);
      
      // Copiar el archivo
      fs.copyFileSync(originalDataPath, destDataPath);
      
      // Actualizar la URL en el HTML
      html = html.replace(/babia-queryjson="url: .*?"/, `babia-queryjson="url: ${dataFileName}"`);
    }
    
    // Guardar el HTML
    fs.writeFileSync(htmlPath, html);
    
    // Mensaje de éxito
    vscode.window.showInformationMessage(
      `Visualización creada en: ${projectDir}`,
      'Abrir carpeta'
    ).then(selection => {
      if (selection === 'Abrir carpeta') {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(projectDir));
      }
    });
    
    return htmlPath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error guardando proyecto: ${error}`);
    return undefined;
  }
}