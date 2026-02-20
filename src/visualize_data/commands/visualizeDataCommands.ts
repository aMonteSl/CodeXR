import * as vscode from 'vscode';
import { VisualizationLauncher } from '../views/interactions/visualizationLauncher';
import { VisualizationRestorer, StoredVisualization } from '../runtime/visualizationRestorer';
import { CommandBuilder } from '../../utils/commandBuilder';

const MODULE = 'VISUALIZE_DATA';
const BROWSE = 'BROWSE-VISUALIZATIONS';

/**
 * Visualize Data Commands
 * Uses CommandBuilder for consistent error handling and logging.
 */
export class VisualizeDataCommands {
    public static registerCommands(context: vscode.ExtensionContext): void {
        console.log(`${MODULE}: Registering visualize data commands...`);

        /** Helper: create a launcher, run the action, cleanup. */
        const withLauncher = (action: (l: VisualizationLauncher) => Promise<void>) => async () => {
            const launcher = new VisualizationLauncher(context);
            await action(launcher);
            launcher.cleanup();
        };

        CommandBuilder.registerAll(context, [
            {
                id: 'codeXR.visualizeData.chartType',
                module: MODULE,
                description: 'Chart Type selection',
                errorMessage: 'Failed to handle chart type',
                handler: withLauncher(l => l.handleChartType()),
            },
            {
                id: 'codeXR.visualizeData.selectJson',
                module: MODULE,
                description: 'Select JSON',
                errorMessage: 'Failed to select JSON',
                handler: withLauncher(l => l.handleSelectJson()),
            },
            {
                id: 'codeXR.visualizeData.dimensionMapping',
                module: MODULE,
                description: 'Dimension Mapping',
                errorMessage: 'Failed to handle dimension mapping',
                handler: withLauncher(l => l.handleDimensionMapping()),
            },
            {
                id: 'codeXR.visualizeData.mapDimensionField',
                module: MODULE,
                description: 'Map Dimension Field',
                errorMessage: 'Failed to map dimension field',
                handler: async (dimensionName: string) => {
                    console.log(`${MODULE}: Mapping dimension field for: ${dimensionName}`);
                    const launcher = new VisualizationLauncher(context);
                    await launcher.handleDimensionFieldMapping(dimensionName);
                    launcher.cleanup();
                },
            },
            {
                id: 'codeXR.visualizeData.launchVisualization',
                module: MODULE,
                description: 'Launch Visualization',
                errorMessage: 'Failed to launch visualization',
                handler: withLauncher(l => l.handleLaunchVisualization()),
            },
            {
                id: 'codeXR.visualizeData.debugState',
                module: MODULE,
                description: 'Debug State',
                errorMessage: 'Failed to show debug state',
                handler: withLauncher(l => l.handleDebugState()),
            },
            {
                id: 'codeXR.browseVisualizations.launch',
                module: BROWSE,
                description: 'Launch stored visualization',
                errorMessage: 'Failed to launch visualization',
                handler: async (visualization: StoredVisualization) => {
                    console.log(`${BROWSE}: Launching: ${visualization.name}`);
                    const restorer = new VisualizationRestorer(context);
                    await restorer.launchVisualization(visualization);
                },
            },
            {
                id: 'codeXR.browseVisualizations.resetAll',
                module: BROWSE,
                description: 'Reset all visualizations',
                errorMessage: 'Failed to reset visualizations',
                handler: async () => {
                    const restorer = new VisualizationRestorer(context);
                    await restorer.resetAllVisualizations();
                },
            },
        ]);

        context.subscriptions.push({
            dispose: () => console.log(`${MODULE}: Commands cleanup complete`),
        });
    }
}
