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
    // The offline branch now checks for exported git data first; the replay
    // status remains its fallback within the same guarded block.
    assert.match(runtimeSource, /isOfflineExport\?\.\(\)[\s\S]{0,700}showOfflineReplayStatus\(\)/);

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

// == Offline comparisons from exported git payloads ==

test('exported git payloads turn Compare into a real offline comparison', () => {
    assert.match(runtimeSource, /getOfflineGitData\(\)/);
    assert.match(runtimeSource, /synthesizeOfflineHistoricalReferences\(offlineGitData\)/);
    assert.match(runtimeSource, /pick any two exported revisions/);
    assert.match(runtimeSource, /startOfflineGitComparison\(\)/);
    assert.match(runtimeSource, /showOfflineReplayStatus\(\)/);
});

test('the offline delta port matches the server semantics over payload pairs', () => {
    const runtime = loadRuntime();
    const del = runtime.__testing.buildOfflineDelta;

    const left = [
        { comparisonKey: 'file:a.py', totalLines: 10, filePath: 'x/a.py' },
        { comparisonKey: 'file:b.py', totalLines: 5 },
        { comparisonKey: 'file:c.py', totalLines: 7, language: 'Python' },
    ];
    const right = [
        { comparisonKey: 'file:a.py', totalLines: 10, filePath: 'y/a.py' },
        { comparisonKey: 'file:b.py', totalLines: 6 },
        { comparisonKey: 'file:d.py', totalLines: 1 },
    ];

    const directory = del(left, right, 'directory');
    assert.deepEqual(
        { added: directory.added, removed: directory.removed, modified: directory.modified, unchanged: directory.unchanged },
        { added: 1, removed: 1, modified: 1, unchanged: 1 },
    );
    // metrics stays empty offline (XR never reads it); length-checked because
    // the runtime's array comes from another vm realm.
    assert.equal(directory.metrics.length, 0);

    const stringLeft = [{ comparisonKey: 'k', signature: 'foo(a)' }];
    const stringRight = [{ comparisonKey: 'k', signature: 'foo(a, b)' }];
    assert.equal(del(stringLeft, stringRight, 'directory').unchanged, 1);
    assert.equal(del(stringLeft, stringRight, 'file').modified, 1);

    const withEvolutionKey = del(
        [{ comparisonKey: 'k', evolutionKey: 'file:x', totalLines: 2 }],
        [{ comparisonKey: 'k', evolutionKey: 'file:y', totalLines: 2 }],
        'file',
    );
    assert.equal(withEvolutionKey.unchanged, 1);
});

test('synthesized historical references keep the picker contract', () => {
    const runtime = loadRuntime();
    const references = runtime.__testing.synthesizeOfflineHistoricalReferences({
        references: {
            repositoryRoot: '/repo',
            targetRelativePath: 'src',
            workingTreeDirty: true,
            activeBranch: 'main',
            pageSize: 5,
            sources: [{ id: 'working-copy', kind: 'workingCopy' }, { id: 'commit:a', kind: 'gitRef' }],
        },
        workingCopyPayloadUrl: './git-revisions/working-copy.json',
    });
    assert.equal(references.pageSize, 5);
    assert.equal(references.workingTreeDirty, true);
    assert.equal(references.activeBranch, 'main');
    assert.equal(references.sources.length, 2);
    assert.equal(references.activeRequest, null);
});
