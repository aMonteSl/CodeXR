import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LocalServerProvider } from '../ui/treeProvider';
import { showColorPicker } from '../utils/colorPickerUtils'; 
import { ChartType } from '../babiaxr/models/chartModel';
import { createBabiaXRVisualization, launchBabiaXRVisualization } from '../babiaxr/visualization/chartManager';
import { collectChartData } from '../babiaxr/visualization/dataCollector';
import { collectChartOptions } from '../babiaxr/visualization/optionsCollector';
import { ENVIRONMENT_PRESETS, COLOR_PALETTES } from '../babiaxr/config/visualizationConfig';
import { ServerMode } from '../server/models/serverModel';
import { createServer } from '../server/serverManager';
import { FileWatchManager } from '../analysis/fileWatchManager';
import { openFolderInWorkspace } from '../utils/workspaceUtils';

/**
 * Registers all BabiaXR-related commands
 * @param context Extension context for storage
 * @param treeDataProvider The main tree data provider
 * @returns Array of disposables for registered commands
 */
export function registerBabiaCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: LocalServerProvider
): vscode.Disposable[] {
  const disposables: vscode.Disposable[] = [];
  
  // Command to create visualization
  disposables.push(
    vscode.commands.registerCommand('codexr.createVisualization', async (chartType: ChartType) => {
      try {
        // Collect chart data from user - pass context
        const chartData = await collectChartData(chartType, context);
        if (!chartData) {
          return; // User canceled
        }
        
        // Use default values for options instead of asking
        const defaultOptions = getDefaultOptionsForChartType(chartType);
        
        // Combine data and options
        const combinedData = {
          ...chartData,
          position: defaultOptions.position,
          scale: defaultOptions.scale,
          rotation: defaultOptions.rotation,
          height: defaultOptions.height
        };
        
        // Generate visualization
        const filePath = await createBabiaXRVisualization(chartType, combinedData, context);
        
        if (filePath) {
          // Get the JSON data path from chart data
          const jsonDataPath = chartData.dataSource;
          
          // Get FileWatchManager instance
          const fileWatchManager = FileWatchManager.getInstance();
          if (fileWatchManager && jsonDataPath) {
            // Register the JSON file for watching
            fileWatchManager.watchVisualizationDataFile(jsonDataPath, filePath);
          }
          
          // Ask if user wants to start server
          const startServer = await vscode.window.showInformationMessage(
            `Visualization created at ${path.basename(filePath)}. Do you want to view it in WebXR?`,
            'Yes', 'No'
          );
          
          if (startServer === 'Yes') {
            await launchBabiaXRVisualization(filePath, context);
          }

          // Automatically open the visualization folder as the workspace
          const folderPath = path.dirname(filePath);
          vscode.window.showInformationMessage(`Opening visualization folder in workspace: ${path.basename(folderPath)}`);
          await openFolderInWorkspace(folderPath, false);
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error creating visualization: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })
  );
  
  // Command to set background color
  disposables.push(
    vscode.commands.registerCommand('codexr.setBackgroundColor', async () => {
      try {
        const backgroundColor = await showColorPicker(
          'Select Background Color',
          context.globalState.get<string>('babiaBackgroundColor') || '#112233'
        );
        
        if (backgroundColor) {
          await context.globalState.update('babiaBackgroundColor', backgroundColor);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error updating background color: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to set environment preset
  disposables.push(
    vscode.commands.registerCommand('codexr.setEnvironmentPreset', async () => {
      try {
        const environmentPreset = await vscode.window.showQuickPick(
          ENVIRONMENT_PRESETS.map(preset => ({
            label: preset.value,
            description: preset.description
          })),
          { 
            placeHolder: 'Select environment preset',
            matchOnDescription: true // Allow searching in the descriptions
          }
        );
        
        if (environmentPreset) {
          await context.globalState.update('babiaEnvironmentPreset', environmentPreset.label);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error updating environment preset: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to set ground color
  disposables.push(
    vscode.commands.registerCommand('codexr.setGroundColor', async () => {
      try {
        const groundColor = await showColorPicker(
          'Select Ground Color',
          context.globalState.get<string>('babiaGroundColor') || '#445566'
        );
        
        if (groundColor) {
          await context.globalState.update('babiaGroundColor', groundColor);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error updating ground color: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to set chart palette
  disposables.push(
    vscode.commands.registerCommand('codexr.setChartPalette', async () => {
      try {
        const chartPalette = await vscode.window.showQuickPick(
          COLOR_PALETTES.map(palette => ({
            label: palette.value,
            description: palette.description
          })),
          { 
            placeHolder: 'Select chart color palette',
            matchOnDescription: true
          }
        );
        
        if (chartPalette) {
          await context.globalState.update('babiaChartPalette', chartPalette.label);
          treeDataProvider.refresh();
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error updating chart palette: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Command to launch a BabiaXR example
  disposables.push(
    vscode.commands.registerCommand('codexr.launchBabiaXRExample', async (examplePath: string) => {
      try {
        // First verify that the example file exists
        if (!examplePath) {
          vscode.window.showErrorMessage('No example path provided');
          return;
        }
        
        console.log(`🚀 Attempting to launch example at: ${examplePath}`);
        
        // ✅ VERIFICAR QUE EL ARCHIVO EXISTE
        if (!fs.existsSync(examplePath)) {
          vscode.window.showErrorMessage(`Example file not found: ${examplePath}`);
          console.error(`❌ File not found: ${examplePath}`);
          
          // ✅ LISTAR ARCHIVOS DISPONIBLES PARA DEBUG
          const exampleDir = path.dirname(examplePath);
          if (fs.existsSync(exampleDir)) {
            console.log(`📁 Available files in ${exampleDir}:`);
            try {
              const files = fs.readdirSync(exampleDir);
              files.forEach(file => console.log(`  - ${file}`));
            } catch (error) {
              console.error(`Error reading directory ${exampleDir}:`, error);
            }
          } else {
            console.error(`Directory does not exist: ${exampleDir}`);
          }
          return;
        }
        
        // ✅ USAR LA CARPETA DEL EJEMPLO COMO ROOT DEL SERVIDOR
        const exampleDir = path.dirname(examplePath);
        const fileName = path.basename(examplePath);
        
        console.log(`📁 Using example directory as server root: ${exampleDir}`);
        console.log(`📄 Example file name: ${fileName}`);
        
        // ✅ VERIFICAR QUE EL DIRECTORIO EXISTE
        if (!fs.existsSync(exampleDir)) {
          vscode.window.showErrorMessage(`Example directory not found: ${exampleDir}`);
          return;
        }
        
        // ✅ LISTAR CONTENIDO DEL DIRECTORIO PARA DEBUG
        try {
          const files = fs.readdirSync(exampleDir);
          console.log(`📁 Example directory contains ${files.length} items:`);
          files.forEach(file => console.log(`  - ${file}`));
        } catch (err) {
          console.error(`❌ Error reading example directory: ${err}`);
          return;
        }
        
        // ✅ CREAR SERVIDOR CON EL DIRECTORIO DEL EJEMPLO COMO ROOT
        const serverInfo = await createServer(
          exampleDir,  // ✅ USAR EL DIRECTORIO DEL EJEMPLO, NO EL ROOT DE EXAMPLES
          ServerMode.HTTPS_DEFAULT_CERTS,
          context
        );
        
        if (serverInfo) {
          // ✅ LA URL ES SIMPLEMENTE EL NOMBRE DEL ARCHIVO HTML
          const url = `${serverInfo.url}/${fileName}`;
          
          console.log(`✅ Example server created successfully`);
          console.log(`🌐 Opening example URL: ${url}`);
          
          // Open the example in the default browser
          await vscode.env.openExternal(vscode.Uri.parse(url));
          
          // Show success message
          vscode.window.showInformationMessage(
            `🚀 BabiaXR example "${path.basename(fileName, '.html')}" launched at ${url}`,
            'View in Browser'
          ).then(selection => {
            if (selection === 'View in Browser') {
              vscode.env.openExternal(vscode.Uri.parse(url));
            }
          });
          
        } else {
          vscode.window.showErrorMessage('Failed to start server for BabiaXR example');
        }
        
      } catch (error) {
        console.error('❌ Error launching BabiaXR example:', error);
        vscode.window.showErrorMessage(`Error launching example: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );
  
  return disposables;
}

/**
 * Returns default options for a chart type without asking the user
 */
function getDefaultOptionsForChartType(chartType: ChartType): any {
  // Default position based on chart type
  let position = "0 1.6 -2";
  let scale = "1 1 1";
  let rotation = undefined;
  let height = undefined;
  
  switch (chartType) {
    case ChartType.PIE_CHART:
    case ChartType.DONUT_CHART:
      position = "0 2.5 -2";
      rotation = "90 0 0";
      break;
      
    case ChartType.BARS_CHART:
      position = "0 1.6 -2";
      break;
      
    case ChartType.CYLS_CHART:
      position = "0 1.6 -2";
      break;
      
    // ✅ ADDED: Bubbles chart configuration
    case ChartType.BUBBLES_CHART:
      position = "0 1.6 -2";
      scale = "1.2 1.2 1.2"; // Slightly smaller scale for bubbles
      break;
      
    case ChartType.BARSMAP_CHART:
      position = "0 1.6 -2";
      break;
  }
  
  return {
    position,
    scale,
    rotation,
    height
  };
}