import * as vscode from 'vscode';
import { VisualizationSettingsCommands } from '../../visualization_settings/commands/visualizationSettingsCommands';

/**
 * Visualization Settings Commands Wrapper
 * Re-exports visualization settings commands for centralized command registration
 */

/**
 * Registers all visualization settings related commands
 */
export function registerVisualizationSettingsCommands(context: vscode.ExtensionContext): void {
    console.log('VISUALIZATION-SETTINGS: Registering visualization settings commands...');
    
    VisualizationSettingsCommands.registerCommands(context);
    
    console.log('VISUALIZATION-SETTINGS: Visualization settings commands registration complete');
}
