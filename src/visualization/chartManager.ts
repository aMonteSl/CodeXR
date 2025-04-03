import * as vscode from 'vscode';
import { startServer } from '../server/serverManager';
import { 
  ChartType, 
  ChartData, 
  ChartSpecification
} from '../models/chartModel';
import { 
  processTemplate 
} from '../templates/templateManager';
import { 
  saveHtmlToFile 
} from '../templates/fileManager';

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
    // Get saved environment configurations
    const environmentConfig = {
      backgroundColor: context.globalState.get<string>('babiaBackgroundColor') || '#112233',
      environmentPreset: context.globalState.get<string>('babiaEnvironmentPreset') || 'forest',
      groundColor: context.globalState.get<string>('babiaGroundColor') || '#445566',
      chartPalette: context.globalState.get<string>('babiaChartPalette') || 'ubuntu'
    };
    
    // Add environment configuration to chart data
    chartData.environment = environmentConfig;
    
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