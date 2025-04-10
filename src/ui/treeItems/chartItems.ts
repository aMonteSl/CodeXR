import * as vscode from 'vscode';
import { TreeItem } from './baseItems';
import { TreeItemType } from '../treeProvider';
import { ChartType } from '../../babiaxr/models/chartModel';

/**
 * Item to create a BabiaXR visualization
 */
export class CreateVisualizationItem extends TreeItem {
  constructor() {
    super(
      'Create Visualization',
      'Select a visualization type for BabiaXR',
      TreeItemType.CREATE_VISUALIZATION,
      vscode.TreeItemCollapsibleState.Collapsed, // Make sure this is Collapsed
      undefined,
      new vscode.ThemeIcon('add')
    );
  }
}

/**
 * Item for a BabiaXR chart type
 */
export class ChartTypeItem extends TreeItem {
  constructor(chartType: ChartType, tooltip: string) {
    super(
      chartType,
      tooltip,
      TreeItemType.CHART_TYPE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.createVisualization',
        title: `Create ${chartType}`,
        arguments: [chartType]
      },
      new vscode.ThemeIcon('graph')
    );
  }
}

/**
 * Represents the BabiaXR configuration item in the tree
 */
export class BabiaXRConfigItem extends TreeItem {
  constructor(context: vscode.ExtensionContext) {
    super(
      'Visualization Settings',
      'Default settings for BabiaXR visualizations',
      TreeItemType.BABIAXR_CONFIG,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('settings-gear')
    );
  }
}

/**
 * Represents a BabiaXR configuration option in the tree
 */
export class BabiaXRConfigOption extends TreeItem {
  constructor(
    label: string,
    tooltip: string,
    command: string,
    currentValue: string
  ) {
    const isColor = label.includes('Color');
    
    super(
      label,
      tooltip,
      TreeItemType.BABIAXR_CONFIG_ITEM,
      vscode.TreeItemCollapsibleState.None,
      {
        command: command,
        title: 'Configure ' + label,
        arguments: []
      },
      // Use the appropriate icon
      isColor ? 
        new vscode.ThemeIcon('symbol-color') : 
        new vscode.ThemeIcon('symbol-property')
    );
    
    // For color values, add a color emoji indicator based on the color's hue
    if (isColor && currentValue && currentValue.startsWith('#')) {
      // Get a matching emoji for the color
      const colorEmoji = getColorEmoji(currentValue);
      this.description = `${currentValue} ${colorEmoji}`;
    } else {
      this.description = currentValue;
    }
  }
}

/**
 * Gets a matching emoji for a hex color
 */
function getColorEmoji(hexColor: string): string {
  // Parse the color to get RGB values
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);
  
  // Get hue from RGB
  let max = Math.max(r, g, b);
  let min = Math.min(r, g, b);
  
  // Grayscale check
  if (max - min < 30) {
    if (max < 60) return '⬛'; // Black
    if (max < 180) return '⬜'; // Gray 
    return '⬜'; // White
  }
  
  // Calculate hue
  let hue = 0;
  if (max === r) {
    hue = (g - b) / (max - min) * 60;
    if (hue < 0) hue += 360;
  } else if (max === g) {
    hue = ((b - r) / (max - min) * 60) + 120;
  } else {
    hue = ((r - g) / (max - min) * 60) + 240;
  }
  
  // Map hue to emoji
  if (hue < 30 || hue >= 330) return '🟥'; // Red
  if (hue < 60) return '🟧';  // Orange
  if (hue < 90) return '🟨';  // Yellow
  if (hue < 180) return '🟩'; // Green
  if (hue < 270) return '🟦'; // Blue
  return '🟪'; // Purple
}

/**
 * Section item for BabiaXR
 */
export class BabiaXRSectionItem extends TreeItem {
  constructor() {
    super(
      'BabiaXR',
      'Create and configure BabiaXR visualizations',
      TreeItemType.BABIAXR_SECTION,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('graph')
    );
  }
}

/**
 * Item for a BabiaXR example chart
 */
export class BabiaXRExampleItem extends TreeItem {
  constructor(label: string, examplePath: string) {
    super(
      label,
      "Launch this example visualization",
      TreeItemType.BABIAXR_EXAMPLE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexr.launchBabiaXRExample', // Actualizado a codexr
        title: `Launch ${label} Example`,
        arguments: [examplePath]
      },
      new vscode.ThemeIcon('play')
    );
  }
}

/**
 * Container for BabiaXR examples
 */
export class BabiaXRExamplesContainer extends TreeItem {
  constructor() {
    super(
      "Examples",
      "Launch example visualizations",
      TreeItemType.BABIAXR_EXAMPLES_CONTAINER,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('library')
    );
  }
}