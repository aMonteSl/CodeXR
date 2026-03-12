import * as vscode from 'vscode';
import { VisualizationLauncher } from '../views/interactions/visualizationLauncher';
import { VisualizeDataModel } from '../model/visualizeDataModel';
import { VisualizationRestorer, StoredVisualization } from '../runtime/visualizationRestorer';
import { ExtensionCommandRegistration } from '../../commands/shared';

const MODULE = 'VISUALIZE_DATA';
const BROWSE = 'BROWSE-VISUALIZATIONS';

export class VisualizeDataCommands {
    public static getCommandRegistrations(
        context: vscode.ExtensionContext,
    ): ExtensionCommandRegistration[] {
        const withLauncher = (action: (launcher: VisualizationLauncher) => Promise<void>) => {
            return async () => {
                VisualizeDataModel.validateAndCleanState(context);
                const launcher = new VisualizationLauncher(context);
                try {
                    await action(launcher);
                } finally {
                    launcher.cleanup();
                }
            };
        };

        context.subscriptions.push({
            dispose: () => console.log(`${MODULE}: Commands cleanup complete`),
        });

        return [
            {
                id: 'codeXR.visualizeData.chartType',
                module: MODULE,
                description: 'Chart Type selection',
                errorMessage: 'Failed to handle chart type',
                handler: withLauncher(launcher => launcher.handleChartType()),
            },
            {
                id: 'codeXR.visualizeData.selectJson',
                module: MODULE,
                description: 'Select JSON',
                errorMessage: 'Failed to select JSON',
                handler: withLauncher(launcher => launcher.handleSelectJson()),
            },
            {
                id: 'codeXR.visualizeData.dimensionMapping',
                module: MODULE,
                description: 'Dimension Mapping',
                errorMessage: 'Failed to handle dimension mapping',
                handler: withLauncher(launcher => launcher.handleDimensionMapping()),
            },
            {
                id: 'codeXR.visualizeData.mapDimensionField',
                module: MODULE,
                description: 'Map Dimension Field',
                errorMessage: 'Failed to map dimension field',
                handler: async (dimensionName: string) => {
                    VisualizeDataModel.validateAndCleanState(context);
                    const launcher = new VisualizationLauncher(context);
                    try {
                        await launcher.handleDimensionFieldMapping(dimensionName);
                    } finally {
                        launcher.cleanup();
                    }
                },
            },
            {
                id: 'codeXR.visualizeData.launchVisualization',
                module: MODULE,
                description: 'Launch Visualization',
                errorMessage: 'Failed to launch visualization',
                handler: withLauncher(launcher => launcher.handleLaunchVisualization()),
            },
            {
                id: 'codeXR.visualizeData.debugState',
                module: MODULE,
                description: 'Debug State',
                errorMessage: 'Failed to show debug state',
                handler: withLauncher(launcher => launcher.handleDebugState()),
            },
            {
                id: 'codeXR.browseVisualizations.launch',
                module: BROWSE,
                description: 'Launch stored visualization',
                errorMessage: 'Failed to launch visualization',
                handler: async (visualization: StoredVisualization) => {
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
            }
        ];
    }
}
