import * as vscode from 'vscode';
import { BaseSectionProvider } from '../common/baseInterfaces';
import { VenvManager } from '../../python_env/runtime/venvManager';
import { PythonEnvUiStateService } from '../../python_env/runtime/pythonEnvUiState';
import { PythonEnvItems, PythonEnvModularTreeItem } from '../../python_env/views/items/pythonEnvItems';

/**
 * Python environment section provider for the modular tree view.
 */
export class PythonEnvSectionProvider extends BaseSectionProvider<PythonEnvModularTreeItem> {
    private readonly venvManager: VenvManager;
    private readonly uiState = PythonEnvUiStateService.getInstance();
    private readonly uiStateSubscription: vscode.Disposable;

    constructor(context: vscode.ExtensionContext) {
        super(context);
        this.venvManager = new VenvManager(context);
        this.uiStateSubscription = this.uiState.onDidChangeState(() => this.refresh());
    }

    getSectionName(): string {
        return 'pythonEnv';
    }

    getSectionItem(): PythonEnvModularTreeItem {
        return PythonEnvItems.createSectionItem(
            this.venvManager.getEnvironmentStatus(),
            this.uiState.getState(),
        );
    }

    async getChildren(element?: PythonEnvModularTreeItem): Promise<PythonEnvModularTreeItem[]> {
        if (element) {
            return [];
        }

        return PythonEnvItems.createEnvironmentStatusItems(
            this.venvManager.getEnvironmentStatus(),
            this.uiState.getState(),
        );
    }

    dispose(): void {
        this.uiStateSubscription.dispose();
    }
}
