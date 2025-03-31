import * as vscode from 'vscode';
import { ServerInfo } from '../models/serverModel';

// Status bar item for quick access to server actions
let statusBarItem: vscode.StatusBarItem | undefined;

/**
 * Updates the status bar with server information
 * @param serverInfo Server information to display
 */
export function updateStatusBar(serverInfo: ServerInfo): void {
  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  }
  
  // Use displayUrl if available, otherwise fall back to url
  const displayUrl = serverInfo.displayUrl || serverInfo.url;
  
  statusBarItem.text = `$(globe) Server: ${displayUrl}`;
  statusBarItem.tooltip = `${serverInfo.protocol.toUpperCase()} server active\nClick to see options`;
  statusBarItem.command = 'integracionvsaframe.serverStatusActions';
  statusBarItem.show();
}

/**
 * Hides and disposes the status bar item
 */
export function disposeStatusBar(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
}

/**
 * Shows the status bar with the given server info
 * @param serverInfo Server info to display
 */
export function showStatusBar(serverInfo: ServerInfo): void {
  updateStatusBar(serverInfo);
}