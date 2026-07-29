import * as fs from 'fs';
import * as path from 'path';
import { ExportGitData } from './gitRevisionExportCore';
import type { ExportSelection } from './exportModeSelection';

/**
 * Self-contained export support.
 *
 * "Export Analysis Folder" copies a session's generated folder verbatim, which
 * is enough for the classic analysis but leaves the dependency graph,
 * historical comparison and project evolution dead: their availability and
 * dataset URLs only ever travel over the live server's collaboration WebSocket,
 * and every artifact URL the server writes is root-absolute (`/comparison/…`),
 * which breaks the moment the copy is served under a sub-path.
 *
 * This module runs against the DESTINATION copy only (the live session folder
 * is never touched) and closes that gap:
 *  - `relativizeExportArtifacts` rewrites the artifact URLs to `./` relative;
 *  - `buildExportManifest` writes `codexr-export-manifest.json`, the offline
 *    stand-in for the collaboration session: replay capabilities plus the same
 *    entity snapshots the room would have delivered;
 *  - `refreshRuntimeCopies` re-assembles the runtime JS files already present
 *    in the copy from the current templates, so folders generated before the
 *    offline mode existed still export runtimes that understand it;
 *  - `writeExportReadme` documents how to serve the folder.
 *
 * Deliberately vscode-free (fs/path only) so the unit tests can require the
 * compiled module directly.
 */

export const EXPORT_MANIFEST_FILE_NAME = 'codexr-export-manifest.json';
export const EXPORT_README_FILE_NAME = 'README-EXPORT.md';

/** Root-level file that unmistakably marks an XR scene folder. */
const XR_SCENE_MARKER = 'xrChartMappingUiRuntime.js';

export interface ExportServerCapabilities {
    dependencyGraph: boolean;
    historicalComparison: boolean;
    projectEvolution: boolean;
}

export interface ExportManifestOptions {
    target: { name: string; type: string; analysisMode: string };
    serverCapabilities: ExportServerCapabilities;
    /** Set when the pre-export dependency analysis failed or timed out. */
    dependencyGraphFailureReason?: string;
    /**
     * The analysis view active when the user exported, straight from the
     * refresh coordinator. Deliberately an opaque mode string: whatever modes
     * exist now or in the future, the export lands the scene exactly where
     * the user left it.
     */
    viewState?: { mode: string; controllerView?: string };
    /**
     * Shared per-revision git payloads produced at export time. Present only
     * when the user selected historical/evolution in the export modal and the
     * timeline analysis produced usable data. Runtimes gate on its PRESENCE,
     * never on schemaVersion, so older manifests keep their replay behavior.
     */
    gitData?: ExportGitData;
    /** Set when git data was selected but could not be produced. */
    gitDataFailureReason?: string;
    /** True when the user ticked historical/evolution in the modal. */
    gitDataSelected?: boolean;
    /** Exact modal selection. Omitted only by legacy callers/tests. */
    selectedModes?: ExportSelection;
}

interface ComparisonReplayEntry {
    revision: number;
    url: string;
    leftLabel: string;
    rightLabel: string;
    generatedAt: string;
}

export interface ExportManifest {
    schemaVersion: number;
    kind: 'codexr-export';
    exportedAt: string;
    target: { name: string; type: string; analysisMode: string };
    selectedModes: {
        normal: true;
        dependencyGraph: boolean;
        historicalComparison: boolean;
        projectEvolution: boolean;
    };
    capabilities: {
        dependencyGraph: boolean;
        dependencyGraphReason: string;
        historicalComparison: boolean;
        historicalComparisonReason: string;
        projectEvolution: boolean;
        projectEvolutionReason: string;
    };
    entities: Record<string, unknown>[];
    historicalComparison: { comparisons: ComparisonReplayEntry[] };
    gitData?: ExportGitData;
}

export function isXrSceneFolder(folderPath: string): boolean {
    return fs.existsSync(path.join(folderPath, XR_SCENE_MARKER));
}

/** `/comparison/x.json` → `./comparison/x.json`; anything else unchanged. */
function relativizeUrl(value: unknown): unknown {
    if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) {
        return `.${value}`;
    }
    return value;
}

