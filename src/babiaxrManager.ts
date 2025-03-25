import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { startServer } from './server';
import { 
  ChartType, 
  ChartData, 
  ChartSpecification,
  BarChartOptions,
  PieChartOptions,
  TimeSeriesOptions
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
    
    // Process template with the chart specification (ahora es async)
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
 * Recopila información sobre la fuente de datos de manera más amigable
 * @returns URL o ruta del archivo de datos seleccionado
 */
async function collectDataSource(): Promise<string | undefined> {
  // 1. Mostrar opciones para elegir el tipo de fuente de datos
  const sourceType = await vscode.window.showQuickPick(
    [
      { label: '$(file) Archivo local', id: 'local', description: 'Seleccionar archivo CSV o JSON del equipo' },
      { label: '$(cloud) URL remota', id: 'remote', description: 'Ingresar URL de datos online' },
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
      
    case 'remote':
      // Para URLs, seguimos necesitando un input box
      return await vscode.window.showInputBox({
        prompt: 'Introduce la URL del archivo de datos',
        placeHolder: 'https://ejemplo.com/datos.csv',
        validateInput: input => {
          // Validar que sea una URL válida
          try {
            new URL(input);
            return null; // Sin error
          } catch {
            return 'Por favor, introduce una URL válida';
          }
        }
      });
      
    case 'sample':
      // Ofrecer datasets de ejemplo para elegir
      const sampleDataset = await vscode.window.showQuickPick(
        [
          { 
            label: 'Datos de Apple Stock (simple)', 
            value: 'https://raw.githubusercontent.com/plotly/datasets/master/2014_apple_stock.csv', 
            description: 'Pequeño dataset CSV (5 filas)' 
          },
          { 
            label: 'Datos de países (simple)', 
            value: 'https://raw.githubusercontent.com/cs109/2014_data/master/countries.csv', 
            description: 'Estadísticas de países (CSV)' 
          },
          { 
            label: 'Datos de mascotas (JSON)', 
            value: 'https://raw.githubusercontent.com/LearnWebCode/json-example/master/pets-data.json', 
            description: 'Datos simples en formato JSON' 
          }
        ],
        { 
          placeHolder: 'Selecciona un conjunto de datos de ejemplo',
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
    
    // Mostrar información al usuario
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
    { placeHolder: 'Bar orientation' }
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
    { placeHolder: 'Chart style' }
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
 * Collects options specific to time series charts
 * @returns Time series options
 */
async function collectTimeSeriesOptions(): Promise<TimeSeriesOptions | undefined> {
  // Ask for time column
  const timeColumn = await vscode.window.showInputBox({
    prompt: 'Column containing time data',
    placeHolder: 'e.g., date, timestamp, year',
    value: 'date'
  });
  
  if (!timeColumn) return undefined;
  
  // Ask for area style
  const areaResponse = await vscode.window.showQuickPick(
    ['Line', 'Area'],
    { placeHolder: 'Chart style' }
  );
  
  if (!areaResponse) return undefined;
  
  return {
    timeColumn,
    area: areaResponse === 'Area',
    width: 3,
    height: 1
  };
}

/**
 * Extrae automáticamente las dimensiones disponibles de un archivo de datos
 * @param dataSource Ruta o URL al archivo de datos
 * @returns Array con los nombres de las dimensiones disponibles
 */
async function extractDimensions(dataSource: string): Promise<string[]> {
  try {
    let data: any;
    
    // Verificar si es una URL
    if (isUrl(dataSource)) {
      // Obtener el contenido de la URL
      const fileContent = await fetchDataFromUrl(dataSource);
      
      // Determinar si es JSON o CSV por la extensión
      if (dataSource.toLowerCase().endsWith('.json')) {
        data = JSON.parse(fileContent);
        
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
          return Object.keys(data[0]);
        }
      } 
      else if (dataSource.toLowerCase().endsWith('.csv')) {
        // Detectar automáticamente el separador
        const firstLine = fileContent.split('\n')[0];
        const separator = firstLine.includes(';') ? ';' : ',';
        
        // Para CSV, asumimos que la primera línea contiene los encabezados
        const lines = fileContent.split('\n');
        if (lines.length > 0) {
          return lines[0].split(separator).map(header => header.trim());
        }
      }
    }
    // Si es una ruta local (código existente)
    else if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
      const fileContent = fs.readFileSync(dataSource, 'utf8');
      
      // Determinar si es JSON o CSV por la extensión
      if (dataSource.toLowerCase().endsWith('.json')) {
        data = JSON.parse(fileContent);
        
        // Si tenemos un array con al menos un objeto, extraemos sus propiedades
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
          return Object.keys(data[0]);
        }
      } 
      else if (dataSource.toLowerCase().endsWith('.csv')) {
        // Detectar automáticamente el separador (coma o punto y coma)
        const firstLine = fileContent.split('\n')[0];
        const separator = firstLine.includes(';') ? ';' : ',';
        
        // Para CSV, asumimos que la primera línea contiene los encabezados
        const lines = fileContent.split('\n');
        if (lines.length > 0) {
          return lines[0].split(separator).map(header => header.trim());
        }
      }
    }
    
    // Para URLs y otros casos sin formato reconocido
    return ['nombre', 'valor'];
  } catch (error) {
    vscode.window.showWarningMessage(`No se pudieron extraer dimensiones automáticamente: ${error}`);
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
 * @param csvPath Ruta al archivo CSV o URL
 * @returns Ruta al archivo JSON creado o datos JSON procesados
 */
export async function convertCSVtoJSON(csvPath: string): Promise<string> {
  let jsonData;
  
  // Si es una URL
  if (isUrl(csvPath)) {
    // Procesamos los datos CSV remotos
    jsonData = await processRemoteCSVData(csvPath);
    
    // Para URLs remotas, usamos un archivo temporal en el directorio de trabajo
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      throw new Error('No hay un espacio de trabajo abierto para guardar los datos temporales');
    }
    
    // Crear un nombre de archivo basado en la URL
    const urlObj = new URL(csvPath);
    const fileName = path.basename(urlObj.pathname).replace(/\.csv$/i, '') || 'remote-data';
    const jsonPath = path.join(workspaceFolders[0].uri.fsPath, `${fileName}.json`);
    
    // Guardar los datos procesados
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    return jsonPath;
  } 
  // Para archivos locales
  else {
    // Procesar los datos CSV
    jsonData = processCSVData(csvPath);
    
    // Crear la ruta para el nuevo archivo JSON
    const jsonPath = csvPath.replace(/\.csv$/i, '.json');
    
    // Guardar el JSON
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    return jsonPath;
  }
}

/**
 * Carga datos desde un archivo local o URL
 * @param dataSource Ruta del archivo o URL
 * @returns Array con los datos cargados
 */
export async function loadData(dataSource: string): Promise<any[]> {
  // Verificar si es una URL
  if (isUrl(dataSource)) {
    // Para URLs remotas
    if (dataSource.toLowerCase().endsWith('.json')) {
      const fileContent = await fetchDataFromUrl(dataSource);
      return JSON.parse(fileContent);
    } 
    else if (dataSource.toLowerCase().endsWith('.csv')) {
      return await processRemoteCSVData(dataSource);
    }
    else {
      throw new Error('URL no válida. Debe ser un archivo CSV o JSON.');
    }
  } 
  else {
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
}

/**
 * Verifica si una cadena es una URL válida
 * @param str Cadena a verificar
 * @returns true si es una URL, false en caso contrario
 */
export function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Descarga datos desde una URL
 * @param url URL de los datos
 * @returns Contenido de la URL como texto
 */
export async function fetchDataFromUrl(url: string): Promise<string> {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    // Determinar qué protocolo usar
    const requester = url.startsWith('https:') ? https : http;
    
    requester.get(url, (res: any) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Error HTTP: ${res.statusCode}`));
      }
      
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err: any) => reject(err));
  });
}

/**
 * Procesa datos CSV desde una URL remota
 * @param url URL del archivo CSV
 * @returns Array de objetos con los datos procesados
 */
export async function processRemoteCSVData(url: string): Promise<any[]> {
  // Descargar el contenido
  const fileContent = await fetchDataFromUrl(url);
  
  // Usar el mismo algoritmo que para archivos locales
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    throw new Error('El archivo CSV remoto está vacío');
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
    
    const item: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (value !== undefined && !isNaN(Number(value))) {
        item[header] = Number(value);
      } else {
        item[header] = value || '';
      }
    });
    
    if (Object.keys(item).length > 0) {
      result.push(item);
    }
  }
  
  return result;
}