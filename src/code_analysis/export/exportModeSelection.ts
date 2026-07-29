import { ExportServerCapabilities } from './exportManifest';

/**
 * The export modal's item model, kept vscode-free so the selection logic is
 * unit-testable: the command layer maps these onto QuickPick items 1:1.
 */

export type ExportModeId = 'normal' | 'dependency-graph' | 'historical' | 'evolution';

export interface ExportModeItem {
    label: string;
    description: string;
    picked: boolean;
    modeId: ExportModeId;
}

export interface ExportSelection {
    cancelled: boolean;
    /** The base scene and data.json are required to boot every XR export. */
    normal: true;
    dependencyGraph: boolean;
    historicalComparison: boolean;
    projectEvolution: boolean;
    /**
     * True when historical and/or evolution were picked: both feed from the
     * same per-revision payloads, so one shared git analysis covers either.
     */
    gitTimeline: boolean;
}

/**
 * Build the modal's items from what the session can actually do. Modes whose
 * capability is off are omitted entirely (QuickPick has no disabled state).
 * The normal analysis is the scene itself, so it is always present, always
 * pre-picked, and unticking it is ignored downstream.
 */
export function buildExportModeItems(capabilities: ExportServerCapabilities): ExportModeItem[] {
    const items: ExportModeItem[] = [{
        label: 'Normal analysis',
        description: 'Base XR scene, always included',
        picked: true,
        modeId: 'normal',
    }];
    if (capabilities.dependencyGraph) {
        items.push({
            label: 'Dependency graph',
            description: 'Ships the dependency dataset (generated now if missing)',
            picked: true,
            modeId: 'dependency-graph',
        });
    }
    if (capabilities.historicalComparison) {
        items.push({
            label: 'Historical comparison',
            description: 'Pre-analyzes all or the latest N Git commits for offline comparisons',
            picked: true,
            modeId: 'historical',
        });
    }
    if (capabilities.projectEvolution) {
        items.push({
            label: 'Project evolution',
            description: 'Shares the selected Git timeline with historical comparison, no duplicate work',
            picked: true,
            modeId: 'evolution',
        });
    }
    return items;
}

/**
 * Interpret what the QuickPick returned: `undefined` is cancel (abort the
 * export), an empty array is "just the base copy". Normal is always included
 * whatever the ticks say.
 */
export function interpretExportSelection(
    selected: ExportModeItem[] | undefined,
): ExportSelection {
    if (!selected) {
        return {
            cancelled: true,
            normal: true,
            dependencyGraph: false,
            historicalComparison: false,
            projectEvolution: false,
            gitTimeline: false,
        };
    }
    const picked = new Set(selected.map((item) => item.modeId));
    const historicalComparison = picked.has('historical');
    const projectEvolution = picked.has('evolution');
    return {
        cancelled: false,
        normal: true,
        dependencyGraph: picked.has('dependency-graph'),
        historicalComparison,
        projectEvolution,
        gitTimeline: historicalComparison || projectEvolution,
    };
}
