const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '..', '..');
const importScript = (name) => import(pathToFileURL(path.join(projectRoot, 'scripts', name)).href);

function withTempDist(files, callback) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-dist-'));
    try {
        for (const [relativePath, content] of Object.entries(files)) {
            const target = path.join(root, ...relativePath.split('/'));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, content);
        }
        return callback(root);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

const SHIPPED = {
    'extension.js': 'module.exports = { activate() {} };\n',
    'code_analysis/python/main.py': 'print("ok")\n',
    'code_analysis/python/examples/example_progress_coordinator.py': 'print("example")\n',
    'templates/xr/scene.html': '<a-scene></a-scene>\n',
};

test('a dist fingerprint is reproducible and sees every shipped file', async () => {
    const { fingerprintDist } = await importScript('dist-fingerprint.mjs');

    const [first, second] = [withTempDist(SHIPPED, fingerprintDist), withTempDist(SHIPPED, fingerprintDist)];

    assert.deepEqual(first, second, 'the same tree always gives the same fingerprint, wherever it lives');
    assert.deepEqual(Object.keys(first.files), Object.keys(SHIPPED).sort());
    assert.equal(first.bundle.path, 'extension.js');
    assert.equal(first.bundle.bytes, Buffer.byteLength(SHIPPED['extension.js']));
    assert.match(first.bundle.sha256, /^[0-9a-f]{64}$/);
    assert.throws(() => fingerprintDist(path.join(os.tmpdir(), 'codexr-no-such-dist')), /does not exist\. Build first/);
});

test('H1: deleting an unreachable source file must leave everything that ships identical', async () => {
    const { fingerprintDist } = await importScript('dist-fingerprint.mjs');
    const { diffFingerprints, checkIdenticalBundle } = await importScript('dist-diff.mjs');
    const before = withTempDist(SHIPPED, fingerprintDist);

    const untouched = diffFingerprints(before, withTempDist(SHIPPED, fingerprintDist));
    assert.deepEqual(untouched, { bundleIdentical: true, added: [], removed: [], changed: [] });
    assert.deepEqual(checkIdenticalBundle(untouched), []);

    // The "dead" file was not dead: the bundle moved.
    const bundleMoved = diffFingerprints(before, withTempDist({ ...SHIPPED, 'extension.js': 'module.exports = {};\n' }, fingerprintDist));
    assert.deepEqual(checkIdenticalBundle(bundleMoved), ['extension.js changed: the bundle is not byte-identical']);

    // A copied template changed although the commit claimed to touch nothing that ships.
    const assetMoved = diffFingerprints(before, withTempDist({ ...SHIPPED, 'templates/xr/scene.html': '<a-scene embedded></a-scene>\n' }, fingerprintDist));
    assert.deepEqual(checkIdenticalBundle(assetMoved), ['changed: templates/xr/scene.html']);
});

test('H1: a copied asset may disappear only when the commit names it', async () => {
    const { fingerprintDist } = await importScript('dist-fingerprint.mjs');
    const { diffFingerprints, checkIdenticalBundle } = await importScript('dist-diff.mjs');
    const before = withTempDist(SHIPPED, fingerprintDist);
    const { 'code_analysis/python/examples/example_progress_coordinator.py': removedExample, ...withoutExample } = SHIPPED;
    assert.ok(removedExample);

    const diff = diffFingerprints(before, withTempDist(withoutExample, fingerprintDist));

    assert.deepEqual(diff.removed, ['code_analysis/python/examples/example_progress_coordinator.py']);
    assert.deepEqual(checkIdenticalBundle(diff), ['removed but not expected: code_analysis/python/examples/example_progress_coordinator.py']);
    assert.deepEqual(checkIdenticalBundle(diff, ['code_analysis/python/examples/']), [], 'a directory prefix covers everything under it');
    assert.deepEqual(checkIdenticalBundle(diff, ['code_analysis/python/examples/example_progress_coordinator.py']), []);
    assert.deepEqual(checkIdenticalBundle(diff, ['code_analysis/python/']).length, 0);
    assert.deepEqual(checkIdenticalBundle(diff, ['templates/']).length, 1, 'an unrelated allowance does not excuse it');
});

test('H2: removing a dead declaration shrinks the bundle and inserts nothing', async () => {
    const { diffBundleLines } = await importScript('dist-diff.mjs');
    const before = ['function live() {', '  return 1;', '}', 'function dead() {', '  return 2;', '}', 'exports.live = live;'].join('\n');

    const removed = diffBundleLines(before, ['function live() {', '  return 1;', '}', 'exports.live = live;'].join('\n'));
    assert.equal(removed.insertedLines, 0);
    assert.equal(removed.deletedLines, 3);
    assert.ok(removed.bytesAfter < removed.bytesBefore);

    // Code that only moved costs nothing...
    const moved = diffBundleLines(before, ['function dead() {', '  return 2;', '}', 'function live() {', '  return 1;', '}', 'exports.live = live;'].join('\n'));
    assert.deepEqual([moved.insertedLines, moved.deletedLines], [0, 0]);

    // ...while a changed line is reported so a human has to explain it.
    const changed = diffBundleLines(before, before.replace('return 1;', 'return 3;'));
    assert.deepEqual([changed.insertedLines, changed.deletedLines], [1, 1]);
    assert.deepEqual(changed.inserted, ['  return 3;']);
});
