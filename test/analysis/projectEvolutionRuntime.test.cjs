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

test('suggested auto order tolerates never-loaded references (dependency-start regression)', () => {
    const runtime = loadRuntime();

    // references stays null until the server answers. stop() renders during
    // deactivate/disposeView, so this path runs for a mode that was never
    // opened — a throw here used to reject the whole selection transition
    // and silently kill the dependency-graph start handshake.
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.__testing.getSuggestedAutoOrderById())), {});
});
