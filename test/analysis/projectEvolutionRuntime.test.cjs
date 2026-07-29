const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const runtimeSource = readAssembledRuntime('project-evolution', 'projectEvolutionRuntime.js');

function loadRuntime(config = null) {
    const document = {
        readyState: 'loading',
        addEventListener() {},
        getElementById(id) {
            if (id === 'codexr-tooling-config-xr-mapping-ui' && config) {
                return { textContent: JSON.stringify(config) };
            }
            return null;
        },
    };
    const sandbox = {
        window: null,
        document,
        console,
        Date: { now: () => 123456789 },
        setTimeout() {
            return 1;
        },
        clearTimeout() {},
        encodeURIComponent,
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return sandbox.CodeXRProjectEvolutionRuntime;
}

test('project evolution owns one declarative datasource and a direct tree-chart root', () => {
    assert.doesNotMatch(runtimeSource, /function createEvolutionFrameRoot\(frame\)/);
    assert.doesNotMatch(runtimeSource, /id: 'codexrProjectEvolutionFrameRoot'/);
    assert.doesNotMatch(runtimeSource, /codexrProjectEvolutionPlaybackRoot/);
    assert.doesNotMatch(runtimeSource, /releaseEvolutionFrameSurface/);
    assert.doesNotMatch(runtimeSource, /codexrProjectEvolutionChartSurface/);
    assert.doesNotMatch(runtimeSource, /function buildEvolutionChartSurface/);
    assert.doesNotMatch(runtimeSource, /evolutionCharts\.js/);
    assert.doesNotMatch(runtimeSource, /bridgeAndPlayback\.js/);
    assert.match(runtimeSource, /function ensureEvolutionRoot\(frame\)/);
    assert.match(runtimeSource, /id: 'codexrProjectEvolutionRoot'/);
    assert.match(runtimeSource, /function ensureDeclarativeEvolutionPipeline\(frame, frameUrl, viewGeneration\)/);
    assert.match(runtimeSource, /releaseChartEntity\?\.\(refs\.evolutionChart\)/);
    assert.match(runtimeSource, /function ensureEvolutionDataSource\(frameUrl\)/);
    assert.match(runtimeSource, /EVOLUTION_DATA_ID = 'codexrProjectEvolutionData'/);
    assert.match(runtimeSource, /scene\.appendChild\(refs\.evolutionDataSource\)/);
    assert.match(runtimeSource, /function ensureEvolutionTreeBuilder\(rootEl\)/);
    assert.match(runtimeSource, /EVOLUTION_TREE_ID = 'codexrProjectEvolutionTree'/);
    assert.match(runtimeSource, /buildDeclarativeTreeEntity\?\.\(\{/);
    assert.match(runtimeSource, /rootEl\.insertBefore\?\.\(refs\.evolutionTreeBuilder, rootEl\.firstChild \|\| null\)/);
    assert.match(runtimeSource, /EVOLUTION_CHART_ID = 'codexrProjectEvolutionChart'/);
    assert.match(runtimeSource, /buildDeclarativeChartEntity\?\.\(/);
    assert.match(runtimeSource, /rootEl\.appendChild\(nextChart\)/);
    assert.match(runtimeSource, /function refreshEvolutionDataSource\(frameUrl\)/);
    assert.match(runtimeSource, /serializeEvolutionComponentData\(\{ url: frameUrl \}\)/);
    assert.doesNotMatch(runtimeSource, /setAttribute\('babia-queryjson', 'url'/);
    assert.doesNotMatch(runtimeSource, /setAttribute\(pipeline\.componentName, data\)/);
    assert.doesNotMatch(runtimeSource, /emit\('data-loaded'/);
    assert.match(runtimeSource, /function waitForComponent\(element, componentName, timeoutMs\)/);
    assert.match(runtimeSource, /await waitForComponent\(dataSource, 'babia-queryjson', 1200\)/);
    assert.match(runtimeSource, /await waitForComponent\(treeBuilder, EVOLUTION_TREE_COMPONENT, 1200\)/);
    assert.match(runtimeSource, /await waitForComponent\(chart, componentName, 1200\)/);
    assert.match(runtimeSource, /configureDeclarativeChartEntity\?\.\(/);
    // The git-ref-picker runtime is presentation chrome: every describeSource
    // use goes through the guarded helper, so a missing picker can no longer
    // throw inside play() and freeze the movie with `playing` stuck on.
    assert.match(runtimeSource, /function describeSourceSafe\(source\)/);
    assert.doesNotMatch(runtimeSource, /root\.CodeXRGitRefPickerRuntime\.describeSource\(/);
    // Shared boats tree contract (generator-injected config): the movie splits
    // the same filePath the normal analysis splits — the service rebuilds it
    // against the ORIGINAL target so temp copies never shape the quarters.
    assert.match(runtimeSource, /function evolutionTreeField\(targetType\)/);
    assert.match(runtimeSource, /getChartBaseConfig\?\.\(\)\?\.treeFields/);
    assert.match(runtimeSource, /treeFields\?\.directory \|\| 'filePath'/);
    assert.doesNotMatch(runtimeSource, /targetType === 'directory' \? 'filePath'/);
    assert.match(runtimeSource, /function applyBridgeFrameToChart\(frame, appliedBridgeUrl\)/);
    assert.match(runtimeSource, /return chartId === 'boats' \? EVOLUTION_TREE_ID : EVOLUTION_DATA_ID/);
    assert.match(runtimeSource, /beginEvolutionDataTransition\('project-evolution-frame'\)/);
    assert.match(runtimeSource, /finishEvolutionDataTransition\('project-evolution-frame'\)/);
    assert.match(runtimeSource, /waitForEvolutionChartAnimation/);
    assert.doesNotMatch(runtimeSource, /scheduleFrameRenormalization/);
    assert.match(runtimeSource, /project-evolution-apply-frame/);
    assert.match(runtimeSource, /project-evolution-frame-applied/);
    assert.match(runtimeSource, /requestId: requestId/);
    assert.match(runtimeSource, /project-evolution-frame-apply-superseded/);
    assert.match(runtimeSource, /Project evolution frame could not be applied/);
});

test('project evolution namespaces stable boats identities away from other analyses', () => {
    const runtime = loadRuntime();
    const payload = [
        {
            name: 'repo',
            uid: 'repo',
            children: [{
                name: 'src',
                uid: 'repo/src',
                children: [
                    { name: 'a.js', uid: 'repo/src/a.js', totalLines: 10 },
                    { name: 'b.js', uid: 'repo/src/b.js', totalLines: 20 },
                ],
            }],
        },
    ];
    const first = runtime.__testing.namespaceEvolutionTreeNodes(payload, 'project-evolution');
    const second = runtime.__testing.namespaceEvolutionTreeNodes(payload, 'project-evolution');
    const collectUids = (nodes) => nodes.flatMap((node) => [
        node.uid,
        ...collectUids(Array.isArray(node.children) ? node.children : []),
    ]);

    const firstUids = collectUids(first);
    assert.deepEqual(firstUids, collectUids(second));
    assert.equal(firstUids.length, 4);
    assert.ok(firstUids.every((uid) => uid.startsWith('project-evolution:')));
    assert.doesNotMatch(runtimeSource, /function buildEvolutionVisualPayload/);
    assert.doesNotMatch(runtimeSource, /fetch\(frame\.url\)/);
    assert.doesNotMatch(runtimeSource, /data\.data = JSON\.stringify/);
    assert.match(runtimeSource, /buffer\.__codexrEvolutionNamespace = MODE/);
});

test('project evolution bridge URL is cache-busted without changing its path', () => {
    const runtime = loadRuntime();

    const url = runtime.__testing.frameUrlWithCache({
        index: 3,
        url: '/evolution/revision-3/data4.json',
    }, '/evolution/revision-3/data.json');

    assert.match(url, /^\/evolution\/revision-3\/data\.json\?/);
    assert.match(url, /revision=/);
    assert.match(url, /frame=4/);
    assert.match(url, /t=123456789/);
});

test('project evolution merges chart defaults with live mappings for the active chart', () => {
    const runtime = loadRuntime({
        chartId: 'boats',
        defaultMappingsByChart: {
            boats: { area: 'functionCount', height: 'totalLines', color: 'cyclomaticComplexityNumber' },
        },
    });

    const mapping = runtime.__testing.getActiveMappingForChart('boats');

    assert.deepEqual(JSON.parse(JSON.stringify(mapping)), {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    });
});

test('project evolution treats only active Babia boats as hierarchical charts', () => {
    const runtime = loadRuntime();

    assert.equal(runtime.__testing.isHierarchicalBoatsChart('boats', 'babia-boats'), true);
    assert.equal(runtime.__testing.isHierarchicalBoatsChart('codexr-boats', 'codexr-boats'), false);
    assert.equal(runtime.__testing.isHierarchicalBoatsChart('bars', 'babia-bars'), false);
});

// Fake entity good enough for buildEvolutionChart: attribute bag + the
// getAttributeNames/getAttribute pair it copies decoration through.
function createSceneChart(attributes) {
    const bag = Object.assign({}, attributes);
    return {
        getAttributeNames() { return Object.keys(bag); },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(bag, name) ? bag[name] : null; },
        setAttribute(name, value) { bag[name] = value; },
        hasAttribute(name) { return Object.prototype.hasOwnProperty.call(bag, name); },
    };
}

function loadRuntimeWithSceneChart(sceneChart, config) {
    const created = [];
    const document = {
        readyState: 'loading',
        addEventListener() {},
        getElementById(id) {
            if (id === 'codexr-tooling-config-xr-mapping-ui' && config) {
                return { textContent: JSON.stringify(config) };
            }
            return null;
        },
        querySelector() { return sceneChart; },
        querySelectorAll() { return [sceneChart]; },
        createElement() {
            const element = createSceneChart({});
            created.push(element);
            return element;
        },
    };
    const sandbox = {
        window: null,
        document,
        console,
        Date: { now: () => 123456789 },
        setTimeout() { return 1; },
        clearTimeout() {},
        encodeURIComponent,
        // The canonical presentation profile, reached exactly as the runtime
        // reaches it in a real scene.
        CodeXRMappingUiRuntime: {
            getChartPresentation(chartId) {
                return {
                    rotation: chartId === 'pie' || chartId === 'donut' ? '90 0 0' : '0 0 0',
                    initialScale: chartId === 'boats' ? '0.01 0.05 0.01' : '1.5 1.5 1.5',
                };
            },
            buildDeclarativeChartEntity(options) {
                const chart = createSceneChart({});
                const componentByChart = {
                    boats: 'babia-boats',
                    donut: 'babia-doughnut',
                };
                chart.setAttribute('id', options.entityId);
                chart.setAttribute('data-codexr-active-chart-id', options.chartId);
                chart.setAttribute(
                    componentByChart[options.chartId],
                    `from: ${options.sourceId}`,
                );
                const presentation = this.getChartPresentation(options.chartId);
                chart.setAttribute('rotation', presentation.rotation);
                chart.setAttribute('scale', presentation.initialScale);
                return chart;
            },
        },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return { runtime: sandbox.CodeXRProjectEvolutionRuntime, created };
}

test('the movie chart is built declaratively without reading the parked scene chart', () => {
    // The scene had been switched to donut: rotated 90°, wearing
    // babia-doughnut. The movie borrows DECORATION from it, and borrowing
    // those two turned the boats movie into a rotated doughnut.
    const sceneChart = createSceneChart({
        'babia-doughnut': { from: 'data', key: 'fileName', size: 'functionCount' },
        'data-codexr-active-chart-id': 'donut',
        rotation: '90 0 0',
        'babia-queryjson': 'url: ./data.json',
    });
    const { runtime } = loadRuntimeWithSceneChart(sceneChart, { chartId: 'donut' });

    const movieChart = runtime.__testing.buildEvolutionChart('boats');

    assert.ok(movieChart);
    assert.equal(movieChart.getAttribute('rotation'), '0 0 0', 'boats stands upright in the movie');
    assert.equal(movieChart.getAttribute('babia-doughnut'), null, 'no foreign chart component rides along');
    assert.equal(movieChart.getAttribute('data-codexr-project-evolution-chart-id'), 'boats');
    // Decoration still travels — that is the whole point of the style source.
    assert.equal(movieChart.getAttribute('babia-boats'), 'from: codexrProjectEvolutionTree');
    assert.equal(movieChart.getAttribute('scale'), '0.01 0.05 0.01');

    // And a movie that IS circular gets the profile rotation, not a default.
    const circular = runtime.__testing.buildEvolutionChart('donut');
    assert.equal(circular.getAttribute('rotation'), '90 0 0');
    assert.equal(circular.getAttribute('babia-boats'), null);
    assert.equal(circular.getAttribute('babia-doughnut'), 'from: codexrProjectEvolutionData');
    assert.doesNotMatch(runtimeSource, /getChartStyleSource/);
});

test('boats is the identity chart of the movie whatever the scene was generated with', () => {
    // A pie scene used to open the movie as a pie. The movie resolves its own
    // default from the available charts, and only falls back to the scene's
    // chart when the scene has no boats template at all.
    const pieScene = loadRuntime({
        chartId: 'pie',
        availableCharts: [{ id: 'pie' }, { id: 'bars' }, { id: 'boats' }],
    });
    assert.equal(pieScene.__testing.getDefaultChartId(), 'boats');

    const boatlessScene = loadRuntime({
        chartId: 'bars',
        availableCharts: [{ id: 'pie' }, { id: 'bars' }],
    });
    assert.equal(boatlessScene.__testing.getDefaultChartId(), 'bars');
});

test('frames rely on Babia morphing without mutating its internal state', () => {
    assert.doesNotMatch(runtimeSource, /resetChartRedrawState/);
    assert.match(runtimeSource, /function captureEvolutionChartTransition/);
    assert.match(runtimeSource, /component\.figures !== previousTransition\.figures/);
    assert.match(runtimeSource, /component\.figures_old !== previousTransition\.figuresOld/);
    assert.doesNotMatch(runtimeSource, /component\.figures\s*=/);
    assert.doesNotMatch(runtimeSource, /component\.figures_old\s*=/);
    assert.match(runtimeSource, /var pipeline = await ensureDeclarativeEvolutionPipeline\(/);
    assert.match(runtimeSource, /var refreshGeneration = pipeline\.dataSourceCreated/);
    assert.match(runtimeSource, /await waitForEvolutionChartAnimation/);
    assert.doesNotMatch(
        runtimeSource,
        /function applyBridgeFrameToChart[\s\S]*?releaseEvolutionChart\(\)/,
    );
});

test('suggested auto order tolerates never-loaded references (dependency-start regression)', () => {
    const runtime = loadRuntime();

    // references stays null until the server answers. stop() renders during
    // deactivate/disposeView, so this path runs for a mode that was never
    // opened — a throw here used to reject the whole selection transition
    // and silently kill the dependency-graph start handshake.
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.__testing.getSuggestedAutoOrderById())), {});
});

// ── Self-contained exports: play from the pre-generated frame files ─────────

function loadRuntimeWithClient(clientStub) {
    const document = {
        readyState: 'loading',
        addEventListener() {},
        getElementById() { return null; },
    };
    const sandbox = {
        window: null,
        document,
        console,
        Date: { now: () => 123456789 },
        setTimeout() { return 1; },
        clearTimeout() {},
        encodeURIComponent,
        CodeXRCollaborationRuntime: {
            getClient() { return clientStub; },
        },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return sandbox.CodeXRProjectEvolutionRuntime;
}

test('offline export plays each frame from its own file; online keeps the bridge preference', () => {
    const frame = { index: 3, url: '/evolution/revision-3/data4.json' };
    const appliedBridgeUrl = '/evolution/revision-3/data.json';

    // Online (no offline flag): the bridge URL wins, exactly as before.
    const online = loadRuntimeWithClient({ isOfflineExport: () => false, sendMessage: () => true });
    const onlineUrl = online.__testing.frameUrlWithCache(frame, appliedBridgeUrl);
    assert.match(onlineUrl, /^\/evolution\/revision-3\/data\.json\?/);

    // Offline: the same call must point at the frame's own pre-generated file,
    // because no server exists to swap the bridge content.
    const offline = loadRuntimeWithClient({ isOfflineExport: () => true, sendMessage: () => true });
    const offlineUrl = offline.__testing.frameUrlWithCache(frame, appliedBridgeUrl);
    assert.match(offlineUrl, /^\/evolution\/revision-3\/data4\.json\?/);
    assert.match(offlineUrl, /frame=4/);
});

test('offline export never sends playback or lifecycle messages to a server', () => {
    // requestBridgeFrame resolves immediately (empty bridge URL) before any
    // sendMessage: no timeout, no pending apply.
    assert.match(runtimeSource, /isOfflineExport\?\.\(\)[\s\S]{0,220}bridgeUrl: ''/);
    const offlineResolve = runtimeSource.indexOf("bridgeUrl: ''");
    const applyFrameSend = runtimeSource.indexOf("'project-evolution-apply-frame'");
    assert.ok(offlineResolve > -1 && applyFrameSend > -1 && offlineResolve < applyFrameSend,
        'the offline resolution must run before the frame-apply send');

    // References, generation and clearing are server work: offline they turn
    // into plain notices instead of dead requests (Clear would even wipe the
    // exported replay through its local fallback).
    assert.match(runtimeSource, /play, pause and seek work here/);
    assert.match(runtimeSource, /a new movie needs the live CodeXR session/);
    assert.match(runtimeSource, /replay-only: it cannot be cleared or regenerated here/);
    const clearGuard = runtimeSource.indexOf('replay-only: it cannot be cleared or regenerated here');
    const clearSend = runtimeSource.indexOf("'project-evolution-clear'");
    assert.ok(clearGuard > -1 && clearSend > -1 && clearGuard < clearSend,
        'the offline guard must run before the clear request');
});

// ── Passive-entity contract: mode data must never steal the table ───────────
// The authoritative `analysis-view` entity (or an explicit user action) is the
// only thing allowed to change the active mode. A movie snapshot arriving
// while the user is in another mode is stored, nothing more — the hijack this
// pins down is exactly what made exported copies (and room-snapshot replays)
// land on project evolution regardless of the mode the user left active.

function loadRuntimeForModeContract(activeMode) {
    const transitions = [];
    const sent = [];
    const document = {
        readyState: 'loading',
        addEventListener() {},
        getElementById() { return null; },
    };
    const sandbox = {
        window: null,
        document,
        console,
        Date: { now: () => 123456789 },
        setTimeout() { return 1; },
        clearTimeout() {},
        encodeURIComponent,
        CodeXRCollaborationRuntime: {
            getClient() {
                return {
                    sendMessage(type, payload) { sent.push([type, payload]); return true; },
                };
            },
        },
        CodeXRAnalysisModeRuntime: {
            getState() { return { mode: activeMode, transitioning: false, requestedMode: null }; },
            changeAnalysis(mode, options) {
                transitions.push([mode, options?.reason]);
                return Promise.resolve(true);
            },
        },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return { runtime: sandbox.CodeXRProjectEvolutionRuntime, transitions, sent };
}

test('a movie snapshot received while in ANOTHER mode is stored passively', () => {
    const { runtime, transitions, sent } = loadRuntimeForModeContract('single');

    runtime.__testing.applySharedState({
        entityKind: 'project-evolution',
        entityId: 'main',
        mode: 'project-evolution',
        result: { revision: 1, frames: [{ index: 0, url: '/evolution/revision-1/data1.json' }] },
    });

    assert.deepEqual(transitions, [], 'no transition may fire from a passive snapshot');
    assert.equal(sent.some(([type]) => type === 'analysis-mode-activate'), false,
        'a passive snapshot must not push the room into evolution mode either');
    assert.equal(runtime.getState().result.revision, 1, 'the result must still be stored for later activation');
});

test('a movie snapshot received while ALREADY in evolution reroutes to the movie view', () => {
    const { runtime, transitions } = loadRuntimeForModeContract('project-evolution');

    runtime.__testing.applySharedState({
        entityKind: 'project-evolution',
        entityId: 'main',
        mode: 'project-evolution',
        result: { revision: 2, frames: [{ index: 0, url: '/evolution/revision-2/data1.json' }] },
    });

    assert.equal(transitions.length, 1, 'the requester (already in evolution) must land on the movie');
    assert.deepEqual(transitions[0], ['project-evolution', 'project-evolution-ready']);
});

// == Offline movie generation from exported git payloads ==

function buildOfflineGitDataFixture() {
    const day = 24 * 60 * 60;
    const commit = function (n, extras) {
        return Object.assign({
            id: 'commit:c' + n,
            kind: 'gitRef',
            refType: 'commit',
            commitSha: 'sha' + n,
            label: 'c' + n,
            date: '',
            timestamp: 1600000000 + n * day,
            revisionType: 'commit',
            payloadUrl: './git-revisions/sha' + n + '.json',
            itemCount: n + 1,
        }, extras || {});
    };
    const sources = [{
        id: 'working-copy', kind: 'workingCopy', label: 'Working copy',
        payloadUrl: './git-revisions/working-copy.json', itemCount: 9,
    }];
    for (let n = 0; n < 10; n += 1) {
        sources.push(commit(n, n === 5 ? { revisionType: 'merge' } : {}));
    }
    return {
        references: {
            targetRelativePath: '', workingTreeDirty: false, activeBranch: 'main', pageSize: 5, sources,
        },
        timelineSourceIds: sources
            .filter((source) => source.kind === 'gitRef')
            .map((source) => source.id)
            .concat(['working-copy']),
        suggestedSourceIds: ['commit:c0', 'commit:c5', 'working-copy'],
        maxFrames: 3,
        workingCopyPayloadUrl: './git-revisions/working-copy.json',
        analyzedRevisionCount: 11,
    };
}

function loadRuntimeWithOfflineGitData(gitData) {
    const pickerApi = require(path.join(
        projectRoot, 'templates', 'components', 'common', 'codexrGitRefPickerRuntime.js',
    ));
    const document = {
        readyState: 'loading',
        addEventListener() {},
        getElementById() { return null; },
    };
    const sandbox = {
        window: null,
        document,
        console,
        Date: { now: () => 123456789 },
        setTimeout() { return 1; },
        clearTimeout() {},
        encodeURIComponent,
        CodeXRGitRefPickerRuntime: pickerApi,
        CodeXRCollaborationRuntime: {
            getClient() {
                return {
                    isOfflineExport: () => true,
                    getOfflineExportManifest: () => ({ kind: 'codexr-export', gitData }),
                    sendMessage: () => false,
                };
            },
        },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return sandbox.CodeXRProjectEvolutionRuntime;
}

test('offline auto movies use the shipped suggestion at the default frame budget', () => {
    const gitData = buildOfflineGitDataFixture();
    const runtime = loadRuntimeWithOfflineGitData(gitData);

    const frames = runtime.__testing.buildOfflineFrames(gitData, 'auto', { maxFrames: 3 });
    assert.deepEqual(frames.map((frame) => frame.source.id), ['commit:c0', 'commit:c5', 'working-copy']);
    assert.deepEqual(frames.map((frame) => frame.index), [0, 1, 2]);
    assert.equal(frames[2].url, './git-revisions/working-copy.json');
    assert.equal(frames[0].itemCount, 1);

    const resampled = runtime.__testing.buildOfflineFrames(gitData, 'auto', { maxFrames: 5 });
    assert.equal(resampled.length, 5);
    assert.equal(resampled[0].source.id, 'commit:c0');
    assert.equal(resampled[resampled.length - 1].source.id, 'working-copy');
    assert.ok(
        resampled.some((frame) => frame.source.id === 'commit:c5'),
        'the merge milestone should be picked',
    );
});

test('offline range slices the timeline inclusively; manual keeps chronological order', () => {
    const gitData = buildOfflineGitDataFixture();
    const runtime = loadRuntimeWithOfflineGitData(gitData);

    const range = runtime.__testing.buildOfflineFrames(gitData, 'range', {
        maxFrames: 96, startSourceId: 'commit:c2', endSourceId: 'commit:c4',
    });
    assert.deepEqual(range.map((frame) => frame.source.id), ['commit:c2', 'commit:c3', 'commit:c4']);

    const manual = runtime.__testing.buildOfflineFrames(gitData, 'manual', {
        maxFrames: 96, sourceIds: ['commit:c7', 'commit:c1', 'working-copy'],
    });
    assert.deepEqual(manual.map((frame) => frame.source.id), ['commit:c1', 'commit:c7', 'working-copy']);
    assert.deepEqual(manual.map((frame) => frame.url), [
        './git-revisions/sha1.json', './git-revisions/sha7.json', './git-revisions/working-copy.json',
    ]);
});

test('offline generation is wired through the panel, and the no-git replay path survives', () => {
    assert.match(runtimeSource, /synthesizeOfflineEvolutionReferences\(offlineGitData\)/);
    assert.match(runtimeSource, /startOfflineTimeline\(\)/);
    assert.match(runtimeSource, /exported revisions \(Auto, Range or Manual\)/);
    assert.match(runtimeSource, /replays the movie generated before export/);
    assert.match(runtimeSource, /replay-only: it cannot be cleared or regenerated here/);
});
