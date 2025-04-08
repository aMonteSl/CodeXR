import * as vscode from 'vscode';
import { TreeItemType } from '../treeProvider';

/**
 * Base class for all tree items
 */
export class TreeItem extends vscode.TreeItem {
  // Add children property
  public children?: TreeItem[];

  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    contextValue: string, // Remove the readonly modifier
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    iconPath?: vscode.ThemeIcon | vscode.Uri
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.contextValue = contextValue;
    
    if (command) {
      this.command = command;
    }
    
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