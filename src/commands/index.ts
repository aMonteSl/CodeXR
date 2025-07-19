import * as vscode from 'vscode';
import { registerServerCommands } from './servers/serverCommands';
import { registerActiveServersCommands } from './active_servers/activeServersCommands';
import { registerBabiaExamplesCommands } from './babia_examples/babiaExamplesCommands';
import { registerVisualizeDataCommands } from './visualize_data/visualizeDataCommands';
import { registerCodeAnalysisCommands } from './code_analysis/analysisCommands';
import { registerGeneralCommands } from './common/generalCommands';
import { BabiaExamplesTreeDataProvider } from '../babia_examples/views/babiaExamplesTreeView';
import * as pythonEnv from '../python_env';

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
    
    // Register Python environment commands
    pythonEnv.register(context);
    
    // Register the existing hello world command
    const helloWorldCommand = vscode.commands.registerCommand('CodeXR.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Code-XR!');
    });
    
    context.subscriptions.push(helloWorldCommand);
}