async function readJsonIfPresent(filePath: string): Promise<Record<string, unknown> | undefined> {
    try {
        return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as Record<string, unknown>;
    } catch {
        return undefined;
    }
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

/** Numbered artifacts, newest first: `prefix-<n>.json` (no other suffix). */
function listNumberedArtifacts(dirPath: string, pattern: RegExp): { revision: number; fileName: string }[] {
    if (!fs.existsSync(dirPath)) {
        return [];
    }
    return fs.readdirSync(dirPath)
        .map((fileName) => {
            const match = pattern.exec(fileName);
            return match ? { revision: Number(match[1]), fileName } : undefined;
        })
        .filter((entry): entry is { revision: number; fileName: string } => entry !== undefined)
        .sort((a, b) => b.revision - a.revision);
}

function resolveSelectedModes(options: ExportManifestOptions): ExportManifest['selectedModes'] {
    const selected = options.selectedModes;
    if (selected) {
        return {
            normal: true,
            dependencyGraph: selected.dependencyGraph === true,
            historicalComparison: selected.historicalComparison === true,
            projectEvolution: selected.projectEvolution === true,
        };
    }
    // Backward-compatible default for callers created before schema v3. The
    // real export command always supplies selectedModes.
    return {
        normal: true,
        dependencyGraph: options.serverCapabilities.dependencyGraph,
        historicalComparison: options.serverCapabilities.historicalComparison,
        projectEvolution: options.serverCapabilities.projectEvolution,
    };
}

function defaultControllerView(mode: string): string {
    switch (mode) {
        case 'selection':
            return 'visualization-menu';
        case 'dependency-graph':
            return 'dependency.settings';
        case 'historical-compare':
            return 'historical.selection';
        case 'project-evolution':
            return 'project-evolution';
        default:
            return 'single.mapping';
    }
}

/**
 * Rewrite the root-absolute artifact URLs inside the copied result files to
 * `./` relative, so the export works when served under any sub-path.
 * Idempotent: already-relative URLs pass through untouched.
 */
export async function relativizeExportArtifacts(destinationPath: string): Promise<number> {
    let rewritten = 0;

    const comparisonDir = path.join(destinationPath, 'comparison');
    for (const entry of listNumberedArtifacts(comparisonDir, /^revision-(\d+)\.json$/)) {
        const filePath = path.join(comparisonDir, entry.fileName);
        const result = await readJsonIfPresent(filePath);
        if (!result) {
            continue;
        }
        let changed = false;
        for (const side of ['left', 'right'] as const) {
            const dataset = result[side] as Record<string, unknown> | undefined;
            if (dataset && typeof dataset === 'object') {
                const relative = relativizeUrl(dataset.url);
                if (relative !== dataset.url) {
                    dataset.url = relative;
                    changed = true;
                }
            }
        }
        if (changed) {
            await writeJson(filePath, result);
            rewritten += 1;
        }
    }

    const evolutionDir = path.join(destinationPath, 'evolution');
    if (fs.existsSync(evolutionDir)) {
        const revisionDirs = fs.readdirSync(evolutionDir).filter((name) => /^revision-\d+$/.test(name));
        for (const revisionDirName of revisionDirs) {
            const manifestPath = path.join(evolutionDir, revisionDirName, 'manifest.json');
            const result = await readJsonIfPresent(manifestPath);
            if (!result) {
                continue;
            }
            let changed = false;
            for (const key of ['manifestUrl', 'bridgeUrl'] as const) {
                const relative = relativizeUrl(result[key]);
                if (relative !== result[key]) {
                    result[key] = relative;
                    changed = true;
                }
            }
            const frames = Array.isArray(result.frames) ? result.frames : [];
            for (const frame of frames as Record<string, unknown>[]) {
                const relative = relativizeUrl(frame?.url);
                if (frame && relative !== frame.url) {
                    frame.url = relative;
                    changed = true;
                }
            }
            if (changed) {
                await writeJson(manifestPath, result);
                rewritten += 1;
            }
        }
    }

    return rewritten;
}

/**
 * Stamp export-only runtime configuration into the copied HTML. Collaboration
 * remains enabled long enough to load the offline manifest, but live screen
 * broadcast must be disabled synchronously: otherwise that independent
 * runtime opens and retries `/codexr-broadcast` before manifest discovery.
 */
export async function configureOfflineExportHtml(destinationPath: string): Promise<boolean> {
    const indexPath = path.join(destinationPath, 'index.html');
    if (!fs.existsSync(indexPath)) {
        return false;
    }
    const original = await fs.promises.readFile(indexPath, 'utf8');
    const updateConfig = (
        html: string,
        scriptId: string,
        values: Record<string, unknown>,
    ): string => {
        const escapedId = scriptId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
            `(<script\\b[^>]*\\bid=["']${escapedId}["'][^>]*>)([\\s\\S]*?)(<\\/script>)`,
            'i',
        );
        const match = pattern.exec(html);
        if (!match) {
            return html;
        }
        let config: Record<string, unknown>;
        try {
            config = JSON.parse(match[2]) as Record<string, unknown>;
        } catch {
            return html;
        }
        Object.assign(config, values);
        const replacement = `${match[1]}${JSON.stringify(config)}${match[3]}`;
        return html.slice(0, match.index)
            + replacement
            + html.slice(match.index + match[0].length);
    };

    // These blocks precede every runtime script in generated XR HTML. The
    // marker prevents even a single optimistic request to live-only CodeXR
    // endpoints; the manifest remains the collaboration snapshot substitute.
    let updated = updateConfig(original, 'codexr-tooling-config-collaboration', {
        offlineExport: true,
    });
    updated = updateConfig(updated, 'codexr-tooling-config-virtual-screen', {
        broadcastEnabled: false,
        offlineExport: true,
    });
    if (updated !== original) {
        await fs.promises.writeFile(indexPath, updated, 'utf8');
        return true;
    }
    return false;
}

