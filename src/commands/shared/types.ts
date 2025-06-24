import * as vscode from 'vscode';

/**
 * Shared types for command operations
 */

/**
 * Result of server conflict resolution
 */
export type ServerConflictAction = 'proceed' | 'open' | 'cancel';

/**
 * Tree display configuration option
 */
export interface TreeDisplayOption {
  label: string;
  description: string;
  action: string;
}

/**
 * Chart type option for analysis
 */
export interface ChartTypeOption {
  label: string;
  value: string;
  description: string;
}

/**
 * Command registration result
 */
export interface CommandRegistration {
  disposables: vscode.Disposable[];
}