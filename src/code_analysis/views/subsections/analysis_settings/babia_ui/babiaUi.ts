/**
 * CodeXR Mapping UI XR Setting Item
 * Controls whether CodeXR mapping UI is injected into XR chart visualizations.
 */

import * as vscode from 'vscode';
import { CodeAnalysisTreeItem } from '../../../items/analysisItems';
import { AnalysisConfigurationStorage } from '../../../../configuration';

export class BabiaUiSetting {
    private readonly storage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        this.storage = AnalysisConfigurationStorage.getInstance(context);
    }

    async getSettingItem(): Promise<CodeAnalysisTreeItem> {
        const enabled = await this.storage.getXRBabiaUiEnabled();
        const label = `CodeXR Mapping UI (XR): ${enabled ? 'Enabled' : 'Disabled'}`;
        const icon = enabled
            ? new vscode.ThemeIcon('eye', new vscode.ThemeColor('charts.green'))
            : new vscode.ThemeIcon('eye-closed', new vscode.ThemeColor('charts.orange'));

        return new CodeAnalysisTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'subsection',
            {
                command: 'codeXR.analysis.toggleBabiaUiXR',
                title: 'Toggle CodeXR Mapping UI (XR)',
                arguments: [],
            },
            icon,
            enabled
                ? 'CodeXR mapping panel will be included in XR chart analyses. Click to disable.'
                : 'CodeXR mapping panel is not included in XR chart analyses. Click to enable.',
            enabled ? 'Injected into XR output' : 'Not injected into XR output',
            'babiaUiXRSetting',
        );
    }

    async toggleEnabled(): Promise<boolean> {
        const current = await this.storage.getXRBabiaUiEnabled();
        const next = !current;
        await this.storage.setXRBabiaUiEnabled(next);
        return next;
    }

    async setEnabled(enabled: boolean): Promise<void> {
        await this.storage.setXRBabiaUiEnabled(enabled);
    }
}
