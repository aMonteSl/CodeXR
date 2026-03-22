import * as vscode from 'vscode';
import { registerAllCommands } from './commands/index';
import { initializePythonEnvOnStartup } from './commands/python_env/pythonEnvCommands';
import { XRFieldSchemaService } from './code_analysis/services/xrFieldSchemaService';
import { ModularTreeDataProvider } from './views';
import { CommonCommands } from './utils/commonCommands';
import { ServerSettingsManager } from './servers/storage/serverSettingsManager';
import { GeneratedHttpsCertificateManager } from './servers/runtime/generatedHttpsCertificateManager';
import { getActiveServerRegistry } from './active_servers/registry/activeServerRegistry';
import { ServerControl } from './active_servers/runtime/serverControl';
import { sseManager } from './servers/runtime/sse/SSEManager';
import { fileToServerMap } from './utils/fileToServerMap';
import { ServerWatcherIntegration } from './code_analysis/services/serverWatcherIntegration';
import { CleanAnalysisCommands } from './code_analysis/commands/clean_analysis/cleanAnalysisCommands';
import { AnalysisConfigurationStorage } from './code_analysis/configuration';
import { handleError, ErrorDomain, ErrorSeverity } from './utils/errorHandler';
import { initializeExtensionContext } from './core/extensionContext';
import { CodeXRLogger } from './core/logging/logger';
import { StartupCoordinator } from './core/startup/startupCoordinator';

const startupLogger = CodeXRLogger.getLogger('STARTUP');

let extensionContext: vscode.ExtensionContext;
let globalModularTreeDataProvider: ModularTreeDataProvider | null = null;

export async function activate(context: vscode.ExtensionContext) {
    const activationStartedAt = Date.now();
    extensionContext = context;

    initializeExtensionContext(context);
    CodeXRLogger.initialize(context);

    startupLogger.info('Activating CodeXR.');

    try {
        AnalysisConfigurationStorage.initialize(context);

        const settingsManager = ServerSettingsManager.getInstance(context);
        getActiveServerRegistry();
        ServerControl.initialize(context);

        const modularTreeDataProvider = new ModularTreeDataProvider(context);
        globalModularTreeDataProvider = modularTreeDataProvider;

        const modularTreeView = vscode.window.createTreeView('codexrTree', {
            treeDataProvider: modularTreeDataProvider,
            showCollapseAll: true,
            canSelectMany: false,
        });

        context.subscriptions.push(modularTreeView);
        CommonCommands.setModularTreeProvider(modularTreeDataProvider);
        registerAllCommands(context, modularTreeDataProvider, undefined);

        const startupCoordinator = new StartupCoordinator(
            CodeXRLogger.getLogger('STARTUP_DEFERRED'),
            undefined,
            { maxConcurrent: 3 },
        );
        
        context.subscriptions.push({
            dispose: () => startupCoordinator.dispose(),
        });
        const xrFieldSchemaService = XRFieldSchemaService.getInstance(context);

        startupCoordinator.schedule({
            id: 'restore-server-settings',
            run: async () => {
                await settingsManager.ensureInitialized();
                await new GeneratedHttpsCertificateManager(context).ensureDefaultCertificatePair();
                modularTreeDataProvider.refreshSection('SERVERS');
            },
        });

        startupCoordinator.schedule({
            id: 'initialize-server-watcher-integration',
            run: async () => {
                ServerWatcherIntegration.initialize(context);
            },
        });

        startupCoordinator.schedule({
            id: 'initialize-python-env',
            run: async () => {
                await initializePythonEnvOnStartup();
                await xrFieldSchemaService.prefetchAll();
                modularTreeDataProvider.refreshSection('pythonEnv');
                modularTreeDataProvider.refreshSection('analysis');
            },
        });

        startupCoordinator.schedule({
            id: 'cleanup-stale-analysis-artifacts',
            run: async () => {
                await CleanAnalysisCommands.executeStartupCleanup(context, activationStartedAt);
            },
        });

        startupCoordinator.start();
        startupLogger.info('CodeXR activation completed. Deferred startup tasks queued.');
    } catch (error) {
        startupLogger.error('Extension activation failed.', error);
        vscode.window.showErrorMessage(`CodeXR activation failed: ${error}`);
    }
}

export async function deactivate() {
    startupLogger.info('Deactivating CodeXR.');

    try {
        const registry = getActiveServerRegistry();
        const cleanedCount = registry.cleanupInactiveServers();
        startupLogger.debug(() => `Active server registry cleanup removed ${cleanedCount} inactive servers.`);
    } catch (error) {
        handleError(ErrorDomain.ActiveServers, 'Registry cleanup', error, ErrorSeverity.Warn);
    }

    try {
        sseManager.dispose();
        fileToServerMap.clearAll();
    } catch (error) {
        handleError(ErrorDomain.SSE, 'SSE and file mapping cleanup', error, ErrorSeverity.Warn);
    }

    try {
        if (globalModularTreeDataProvider) {
            globalModularTreeDataProvider.dispose();
            globalModularTreeDataProvider = null;
        }
    } catch (error) {
        handleError(ErrorDomain.UI, 'Modular tree cleanup', error, ErrorSeverity.Warn);
    }
}







