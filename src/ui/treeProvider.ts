import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveServers } from '../server/serverManager';
import { ChartType } from '../models/chartModel';
import { ServerMode, ServerInfo } from '../models/serverModel';
import { defaultCertificatesExist } from '../server/certificateManager';

// Import tree items from separate modules
import { TreeItem, SectionItem } from './treeItems/baseItems';
import { 
  ServerConfigItem, 
  ServerModeItem, 
  StartServerItem, 
  ActiveServersContainer, 
  ActiveServerItem 
} from './treeItems/serverItems';
import { 
  CreateVisualizationItem, 
  ChartTypeItem 
} from './treeItems/chartItems';

// Types of tree items for context handling
export enum TreeItemType {
  SERVERS_SECTION = 'servers-section',
  BABIAXR_SECTION = 'babiaxr-section',
  SERVER_CONFIG = 'server-config',
  SERVER_MODE = 'server-mode',
  START_SERVER = 'start-server',
  ACTIVE_SERVER = 'active-server',
  SERVERS_CONTAINER = 'servers-container',
  CREATE_VISUALIZATION = 'create-visualization',
  CHART_TYPE = 'chart-type'
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

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    
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
  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (!element) {
      // Root elements - Main sections
      return Promise.resolve([
        new SectionItem(
          "Servers", 
          "Local server management", 
          TreeItemType.SERVERS_SECTION,
          vscode.TreeItemCollapsibleState.Expanded
        ),
        new SectionItem(
          "BabiaXR Visualizations", 
          "Create 3D data visualizations", 
          TreeItemType.BABIAXR_SECTION,
          vscode.TreeItemCollapsibleState.Expanded
        )
      ]);
    }
    
    // Handle child nodes based on parent element type
    switch(element.contextValue) {
      case TreeItemType.SERVERS_SECTION:
        return this.getServersSectionChildren();
      
      case TreeItemType.BABIAXR_SECTION:
        return this.getBabiaXRSectionChildren();
      
      case TreeItemType.SERVER_CONFIG:
        return this.getServerConfigChildren();
      
      case TreeItemType.SERVERS_CONTAINER:
        return this.getActiveServersChildren();
      
      case TreeItemType.CREATE_VISUALIZATION:
        return this.getChartTypesChildren();
      
      default:
        return Promise.resolve([]);
    }
  }

  /**
   * Gets the child elements of the servers section
   */
  private getServersSectionChildren(): Thenable<TreeItem[]> {
    const currentMode = this.context.globalState.get<ServerMode>('serverMode') || 
      ServerMode.HTTPS_DEFAULT_CERTS;
    
    // Check if default certificates exist
    const defaultCertsExist = defaultCertificatesExist(this.context);
    
    // Get active servers
    const activeServers = getActiveServers();
    
    const children: TreeItem[] = [
      new ServerConfigItem(this.context, currentMode),
      new StartServerItem(currentMode, defaultCertsExist)
    ];
    
    // If there are active servers, add the servers container
    if (activeServers.length > 0) {
      children.push(new ActiveServersContainer(activeServers.length));
    }
    
    return Promise.resolve(children);
  }

  /**
   * Gets the child elements of the BabiaXR section
   */
  private getBabiaXRSectionChildren(): Thenable<TreeItem[]> {
    return Promise.resolve([
      new CreateVisualizationItem()
      // You could add more items like "Recent Visualizations" if you implement them
    ]);
  }

  /**
   * Gets the server configuration options
   */
  private getServerConfigChildren(): Thenable<TreeItem[]> {
    const currentMode = this.context.globalState.get<ServerMode>('serverMode');
    return Promise.resolve([
      new ServerModeItem(ServerMode.HTTP, this.context),
      new ServerModeItem(ServerMode.HTTPS_DEFAULT_CERTS, this.context),
      new ServerModeItem(ServerMode.HTTPS_CUSTOM_CERTS, this.context)
    ]);
  }

  /**
   * Gets the list of active servers
   */
  private getActiveServersChildren(): Thenable<TreeItem[]> {
    const activeServers = getActiveServers();
    return Promise.resolve(
      activeServers.map(server => new ActiveServerItem(server))
    );
  }

  /**
   * Gets the available chart types
   */
  private getChartTypesChildren(): Thenable<TreeItem[]> {
    return Promise.resolve([
      new ChartTypeItem(
        ChartType.BAR_CHART,
        "Visualize categorical data with bars"
      ),
      new ChartTypeItem(
        ChartType.PIE_CHART,
        "Visualize proportions as circular sectors"
      )
    ]);
  }

  /**
   * Changes the server mode
   */
  async changeServerMode(mode: ServerMode): Promise<void> {
    if (mode === ServerMode.HTTP) {
      // Warn about limitations on VR devices
      const selection = await vscode.window.showWarningMessage(
        'HTTP mode is not compatible with virtual reality devices due to security restrictions. ' +
        'Do you want to continue?',
        'Yes, I understand', 'Cancel'
      );
      
      if (selection !== 'Yes, I understand') {
        return;
      }
    }
    
    // Save the selected mode
    await this.context.globalState.update('serverMode', mode);
    this.refresh();
  }
}
