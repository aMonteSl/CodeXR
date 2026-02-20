import * as vscode from 'vscode';
import { VisualizationLauncher } from '../views/interactions/visualizationLauncher';
import { VisualizationRestorer, StoredVisualization } from '../runtime/visualizationRestorer';

/**
 * Visualize Data Commands
 * VS Code command definitions for visualize data functionality
 */
export class VisualizeDataCommands {
    /**
     * Register all visualize data commands
     */
    public static registerCommands(context: vscode.ExtensionContext): void {
        console.log('VISUALIZE_DATA: Registering visualize data commands...');

        // Command: Chart Type selection
        const chartTypeCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.chartType',
            async () => {
                try {
                    console.log('VISUALIZE_DATA: Chart Type command triggered');
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleChartType();
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in chart type command:', error);
                    vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Select JSON File
        const selectJsonCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.selectJson',
            async () => {
                try {
                    console.log('VISUALIZE_DATA: Select JSON command triggered');
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleSelectJson();
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in select JSON command:', error);
                    vscode.window.showErrorMessage(`Failed to select JSON: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Dimension Mapping
        const dimensionMappingCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.dimensionMapping',
            async () => {
                try {
                    console.log('VISUALIZE_DATA: Dimension Mapping command triggered');
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleDimensionMapping();
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in dimension mapping command:', error);
                    vscode.window.showErrorMessage(`Failed to handle dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Map Dimension Field
        const mapDimensionFieldCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.mapDimensionField',
            async (dimensionName: string) => {
                try {
                    console.log(`VISUALIZE_DATA: Map Dimension Field command triggered for: ${dimensionName}`);
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleDimensionFieldMapping(dimensionName);
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in map dimension field command:', error);
                    vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Launch Visualization
        const launchVisualizationCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.launchVisualization',
            async () => {
                try {
                    console.log('VISUALIZE_DATA: Launch Visualization command triggered');
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleLaunchVisualization();
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in launch visualization command:', error);
                    vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Diagnostic - Show current state (for debugging)
        const debugStateCmd = vscode.commands.registerCommand(
            'codeXR.visualizeData.debugState',
            async () => {
                try {
                    console.log('VISUALIZE_DATA: Debug State command triggered');
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleDebugState();
                    launcher.cleanup();
                } catch (error) {
                    console.error('VISUALIZE_DATA: Error in debug state command:', error);
                    vscode.window.showErrorMessage(`Failed to show debug state: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Launch stored visualization
        const launchStoredVisualizationCmd = vscode.commands.registerCommand(
            'codeXR.browseVisualizations.launch',
            async (visualization: StoredVisualization) => {
                try {
                    console.log('BROWSE-VISUALIZATIONS: Launch command triggered for:', visualization.name);
                    const restorer = new VisualizationRestorer(context);
                    await restorer.launchVisualization(visualization);
                } catch (error) {
                    console.error('BROWSE-VISUALIZATIONS: Error launching visualization:', error);
                    vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Command: Reset all visualizations
        const resetAllVisualizationsCmd = vscode.commands.registerCommand(
            'codeXR.browseVisualizations.resetAll',
            async () => {
                try {
                    console.log('BROWSE-VISUALIZATIONS: Reset all command triggered');
                    const restorer = new VisualizationRestorer(context);
                    await restorer.resetAllVisualizations();
                } catch (error) {
                    console.error('BROWSE-VISUALIZATIONS: Error resetting visualizations:', error);
                    vscode.window.showErrorMessage(`Failed to reset visualizations: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        );

        // Register commands with the extension context
        const commandsToRegister = [
            chartTypeCmd,
            selectJsonCmd,
            dimensionMappingCmd,
            mapDimensionFieldCmd,
            launchVisualizationCmd,
            debugStateCmd,
            launchStoredVisualizationCmd,
            resetAllVisualizationsCmd
        ];

        context.subscriptions.push(...commandsToRegister);

        // Store action handler for cleanup
        context.subscriptions.push({
            dispose: () => {
                // No longer needed since we create instances on demand
                console.log('VISUALIZE_DATA: Commands cleanup complete');
            }
        });

        console.log(`VISUALIZE_DATA: Registered ${commandsToRegister.length} visualize data commands`);
    }
}
