import * as vscode from 'vscode';
import { TreeItem } from './baseItems';
import { TreeItemType } from '../treeProvider';
import { ChartType } from '../../models/chartModel';

/**
 * Item to create a BabiaXR visualization
 */
export class CreateVisualizationItem extends TreeItem {
  constructor() {
    super(
      'Create Visualization',
      'Select a visualization type for BabiaXR',
      TreeItemType.CREATE_VISUALIZATION,
      vscode.TreeItemCollapsibleState.Collapsed,
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
        command: 'integracionvsaframe.createBabiaXRVisualization',
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
      new vscode.ThemeIcon('symbol-color')
    );
    
    this.description = currentValue;
  }
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