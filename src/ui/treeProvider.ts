import * as vscode from 'vscode';
import { ServerMode } from '../server/models/serverModel';
import { AnalysisTreeProvider } from '../analysis/providers/analysisTreeProvider';
import { BabiaTreeProvider } from '../babiaxr/providers/babiaTreeProvider';
import { ServerTreeProvider } from '../server/providers/serverTreeProvider';
import { TreeItem } from './treeItems/baseItems';

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
  JS_FILES_CONTAINER = 'js-files-container'
}

/**
 * Tree data provider implementation for the sidebar view
 */
export class LocalServerProvider implements vscode.TreeDataProvider<TreeItem> {
  // Event emitter to notify data changes
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | void> = 
    new vscode.EventEmitter<TreeItem | undefined | void>();
  
  // Event that VS Code listens to for view updates
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> = 
    this._onDidChangeTreeData.event;
  
  // Extension context for storage access
  private context: vscode.ExtensionContext;

  // Specialized tree providers
  private analysisTreeProvider: AnalysisTreeProvider;
  private babiaTreeProvider: BabiaTreeProvider;
  private serverTreeProvider: ServerTreeProvider;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
    // Initialize specialized providers
    this.analysisTreeProvider = new AnalysisTreeProvider(context);
    this.babiaTreeProvider = new BabiaTreeProvider(context);
    this.serverTreeProvider = new ServerTreeProvider(context);

    // Initialize with default values if no previous configuration exists
    if (!this.context.globalState.get('serverMode')) {
      this.context.globalState.update('serverMode', ServerMode.HTTPS_DEFAULT_CERTS);
    }
  }

  /**
   * Refreshes the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
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
      case TreeItemType.JS_FILES_CONTAINER:
        return this.analysisTreeProvider.getJavaScriptFilesChildren();
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
      this.analysisTreeProvider.getJavaScriptFilesContainer()
    ]);
  }

  /**
   * Changes the server mode - delegated to ServerTreeProvider
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    await this.serverTreeProvider.changeServerMode(mode);
    this.refresh();
  }
}
