import * as vscode from 'vscode';
import { registerAllCommands } from './commands/index';
import { ModularTreeDataProvider } from './views';
import { CommonCommands } from './utils/commonCommands';
import { ServerSettingsManager } from './servers/storage/serverSettingsManager';
import { getActiveServerRegistry } from './active_servers/registry/activeServerRegistry';
import { VisualizeDataModel } from './visualize_data/model/visualizeDataModel';
import { sseManager } from './servers/runtime/sse/SSEManager';
import { fileToServerMap } from './utils/fileToServerMap';
import { ServerWatcherIntegration } from './new_code_analysis/services/serverWatcherIntegration';

// Global context reference for cleanup
let extensionContext: vscode.ExtensionContext;
let globalModularTreeDataProvider: ModularTreeDataProvider | null = null;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	
	// Store context globally for cleanup
	extensionContext = context;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "CodeXR" is now active!');

	try {
		// Step 1: Initialize server settings manager and restore settings FIRST
		console.log('SERVER: Initializing server settings manager');
		const settingsManager = ServerSettingsManager.getInstance(context);
		await settingsManager.restoreServerSettings();
		console.log('SERVER: Settings restoration completed');

		// Step 2: Initialize active servers registry
		console.log('ACTIVE_SERVERS: Initializing active servers registry');
		const activeServerRegistry = getActiveServerRegistry();
		console.log('ACTIVE_SERVERS: Registry initialized');

		// Step 2.5: Initialize server-watcher integration service
		console.log('SERVER_WATCHER_INTEGRATION: Initializing integration service');
		ServerWatcherIntegration.initialize();
		console.log('SERVER_WATCHER_INTEGRATION: Service initialized');

		// Step 3: Register the modular tree view AFTER settings are restored
		console.log('MODULAR_TREE: Registering modular tree view with all sections');
		const modularTreeDataProvider = new ModularTreeDataProvider(context);
		globalModularTreeDataProvider = modularTreeDataProvider; // Store globally for cleanup
		const modularTreeView = vscode.window.createTreeView('codexrTree', {
			treeDataProvider: modularTreeDataProvider,
			showCollapseAll: true,
			canSelectMany: false
		});

		context.subscriptions.push(modularTreeView);
		console.log('MODULAR_TREE: Tree view registered successfully with all sections');

		// Step 3.5: Set up common commands with the modular tree provider
		console.log('COMMON_COMMANDS: Setting up common commands with modular tree provider');
		CommonCommands.setModularTreeProvider(modularTreeDataProvider);
		console.log('COMMON_COMMANDS: Common commands configured');

		// Step 3.6: Code Analysis will start background scanning automatically when provider is created
		console.log('CODE_ANALYSIS: Background file scanning will start automatically');

		// Step 4: Register all commands after tree views are created
		registerAllCommands(context, modularTreeDataProvider, undefined);

		// Step 5: Reset Visualize Data state to ensure clean UI/model synchronization
		console.log('VISUALIZE-DATA: Resetting state to ensure clean UI/model synchronization');
		VisualizeDataModel.resetVisualizeDataState(context);
		console.log('VISUALIZE-DATA: State reset completed');

		// Step 7: Trigger initial refresh to ensure UI reflects loaded settings
		console.log('MODULAR_TREE: Triggering initial tree view refresh with loaded settings');
		vscode.commands.executeCommand('codexr.tree.refresh');
		
		console.log('MODULAR_TREE: Extension activation completed successfully');
	} catch (error) {
		console.error('MODULAR_TREE: Error during extension activation:', error);
		vscode.window.showErrorMessage(`CodeXR activation failed: ${error}`);
	}
}

// This method is called when your extension is deactivated
export async function deactivate() {
	console.log('MODULAR_TREE: CodeXR extension deactivated');
	
	// Cleanup active servers registry
	try {
		console.log('ACTIVE_SERVERS: Cleaning up active servers registry');
		const registry = getActiveServerRegistry();
		const cleanedCount = registry.cleanupInactiveServers();
		console.log(`ACTIVE_SERVERS: Registry cleanup completed - removed ${cleanedCount} inactive servers`);
	} catch (error) {
		console.error('ACTIVE_SERVERS: Error during registry cleanup:', error);
	}
	
	// Cleanup SSE manager and file-to-server mapping
	try {
		console.log('SSE: Cleaning up SSE manager and file mappings');
		
		sseManager.dispose();
		fileToServerMap.clearAll();
		
		console.log('SSE: SSE and file mapping cleanup completed');
	} catch (error) {
		console.error('SSE: Error during SSE cleanup:', error);
	}

	// Cleanup modular tree data provider and file watchers
	try {
		console.log('MODULAR_TREE: Cleaning up modular tree data provider');
		
		if (globalModularTreeDataProvider) {
			globalModularTreeDataProvider.dispose();
			globalModularTreeDataProvider = null;
		}
		
		console.log('MODULAR_TREE: Modular tree cleanup completed');
	} catch (error) {
		console.error('MODULAR_TREE: Error during modular tree cleanup:', error);
	}
}