/**
 * Build and write `codexr-export-manifest.json` from the artifacts present in
 * the destination copy. Must run AFTER `relativizeExportArtifacts` so the
 * snapshots it derives already carry relative URLs.
 *
 * Entity snapshots mirror exactly what the live server upserts into the
 * collaboration room, so the runtimes can consume them through the same
 * applySharedState path a room snapshot uses. The two git-mode entities carry
 * a `resultUrl` instead of the embedded result: the collaboration client
 * fetches it at injection time, which keeps the manifest small no matter how
 * large a comparison delta grew.
 */
export async function buildExportManifest(
    destinationPath: string,
    options: ExportManifestOptions,
): Promise<ExportManifest> {
    const entities: Record<string, unknown>[] = [];
    const comparisons: ComparisonReplayEntry[] = [];
    const selectedModes = resolveSelectedModes(options);

    const dependencyDatasets = listNumberedArtifacts(
        path.join(destinationPath, 'dependencies'),
        /^dependency-graph-(\d+)\.json$/,
    );
    const dependencyReady = selectedModes.dependencyGraph
        && options.serverCapabilities.dependencyGraph
        && dependencyDatasets.length > 0;
    if (dependencyReady) {
        const newest = dependencyDatasets[0];
        const dataset = await readJsonIfPresent(path.join(destinationPath, 'dependencies', newest.fileName));
        entities.push({
            entityKind: 'dependency-graph',
            entityId: 'main',
            mode: 'dependency-graph',
            status: 'ready',
            message: 'Exported dependency graph.',
            datasetUrl: `./dependencies/${newest.fileName}`,
            revision: newest.revision,
            ...(dataset && dataset.sourceRevision !== undefined
                ? { sourceRevision: dataset.sourceRevision }
                : {}),
        });
    }

    const comparisonDir = path.join(destinationPath, 'comparison');
    const comparisonArtifacts = selectedModes.historicalComparison
        ? listNumberedArtifacts(comparisonDir, /^revision-(\d+)\.json$/)
        : [];
    for (const entry of comparisonArtifacts) {
        const result = await readJsonIfPresent(path.join(comparisonDir, entry.fileName));
        if (!result) {
            continue;
        }
        const left = result.left as { source?: { label?: string } } | undefined;
        const right = result.right as { source?: { label?: string } } | undefined;
        comparisons.push({
            revision: entry.revision,
            url: `./comparison/${entry.fileName}`,
            leftLabel: String(left?.source?.label ?? ''),
            rightLabel: String(right?.source?.label ?? ''),
            generatedAt: String(result.generatedAt ?? ''),
        });
    }
    const historicalArtifactReady = selectedModes.historicalComparison
        && options.serverCapabilities.historicalComparison
        && comparisons.length > 0;
    if (historicalArtifactReady) {
        entities.push({
            entityKind: 'historical-comparison',
            entityId: 'main',
            mode: 'historical-compare',
            resultUrl: comparisons[0].url,
        });
    }

    const evolutionRevisions = selectedModes.projectEvolution
        && fs.existsSync(path.join(destinationPath, 'evolution'))
        ? fs.readdirSync(path.join(destinationPath, 'evolution'))
            .map((name) => /^revision-(\d+)$/.exec(name))
            .filter((match): match is RegExpExecArray => match !== null)
            .map((match) => Number(match[1]))
            .sort((a, b) => b - a)
        : [];
    const evolutionArtifactReady = selectedModes.projectEvolution
        && options.serverCapabilities.projectEvolution
        && evolutionRevisions.length > 0
        && fs.existsSync(path.join(destinationPath, 'evolution', `revision-${evolutionRevisions[0]}`, 'manifest.json'));
    if (evolutionArtifactReady) {
        entities.push({
            entityKind: 'project-evolution',
            entityId: 'main',
            mode: 'project-evolution',
            resultUrl: `./evolution/revision-${evolutionRevisions[0]}/manifest.json`,
        });
    }

    // The active mode is itself a shared entity (`analysis-view`): the live
    // server publishes it and the mode runtime obeys it. Exporting it is what
    // makes the copy open in the mode the user was actually in — the mode-data
    // entities above are passive by contract and never change the view.
    // Shared git payloads unlock the real offline flows: any pair compares,
    // any movie generates. Without them the capabilities fall back to the
    // artifact-based replay gating, exactly as before gitData existed.
    const gitTimelineSelected = selectedModes.historicalComparison || selectedModes.projectEvolution;
    const gitData = gitTimelineSelected
        && options.gitData
        && options.gitData.references.sources.length >= 2
        ? options.gitData
        : undefined;
    const partialSuffix = gitData?.partial
        ? ` Partial export: ${gitData.skippedRevisions?.length || 0} revision source(s) could not be prepared.`
        : '';
    const gitMissingSuffix = options.gitDataSelected && !gitData
        ? ` ${options.gitDataFailureReason || 'The git timeline analysis produced no usable data.'}`
        : '';
    const historicalReady = selectedModes.historicalComparison
        && options.serverCapabilities.historicalComparison
        && (!!gitData || historicalArtifactReady);
    const evolutionReady = selectedModes.projectEvolution
        && options.serverCapabilities.projectEvolution
        && (!!gitData || evolutionArtifactReady);

    // If the captured active mode was excluded, or its data preparation
    // failed, publish a valid Single owner rather than an impossible view.
    if (options.viewState?.mode) {
        const requestedMode = options.viewState.mode;
        const requestedAvailable = requestedMode === 'single'
            || requestedMode === 'selection'
            || (requestedMode === 'dependency-graph' && dependencyReady)
            || (requestedMode === 'historical-compare' && historicalReady)
            || (requestedMode === 'project-evolution' && evolutionReady);
        const mode = requestedAvailable ? requestedMode : 'single';
        entities.push({
            entityKind: 'analysis-view',
            entityId: 'main',
            mode,
            controllerView: mode === requestedMode && options.viewState.controllerView
                ? options.viewState.controllerView
                : defaultControllerView(mode),
            status: 'ready',
            hasUsableSnapshot: true,
        });
    }

    const manifest: ExportManifest = {
        schemaVersion: 3,
        kind: 'codexr-export',
        exportedAt: new Date().toISOString(),
        target: options.target,
        selectedModes,
        capabilities: {
            dependencyGraph: dependencyReady,
            dependencyGraphReason: dependencyReady
                ? ''
                : !selectedModes.dependencyGraph
                    ? 'Not selected for this export.'
                    : options.dependencyGraphFailureReason
                        || (options.serverCapabilities.dependencyGraph
                            ? 'No dependency dataset was generated before export.'
                            : 'This analysis mode has no dependency graph.'),
            historicalComparison: historicalReady,
            historicalComparisonReason: !selectedModes.historicalComparison
                ? 'Not selected for this export.'
                : gitData
                    ? `Offline comparisons: pick any two of the ${
                        gitData.timelineSelection?.exportedSourceCount
                        || gitData.analyzedRevisionCount
                    } exported sources.${partialSuffix}`
                    : (historicalArtifactReady
                        ? 'Replay only: new comparisons need the live CodeXR session.'
                        : `No comparison was computed before export.${gitMissingSuffix}`),
            projectEvolution: evolutionReady,
            projectEvolutionReason: !selectedModes.projectEvolution
                ? 'Not selected for this export.'
                : gitData
                    ? `Offline movies from the ${
                        gitData.timelineSelection?.exportedSourceCount
                        || gitData.analyzedRevisionCount
                    } exported sources (Auto, Range or Manual).${partialSuffix}`
                    : (evolutionArtifactReady
                        ? 'Replay only: generating a new movie needs the live CodeXR session.'
                        : `No evolution movie was generated before export.${gitMissingSuffix}`),
        },
        entities,
        historicalComparison: { comparisons },
        ...(gitData ? { gitData } : {}),
    };

    await writeJson(path.join(destinationPath, EXPORT_MANIFEST_FILE_NAME), manifest);
    return manifest;
}

