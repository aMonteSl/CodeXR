import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { GitRepositoryService } from '../historical/gitRepositoryService';
import { GitExportOutcome, runGitRevisionExport } from './gitRevisionExportCore';
import {
    calculateGitExportWorkerPlan,
    GitRevisionExportRequest,
} from './gitExportOptions';
import { GitTimelineBlobAnalyzer } from './gitTimelineBlobAnalyzer';
import { VenvManager } from '../../python_env/runtime/venvManager';

/**
 * VS Code-side wrapper for the export-time Git analysis. It resolves the
 * private Python environment, chooses the requested adaptive worker count,
 * wires the content-addressed blob analyzer, and reads the destination copy's
 * data.json as the working-copy payload.
 */

interface ExportableSession {
    id: string;
    targetPath: string;
    targetType?: string;
    analysisMode?: string;
    isDeep?: boolean;
}

export interface GitExportPreflight {
    commitCount: number;
    repositoryRoot: string;
}

/**
 * Inspect the repository without materializing or analyzing revisions. The
 * command uses this before asking for a destination so a potentially long
 * export is always an informed user decision.
 */
export async function inspectGitRevisionExport(
    context: vscode.ExtensionContext,
    session: ExportableSession,
): Promise<GitExportPreflight> {
    const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
    const inspectionRoot = path.join(
        privateStorageRoot,
        'export-git',
        session.id,
        `preflight-${randomUUID()}`,
    );
    const gitService = new GitRepositoryService(session.targetPath, inspectionRoot);
    try {
        const repositoryRoot = await gitService.resolveRepositoryRoot();
        const commitCount = await gitService.countTimelineCommits();
        return { commitCount, repositoryRoot };
    } finally {
        await gitService.dispose();
    }
}

export async function exportGitRevisionData(
    context: vscode.ExtensionContext,
    session: ExportableSession,
    destinationPath: string,
    request: GitRevisionExportRequest,
    ui: { progress: vscode.Progress<{ message?: string; increment?: number }>; token: vscode.CancellationToken },
): Promise<GitExportOutcome> {
    const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
    const snapshotRoot = path.join(privateStorageRoot, 'export-git', session.id, 'snapshots');
    const gitService = new GitRepositoryService(session.targetPath, snapshotRoot);
    const pythonExecutable = new VenvManager(context).getPythonExecutablePath();
    if (!pythonExecutable) {
        await gitService.dispose();
        return {
            cancelled: false,
            failureReason: 'The CodeXR Python environment is unavailable.',
        };
    }
    const workerRelativePath = path.join(
        'code_analysis',
        'python',
        'export',
        'git_export_analysis_worker.py',
    );
    const distWorkerPath = path.join(context.extensionPath, 'dist', workerRelativePath);
    const srcWorkerPath = path.join(context.extensionPath, 'src', workerRelativePath);
    const workerScriptPath = fs.existsSync(distWorkerPath) ? distWorkerPath : srcWorkerPath;
    const workerPlan = calculateGitExportWorkerPlan(request.performanceProfile);

    const readWorkingCopyPayload = async (): Promise<unknown> => {
        try {
            const raw = await fs.promises.readFile(path.join(destinationPath, 'data.json'), 'utf8');
            return JSON.parse(raw);
        } catch {
            return undefined;
        }
    };

    return runGitRevisionExport(
        {
            gitService,
            prepareRevisionStore: async (sources) => {
                const references = await gitService.listReferences();
                const analyzer = new GitTimelineBlobAnalyzer({
                    repositoryRoot: references.repositoryRoot,
                    targetRelativePath: references.targetRelativePath,
                    originalTargetPath: session.targetPath,
                    targetType: session.targetType === 'file' ? 'file' : 'directory',
                    recursive: session.isDeep === true,
                    pythonExecutable,
                    workerScriptPath,
                    workerCount: workerPlan.workerCount,
                    temporaryRoot: path.join(snapshotRoot, 'blob-pipeline'),
                    token: ui.token,
                    progress: ui.progress,
                });
                return analyzer.prepare(sources);
            },
            readWorkingCopyPayload,
        },
        {
            targetPath: session.targetPath,
            targetType: session.targetType || 'directory',
            destinationPath,
            request,
            token: ui.token,
            progress: ui.progress,
        },
    );
}
