"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualizeDataCommands = void 0;
const vscode = __importStar(require("vscode"));
const visualizationLauncher_1 = require("../views/interactions/visualizationLauncher");
const visualizationRestorer_1 = require("../runtime/visualizationRestorer");
/**
 * Visualize Data Commands
 * VS Code command definitions for visualize data functionality
 */
class VisualizeDataCommands {
    /**
     * Register all visualize data commands
     */
    static registerCommands(context) {
        console.log('VISUALIZE_DATA: Registering visualize data commands...');
        // Command: Chart Type selection
        const chartTypeCmd = vscode.commands.registerCommand('codeXR.visualizeData.chartType', async () => {
            try {
                console.log('VISUALIZE_DATA: Chart Type command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleChartType();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in chart type command:', error);
                vscode.window.showErrorMessage(`Failed to handle chart type: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Select JSON File
        const selectJsonCmd = vscode.commands.registerCommand('codeXR.visualizeData.selectJson', async () => {
            try {
                console.log('VISUALIZE_DATA: Select JSON command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleSelectJson();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in select JSON command:', error);
                vscode.window.showErrorMessage(`Failed to select JSON: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Dimension Mapping
        const dimensionMappingCmd = vscode.commands.registerCommand('codeXR.visualizeData.dimensionMapping', async () => {
            try {
                console.log('VISUALIZE_DATA: Dimension Mapping command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDimensionMapping();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in dimension mapping command:', error);
                vscode.window.showErrorMessage(`Failed to handle dimension mapping: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Map Dimension Field
        const mapDimensionFieldCmd = vscode.commands.registerCommand('codeXR.visualizeData.mapDimensionField', async (dimensionName) => {
            try {
                console.log(`VISUALIZE_DATA: Map Dimension Field command triggered for: ${dimensionName}`);
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDimensionFieldMapping(dimensionName);
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in map dimension field command:', error);
                vscode.window.showErrorMessage(`Failed to map dimension field: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Launch Visualization
        const launchVisualizationCmd = vscode.commands.registerCommand('codeXR.visualizeData.launchVisualization', async () => {
            try {
                console.log('VISUALIZE_DATA: Launch Visualization command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleLaunchVisualization();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in launch visualization command:', error);
                vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Diagnostic - Show current state (for debugging)
        const debugStateCmd = vscode.commands.registerCommand('codeXR.visualizeData.debugState', async () => {
            try {
                console.log('VISUALIZE_DATA: Debug State command triggered');
                const launcher = new visualizationLauncher_1.VisualizationLauncher(context);
                await launcher.handleDebugState();
                launcher.cleanup();
            }
            catch (error) {
                console.error('VISUALIZE_DATA: Error in debug state command:', error);
                vscode.window.showErrorMessage(`Failed to show debug state: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Launch stored visualization
        const launchStoredVisualizationCmd = vscode.commands.registerCommand('codeXR.browseVisualizations.launch', async (visualization) => {
            try {
                console.log('BROWSE-VISUALIZATIONS: Launch command triggered for:', visualization.name);
                const restorer = new visualizationRestorer_1.VisualizationRestorer(context);
                await restorer.launchVisualization(visualization);
            }
            catch (error) {
                console.error('BROWSE-VISUALIZATIONS: Error launching visualization:', error);
                vscode.window.showErrorMessage(`Failed to launch visualization: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        // Command: Reset all visualizations
        const resetAllVisualizationsCmd = vscode.commands.registerCommand('codeXR.browseVisualizations.resetAll', async () => {
            try {
                console.log('BROWSE-VISUALIZATIONS: Reset all command triggered');
                const restorer = new visualizationRestorer_1.VisualizationRestorer(context);
                await restorer.resetAllVisualizations();
            }
            catch (error) {
                console.error('BROWSE-VISUALIZATIONS: Error resetting visualizations:', error);
                vscode.window.showErrorMessage(`Failed to reset visualizations: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
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
exports.VisualizeDataCommands = VisualizeDataCommands;
//# sourceMappingURL=visualizeDataCommands.js.map