/**
 * Re-assemble from the current templates every runtime JS file that ALREADY
 * exists in the copy (overwrite-existing-only; never adds files). Without
 * this, a session generated before the offline mode existed would export
 * runtime copies that cannot read the manifest, and the whole feature would
 * silently no-op.
 */
export async function refreshRuntimeCopies(
    destinationPath: string,
    extensionPath: string,
): Promise<string[]> {
    const componentsRoot = path.join(extensionPath, 'templates', 'components', 'codexr');
    if (!fs.existsSync(componentsRoot)) {
        return [];
    }
    const componentFolders = fs.readdirSync(componentsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

    const refreshed: string[] = [];
    const rootJsFiles = fs.readdirSync(destinationPath)
        .filter((name) => name.endsWith('.js'));

    for (const fileName of rootJsFiles) {
        const runtimeBase = fileName.replace(/\.js$/, '');
        for (const componentFolder of componentFolders) {
            const partsDir = path.join(componentsRoot, componentFolder, runtimeBase);
            const manifestPath = path.join(partsDir, 'manifest.json');
            const singleFilePath = path.join(componentsRoot, componentFolder, fileName);

            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8')) as {
                    parts: string[];
                };
                const contents = await Promise.all(manifest.parts.map(
                    (part) => fs.promises.readFile(path.join(partsDir, part), 'utf8'),
                ));
                await fs.promises.writeFile(path.join(destinationPath, fileName), contents.join('\n'), 'utf8');
                refreshed.push(fileName);
                break;
            }
            if (fs.existsSync(singleFilePath)) {
                await fs.promises.copyFile(singleFilePath, path.join(destinationPath, fileName));
                refreshed.push(fileName);
                break;
            }
        }
    }

    // The SSE bootstrap ships as main.js; refresh it from the XR source only
    // when the folder is unmistakably an XR scene (a LivePanel folder also has
    // a main.js, and clobbering that one would kill the whole panel).
    const mainJsPath = path.join(destinationPath, 'main.js');
    if (isXrSceneFolder(destinationPath) && fs.existsSync(mainJsPath)) {
        const sseSource = path.join(extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
        if (fs.existsSync(sseSource)) {
            await fs.promises.copyFile(sseSource, mainJsPath);
            refreshed.push('main.js');
        }
    }

    return refreshed;
}

