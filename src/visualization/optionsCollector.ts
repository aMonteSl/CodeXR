import * as vscode from 'vscode';
import { 
  ChartType, 
  BarChartOptions, 
  PieChartOptions, 
  DonutChartOptions,
  EnvironmentOptions  // Add this import
} from '../models/chartModel';
import { showColorPicker } from '../utils/colorPickerUtils';

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
 * Available environment presets in A-Frame with English descriptions
 */
export const ENVIRONMENT_PRESETS = [
    { value: 'default', description: 'Base environment, light blue sky, green terrain' },
    { value: 'none', description: 'No environment, useful for fully custom scenes' },
    { value: 'checkerboard', description: 'Simple flat checkerboard floor' },
    { value: 'forest', description: 'Ground with scattered trees, soft lighting, forest-like' },
    { value: 'goaland', description: 'Mountainous environment with epic sky, game-like' },
    { value: 'yavapai', description: 'Rocky desert landscape' },
    { value: 'goldmine', description: 'Foggy mountainous terrain with mining atmosphere' },
    { value: 'arches', description: 'Similar to Arches National Park, reddish tones' },
    { value: 'tron', description: 'Sci-fi style with neon colors and Tron-like lines' },
    { value: 'japan', description: 'Japanese garden atmosphere with pink cherry blossom' },
    { value: 'dream', description: 'Surreal dreamlike landscape, intense colors' },
    { value: 'volcano', description: 'Volcanic terrain, dense sky, dark atmosphere' },
    { value: 'starry', description: 'Starry sky with nighttime atmosphere' },
    { value: 'egypt', description: 'Sand, pyramids and desert sky, Egyptian style' },
    { value: 'threetowers', description: 'Three towers rising from the terrain' },
    { value: 'poison', description: 'Surreal environment, acid green colors, alien-like world' },
    { value: 'osiris', description: 'Stylized Egyptian setting with mystical tones' },
    { value: 'moon', description: 'Gray lunar landscape, no atmosphere' }
];

/**
 * Available color palettes for BabiaXR with English descriptions
 */
export const COLOR_PALETTES = [
    { value: 'ubuntu', description: 'Vibrant and accessible colors used by Ubuntu' },
    { value: 'blues', description: 'Scale from soft to intense blues' },
    { value: 'greens', description: 'Scale of green shades' },
    { value: 'reds', description: 'Scale of red shades' },
    { value: 'purples', description: 'Scale of purple shades' },
    { value: 'oranges', description: 'Scale of orange shades' },
    { value: 'greys', description: 'Scale of gray shades' },
    { value: 'spectral', description: 'Balanced multicolor palette from ColorBrewer' },
    { value: 'paired', description: 'Paired colors with good contrast' },
    { value: 'category10', description: 'Classic D3 palette for 10 distinct categories' },
    { value: 'category20', description: 'Extended to 20 colors with more variety' },
    { value: 'pastel1', description: 'Soft colors, ideal for non-aggressive visualizations' },
    { value: 'pastel2', description: 'Another soft variant' },
    { value: 'dark2', description: 'Intense colors, but less saturated' },
    { value: 'set1', description: 'Bright and vibrant colors' },
    { value: 'set2', description: 'Medium tone colors' },
    { value: 'set3', description: 'More colors, somewhat softer' },
    { value: 'tableau10', description: 'Modern palette, accessible and high contrast' }
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