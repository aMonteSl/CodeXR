import * as vscode from 'vscode';
import { TreeItemType } from '../treeProvider';

/**
 * Base class for all tree items
 */
export class TreeItem extends vscode.TreeItem {
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
 * Item for the main sections in the tree
 */
export class SectionItem extends TreeItem {
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