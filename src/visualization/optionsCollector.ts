import * as vscode from 'vscode';
import { 
  ChartType, 
  BarChartOptions, 
  PieChartOptions, 
  DonutChartOptions,
  EnvironmentOptions  // Add this import
} from '../models/chartModel';

/**
 * Collects chart-specific options based on chart type
 */
export async function collectChartOptions(
  chartType: ChartType
): Promise<BarChartOptions | PieChartOptions | DonutChartOptions | undefined> {
  switch (chartType) {
    case ChartType.BARSMAP_CHART:
      return collectBarsmapChartOptions();
    case ChartType.PIE_CHART:
      return collectPieChartOptions();
    case ChartType.DONUT_CHART:
      return collectDonutChartOptions();
    default:
      return {};
  }
}

/**
 * Collects options specific to barsmap charts
 * @returns BarChartOptions object
 */
export async function collectBarsmapChartOptions(): Promise<BarChartOptions | undefined> {
  return {
    height: 1,
    width: 2
  };
}

/**
 * Collects options specific to donut charts
 */
export async function collectDonutChartOptions(): Promise<DonutChartOptions | undefined> {
  // Return default values without asking for unnecessary parameters
  return {
    donutRadius: 0.5 // Use a standard default value
  };
}

/**
 * Collects options specific to pie charts (simplified - no donut option)
 */
export async function collectPieChartOptions(): Promise<PieChartOptions | undefined> {
  // Simplified implementation - no donut option
  return {};
}

/**
 * Available environment presets in A-Frame
 */
export const ENVIRONMENT_PRESETS = [
    'forest', 'starry', 'dream', 'tron', 'arches', 'egypt', 'contact', 
    'threetowers', 'poison', 'default', 'goldmine', 'yavapai', 'osiris', 'moon'
];

/**
 * Available color palettes for BabiaXR
 */
export const COLOR_PALETTES = [
    'ubuntu', 'blues', 'flat', 'reds', 'greens', 'yellows', 'commerce'
];

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
      label: preset,
      description: `Environment preset: ${preset}`
    })),
    { 
      placeHolder: 'Select environment preset',
      activeItems: [{ label: defaultEnvPreset } as any]
    }
  );
  
  if (!environmentPreset) return undefined;
  
  // Select background color
  const backgroundColor = await vscode.window.showInputBox({
    prompt: 'Background color (hex format)',
    placeHolder: '#112233',
    value: defaultBgColor,
    validateInput: value => {
      return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Please enter a valid hex color (e.g., #112233)';
    }
  });
  
  if (!backgroundColor) return undefined;
  
  // Select ground color
  const groundColor = await vscode.window.showInputBox({
    prompt: 'Ground color (hex format)',
    placeHolder: '#445566',
    value: defaultGroundColor,
    validateInput: value => {
      return /^#[0-9A-Fa-f]{6}$/.test(value) ? null : 'Please enter a valid hex color (e.g., #445566)';
    }
  });
  
  if (!groundColor) return undefined;
  
  // Select chart color palette
  const chartPalette = await vscode.window.showQuickPick(
    COLOR_PALETTES.map(palette => ({
      label: palette,
      description: `Color palette: ${palette}`
    })),
    { 
      placeHolder: 'Select chart color palette',
      activeItems: [{ label: defaultPalette } as any]
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