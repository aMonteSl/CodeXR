import * as vscode from 'vscode';
import { CodeAnalysisCommands } from '../../code_analysis/commands/analysisCommands';

/**
 * Register Code Analysis Commands
 * Entry point for registering all code analysis related commands
 */
export function registerCodeAnalysisCommands(context: vscode.ExtensionContext): void {
    console.log('[CODE_ANALYSIS] Registering code analysis commands...');
    
    CodeAnalysisCommands.registerCommands(context);
    
    console.log('[CODE_ANALYSIS] Code analysis commands registration complete');
}
