import * as vscode from 'vscode';
import { ServerMode } from '../server/models/serverModel';
import { BabiaTreeProvider } from '../babiaxr/providers/babiaTreeProvider';
import { ServerTreeProvider } from '../server/providers/serverTreeProvider';
import { TreeItem } from './treeItems/baseItems';
import {
  getAnalysisChildren,
  getAnalysisSectionItem,
  getLanguageGroupChildren
} from '../analysis/tree/analysisTreeProvider';
import {
  AnalysisSectionItem,
  AnalysisSettingsItem,
  AnalysisModeOptionItem,
  AnalysisDelayOptionItem,
  AnalysisAutoOptionItem,
  AnalysisChartTypeOptionItem // Añadida la nueva clase
} from '../analysis/tree/analysisTreeItems';
import { VisualizationSettingsItem } from './treeItems/settingsItems';
import { DimensionMappingItem } from '../analysis/tree/dimensionMappingTreeItem';

// Types of tree items for context handling - as string literals
export enum TreeItemType {
  SERVER_SECTION = 'SERVER_SECTION',
  SERVER_CONFIG = 'SERVER_CONFIG',
  SERVER_STATUS = 'SERVER_STATUS',
  SERVERS_SECTION = 'SERVERS_SECTION',
  SERVERS_CONTAINER = 'SERVERS_CONTAINER',
  START_SERVER = 'START_SERVER',
  SERVER_MODE = 'SERVER_MODE',
  ACTIVE_SERVER = 'ACTIVE_SERVER',
  STOP_ALL_SERVERS = 'STOP_ALL_SERVERS',
  BABIAXR_SECTION = 'BABIAXR_SECTION',
  BABIAXR_CONFIG = 'BABIAXR_CONFIG',
  CREATE_VISUALIZATION = 'CREATE_VISUALIZATION',
  CHART_TYPE = 'CHART_TYPE',
  ANALYSIS_SECTION = 'ANALYSIS_SECTION',
  ANALYSIS_SETTINGS = 'analysis_settings',
  ANALYSIS_LANGUAGE_GROUP = 'ANALYSIS_LANGUAGE_GROUP',
  ANALYSIS_FILE = 'ANALYSIS_FILE',
  ANALYSIS_SETTING_OPTION = 'analysis_setting_option',
  ANALYSIS_MESSAGE = 'ANALYSIS_MESSAGE',
  ANALYSIS_RESET = 'analysis_reset', // ✅ AÑADIR NUEVO TIPO
  VISUALIZATION_SETTINGS = 'VISUALIZATION_SETTINGS',
  BABIAXR_EXAMPLES_CONTAINER = 'BABIAXR_EXAMPLES_CONTAINER',
  BABIAXR_EXAMPLE_CATEGORY = 'BABIAXR_EXAMPLE_CATEGORY',
  BABIAXR_EXAMPLE = 'BABIAXR_EXAMPLE',
  BABIAXR_CONFIG_ITEM = 'BABIAXR_CONFIG_ITEM',
  DIMENSION_MAPPING = 'dimension_mapping',
  DIMENSION_MAPPING_OPTION = 'dimension_mapping_option'
}

/**
 * Tree data provider implementation for the sidebar view
 */
export class LocalServerProvider implements vscode.TreeDataProvider<TreeItem> {
  // Event emitter to notify data changes
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined> = new vscode.EventEmitter<TreeItem | undefined>();
  
  // Event that VS Code listens to for view updates
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined> = this._onDidChangeTreeData.event;
  
  // Extension context for storage access
  private context: vscode.ExtensionContext;

  // Specialized tree providers
  private babiaTreeProvider: BabiaTreeProvider;
  private serverTreeProvider: ServerTreeProvider;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Initialize specialized providers
    this.babiaTreeProvider = new BabiaTreeProvider(context);
    this.serverTreeProvider = new ServerTreeProvider(context);

