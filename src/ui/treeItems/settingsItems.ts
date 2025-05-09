import * as vscode from 'vscode';
import { TreeItem } from './baseItems';
import { TreeItemType } from '../treeProvider';
import { BabiaXRConfigOption } from './chartItems'; // Fixed import path

/**
 * Top-level Visualization Settings item for the tree view
 */
export class VisualizationSettingsItem extends TreeItem {
  constructor(context: vscode.ExtensionContext) {
    super(
      'Visualization Settings',
      'Configure visualization environment and appearance',
      TreeItemType.VISUALIZATION_SETTINGS,  // Now this will be a string
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('settings-gear')  // Cambiado de 'paintcan' a 'settings-gear'
    );
    
    this.context = context;
  }
  
  private context: vscode.ExtensionContext;
  
  /**
   * Gets the children of this item
   * @returns Tree items for visualization settings
   */
  public getChildren(): Thenable<TreeItem[]> {
    const bgColor = this.context.globalState.get<string>('babiaBackgroundColor') || '#112233';
    const envPreset = this.context.globalState.get<string>('babiaEnvironmentPreset') || 'forest';
    const groundColor = this.context.globalState.get<string>('babiaGroundColor') || '#445566';
    const chartPalette = this.context.globalState.get<string>('babiaChartPalette') || 'ubuntu';
    
    return Promise.resolve([
      new BabiaXRConfigOption(
        'Background Color', 
        'Set default background color for visualizations',
        'codexr.setBackgroundColor',
        bgColor
      ),
      new BabiaXRConfigOption(
        'Environment Preset', 
        'Set default environment preset',
        'codexr.setEnvironmentPreset',
        envPreset
      ),
      new BabiaXRConfigOption(
        'Ground Color', 
        'Set default ground color',
        'codexr.setGroundColor',
        groundColor
      ),
      new BabiaXRConfigOption(
        'Chart Palette', 
        'Set default color palette for charts',
        'codexr.setChartPalette',
        chartPalette
      )
    ]);
  }
}