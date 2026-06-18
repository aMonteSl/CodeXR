const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(
    projectRoot,
    'templates',
    'components',
    'codexr',
    'historical-comparison',
    'historicalComparisonRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

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
    vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
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
