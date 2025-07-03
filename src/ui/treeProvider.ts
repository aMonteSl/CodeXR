import * as vscode from 'vscode';
import * as path from 'path';
import { TreeItem } from './treeItems/baseItems';
import { SectionItem } from './treeItems/baseItems';
import { BabiaTreeProvider } from '../babiaxr/providers/babiaTreeProvider';
import { ServerTreeProvider } from '../server/providers/serverTreeProvider';
import { AnalysisTreeProvider } from '../analysis/tree/analysisTreeProvider';
import { VisualizationSettingsItem } from './treeItems/settingsItems';
import { ServerMode } from '../server/models/serverModel';
import { defaultCertificatesExist } from '../server/certificateManager';
import { getActiveServers } from '../server/serverManager';
import {
  getAnalysisChildren,
  getLanguageGroupChildren,
  getAnalysisSectionItem
} from '../analysis/tree/analysisTreeProvider';
import {
  AnalysisSectionItem,
  AnalysisSettingsItem,
  AnalysisModeOptionItem,
  AnalysisDelayOptionItem,
  AnalysisAutoOptionItem,
  AnalysisChartTypeOptionItem
} from '../analysis/tree/analysisTreeItems';
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
  ANALYSIS_RESET = 'analysis_reset',
  FILES_PER_LANGUAGE_CONTAINER = 'FILES_PER_LANGUAGE_CONTAINER',
  VISUALIZATION_SETTINGS = 'VISUALIZATION_SETTINGS',
  BABIAXR_EXAMPLES_CONTAINER = 'BABIAXR_EXAMPLES_CONTAINER',
  BABIAXR_EXAMPLE_CATEGORY = 'BABIAXR_EXAMPLE_CATEGORY',
  BABIAXR_EXAMPLE = 'BABIAXR_EXAMPLE',
  BABIAXR_CONFIG_ITEM = 'BABIAXR_CONFIG_ITEM',
  DIMENSION_MAPPING = 'dimension_mapping',
  DIMENSION_MAPPING_OPTION = 'dimension_mapping_option',
  ACTIVE_ANALYSES_SECTION = 'ACTIVE_ANALYSES_SECTION',
  ACTIVE_ANALYSIS = 'ACTIVE_ANALYSIS'
}

/**
 * Tree data provider implementation for the sidebar view
 */
export class LocalServerProvider implements vscode.TreeDataProvider<TreeItem> {
  // Event emitter to notify data changes
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  
  // Event that VS Code listens to for view updates
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  // Extension context for storage access
  private context: vscode.ExtensionContext;

  // Specialized tree providers
  private babiaTreeProvider: BabiaTreeProvider;
  private serverTreeProvider: ServerTreeProvider;
  private analysisTreeProvider: AnalysisTreeProvider;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Initialize specialized providers
    this.babiaTreeProvider = new BabiaTreeProvider(context);
    this.serverTreeProvider = new ServerTreeProvider(context);
    this.analysisTreeProvider = new AnalysisTreeProvider(context);

    // Subscribe to analysis tree provider changes
    this.analysisTreeProvider.onDidChangeTreeData(() => {
      console.log('🔄 Analysis tree data changed, refreshing main tree...');
      this.refresh();
    });

    // Initialize with default values if no previous configuration exists
    if (!this.context.globalState.get('serverMode')) {
      this.context.globalState.update('serverMode', ServerMode.HTTPS_DEFAULT_CERTS);
    }

