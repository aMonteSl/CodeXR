import * as vscode from 'vscode';
import * as path from 'path';
import { LocalServerProvider } from '../ui/treeProvider';
import { showColorPicker } from '../utils/colorPickerUtils'; 
import { ChartType } from '../babiaxr/models/chartModel';
import { createBabiaXRVisualization, launchBabiaXRVisualization } from '../babiaxr/visualization/chartManager';
import { collectChartData } from '../babiaxr/visualization/dataCollector';
import { collectChartOptions } from '../babiaxr/visualization/optionsCollector';
import { ENVIRONMENT_PRESETS, COLOR_PALETTES } from '../babiaxr/config/visualizationConfig';

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
          // Ask if user wants to start server
          const startServer = await vscode.window.showInformationMessage(
            `Visualization created at ${path.basename(filePath)}. Do you want to view it in WebXR?`,
            'Yes', 'No'
          );
          
          if (startServer === 'Yes') {
            await launchBabiaXRVisualization(filePath, context);
          }
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
      position = "0 1.6 -2";
      scale = "2 2 2";
      rotation = "-90 0 0";
      break;
      
    case ChartType.BARS_CHART:
      position = "0 0 -2";
      scale = "1 1 1";
      height = "5";
      break;
      
    case ChartType.CYLS_CHART:
      position = "0 0 -3";
      scale = "1 1 1";
      height = "15"; // Aumentamos la altura máxima predeterminada
      break;
      
    case ChartType.BARSMAP_CHART:
      position = "0 0 -3";
      scale = "1 1 1";
      height = "5";
      break;
  }
  
  return {
    position,
    scale,
    rotation,
    height
  };
}