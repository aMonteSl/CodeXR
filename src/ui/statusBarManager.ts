import * as vscode from 'vscode';
import { ServerInfo } from '../server/models/serverModel';

/**
 * Manages the extension's status bar functionality
 */
export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];
  private updateTimer: NodeJS.Timeout | undefined;
  private serverInfo: ServerInfo | undefined;
  
  constructor(private context: vscode.ExtensionContext) {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    
    // Set default state
    this.resetToDefaultState();
    
    // Register the status bar item for disposal
    this.context.subscriptions.push(this.statusBarItem);
    
    // Set up event handlers
    this.registerEventHandlers();
  }
  
  /**
   * Register all event handlers for status bar updates
   */
  private registerEventHandlers(): void {
    // Track editor changes to show/hide based on file type
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (this.serverInfo) {
        // When server is running, always show status bar
        this.statusBarItem.show();
      } else if (editor && (editor.document.languageId === 'javascript' || 
                           editor.document.languageId === 'javascriptreact')) {
        // Only show for JS/JSX files when no server is running
        this.statusBarItem.show();
      } else if (!this.serverInfo) {
        // Hide for non-JS files when no server is running
        this.statusBarItem.hide();
      }
    });
    
    // Track document changes
    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
      if (this.serverInfo) {
        // Don't update if showing server info
        return;
      }
      
      if (vscode.window.activeTextEditor && 
          event.document === vscode.window.activeTextEditor.document &&
          (event.document.languageId === 'javascript' || 
           event.document.languageId === 'javascriptreact')) {
        // Use debouncing to avoid too frequent updates
        if (this.updateTimer) {
          clearTimeout(this.updateTimer);
        }
        
        this.updateTimer = setTimeout(() => {
          // For future metrics implementation
          // this.updateJSMetrics(event.document);
        }, 1000);
      }
    });
    
    // Add disposables to the list
    this.disposables.push(editorChangeDisposable, documentChangeDisposable);
  }
  
  /**
   * Updates the status bar with server information
   */
  public updateServerInfo(serverInfo: ServerInfo): void {
    this.serverInfo = serverInfo;
    
    // Use displayUrl if available, otherwise fall back to url
    const displayUrl = serverInfo.displayUrl || serverInfo.url;
    
    this.statusBarItem.text = `$(globe) Server: ${displayUrl}`;
    this.statusBarItem.tooltip = `${serverInfo.protocol.toUpperCase()} server active\nClick to see options`;
    this.statusBarItem.command = 'codexr.serverStatusActions';
    this.statusBarItem.show();
  }
  
  /**
   * Resets the status bar to default state (no server running)
   */
  public resetToDefaultState(): void {
    this.serverInfo = undefined;
    
    this.statusBarItem.text = '$(code) CodeXR';
    this.statusBarItem.tooltip = 'CodeXR Extension';
    this.statusBarItem.command = 'codexr.showMenu';
    
    // Only show for JS/JSX files in default state
    const editor = vscode.window.activeTextEditor;
    if (editor && (editor.document.languageId === 'javascript' || 
                  editor.document.languageId === 'javascriptreact')) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }
  
  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Clear any pending timers
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }
    
    // Dispose all registered event handlers
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    
    // Status bar item is disposed by the context subscriptions
  }
}

// Create a singleton instance for the extension
let statusBarManagerInstance: StatusBarManager | undefined;

/**
 * Get or create the StatusBarManager instance
 */
export function getStatusBarManager(context: vscode.ExtensionContext): StatusBarManager {
  if (!statusBarManagerInstance) {
    statusBarManagerInstance = new StatusBarManager(context);
  }
  return statusBarManagerInstance;
}

/**
 * Update the status bar with server information (facade for backward compatibility)
 */
export function updateStatusBar(serverInfo: ServerInfo): void {
  if (statusBarManagerInstance) {
    statusBarManagerInstance.updateServerInfo(serverInfo);
  }
}

/**
 * Reset the status bar to default state (facade for backward compatibility)
 */
export function resetStatusBar(): void {
  if (statusBarManagerInstance) {
    statusBarManagerInstance.resetToDefaultState();
  }
}

/**
 * Dispose the status bar (facade for backward compatibility)
 */
export function disposeStatusBar(): void {
  if (statusBarManagerInstance) {
    statusBarManagerInstance.dispose();
    statusBarManagerInstance = undefined;
  }
}