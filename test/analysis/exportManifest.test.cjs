const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const {
    EXPORT_MANIFEST_FILE_NAME,
    EXPORT_README_FILE_NAME,
    buildExportManifest,
    configureOfflineExportHtml,
    isXrSceneFolder,
    refreshRuntimeCopies,
    relativizeExportArtifacts,
    writeExportReadme,
} = require('../../out/code_analysis/export/exportManifest.js');

const XR_CAPABILITIES = {
    dependencyGraph: true,
    historicalComparison: true,
    projectEvolution: true,
};

function selectedModes(overrides = {}) {
    const historicalComparison = overrides.historicalComparison ?? true;
    const projectEvolution = overrides.projectEvolution ?? true;
    return {
        cancelled: false,
        normal: true,
        dependencyGraph: overrides.dependencyGraph ?? true,
        historicalComparison,
        projectEvolution,
        gitTimeline: historicalComparison || projectEvolution,
    };
}

function makeTempFolder() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-test-'));
}

function writeJson(folder, relative, payload) {
    const filePath = path.join(folder, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return filePath;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** A destination copy with artifacts for all three advanced modes. */
function buildFullFixture() {
    const folder = makeTempFolder();
    fs.writeFileSync(path.join(folder, 'xrChartMappingUiRuntime.js'), '// stale copy', 'utf8');
    writeJson(folder, 'dependencies/dependency-graph-2.json', { revision: 2, nodes: [] });
    writeJson(folder, 'dependencies/dependency-graph-3.json', {
        revision: 3, sourceRevision: 41, nodes: [],
    });
    writeJson(folder, 'comparison/revision-1.json', {
        revision: 1,
        mode: 'historical-compare',
        left: { source: { label: 'v1.0.0' }, url: '/comparison/revision-1-left.json' },
        right: { source: { label: 'Working copy' }, url: '/comparison/revision-1-right.json' },
        generatedAt: '2026-07-29T00:00:00.000Z',
    });
    writeJson(folder, 'comparison/revision-2.json', {
        revision: 2,
        mode: 'historical-compare',
        left: { source: { label: 'origin/main' }, url: '/comparison/revision-2-left.json' },
        right: { source: { label: 'Working copy' }, url: '/comparison/revision-2-right.json' },
        generatedAt: '2026-07-29T01:00:00.000Z',
    });
    writeJson(folder, 'evolution/revision-4/manifest.json', {
        revision: 4,
        mode: 'project-evolution',
        manifestUrl: '/evolution/revision-4/manifest.json',
        bridgeUrl: '/evolution/revision-4/data.json',
        frames: [
            { index: 0, url: '/evolution/revision-4/data1.json', label: 'first' },
            { index: 1, url: '/evolution/revision-4/data2.json', label: 'second' },
        ],
    });
    return folder;
}

test('relativizeExportArtifacts rewrites only the URL fields, and is idempotent', async () => {
    const folder = buildFullFixture();

    const rewritten = await relativizeExportArtifacts(folder);
    assert.equal(rewritten, 3, 'two comparisons + one evolution manifest should be rewritten');

    const comparison = readJson(path.join(folder, 'comparison', 'revision-2.json'));
    assert.equal(comparison.left.url, './comparison/revision-2-left.json');
    assert.equal(comparison.right.url, './comparison/revision-2-right.json');
    assert.equal(comparison.left.source.label, 'origin/main', 'non-URL fields must stay untouched');
    assert.equal(comparison.generatedAt, '2026-07-29T01:00:00.000Z');

    const evolution = readJson(path.join(folder, 'evolution', 'revision-4', 'manifest.json'));
    assert.equal(evolution.manifestUrl, './evolution/revision-4/manifest.json');
    assert.equal(evolution.bridgeUrl, './evolution/revision-4/data.json');
    assert.deepEqual(evolution.frames.map((frame) => frame.url), [
        './evolution/revision-4/data1.json',
        './evolution/revision-4/data2.json',
    ]);
    assert.equal(evolution.frames[1].label, 'second');

    // Second run: everything is already relative, nothing gets rewritten.
    assert.equal(await relativizeExportArtifacts(folder), 0);
});

test('buildExportManifest snapshots the newest artifacts with relative URLs', async () => {
    const folder = buildFullFixture();
    await relativizeExportArtifacts(folder);

    const manifest = await buildExportManifest(folder, {
        target: { name: 'demo-project', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
    });

    assert.equal(manifest.kind, 'codexr-export');
    assert.equal(manifest.capabilities.dependencyGraph, true);
    assert.equal(manifest.capabilities.historicalComparison, true);
    assert.equal(manifest.capabilities.projectEvolution, true);

    const dependency = manifest.entities.find((entity) => entity.entityKind === 'dependency-graph');
    assert.equal(dependency.datasetUrl, './dependencies/dependency-graph-3.json');
    assert.equal(dependency.revision, 3);
    assert.equal(dependency.sourceRevision, 41);
    assert.equal(dependency.status, 'ready');

    const historical = manifest.entities.find((entity) => entity.entityKind === 'historical-comparison');
    assert.equal(historical.resultUrl, './comparison/revision-2.json');
    assert.equal(historical.mode, 'historical-compare');

    const evolution = manifest.entities.find((entity) => entity.entityKind === 'project-evolution');
    assert.equal(evolution.resultUrl, './evolution/revision-4/manifest.json');

    // Replay list: newest first, carrying the labels the panel shows.
    assert.deepEqual(
        manifest.historicalComparison.comparisons.map((entry) => [entry.revision, entry.leftLabel]),
        [[2, 'origin/main'], [1, 'v1.0.0']],
    );

    // The manifest is written to disk in the destination copy.
    const onDisk = readJson(path.join(folder, EXPORT_MANIFEST_FILE_NAME));
    assert.equal(onDisk.kind, 'codexr-export');
});

test('buildExportManifest disables missing modes with actionable reasons', async () => {
    const folder = makeTempFolder();
    fs.writeFileSync(path.join(folder, 'xrChartMappingUiRuntime.js'), '// stale copy', 'utf8');

    const manifest = await buildExportManifest(folder, {
        target: { name: 'empty', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        dependencyGraphFailureReason: 'The dependency analysis failed during export: boom',
    });

    assert.equal(manifest.capabilities.dependencyGraph, false);
    assert.match(manifest.capabilities.dependencyGraphReason, /failed during export: boom/);
    assert.equal(manifest.capabilities.historicalComparison, false);
    assert.match(manifest.capabilities.historicalComparisonReason, /No comparison was computed/);
    assert.equal(manifest.capabilities.projectEvolution, false);
    assert.match(manifest.capabilities.projectEvolutionReason, /No evolution movie/);
    assert.equal(manifest.entities.length, 0);
});

test('offline HTML disables broadcast before any WebSocket runtime initializes', async () => {
    const folder = makeTempFolder();
    fs.writeFileSync(path.join(folder, 'index.html'), [
        '<!doctype html>',
        '<script id="codexr-tooling-config-collaboration" type="application/json">',
        '{"enabled":true,"collaborationEnabled":true}',
        '</script>',
        '<script id="codexr-tooling-config-virtual-screen" type="application/json">',
        '{"enabled":true,"broadcastEnabled":true,"signalingPath":"/codexr-broadcast"}',
        '</script>',
    ].join(''), 'utf8');

    assert.equal(await configureOfflineExportHtml(folder), true);
    const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
    const virtualConfig = JSON.parse(
        /codexr-tooling-config-virtual-screen[^>]*>([^<]+)/.exec(html)[1],
    );
    assert.equal(virtualConfig.enabled, true);
    assert.equal(virtualConfig.broadcastEnabled, false);
    assert.equal(virtualConfig.offlineExport, true);
    const collaborationConfig = JSON.parse(
        /codexr-tooling-config-collaboration[^>]*>([^<]+)/.exec(html)[1],
    );
    assert.equal(collaborationConfig.collaborationEnabled, true);
    assert.equal(collaborationConfig.offlineExport, true);
});

test('stale artifacts never reactivate modes excluded by the export selector', async () => {
    const folder = buildFullFixture();
    await relativizeExportArtifacts(folder);
    const manifest = await buildExportManifest(folder, {
        target: { name: 'normal-only', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        selectedModes: selectedModes({
            dependencyGraph: false,
            historicalComparison: false,
            projectEvolution: false,
        }),
        viewState: { mode: 'project-evolution', controllerView: 'project-evolution.playback' },
    });

    assert.deepEqual(manifest.capabilities, {
        dependencyGraph: false,
        dependencyGraphReason: 'Not selected for this export.',
        historicalComparison: false,
        historicalComparisonReason: 'Not selected for this export.',
        projectEvolution: false,
        projectEvolutionReason: 'Not selected for this export.',
    });
    assert.equal(
        manifest.entities.some((entity) => [
            'dependency-graph',
            'historical-comparison',
            'project-evolution',
        ].includes(entity.entityKind)),
        false,
    );
    assert.deepEqual(manifest.historicalComparison.comparisons, []);
    const view = manifest.entities.find((entity) => entity.entityKind === 'analysis-view');
    assert.equal(view.mode, 'single');
});

test('refreshRuntimeCopies overwrites existing runtime files only, from the real templates', async () => {
    const folder = makeTempFolder();
    fs.writeFileSync(path.join(folder, 'xrChartMappingUiRuntime.js'), '// stale', 'utf8');
    fs.writeFileSync(path.join(folder, 'dependencyGraphRuntime.js'), '// stale', 'utf8');
    fs.writeFileSync(path.join(folder, 'codexrCollaborationRuntime.js'), '// stale', 'utf8');
    fs.writeFileSync(path.join(folder, 'main.js'), '// stale sse', 'utf8');

    const refreshed = await refreshRuntimeCopies(folder, projectRoot);

    assert.ok(refreshed.includes('dependencyGraphRuntime.js'));
    assert.ok(refreshed.includes('codexrCollaborationRuntime.js'));
    assert.ok(refreshed.includes('main.js'));

    // The refreshed collaboration runtime must know the offline mode.
    const collaboration = fs.readFileSync(path.join(folder, 'codexrCollaborationRuntime.js'), 'utf8');
    assert.match(collaboration, /codexr-export-manifest\.json/);
    assert.match(collaboration, /isOfflineExport/);
    const sse = fs.readFileSync(path.join(folder, 'main.js'), 'utf8');
    assert.match(sse, /codexr-export-manifest\.json/);
    assert.match(sse, /hasOfflineExportMarker/);

    // Overwrite-existing-only: a runtime the copy never had must not appear.
    assert.equal(fs.existsSync(path.join(folder, 'virtualScreenRuntime.js')), false);
});

test('refreshRuntimeCopies never touches main.js outside an XR scene folder', async () => {
    const folder = makeTempFolder();
    // No xrChartMappingUiRuntime.js marker: this shape is a LivePanel folder,
    // whose main.js is the bundled panel code, not the SSE bootstrap.
    fs.writeFileSync(path.join(folder, 'main.js'), '// livepanel bundle', 'utf8');

    assert.equal(isXrSceneFolder(folder), false);
    const refreshed = await refreshRuntimeCopies(folder, projectRoot);

    assert.equal(refreshed.includes('main.js'), false);
    assert.equal(fs.readFileSync(path.join(folder, 'main.js'), 'utf8'), '// livepanel bundle');
});

test('writeExportReadme documents serving and the replay-only limits', async () => {
    const folder = buildFullFixture();
    await relativizeExportArtifacts(folder);
    const manifest = await buildExportManifest(folder, {
        target: { name: 'demo-project', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
    });

    await writeExportReadme(folder, manifest);
    const readme = fs.readFileSync(path.join(folder, EXPORT_README_FILE_NAME), 'utf8');

    assert.match(readme, /npx serve/);
    assert.match(readme, /python -m http\.server/);
    assert.match(readme, /file:\/\//);
    assert.match(readme, /replay of the comparison computed before export/);
    assert.match(readme, /Live source re-analysis and collaboration require CodeXR/);
});

test('the manifest normalizes an unknown or excluded active view to Single', async () => {
    const folder = buildFullFixture();
    await relativizeExportArtifacts(folder);

    // A mode not represented by the exact export selection cannot own the
    // static scene.
    const manifest = await buildExportManifest(folder, {
        target: { name: 'demo-project', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        viewState: { mode: 'time-travel', controllerView: 'time-travel.mapping' },
    });

    const view = manifest.entities.find((entity) => entity.entityKind === 'analysis-view');
    assert.equal(view.entityId, 'main');
    assert.equal(view.mode, 'single');
    assert.equal(view.controllerView, 'single.mapping');
    assert.equal(view.status, 'ready');

    // The view entity comes after the data entities, but ordering must not
    // matter: the mode runtimes are passive, so this is belt and braces.
    const kinds = manifest.entities.map((entity) => entity.entityKind);
    assert.equal(kinds[kinds.length - 1], 'analysis-view');

    // Without a view state (defensive path) no analysis-view entity appears
    // and the scene keeps its default mode.
    const folderB = buildFullFixture();
    await relativizeExportArtifacts(folderB);
    const manifestB = await buildExportManifest(folderB, {
        target: { name: 'demo-project', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
    });
    assert.equal(manifestB.entities.some((entity) => entity.entityKind === 'analysis-view'), false);
});

test('schema v3: exported git data unlocks only the selected offline capabilities', async () => {
    const folder = buildFullFixture();
    await relativizeExportArtifacts(folder);

    const gitData = {
        references: {
            targetRelativePath: '',
            workingTreeDirty: false,
            activeBranch: 'main',
            pageSize: 5,
            sources: [
                { id: 'working-copy', kind: 'workingCopy', label: 'Working copy', payloadUrl: './git-revisions/working-copy.json', itemCount: 3 },
                { id: 'commit:abc', kind: 'gitRef', commitSha: 'abc123', label: 'abc', payloadUrl: './git-revisions/abc123.json', itemCount: 3 },
            ],
        },
        timelineSourceIds: ['commit:abc', 'working-copy'],
        suggestedSourceIds: ['commit:abc', 'working-copy'],
        maxFrames: 24,
        workingCopyPayloadUrl: './git-revisions/working-copy.json',
        analyzedRevisionCount: 2,
    };

    const manifest = await buildExportManifest(folder, {
        target: { name: 'demo', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        gitData,
        gitDataSelected: true,
    });

    assert.equal(manifest.schemaVersion, 3);
    assert.deepEqual(manifest.gitData, gitData);
    assert.equal(manifest.capabilities.historicalComparison, true);
    assert.match(manifest.capabilities.historicalComparisonReason, /pick any two of the 2 exported sources/);
    assert.equal(manifest.capabilities.projectEvolution, true);
    assert.match(manifest.capabilities.projectEvolutionReason, /Auto, Range or Manual/);

    // Partial runs say so.
    const partialManifest = await buildExportManifest(buildFullFixture(), {
        target: { name: 'demo', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        gitData: {
            ...gitData,
            partial: true,
            skippedRevisions: [{ id: 'commit:missing', reason: 'target absent' }],
        },
        gitDataSelected: true,
    });
    assert.match(partialManifest.capabilities.projectEvolutionReason, /1 revision source/);

    const historicalOnly = await buildExportManifest(buildFullFixture(), {
        target: { name: 'demo', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        gitData,
        gitDataSelected: true,
        selectedModes: selectedModes({
            dependencyGraph: false,
            historicalComparison: true,
            projectEvolution: false,
        }),
        viewState: { mode: 'project-evolution', controllerView: 'project-evolution.playback' },
    });
    assert.equal(historicalOnly.capabilities.historicalComparison, true);
    assert.equal(historicalOnly.capabilities.projectEvolution, false);
    assert.match(historicalOnly.capabilities.projectEvolutionReason, /Not selected/);
    assert.equal(historicalOnly.capabilities.dependencyGraph, false);
    assert.deepEqual(historicalOnly.selectedModes, {
        normal: true,
        dependencyGraph: false,
        historicalComparison: true,
        projectEvolution: false,
    });
    const normalizedView = historicalOnly.entities.find((entity) => entity.entityKind === 'analysis-view');
    assert.equal(normalizedView.mode, 'single');
    assert.equal(normalizedView.controllerView, 'single.mapping');
});

test('schema v3: without git data the selected artifact-based replay gating remains available', async () => {
    const folder = makeTempFolder();
    fs.writeFileSync(path.join(folder, 'xrChartMappingUiRuntime.js'), '// stale copy', 'utf8');

    const manifest = await buildExportManifest(folder, {
        target: { name: 'empty', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        gitDataSelected: true,
        gitDataFailureReason: 'The git timeline could not be listed for the export: no repo.',
    });

    assert.equal(manifest.schemaVersion, 3);
    assert.equal(manifest.gitData, undefined);
    assert.equal(manifest.capabilities.historicalComparison, false);
    assert.match(manifest.capabilities.historicalComparisonReason, /could not be listed/);
    // A single-source gitData is useless and must be dropped too.
    const single = await buildExportManifest(makeTempFolder(), {
        target: { name: 'empty', type: 'directory', analysisMode: 'XR' },
        serverCapabilities: XR_CAPABILITIES,
        gitData: {
            references: { targetRelativePath: '', workingTreeDirty: false, activeBranch: null, pageSize: 5, sources: [{ id: 'only', payloadUrl: './x.json', itemCount: 1 }] },
            timelineSourceIds: [], suggestedSourceIds: [], maxFrames: 24,
            workingCopyPayloadUrl: './git-revisions/working-copy.json', analyzedRevisionCount: 1,
        },
        gitDataSelected: true,
    });
    assert.equal(single.gitData, undefined);
});
