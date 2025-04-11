import * as vscode from 'vscode';
import { 
  ChartType, 
  BarChartOptions, 
  PieChartOptions, 
  DonutChartOptions,
  EnvironmentOptions
} from '../models/chartModel';
import { showColorPicker } from '../../utils/colorPickerUtils';
import { ENVIRONMENT_PRESETS, COLOR_PALETTES } from '../config/visualizationConfig';

/**
 * Chart options
 */
export interface ChartOptions {
  position: string;
  scale?: string;
  rotation?: string;
  color?: string;
  height?: string;
}

/**
 * Collects chart-specific options from user
 * @param chartType Type of chart to collect options for
 * @returns Chart options or undefined if canceled
 */
export async function collectChartOptions(chartType: ChartType): Promise<ChartOptions | undefined> {
  try {
    // Default position
    let defaultPosition = "0 0 0";
    if (chartType === ChartType.BARSMAP_CHART) {
      defaultPosition = "0 0.5 0";
    }
    
    // Get position
    const position = await vscode.window.showInputBox({
      prompt: 'Enter chart position (x y z)',
      placeHolder: 'e.g. 0 0 0',
      value: defaultPosition
    });
    
    if (!position) return undefined; // User canceled
    
    // Get scale
    const scale = await vscode.window.showInputBox({
      prompt: 'Enter chart scale (x y z) - optional',
      placeHolder: 'e.g. 1 1 1',
      value: getDefaultScaleForChart(chartType)
    });
    
    // Get rotation for some charts
    let rotation: string | undefined;
    if (chartType === ChartType.PIE_CHART || chartType === ChartType.DONUT_CHART) {
      rotation = await vscode.window.showInputBox({
        prompt: 'Enter chart rotation (x y z) - optional',
        placeHolder: 'e.g. -90 0 0',
        value: '-90 0 0'
      });
    }
    
    // Get height for bar charts
    let height: string | undefined;
    if (chartType === ChartType.BARS_CHART || chartType === ChartType.BARSMAP_CHART || chartType === ChartType.CYLS_CHART) {
      height = await vscode.window.showInputBox({
        prompt: 'Enter maximum height for bars/cylinders',
        placeHolder: 'e.g. 5',
        value: '5'
      });
    }
    
    return {
      position,
      scale,
      rotation,
      height
    };
  } catch (error) {
    vscode.window.showErrorMessage(
      `Error collecting chart options: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

/**
 * Get default scale based on chart type
 */
function getDefaultScaleForChart(chartType: ChartType): string {
  switch (chartType) {
    case ChartType.PIE_CHART:
    case ChartType.DONUT_CHART:
      return '3 3 3';
    case ChartType.BARS_CHART:
    case ChartType.BARSMAP_CHART:
    case ChartType.CYLS_CHART:
      return '1 1 1';
    default:
      return '1 1 1';
  }
}

/**
 * Collects environment configuration options
 */
export async function collectEnvironmentOptions(context: vscode.ExtensionContext): Promise<EnvironmentOptions | undefined> {
  // Get default values from settings
  const defaultBgColor = context.globalState.get<string>('babiaBackgroundColor') || '#112233';
  const defaultEnvPreset = context.globalState.get<string>('babiaEnvironmentPreset') || 'forest';
  const defaultGroundColor = context.globalState.get<string>('babiaGroundColor') || '#445566';
  const defaultPalette = context.globalState.get<string>('babiaChartPalette') || 'ubuntu';
  
  // Select environment preset
  const environmentPreset = await vscode.window.showQuickPick(
    ENVIRONMENT_PRESETS.map(preset => ({
      label: preset.value,
      description: preset.description,
      picked: preset.value === defaultEnvPreset
    })),
    { 
      placeHolder: 'Select environment preset',
      matchOnDescription: true
    }
  );
  
  if (!environmentPreset) return undefined;
  
  // Select background color using visual picker
  const backgroundColor = await showColorPicker(
    'Select Background Color',
    defaultBgColor
  );
  
  if (!backgroundColor) return undefined;
  
  // Select ground color using visual picker
  const groundColor = await showColorPicker(
    'Select Ground Color',
    defaultGroundColor
  );
  
  if (!groundColor) return undefined;
  
  // Select chart color palette
  const chartPalette = await vscode.window.showQuickPick(
    COLOR_PALETTES.map(palette => ({
      label: palette.value,
      description: palette.description,
      picked: palette.value === defaultPalette
    })),
    { 
      placeHolder: 'Select chart color palette',
      matchOnDescription: true
    }
  );
  
  if (!chartPalette) return undefined;
  
  return {
    backgroundColor,
    environmentPreset: environmentPreset.label,
    groundColor,
    chartPalette: chartPalette.label
  };
}