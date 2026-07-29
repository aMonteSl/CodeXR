import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { ExportSelection } from './exportModeSelection';
import type { ExportManifest } from './exportManifest';

export interface ExportPackageTransaction {
    sourcePath: string;
    destinationPath: string;
    stagingPath: string;
}

function assertDirectChild(parentPath: string, candidatePath: string): void {
    const parent = path.resolve(parentPath);
    const candidate = path.resolve(candidatePath);
    if (path.dirname(candidate) !== parent || candidate === parent) {
        throw new Error(`Unsafe export transaction path: ${candidate}`);
    }
}

function artifactPath(rootPath: string, relativePath: string): string {
    const root = path.resolve(rootPath);
    const candidate = path.resolve(root, relativePath);
    const relative = path.relative(root, candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Unsafe export artifact path: ${candidate}`);
    }
    return candidate;
}

async function removeArtifact(rootPath: string, relativePath: string): Promise<void> {
    await fs.promises.rm(artifactPath(rootPath, relativePath), {
        recursive: true,
        force: true,
    });
}

/**
 * Copy the live output into a private sibling. Nothing appears at the user's
 * final destination until validation has completed and publish() renames this
 * directory atomically.
 */
export async function beginExportPackageTransaction(
    sourcePath: string,
    destinationPath: string,
): Promise<ExportPackageTransaction> {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDestination = path.resolve(destinationPath);
    const destinationParent = path.dirname(resolvedDestination);
    const destinationName = path.basename(resolvedDestination);
    const stagingPath = path.join(
        destinationParent,
        `.${destinationName}.codexr-export-${randomUUID()}`,
    );
    assertDirectChild(destinationParent, resolvedDestination);
    assertDirectChild(destinationParent, stagingPath);
    if (fs.existsSync(resolvedDestination)) {
        throw new Error(`The export destination already exists: ${resolvedDestination}`);
    }

    try {
        await fs.promises.cp(resolvedSource, stagingPath, {
            recursive: true,
            force: false,
            errorOnExist: true,
        });
    } catch (error) {
        await fs.promises.rm(stagingPath, { recursive: true, force: true });
        throw error;
    }
    return {
        sourcePath: resolvedSource,
        destinationPath: resolvedDestination,
        stagingPath,
    };
}

/**
 * A live analysis folder may contain results from every mode. The export
 * selector is authoritative: stale artifacts must never silently reactivate
 * a mode that the user did not choose.
 */
export async function pruneExportPackage(
    stagingPath: string,
    selection: ExportSelection,
): Promise<void> {
    await Promise.all([
        removeArtifact(stagingPath, 'codexr-export-manifest.json'),
        removeArtifact(stagingPath, 'README-EXPORT.md'),
        // Always regenerated when a git-backed mode was selected. Removing it
        // first prevents a failed export from inheriting an older timeline.
        removeArtifact(stagingPath, 'git-revisions'),
        ...(selection.dependencyGraph
            ? []
            : [
                removeArtifact(stagingPath, 'dependencies'),
                removeArtifact(stagingPath, 'dependency-graph.json'),
            ]),
        ...(selection.historicalComparison
            ? []
            : [removeArtifact(stagingPath, 'comparison')]),
        ...(selection.projectEvolution
            ? []
            : [removeArtifact(stagingPath, 'evolution')]),
    ]);
}

function urlToArtifactPath(rootPath: string, url: string): string {
    const cleanUrl = String(url || '').split(/[?#]/, 1)[0].replace(/^\.?\//, '');
    return artifactPath(rootPath, cleanUrl);
}

/**
 * Final, filesystem-level invariant check. Browser behavior has its own
 * harness, but a package with a missing entry point or referenced payload
 * must never be published in the first place.
 */
export async function validateExportPackage(
    stagingPath: string,
    manifest: ExportManifest,
): Promise<void> {
    const requiredRootFiles = [
        'index.html',
        'data.json',
        'xrChartMappingUiRuntime.js',
        'codexr-export-manifest.json',
    ];
    for (const fileName of requiredRootFiles) {
        const filePath = artifactPath(stagingPath, fileName);
        if (!fs.existsSync(filePath) || !(await fs.promises.stat(filePath)).isFile()) {
            throw new Error(`Export validation failed: missing ${fileName}`);
        }
    }

    const urls = new Set<string>();
    for (const entity of manifest.entities) {
        for (const key of ['datasetUrl', 'resultUrl'] as const) {
            if (typeof entity[key] === 'string') {
                urls.add(entity[key] as string);
            }
        }
    }
    for (const source of manifest.gitData?.references.sources || []) {
        urls.add(source.payloadUrl);
    }
    if (
        manifest.gitData?.workingCopyPayloadUrl
        && manifest.gitData.references.sources.some((source) => source.id === 'working-copy')
    ) {
        urls.add(manifest.gitData.workingCopyPayloadUrl);
    }
    for (const url of urls) {
        const filePath = urlToArtifactPath(stagingPath, url);
        if (!fs.existsSync(filePath) || !(await fs.promises.stat(filePath)).isFile()) {
            throw new Error(`Export validation failed: missing payload ${url}`);
        }
    }

    const onDisk = JSON.parse(await fs.promises.readFile(
        artifactPath(stagingPath, 'codexr-export-manifest.json'),
        'utf8',
    )) as ExportManifest;
    if (onDisk.kind !== 'codexr-export' || onDisk.schemaVersion !== manifest.schemaVersion) {
        throw new Error('Export validation failed: invalid manifest');
    }
}

export async function publishExportPackage(
    transaction: ExportPackageTransaction,
): Promise<void> {
    const parent = path.dirname(transaction.destinationPath);
    assertDirectChild(parent, transaction.destinationPath);
    assertDirectChild(parent, transaction.stagingPath);
    if (fs.existsSync(transaction.destinationPath)) {
        throw new Error(`The export destination already exists: ${transaction.destinationPath}`);
    }
    await fs.promises.rename(transaction.stagingPath, transaction.destinationPath);
}

export async function abortExportPackage(
    transaction: ExportPackageTransaction | undefined,
): Promise<void> {
    if (!transaction) {
        return;
    }
    const parent = path.dirname(transaction.destinationPath);
    assertDirectChild(parent, transaction.stagingPath);
    await fs.promises.rm(transaction.stagingPath, { recursive: true, force: true });
}
