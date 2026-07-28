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
    assert.match(readme, /replay of what was computed before export/);
    assert.match(readme, /live CodeXR session/);
});