    console.log('✅ LocalServerProvider initialized with automatic file system watching');
  }

  /**
   * Refreshes the tree view
   * @param element Optional element to refresh, or undefined to refresh all
   */
  public refresh(element?: TreeItem): void {
    console.log('🔄 LocalServerProvider: Refreshing main tree view...');
    console.log(`🔄 LocalServerProvider: Refresh element type: ${element?.type || 'ROOT'}`);
    this._onDidChangeTreeData.fire(element);
    console.log('✅ LocalServerProvider: Main tree refresh event fired');
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
    console.log(`🔍 [LocalServerProvider] getChildren called for: ${element ? `${element.type} - "${element.label}"` : 'ROOT'}`);
    
    // Root level items
    if (!element) {
      console.log('🏠 [LocalServerProvider] Returning root level items');
      return Promise.resolve([
        this.serverTreeProvider.getServersSectionItem(),
        new TreeItem(
          "BabiaXR Visualizations", 
          "Create 3D data visualizations", 
          TreeItemType.BABIAXR_SECTION,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          new vscode.ThemeIcon('graph')
        ),
        new TreeItem(
          'Code Analysis',
          'Analyze code metrics and complexity',
          TreeItemType.ANALYSIS_SECTION,
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          new vscode.ThemeIcon('microscope')
        ),
        new VisualizationSettingsItem(this.context)
      ]);
    }
    
    console.log(`🔍 [LocalServerProvider] Handling element type: ${element.type}`);
    switch (element.type) {
      case TreeItemType.SERVERS_SECTION:
        return this.serverTreeProvider.getServersChildren();
      
      case TreeItemType.SERVER_CONFIG:
        return this.serverTreeProvider.getServerConfigChildren();
      
      case TreeItemType.SERVERS_CONTAINER:
        return this.serverTreeProvider.getActiveServersChildren();
      
      case TreeItemType.BABIAXR_SECTION:
        return this.babiaTreeProvider.getBabiaXRChildren();
      
      case TreeItemType.CREATE_VISUALIZATION:
        return this.babiaTreeProvider.getCreateVisualizationChildren();
      
      case TreeItemType.BABIAXR_CONFIG:
        return this.babiaTreeProvider.getBabiaXRConfigChildren();
      
      case TreeItemType.BABIAXR_EXAMPLES_CONTAINER:
        console.log('🔍 [LocalServerProvider] Handling BABIAXR_EXAMPLES_CONTAINER, delegating to babiaTreeProvider');
        return this.babiaTreeProvider.getBabiaXRExamplesChildren();
      
      case TreeItemType.BABIAXR_EXAMPLE_CATEGORY:
        console.log('🔍 [LocalServerProvider] Handling BABIAXR_EXAMPLE_CATEGORY');
        // If element has children array, return it directly
        if (element.children && Array.isArray(element.children)) {
          return Promise.resolve(element.children);
        }
        return Promise.resolve([]);
      
      case TreeItemType.ANALYSIS_SECTION:
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.ACTIVE_ANALYSES_SECTION:
        console.log('🔍 [LocalServerProvider] Handling ACTIVE_ANALYSES_SECTION, delegating to analysisTreeProvider');
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.ACTIVE_ANALYSIS:
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.FILES_PER_LANGUAGE_CONTAINER:
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.ANALYSIS_SETTINGS:
        return this.analysisTreeProvider.getChildren(element);
      
      case TreeItemType.DIMENSION_MAPPING:
        // ✅ FIX: Check for DimensionMappingItem and call the correct method
        if (element instanceof DimensionMappingItem) {
          return element.getChildren();
        }
        return Promise.resolve([]);
      
      case TreeItemType.VISUALIZATION_SETTINGS:
        if (element instanceof VisualizationSettingsItem) {
          return element.getChildren();
        }
        return Promise.resolve([]);
      
      default:
        return Promise.resolve([]);
    }
  }

  /**
   * Changes the server mode - delegated to ServerTreeProvider
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    await this.serverTreeProvider.changeServerMode(mode);
    this.refresh();
  }

  // Get file system watcher status for debugging
  public getFileSystemWatcherStatus() {
    return this.analysisTreeProvider.getFileSystemWatcherStatus();
  }

  // Dispose method to cleanup resources
  public dispose(): void {
    console.log('🧹 Disposing LocalServerProvider...');
    this.analysisTreeProvider.dispose();
  }
}
