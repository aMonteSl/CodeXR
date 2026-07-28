import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitRepositoryService } from '../historical/gitRepositoryService';
import { ComparisonSource } from '../historical/historicalComparisonModels';
import { ExecutePython } from '../engine/utils/executePython';
import { GitExportOutcome, runGitRevisionExport } from './gitRevisionExportCore';

/**
 * vscode-side wrapper for the export-time git analysis: wires the standalone
 * GitRepositoryService (with an export-owned snapshot root, since dispose()
 * recursively deletes it), the real Python analyzer in silent mode, and the
 * destination copy's data.json as the working-copy payload.
 */

interface ExportableSession {
    id: string;
    targetPath: string;
    targetType?: string;
    analysisMode?: string;
}

export async function exportGitRevisionData(
    context: vscode.ExtensionContext,
    session: ExportableSession,
    destinationPath: string,
    ui: { progress: vscode.Progress<{ message?: string; increment?: number }>; token: vscode.CancellationToken },
): Promise<GitExportOutcome> {
    const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
    const snapshotRoot = path.join(privateStorageRoot, 'export-git', session.id, 'snapshots');
    const gitService = new GitRepositoryService(session.targetPath, snapshotRoot);
    const executePython = new ExecutePython(context);

    const analyzeSnapshot = async (
        snapshotTargetPath: string,
        source: ComparisonSource,
    ): Promise<Record<string, unknown>[]> => {
        const sha = source.kind === 'gitRef' ? source.commitSha : 'working-copy';
        const revisionSession = {
            ...(session as unknown as Record<string, unknown>),
            id: `${session.id}-export-${String(sha).slice(0, 8)}`,
            targetPath: snapshotTargetPath,
            targetName: path.basename(snapshotTargetPath),
            status: 'analyzing',
            startTime: new Date(),
            requiredFiles: new Map(),
            templatePaths: new Map(),
            metadata: { exportRevisionSource: source },
        };
        const result = await executePython.executeAnalysis(revisionSession as never, { silent: true });
        return Array.isArray(result) ? result : [];
    };

    const readWorkingCopyPayload = async (): Promise<Record<string, unknown>[] | undefined> => {
        try {
            const raw = await fs.promises.readFile(path.join(destinationPath, 'data.json'), 'utf8');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : undefined;
        } catch {
            return undefined;
        }
    };

    return runGitRevisionExport(
        { gitService, analyzeSnapshot, readWorkingCopyPayload },
        {
            targetPath: session.targetPath,
            targetType: session.targetType || 'directory',
            destinationPath,
            token: ui.token,
            progress: ui.progress,
        },
    );
}
