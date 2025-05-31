import * as vscode from 'vscode';
import { TreeItemType } from '../treeProvider';

/**
 * Base class for all tree items
 */
export class TreeItem extends vscode.TreeItem {
  public type: TreeItemType; // ✅ Añadir esta propiedad
  // Add children property
  public children?: TreeItem[];

  /**
   * Creates a new tree item
   * @param label Display label for the item
   * @param tooltip Tooltip text
   * @param contextValue Context value for command handling
   * @param collapsibleState Whether this item can be collapsed
   * @param command Command to execute on click
   * @param iconPath Icon for the item
   * @param children Pre-loaded child items (optional)
   */
  constructor(
    label: string,
    tooltip: string,
    type: TreeItemType,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    iconPath?: string | vscode.ThemeIcon,
    children?: TreeItem[]
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.type = type; // ✅ Asignar el tipo
    this.command = command;
    this.iconPath = iconPath;

    if (children) {
      this.children = children;
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