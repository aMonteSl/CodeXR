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
  AnalysisModeOptionItem
} from '../analysis/tree/analysisTreeItems';

// Types of tree items for context handling
export enum TreeItemType {
  SERVERS_SECTION = 'servers-section',
  BABIAXR_SECTION = 'babiaxr-section',
  SERVER_CONFIG = 'server-config',
  SERVER_MODE = 'server-mode',
  START_SERVER = 'start-server',
  ACTIVE_SERVER = 'active-server',
  SERVERS_CONTAINER = 'serverContainer',
  CHART_TYPE = 'chart-type',
  CREATE_VISUALIZATION = 'create-visualization',
  BABIAXR_CONFIG = 'babiaxr-config',
  BABIAXR_CONFIG_ITEM = 'babiaxr-config-item',
  BABIAXR_EXAMPLES_CONTAINER = 'babiaxr-examples-container',
  BABIAXR_EXAMPLE = 'babiaxr-example',
  BABIAXR_EXAMPLE_CATEGORY = 'example-category',
  JS_FILE = 'js-file',
  JS_FILES_CONTAINER = 'js-files-container',
  ANALYSIS_FILES_CONTAINER = 'analysis-files-container',
  ANALYSIS_FILE = 'analysis-file',
  ANALYSIS_SECTION = 'analysis-section',
  ANALYSIS_LANGUAGE_GROUP = 'analysis-language-group',
  ANALYSIS_MESSAGE = 'analysis-message',
  ANALYSIS_SETTINGS = 'analysis-settings',
  ANALYSIS_SETTING_OPTION = 'analysis-setting-option'
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
    if (!element) {
      return this.getRootChildren();
    }
    
    switch (element.contextValue) {
      case TreeItemType.SERVERS_SECTION:
        return this.serverTreeProvider.getServersChildren();
      case TreeItemType.BABIAXR_SECTION:
        // Get BabiaXR children
        return this.babiaTreeProvider.getBabiaXRChildren();
      case TreeItemType.SERVER_CONFIG:
        return this.serverTreeProvider.getServerConfigChildren();
      case TreeItemType.SERVERS_CONTAINER:
        return this.serverTreeProvider.getActiveServersChildren();
      case TreeItemType.BABIAXR_CONFIG:
        return this.babiaTreeProvider.getBabiaXRConfigChildren();
      case TreeItemType.BABIAXR_EXAMPLES_CONTAINER:
        return this.babiaTreeProvider.getBabiaXRExamplesChildren();
      case TreeItemType.CREATE_VISUALIZATION:
        return this.babiaTreeProvider.getCreateVisualizationChildren();
      case TreeItemType.BABIAXR_EXAMPLE_CATEGORY:
        if (element.children && element.children.length > 0) {
          return Promise.resolve(element.children);
        }
        return Promise.resolve([]);
      // Add the Code Analysis cases
      case TreeItemType.ANALYSIS_SECTION:
        return getAnalysisChildren(this.context);
      case TreeItemType.ANALYSIS_LANGUAGE_GROUP:
        return getLanguageGroupChildren(element);
      case TreeItemType.ANALYSIS_SETTINGS:
        return this.getSettingsChildren(this.context.extensionUri.fsPath);
      default:
        return Promise.resolve([]);
    }
  }

  /**
   * Gets the root elements
   */
  private getRootChildren(): Thenable<TreeItem[]> {
    return Promise.resolve([
      this.serverTreeProvider.getServersSectionItem(),
      this.babiaTreeProvider.getBabiaXRSectionItem(),
      getAnalysisSectionItem(this.context.extensionUri.fsPath)
    ]);
  }

  /**
   * Gets settings child items
   * @param extensionPath Path to the extension
   * @returns Settings option items
   */
  private async getSettingsChildren(extensionPath: string): Promise<TreeItem[]> {
    console.log('Generating settings children items');
    const config = vscode.workspace.getConfiguration();
    const currentMode = config.get<string>('codexr.analysisMode', 'Static');
    
    console.log('Current analysis mode:', currentMode);
    
    // Create option items for each analysis mode
    const staticOption = new AnalysisModeOptionItem('Static', currentMode === 'Static', extensionPath);
    const xrOption = new AnalysisModeOptionItem('XR', currentMode === 'XR', extensionPath);
    
    return [staticOption, xrOption];
  }

  /**
   * Changes the server mode - delegated to ServerTreeProvider
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    await this.serverTreeProvider.changeServerMode(mode);
    this.refresh();
  }
}
