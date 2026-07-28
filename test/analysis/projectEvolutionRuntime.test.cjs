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

test('project evolution runtime keeps one bridge datasource and chart during playback', () => {
    assert.doesNotMatch(runtimeSource, /function createEvolutionFrameRoot\(frame\)/);
    assert.doesNotMatch(runtimeSource, /id: 'codexrProjectEvolutionFrameRoot'/);
    assert.match(runtimeSource, /function ensureEvolutionPlaybackRoot\(frame\)/);
    assert.match(runtimeSource, /id: 'codexrProjectEvolutionPlaybackRoot'/);
    assert.match(runtimeSource, /function ensureEvolutionDataSource\(playbackRoot, initialUrl\)/);
    assert.match(runtimeSource, /id: 'codexrProjectEvolutionData'/);
    assert.match(runtimeSource, /function refreshEvolutionDataSource\(frameUrl\)/);
    assert.match(runtimeSource, /setAttribute\('babia-queryjson', 'url: ' \+ frameUrl\)/);
    assert.match(runtimeSource, /refs\.evolutionDataSource\?\.emit\('data-loaded', \{\}\)/);
    assert.match(runtimeSource, /function waitForComponent\(element, componentName, timeoutMs\)/);
    assert.match(runtimeSource, /await waitForComponent\(dataSource, 'babia-queryjson', 1200\)/);
    assert.match(runtimeSource, /await waitForComponent\(treeBuilder, 'babia-treebuilder', 1200\)/);
    assert.match(runtimeSource, /await waitForComponent\(chart, componentName, 1200\)/);
    assert.doesNotMatch(runtimeSource, /clone\.setAttribute\(componentName/);
    assert.match(runtimeSource, /function ensureEvolutionTreeBuilder\(playbackRoot, targetType\)/);
    assert.match(runtimeSource, /id: 'codexrProjectEvolutionTree'/);
    assert.match(runtimeSource, /var treeAttr = 'field: ' \+ field \+ '; split_by: \/; from: codexrProjectEvolutionData'/);
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
    assert.match(runtimeSource, /data\.from = 'codexrProjectEvolutionTree'/);
    assert.match(runtimeSource, /data\.from = 'codexrProjectEvolutionData'/);
    assert.match(runtimeSource, /playbackRoot\.appendChild\(chart\)/);
    assert.match(runtimeSource, /project-evolution-apply-frame/);
    assert.match(runtimeSource, /project-evolution-frame-applied/);
    assert.match(runtimeSource, /requestId: requestId/);
    assert.match(runtimeSource, /project-evolution-frame-apply-superseded/);
    assert.match(runtimeSource, /return false;\s*\}\s*setStatus\(error instanceof Error \? error\.message/);
});

test('project evolution runtime no longer builds manual boats trees in browser', () => {
    assert.doesNotMatch(runtimeSource, /function buildEvolutionBoatsTree/);
    assert.doesNotMatch(runtimeSource, /function buildEvolutionVisualPayload/);
    assert.doesNotMatch(runtimeSource, /fetch\(frame\.url\)/);
    assert.doesNotMatch(runtimeSource, /data\.data = JSON\.stringify/);
    assert.doesNotMatch(runtimeSource, /data\.field = 'uid'/);
    assert.doesNotMatch(runtimeSource, /__codexrEvolution/);
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
                return { rotation: chartId === 'pie' || chartId === 'donut' ? '90 0 0' : '0 0 0' };
            },
        },
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'projectEvolutionRuntime.js' });
    return { runtime: sandbox.CodeXRProjectEvolutionRuntime, created };
}

test('the movie chart never inherits the scene chart orientation or component', () => {
    // The scene had been switched to donut: rotated 90°, wearing
    // babia-doughnut. The movie borrows DECORATION from it, and borrowing
    // those two turned the boats movie into a rotated doughnut.
    const sceneChart = createSceneChart({
        'babia-doughnut': { from: 'data', key: 'fileName', size: 'functionCount' },
        'data-codexr-active-chart-id': 'donut',
        rotation: '90 0 0',
        palette: 'ubuntu',
        'babia-queryjson': 'url: ./data.json',
    });
    const { runtime } = loadRuntimeWithSceneChart(sceneChart, { chartId: 'donut' });

    const movieChart = runtime.__testing.buildEvolutionChart('boats');

    assert.ok(movieChart);
    assert.equal(movieChart.getAttribute('rotation'), '0 0 0', 'boats stands upright in the movie');
    assert.equal(movieChart.getAttribute('babia-doughnut'), null, 'no foreign chart component rides along');
    assert.equal(movieChart.getAttribute('data-codexr-project-evolution-chart-id'), 'boats');
    // Decoration still travels — that is the whole point of the style source.
    assert.equal(movieChart.getAttribute('palette'), 'ubuntu');

    // And a movie that IS circular gets the profile rotation, not a default.
    const circular = runtime.__testing.buildEvolutionChart('donut');
    assert.equal(circular.getAttribute('rotation'), '90 0 0');
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

test('every frame puts the boats chart back on its full-redraw path', () => {
    // Babia's boats only wipes and redraws while it has no previous figures
    // (`if (this.figures_old.length == 0)`); otherwise it morphs the old tree
    // into the new one. A movie frame is a different revision with different
    // files, so the morph dropped geometry it never restored and the chart
    // decayed frame after frame.
    const runtime = loadRuntime();
    const reset = runtime.__testing.resetChartRedrawState;
    const boats = {
        figures: [{ name: 'stale' }],
        figures_old: [{ name: 'older' }],
        figures_del: [{ name: 'pending-delete' }],
        figures_in: [{ name: 'pending-insert' }],
        animation: true,
    };
    const chart = { components: { 'babia-boats': boats } };

    assert.equal(reset(chart, 'babia-boats'), true);
    assert.deepEqual([...boats.figures], []);
    assert.deepEqual([...boats.figures_old], [], 'an empty figure list is what triggers the redraw');
    assert.deepEqual([...boats.figures_del], []);
    assert.deepEqual([...boats.figures_in], []);
    assert.equal(boats.animation, false);

    // Only boats keeps that morph state; the flat charts rebuild themselves on
    // every data push, so nothing is poked for them.
    const bars = { bar_array: [1, 2, 3] };
    assert.equal(reset({ components: { 'babia-bars': bars } }, 'babia-bars'), false);
    assert.deepEqual([...bars.bar_array], [1, 2, 3]);
    assert.equal(reset({ components: {} }, 'babia-boats'), false, 'a chart without the component is a no-op');
    assert.equal(reset(null, 'babia-boats'), false);
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
            transitionTo(mode, options) {
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