    // Initialize with default values if no previous configuration exists
    if (!this.context.globalState.get('serverMode')) {
      this.context.globalState.update('serverMode', ServerMode.HTTPS_DEFAULT_CERTS);
    }
  }

  /**
   * Refreshes the tree view
   * @param element Optional element to refresh, or undefined to refresh all
   */
  public refresh(element?: TreeItem): void {
    this._onDidChangeTreeData.fire(element);
  }

  /**
   * Returns the UI element for an item
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Gets the child elements of an element or root elements
   */
  public getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    // Root level items
    if (!element) {
      const items: TreeItem[] = [];
      
      // Server section
      items.push(this.serverTreeProvider.getServersSectionItem());
      
      // BabiaXR section
      items.push(this.babiaTreeProvider.getBabiaXRSectionItem());
      
      // Code Analysis section
      items.push(getAnalysisSectionItem(this.context.extensionUri.fsPath));
      
      // NEW: Add Visualization Settings as a top-level item
      items.push(new VisualizationSettingsItem(this.context));
      
      return Promise.resolve(items);
    }
    
    // ✅ CAMBIAR contextValue por type
    switch (element.type) {
      case TreeItemType.SERVERS_SECTION:
        return this.serverTreeProvider.getServersChildren();
      case TreeItemType.BABIAXR_SECTION:
        return this.babiaTreeProvider.getBabiaXRChildren();
      case TreeItemType.SERVER_CONFIG:
        return this.serverTreeProvider.getServerConfigChildren();
      case TreeItemType.SERVERS_CONTAINER:
        return this.serverTreeProvider.getActiveServersChildren();
      case TreeItemType.BABIAXR_CONFIG:
        return this.babiaTreeProvider.getBabiaXRConfigChildren();
      case TreeItemType.VISUALIZATION_SETTINGS:
        return (element as VisualizationSettingsItem).getChildren();
      case TreeItemType.BABIAXR_EXAMPLES_CONTAINER:
        return this.babiaTreeProvider.getBabiaXRExamplesChildren();
      case TreeItemType.CREATE_VISUALIZATION:
        return this.babiaTreeProvider.getCreateVisualizationChildren();
      case TreeItemType.BABIAXR_EXAMPLE_CATEGORY:
        if (element.children && element.children.length > 0) {
          return Promise.resolve(element.children);
        }
        return Promise.resolve([]);
      case TreeItemType.ANALYSIS_SECTION:
        return getAnalysisChildren(this.context);
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        return getLanguageGroupChildren(element);
      case TreeItemType.ANALYSIS_SETTINGS:
        // ✅ Usar el método getChildren del AnalysisSettingsItem
        if (element instanceof AnalysisSettingsItem) {
          console.log('🔧 Using AnalysisSettingsItem.getChildren()');
          return element.getChildren();
        }
        return this.getSettingsChildren(this.context.extensionUri.fsPath);
      case TreeItemType.DIMENSION_MAPPING:
        // ✅ AÑADIR SOPORTE PARA DIMENSION MAPPING
        if (element instanceof DimensionMappingItem) {
          console.log('🎯 Using DimensionMappingItem.getChildren()');
          return element.getChildren();
        }
        return Promise.resolve([]);
      case TreeItemType.STOP_ALL_SERVERS:
        // Este item no tiene hijos, se maneja directamente con el command
        return Promise.resolve([]);
      default:
        return Promise.resolve([]);
    }
  }

  /**
   * Gets settings child items
   * @param extensionPath Path to the extension
   * @returns Settings option items
   */
  private async getSettingsChildren(extensionPath: string): Promise<TreeItem[]> {
    console.log('Generating settings children items');
    const config = vscode.workspace.getConfiguration();
    
    // Get current mode setting
    const currentMode = config.get<string>('codexr.analysisMode', 'Static');
    
    // Get current debounce delay setting
    const debounceDelay = config.get<number>('codexr.analysis.debounceDelay', 2000);
    
    // Get current auto-analysis setting
    const autoAnalysis = config.get<boolean>('codexr.analysis.autoAnalysis', true);
    
    // ✅ LEER CHART TYPE DESDE GLOBAL STATE PRIMERO, LUEGO CONFIG COMO FALLBACK
    const chartType = this.context.globalState.get<string>('codexr.analysis.chartType') || 
                     config.get<string>('codexr.analysis.chartType', 'boats');
    
    console.log('Current settings:', { 
      analysisMode: currentMode, 
      debounceDelay, 
      autoAnalysis,
      chartType,
      chartTypeSource: this.context.globalState.get<string>('codexr.analysis.chartType') ? 'globalState' : 'config'
    });
    
    // Create option items
    const staticOption = new AnalysisModeOptionItem('Static', currentMode === 'Static', extensionPath);
    const xrOption = new AnalysisModeOptionItem('XR', currentMode === 'XR', extensionPath);
    const delayOption = new AnalysisDelayOptionItem(debounceDelay, extensionPath);
    const autoOption = new AnalysisAutoOptionItem(autoAnalysis, extensionPath);
    const chartTypeOption = new AnalysisChartTypeOptionItem(chartType, extensionPath);
    
    return [staticOption, xrOption, delayOption, autoOption, chartTypeOption];
  }

  /**
   * Changes the server mode - delegated to ServerTreeProvider
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    await this.serverTreeProvider.changeServerMode(mode);
    this.refresh();
  }
}
