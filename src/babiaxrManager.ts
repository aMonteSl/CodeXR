import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { startServer } from './server';
import { 
  ChartType, 
  ChartData, 
  ChartSpecification,
  BarChartOptions,
  PieChartOptions
} from './models/chartModel';
import { 
  processTemplate, 
  saveHtmlToFile 
} from './utils/templateUtils';

/**
 * Creates an HTML file with a BabiaXR visualization based on the selected template
 * @param chartType The type of chart to create
 * @param chartData Data for the chart
 * @param context Extension context
 * @returns Path to the created file or undefined if operation was cancelled
 */
export async function createBabiaXRVisualization(
  chartType: ChartType, 
  chartData: ChartData, 
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  try {
    // Create a chart specification object
    const chartSpec: ChartSpecification = {
      type: chartType,
      data: chartData
    };
    
    // Process template with the chart specification
    const { html, originalDataPath, isRemoteData } = await processTemplate(context, chartSpec);
    
    // Get sanitized filename from chart title
    const fileName = `${chartData.title.replace(/\s+/g, '-')}.html`;
    
    // Save the HTML content to a file, passing the original data path if available
    const filePath = await saveHtmlToFile(html, fileName, originalDataPath, isRemoteData);
    if (!filePath) {
      return undefined; // User cancelled the operation
    }
    
    // Open the file in the editor
    await vscode.window.showTextDocument(vscode.Uri.file(filePath));
    
    return filePath;
  } catch (error) {
    vscode.window.showErrorMessage(`Error creating visualization: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Launches a server with the created BabiaXR visualization
 * @param filePath Path to the HTML file
 * @param context Extension context
 */
export async function launchBabiaXRVisualization(
  filePath: string, 
  context: vscode.ExtensionContext
): Promise<void> {
  // Start HTTPS server (required for WebXR)
  await startServer(filePath, context, true, true);
}

/**
 * Recopila información sobre la fuente de datos
 * @returns Ruta del archivo de datos seleccionado
 */
async function collectDataSource(): Promise<string | undefined> {
  // Mostrar opciones para elegir el tipo de fuente de datos
  const sourceType = await vscode.window.showQuickPick(
    [
      { label: '$(file) Archivo local', id: 'local', description: 'Seleccionar archivo CSV o JSON del equipo' },
      { label: '$(beaker) Datos de ejemplo', id: 'sample', description: 'Usar conjunto de datos predefinido' }
    ],
    { 
      placeHolder: 'Seleccionar la fuente de los datos',
      title: 'Fuente de datos para la visualización'
    }
  );
  
  if (!sourceType) return undefined;
  
  switch (sourceType.id) {
    case 'local':
      // Seleccionar archivo local mediante un diálogo
      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: 'Seleccionar archivo de datos',
        filters: { 'Archivos de datos': ['csv', 'json'] }
      };
      
      const fileUri = await vscode.window.showOpenDialog(options);
      if (!fileUri || fileUri.length === 0) return undefined;
      return fileUri[0].fsPath;
      
    case 'sample':
      // Obtener la ruta de la extensión de manera más robusta
      let extensionPath = '';
      
      // Intento 1: Obtener desde la API de extensiones
      try {
        // Usa el ID correcto de tu extensión - debe coincidir con package.json
        const extension = vscode.extensions.getExtension('Your.integracionvsaframe');
        if (extension) {
          extensionPath = extension.extensionUri.fsPath;
        }
      } catch (error) {
        console.log('Error obteniendo extensión por ID:', error);
      }
      
      // Intento 2: Usar el workspace actual
      if (!extensionPath && vscode.workspace.workspaceFolders?.length) {
        extensionPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      }
      
      // Intento 3: Obtener directamente desde __dirname (si estamos en desarrollo)
      if (!extensionPath) {
        // Esta línea asume que este archivo está en src/babiaxrManager.ts
        extensionPath = path.resolve(__dirname, '..');
      }
      
      if (!extensionPath) {
        vscode.window.showErrorMessage('No se pudo determinar la ruta de la extensión');
        return undefined;
      }
      
      console.log(`Ruta de la extensión: ${extensionPath}`);
      
      // Definir posibles ubicaciones donde podrían estar los ejemplos
      const possiblePaths = [
        // El path detectado automáticamente
        path.join(extensionPath, 'examples', 'data'),
        // La ubicación correcta que conocemos
        '/home/adrian/integracionvsaframe/examples/data',
        // Ruta relativa (si estamos en desarrollo)
        path.resolve(__dirname, '..', 'examples', 'data')
      ];
      
      let examplesPath = '';
      
      // Encontrar la primera ruta que exista
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          examplesPath = testPath;
          console.log(`Encontrada ruta de ejemplos válida: ${examplesPath}`);
          break;
        }
      }
      
      if (!examplesPath) {
        vscode.window.showErrorMessage('No se pudieron encontrar los archivos de ejemplo en ninguna ubicación conocida.');
        return undefined;
      }
      
      // Construir la ruta completa a los ejemplos usando la ruta correcta
      const ventasPath = path.join(examplesPath, 'ventas.json');
      const poblacionPath = path.join(examplesPath, 'poblacion.json');
      const temperaturaPath = path.join(examplesPath, 'temperatura.json');
      
      // Verifica que los archivos existan antes de ofrecerlos
      let availableDatasets = [];
      
      if (fs.existsSync(ventasPath)) {
        availableDatasets.push({ 
          label: 'Ventas por Producto y Trimestre', 
          value: ventasPath, 
          description: 'Datos de ventas por producto y trimestre (JSON)' 
        });
      } else {
        console.log(`Archivo no encontrado: ${ventasPath}`);
      }
      
      if (fs.existsSync(poblacionPath)) {
        availableDatasets.push({ 
          label: 'Población por País', 
          value: poblacionPath, 
          description: 'Datos demográficos agrupados por continente (JSON)' 
        });
      } else {
        console.log(`Archivo no encontrado: ${poblacionPath}`);
      }
      
      if (fs.existsSync(temperaturaPath)) {
        availableDatasets.push({ 
          label: 'Temperaturas por Ciudad', 
          value: temperaturaPath, 
          description: 'Datos de temperatura por ciudad y estación (JSON)' 
        });
      } else {
        console.log(`Archivo no encontrado: ${temperaturaPath}`);
      }
      
      if (availableDatasets.length === 0) {
        vscode.window.showErrorMessage('No se encontraron archivos de datos de ejemplo. Verifica la estructura de carpetas.');
        return undefined;
      }
      
      // Ofrecer datasets de ejemplo predefinidos
      const sampleDataset = await vscode.window.showQuickPick(
        availableDatasets,
        { 
          placeHolder: 'Selecciona un conjunto de datos de ejemplo',
          title: 'Datos de ejemplo incluidos en la extensión'
        }
      );
      
      return sampleDataset?.value;
  }
  
  return undefined;
}

/**
 * Collects chart data from the user
 * @param chartType The type of chart
 * @returns Chart data or undefined if cancelled
 */
export async function collectChartData(chartType: ChartType): Promise<ChartData | undefined> {
  try {
    // Ask for chart title
    const title = await vscode.window.showInputBox({
      prompt: 'Título del gráfico',
      placeHolder: 'Mi visualización BabiaXR',
      value: `${chartType} - ${new Date().toLocaleDateString()}`
    });
    
    if (!title) return undefined;
    
    // Usar la nueva función para recopilar la fuente de datos
    const dataSource = await collectDataSource();
    
    if (!dataSource) return undefined;
    
    // Extraer dimensiones automáticamente
    const dimensions = await extractDimensions(dataSource);

    // Información sobre cómo se utilizarán las dimensiones para Bar Chart
    let maxSelections = 3;
    let minSelections = 2;
    let infoMessage = 'Selecciona entre 2 y 3 atributos para el gráfico:\n• El 1º seleccionado será el eje X\n• El 2º será la altura de las barras\n• El 3º (opcional) será el eje Z';
    
    if (chartType !== ChartType.BAR_CHART) {
      maxSelections = dimensions.length;
      minSelections = 1;
      infoMessage = 'Selecciona los atributos para visualizar';
    }
    
    // Mostrar información al usuario (sin await para no bloquear)
    vscode.window.showInformationMessage(infoMessage);
    
    // Mostrar un selector con las dimensiones encontradas
    const selectedDimensions = await vscode.window.showQuickPick(
      dimensions.map(d => ({ label: d, picked: d === dimensions[0] || d === dimensions[1] })),
      { 
        canPickMany: true,
        placeHolder: `Selecciona ${minSelections}-${maxSelections} dimensiones para visualizar`,
        title: 'Dimensiones disponibles en los datos'
      }
    );

    // Validar que se hayan seleccionado suficientes dimensiones
    if (!selectedDimensions || selectedDimensions.length < minSelections) {
      vscode.window.showErrorMessage(`Debes seleccionar al menos ${minSelections} dimensiones para este tipo de gráfico.`);
      return undefined;
    }
    
    // Validar que no se excedan las dimensiones máximas para bar chart
    if (chartType === ChartType.BAR_CHART && selectedDimensions.length > maxSelections) {
      vscode.window.showErrorMessage(`Para un gráfico de barras, selecciona máximo ${maxSelections} dimensiones.`);
      return undefined;
    }

    // Usar las dimensiones seleccionadas
    return {
      title,
      dataSource,
      dimensions: selectedDimensions.map(d => d.label),
      createdAt: Date.now()
    };
  } catch (error) {
    vscode.window.showErrorMessage(`Error recopilando datos del gráfico: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/**
 * Collects chart-specific options based on chart type
 * @param chartType The type of chart
 * @returns Options object or undefined if cancelled
 */
export async function collectChartOptions(
  chartType: ChartType
): Promise<BarChartOptions | PieChartOptions | undefined> {
  switch (chartType) {
    case ChartType.BAR_CHART:
      return collectBarChartOptions();
    case ChartType.PIE_CHART:
      return collectPieChartOptions();
    default:
      return {};
  }
}

/**
 * Collects options specific to bar charts
 * @returns Bar chart options
 */
async function collectBarChartOptions(): Promise<BarChartOptions | undefined> {
  // Ask for horizontal orientation
  const horizontalResponse = await vscode.window.showQuickPick(
    ['Vertical', 'Horizontal'],
    { placeHolder: 'Orientación de las barras' }
  );
  
  if (!horizontalResponse) return undefined;
  
  return {
    horizontal: horizontalResponse === 'Horizontal',
    height: 1,
    width: 2
  };
}

/**
 * Collects options specific to pie charts
 * @returns Pie chart options
 */
async function collectPieChartOptions(): Promise<PieChartOptions | undefined> {
  // Ask for donut style
  const donutResponse = await vscode.window.showQuickPick(
    ['Standard Pie', 'Donut'],
    { placeHolder: 'Estilo de gráfico circular' }
  );
  
  if (!donutResponse) return undefined;
  
  return {
    size: 1.5,
    height: 0.2,
    donut: donutResponse === 'Donut',
    showLabels: true
  };
}

/**
 * Extrae automáticamente las dimensiones disponibles de un archivo de datos
 * @param dataSource Ruta del archivo local
 * @returns Array con los nombres de las dimensiones disponibles
 */
async function extractDimensions(dataSource: string): Promise<string[]> {
  try {
    const fileContent = fs.readFileSync(dataSource, 'utf8');
    
    if (dataSource.toLowerCase().endsWith('.json')) {
      const data = JSON.parse(fileContent);
      
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return Object.keys(data[0]);
      }
    } 
    else if (dataSource.toLowerCase().endsWith('.csv')) {
      const firstLine = fileContent.split('\n')[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const lines = fileContent.split('\n');
      if (lines.length > 0) {
        return lines[0].split(separator).map(header => header.trim());
      }
    }
    
    return ['nombre', 'valor'];
  } catch (error) {
    vscode.window.showWarningMessage(`No se pudieron extraer dimensiones: ${error}`);
    return ['nombre', 'valor']; // Valores predeterminados en caso de error
  }
}

/**
 * Procesa y carga datos desde un archivo CSV
 * @param filePath Ruta al archivo CSV
 * @returns Objeto con los datos procesados en formato utilizable
 */
export function processCSVData(filePath: string): any[] {
  // Leer el contenido del archivo
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    throw new Error('El archivo CSV está vacío');
  }
  
  // Detectar automáticamente el separador
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  
  // Extraer encabezados (primera línea)
  const headers = lines[0].split(separator).map(header => header.trim());
  
  // Procesar todas las líneas de datos
  const result: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map(val => val.trim());
    
    // Crear objeto con los valores correspondientes
    const item: any = {};
    headers.forEach((header, index) => {
      // Intentar convertir a número si es posible
      const value = values[index];
      if (value && !isNaN(Number(value))) {
        item[header] = Number(value);
      } else {
        item[header] = value;
      }
    });
    
    // Solo añadir si hay valores válidos
    if (Object.keys(item).length > 0) {
      result.push(item);
    }
  }
  
  return result;
}

/**
 * Convierte un archivo CSV a JSON y lo guarda en el mismo directorio
 * @param csvPath Ruta al archivo CSV
 * @returns Ruta al archivo JSON creado
 */
export function convertCSVtoJSON(csvPath: string): string {
  // Procesar los datos CSV
  const jsonData = processCSVData(csvPath);
  
  // Crear la ruta para el nuevo archivo JSON
  const jsonPath = csvPath.replace(/\.csv$/i, '.json');
  
  // Guardar el JSON
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  return jsonPath;
}

/**
 * Carga datos desde un archivo local
 * @param dataSource Ruta del archivo
 * @returns Array con los datos cargados
 */
export function loadData(dataSource: string): any[] {
  // Para archivos locales 
  if (dataSource.toLowerCase().endsWith('.json')) {
    const fileContent = fs.readFileSync(dataSource, 'utf8');
    return JSON.parse(fileContent);
  } 
  else if (dataSource.toLowerCase().endsWith('.csv')) {
    return processCSVData(dataSource);
  }
  else {
    throw new Error('Formato de archivo no soportado. Use CSV o JSON.');
  }
}