/** Human instructions next to the copy: how to serve it and what to expect. */
export async function writeExportReadme(
    destinationPath: string,
    manifest: ExportManifest,
): Promise<void> {
    const unavailableLine = (name: string, reason: string): string => (
        `- **${name}**: not available in this export. ${reason}`
    );
    const dependencyLine = manifest.capabilities.dependencyGraph
        ? '- **Dependency graph**: interactive exploration of the exported dataset; re-analysis requires CodeXR.'
        : unavailableLine('Dependency graph', manifest.capabilities.dependencyGraphReason);
    const historicalLine = manifest.capabilities.historicalComparison
        ? (manifest.gitData
            ? `- **Historical comparison**: fully interactive across the exported revisions. ${manifest.capabilities.historicalComparisonReason}`
            : '- **Historical comparison**: replay of the comparison computed before export.')
        : unavailableLine('Historical comparison', manifest.capabilities.historicalComparisonReason);
    const evolutionLine = manifest.capabilities.projectEvolution
        ? (manifest.gitData
            ? `- **Project evolution**: create and play movies from the exported revisions. ${manifest.capabilities.projectEvolutionReason}`
            : '- **Project evolution**: replay of the movie computed before export.')
        : unavailableLine('Project evolution', manifest.capabilities.projectEvolutionReason);
    const content = `# CodeXR exported analysis

This folder is a self-contained snapshot of a CodeXR analysis
(**${manifest.target.name}**, ${manifest.target.type}, exported ${manifest.exportedAt}).

## How to open it

Serve the folder with any static HTTP server and open the reported URL
(opening \`index.html\` via \`file://\` will NOT work: the scene loads its
data with fetch, which browsers block on the file protocol):

\`\`\`bash
npx serve .
\`\`\`

\`\`\`bash
python -m http.server 8080
\`\`\`

## What works in this export

- **Classic analysis**: fully, including the Field Mapping panel and the in-room guide.
${dependencyLine}
${historicalLine}
${evolutionLine}

Live source re-analysis and collaboration require CodeXR. Historical
comparisons and Project Evolution movies can be created without CodeXR when
their git timeline was selected for this export. An internet connection is
still required for the A-Frame/BabiaXR CDN scripts the scene loads.
`;
    await fs.promises.writeFile(path.join(destinationPath, EXPORT_README_FILE_NAME), content, 'utf8');
}
