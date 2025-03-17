import * as vscode from 'vscode';  // Import VS Code API
import * as fs from 'fs';          // For file verification
import * as path from 'path';      // For path handling
import { getActiveServers } from './server'; // For server functionality
import { ChartType } from './models/chartModel'; // For chart types
import { ServerMode, ServerInfo } from './models/serverModel'; // For server models

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
    const extensionPath = this.context.extensionPath;
    const keyPath = path.join(extensionPath, 'certs', 'babia_key.pem');
    const certPath = path.join(extensionPath, 'certs', 'babia_cert.pem');
    const defaultCertsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);
    
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

/**
 * Base class for tree items
 */
class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    tooltip: string,
    contextValue: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    iconPath?: string | vscode.ThemeIcon
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.contextValue = contextValue;
    this.command = command;
    
    if (iconPath) {
      this.iconPath = iconPath;
    }
  }
}

/**
 * Item for the main sections
 */
class SectionItem extends TreeItem {
  constructor(
    label: string,
    tooltip: string,
    contextValue: TreeItemType,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(
      label, 
      tooltip, 
      contextValue, 
      collapsibleState
    );
    
    // Assign icon based on section
    if (contextValue === TreeItemType.SERVERS_SECTION) {
      this.iconPath = new vscode.ThemeIcon('server');
    } else if (contextValue === TreeItemType.BABIAXR_SECTION) {
      this.iconPath = new vscode.ThemeIcon('graph');
    }
  }
}

/**
 * Item to start the server
 */
class StartServerItem extends TreeItem {
  constructor(currentMode: ServerMode, defaultCertsExist: boolean) {
    // Determine description type based on current mode
    let description: string;
    switch(currentMode) {
      case ServerMode.HTTP:
        description = "HTTP mode (no certificates)";
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        description = defaultCertsExist 
          ? "HTTPS with default certificates" 
          : "⚠️ Default certificates not found";
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        description = "HTTPS with custom certificates";
        break;
    }
    
    super(
      'Start Local Server',
      'Start server in ' + currentMode + ' mode\nSelect an HTML file to serve',
      TreeItemType.START_SERVER,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'integracionvsaframe.startServerWithConfig',
        title: 'Start Server'
      },
      new vscode.ThemeIcon('play')
    );
    
    this.description = description;

    // Context for coloring the item in case of warning
    if (currentMode === ServerMode.HTTPS_DEFAULT_CERTS && !defaultCertsExist) {
      this.contextValue = 'warning';
    }
  }
}

/**
 * Item for server configuration
 */
class ServerConfigItem extends TreeItem {
  constructor(context: vscode.ExtensionContext, currentMode: ServerMode) {
    super(
      'Server Configuration',
      'Configuration for the local server',
      TreeItemType.SERVER_CONFIG,
      vscode.TreeItemCollapsibleState.Collapsed,
      undefined,
      new vscode.ThemeIcon('gear')
    );
    
    this.description = currentMode;
  }
}

/**
 * Item for each available server mode
 */
class ServerModeItem extends TreeItem {
  constructor(mode: ServerMode, context: vscode.ExtensionContext) {
    const currentMode = context.globalState.get<ServerMode>('serverMode');
    
    let tooltip: string;
    let iconPath: vscode.ThemeIcon;
    
    // Set explanatory tooltip based on mode
    switch (mode) {
      case ServerMode.HTTP:
        tooltip = 'Use simple HTTP (no encryption)\n⚠️ Does not work with VR devices';
        iconPath = new vscode.ThemeIcon('globe');
        break;
      case ServerMode.HTTPS_DEFAULT_CERTS:
        tooltip = 'Use HTTPS with certificates included in the extension';
        iconPath = new vscode.ThemeIcon('shield');
        break;
      case ServerMode.HTTPS_CUSTOM_CERTS:
        tooltip = 'Use HTTPS with custom certificates (you will need to select them)';
        iconPath = new vscode.ThemeIcon('key');
        break;
    }
    
    super(
      mode,
      tooltip,
      TreeItemType.SERVER_MODE,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'integracionvsaframe.changeServerMode',
        title: 'Change server mode',
        arguments: [mode]
      },
      iconPath
    );
    
    // If it's the current mode, mark as selected
    if (mode === currentMode) {
      this.description = '✓ Selected';
    }
  }
}

/**
 * Item for the active servers container
 */
class ActiveServersContainer extends TreeItem {
  constructor(count: number) {
    super(
      `Active Servers (${count})`,
      'Currently running servers',
      TreeItemType.SERVERS_CONTAINER,
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('server-environment')
    );
  }
}

/**
 * Item for an active server
 */
class ActiveServerItem extends TreeItem {
  constructor(serverInfo: ServerInfo) {
    super(
      path.basename(serverInfo.filePath),
      `${serverInfo.protocol.toUpperCase()} Server
Path: ${serverInfo.filePath}
URL: ${serverInfo.url}
Click to see options`,
      TreeItemType.ACTIVE_SERVER,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'integracionvsaframe.serverOptions',
        title: 'Server Options',
        arguments: [serverInfo]
      },
      new vscode.ThemeIcon(serverInfo.useHttps ? 'shield' : 'globe')
    );
    
    this.description = serverInfo.url;
  }
}

/**
 * Item to create a BabiaXR visualization
 */
class CreateVisualizationItem extends TreeItem {
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
class ChartTypeItem extends TreeItem {
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
