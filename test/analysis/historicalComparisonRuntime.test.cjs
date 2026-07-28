const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const runtimeSource = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');

function loadRuntime() {
    const document = {
        readyState: 'loading',
        addEventListener() {},
    };
    const sandbox = {
        window: null,
        document,
        console,
        setTimeout,
        clearTimeout,
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'historicalComparisonRuntime.js' });
    return sandbox.CodeXRHistoricalComparisonRuntime;
}

test('comparison boats receive unique stable ids on each side without mutating metrics', () => {
    const runtime = loadRuntime();
    const payload = [
        {
            filePath: 'src/services/auth.ts',
            functionCount: 7,
            totalLines: 80,
        },
        {
            filePath: 'src/views/login.ts',
            functionCount: 3,
            totalLines: 35,
        },
    ];

    const left = runtime.__testing.buildComparisonBoatsTree(payload, 'filePath', 'codexr-left');
    const right = runtime.__testing.buildComparisonBoatsTree(payload, 'filePath', 'codexr-right');

    assert.equal(left[0].uid, 'codexr-left:src');
    assert.equal(left[0].children[0].uid, 'codexr-left:src/services');
    assert.equal(left[0].children[0].children[0].uid, 'codexr-left:src/services/auth.ts');
    assert.equal(right[0].uid, 'codexr-right:src');
    assert.equal(right[0].children[0].children[0].uid, 'codexr-right:src/services/auth.ts');
    assert.equal(left[0].children[0].children[0].functionCount, 7);
    assert.equal(right[0].children[1].children[0].totalLines, 35);
    assert.equal(payload[0].uid, undefined);
});

test('historical runtime replays computed comparisons in a self-contained export', () => {
    // The selection panel skips the references request offline (there is no
    // git behind an export) and shows the replay status instead.
    const requestIndex = runtimeSource.indexOf("sendMessage?.('historical-comparison-references-request'");
    const offlineBranch = runtimeSource.indexOf('showOfflineReplayStatus()');
    assert.ok(offlineBranch > -1 && requestIndex > -1);
    assert.match(runtimeSource, /isOfflineExport\?\.\(\)[\s\S]{0,120}showOfflineReplayStatus\(\)/);

    // Compare walks the replay list offline: newest first, wrapping around.
    assert.match(runtimeSource, /function getOfflineReplayList\(\)/);
    assert.match(runtimeSource, /getOfflineExportManifest\?\.\(\)/);
    assert.match(runtimeSource, /function loadOfflineComparison\(entry\)/);
    assert.match(runtimeSource, /state\.offlineReplayIndex = index \+ 1/);

    // The replay rides the exact same applySharedState path a live room
    // snapshot uses, so rendering cannot drift between online and offline.
    assert.match(runtimeSource, /applySharedState\(\{\s*entityKind: 'historical-comparison',\s*entityId: 'main',\s*mode: 'historical-compare',\s*result: result\s*\}\)/);

    // Without computed comparisons the mode says exactly why it cannot run.
    assert.match(runtimeSource, /No comparison was computed before this export/);
});
