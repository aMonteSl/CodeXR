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