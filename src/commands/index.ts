import * as vscode from 'vscode';
import { registerServerCommands } from './servers/serverCommands';
import { registerActiveServersCommands } from './active_servers/activeServersCommands';
import { registerBabiaExamplesCommands } from './babia_examples/babiaExamplesCommands';
import { registerVisualizeDataCommands } from './visualize_data/visualizeDataCommands';
import { registerCodeAnalysisCommands } from './code_analysis/analysisCommands';
import { registerNewCodeAnalysisCommands } from './new_code_analysis/newCodeAnalysisCommands';
import { registerPythonEnvCommands } from './python_env/pythonEnvCommands';
import { registerVisualizationSettingsCommands } from './visualization_settings/visualizationSettingsCommands';
import { registerGeneralCommands } from './common/generalCommands';
import { BabiaExamplesTreeDataProvider } from '../babia_examples/views/babiaExamplesTreeView';

/**
 * Interface for tree data providers that support refresh
 */
interface RefreshableTreeProvider {
    refresh(): void;
}

/**
 * Entry point that registers all extension commands
 */
export function registerAllCommands(
    context: vscode.ExtensionContext, 
    treeDataProvider?: RefreshableTreeProvider,
    babiaExamplesTreeDataProvider?: BabiaExamplesTreeDataProvider
): void {
    // Register general/common commands first
    registerGeneralCommands(context);
    
    // Register server commands
    registerServerCommands(context);
    
    // Register active servers commands with any refreshable tree data provider
    registerActiveServersCommands(context, treeDataProvider);
    
    // Always register Babia examples commands (they work independently now)
    registerBabiaExamplesCommands(context, babiaExamplesTreeDataProvider);
    
    // Register visualize data commands
    registerVisualizeDataCommands(context);
    
    // Register code analysis commands
    registerCodeAnalysisCommands(context);
    
    // Register new code analysis commands with specific section refresh callback
    const newCodeAnalysisRefreshCallback = () => {
        if (treeDataProvider) {
            // Try to get the specific section provider if it's a ModularTreeDataProvider
            if ('getSectionProvider' in treeDataProvider) {
                const sectionProvider = (treeDataProvider as any).getSectionProvider('newCodeAnalysis');
                if (sectionProvider && typeof sectionProvider.refresh === 'function') {
                    console.log('COMMAND_REGISTRATION: Using specific section provider refresh');
                    sectionProvider.refresh();
                    return;
                }
            }
            // Fallback to general refresh
            console.log('COMMAND_REGISTRATION: Using general tree provider refresh');
            treeDataProvider.refresh();
        }
    };
    registerNewCodeAnalysisCommands(context, newCodeAnalysisRefreshCallback);
    
    // Register Python environment commands
    registerPythonEnvCommands(context);
    
    // Register visualization settings commands
    registerVisualizationSettingsCommands(context);
    
    // Register the existing hello world command
    const helloWorldCommand = vscode.commands.registerCommand('CodeXR.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Code-XR!');
    });
    
    context.subscriptions.push(helloWorldCommand);
}
