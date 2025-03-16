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
    
    // Process template with the chart specification
    const { html, originalDataPath } = processTemplate(context, chartSpec);
    
    // Get sanitized filename from chart title
    const fileName = `${chartData.title.replace(/\s+/g, '-')}.html`;
    
    // Save the HTML content to a file, passing the original data path if available
    const filePath = await saveHtmlToFile(html, fileName, originalDataPath);
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
            label: 'Datos demográficos', 
            value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv', 
            description: 'Población por países' 
          },
          { 
            label: 'Ventas trimestrales', 
            value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv', 
            description: 'Ventas por trimestre' 
          },
          { 
            label: 'Estadísticas de uso', 
            value: 'https://raw.githubusercontent.com/aframevr/aframe/master/examples/test/curve/data.csv', 
            description: 'Uso de plataforma' 
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

    // Mostrar un selector con las dimensiones encontradas
    const selectedDimensions = await vscode.window.showQuickPick(
      dimensions.map(d => ({ label: d, picked: d === dimensions[0] || d === dimensions[1] })),
      { 
        canPickMany: true,
        placeHolder: 'Selecciona las dimensiones a visualizar',
        title: 'Dimensiones disponibles en los datos'
      }
    );

    if (!selectedDimensions || selectedDimensions.length === 0) return undefined;

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
): Promise<BarChartOptions | PieChartOptions | TimeSeriesOptions | undefined> {
  switch (chartType) {
    case ChartType.BAR_CHART:
      return collectBarChartOptions();
    case ChartType.PIE_CHART:
      return collectPieChartOptions();
    case ChartType.TIME_SERIES:
      return collectTimeSeriesOptions();
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
    
    // Si es una ruta local
    if (dataSource.startsWith('/') || dataSource.includes(':\\')) {
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
        // Para CSV, asumimos que la primera línea contiene los encabezados
        const lines = fileContent.split('\n');
        if (lines.length > 0) {
          return lines[0].split(',').map(header => header.trim());
        }
      }
    }
    
    // Para URLs y otros casos, devolvemos un conjunto predeterminado
    return ['nombre', 'valor'];
  } catch (error) {
    vscode.window.showWarningMessage(`No se pudieron extraer dimensiones automáticamente: ${error}`);
    return ['nombre', 'valor']; // Valores predeterminados en caso de error
  }
}