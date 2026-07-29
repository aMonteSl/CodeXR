import * as vscode from 'vscode';
import { getServerCommandRegistrations } from './servers/serverCommands';
import { getActiveServersCommandRegistrations } from './active_servers/activeServersCommands';
import { getBabiaExamplesCommandRegistrations } from './babia_examples/babiaExamplesCommands';
import { getVisualizeDataCommandRegistrations } from './visualize_data/visualizeDataCommands';
import { getAnalysisCommandRegistrations } from './analysis';
import { getPythonEnvCommandRegistrations } from './python_env/pythonEnvCommands';
import { getVisualizationSettingsCommandRegistrations } from './visualization_settings/visualizationSettingsCommands';
import { getLearnMoreCommandRegistrations } from './learn_more/learnMoreCommands';
import { getGeneralCommandRegistrations } from './common/generalCommands';
import { getCollaborationCommandRegistrations } from './collaboration/collaborationCommands';
import { ExtensionCommandRegistration, assertUniqueCommandIds } from './shared';
import { CommandBuilder } from '../utils/commandBuilder';
import { BabiaExamplesTreeDataProvider } from '../babia_examples/views/babiaExamplesTreeView';
import { DebugThemeProblem } from '../code_analysis/configuration/debugThemeProblem';
import { CodeXRLogger } from '../core/logging/logger';
interface RefreshableTreeProvider {
    refresh(): void;
    refreshSection?(sectionName: string): void;
}
const logger = CodeXRLogger.getLogger('COMMAND_REGISTRATION');
export function registerAllCommands(
    context: vscode.ExtensionContext,
    treeDataProvider?: RefreshableTreeProvider,
    babiaExamplesTreeDataProvider?: BabiaExamplesTreeDataProvider,
): void {
    const analysisRefreshCallback = () => {
        if (!treeDataProvider) {
            return;
        }
        if ('getSectionProvider' in treeDataProvider) {
            const sectionProvider = (treeDataProvider as any).getSectionProvider('analysis');
            if (sectionProvider && typeof sectionProvider.refresh === 'function') {
                logger.debug('Refreshing ANALYSIS through its section provider.');
                sectionProvider.refresh();
                return;
            }
        }
        logger.debug('Refreshing the modular tree through the shared tree provider.');
        treeDataProvider.refresh();
    };
    const registrations: ExtensionCommandRegistration[] = [
        ...getGeneralCommandRegistrations(),
        ...getServerCommandRegistrations(context),
        ...getActiveServersCommandRegistrations(treeDataProvider),
        ...getBabiaExamplesCommandRegistrations(context, babiaExamplesTreeDataProvider),
        ...getVisualizeDataCommandRegistrations(context),
        ...getAnalysisCommandRegistrations(context, analysisRefreshCallback),
        ...getPythonEnvCommandRegistrations(context),
        ...getVisualizationSettingsCommandRegistrations(context),
        ...getCollaborationCommandRegistrations(context, treeDataProvider),
        ...getLearnMoreCommandRegistrations(context),
        ...DebugThemeProblem.getCommandRegistrations(context),
        {
            id: 'CodeXR.helloWorld',
            module: 'GENERAL_COMMANDS',
            description: 'Hello world',
            handler: () => {
                vscode.window.showInformationMessage('Hello World from CodeXR!');
            },
        },
    ];
    assertUniqueCommandIds(registrations);
    CommandBuilder.registerAll(context, registrations);
}

