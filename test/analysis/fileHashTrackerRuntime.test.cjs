const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { FileHashTracker } = require('../../out/code_analysis/engine/watchers/fileHashTracker.js');
const { SHA256Generator } = require('../../out/utils/sha256Generator.js');

function createTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('FileHashTracker only reports candidates whose hash really changed', async () => {
    const root = createTempDir('codexr-hash-');
    const filePath = path.join(root, 'sample.ts');
    fs.writeFileSync(filePath, 'export const value = 1;\n');

    const initialStat = fs.statSync(filePath);
    const initialHash = await SHA256Generator.generateFileHash(filePath);
    const tracker = new FileHashTracker([
        {
            filePath,
            hash: initialHash,
            size: initialStat.size,
            mtimeMs: initialStat.mtimeMs,
        },
    ]);

    const touchedDate = new Date(Date.now() + 2000);
    fs.utimesSync(filePath, touchedDate, touchedDate);
    const touchedStat = fs.statSync(filePath);

    const noContentDiff = tracker.diffAgainst([
        { filePath, size: touchedStat.size, mtimeMs: touchedStat.mtimeMs },
    ]);
    assert.deepEqual(noContentDiff.added, []);
    assert.deepEqual(noContentDiff.removed, []);
    assert.deepEqual(noContentDiff.suspectedChanged, [filePath]);

    const noHashChanges = await tracker.resolveActuallyChanged(
        noContentDiff.suspectedChanged,
        new Map([[filePath, { filePath, size: touchedStat.size, mtimeMs: touchedStat.mtimeMs }]]),
    );
    assert.deepEqual(noHashChanges, []);
    assert.equal(tracker.getTrackedFiles()[0].hash, initialHash);
    assert.equal(tracker.getTrackedFiles()[0].mtimeMs, touchedStat.mtimeMs);

    fs.writeFileSync(filePath, 'export const value = 2;\n');
    const changedStat = fs.statSync(filePath);
    const contentDiff = tracker.diffAgainst([
        { filePath, size: changedStat.size, mtimeMs: changedStat.mtimeMs },
    ]);
    const changedFiles = await tracker.resolveActuallyChanged(
        contentDiff.suspectedChanged,
        new Map([[filePath, { filePath, size: changedStat.size, mtimeMs: changedStat.mtimeMs }]]),
    );

    assert.deepEqual(changedFiles, [filePath]);
    assert.notEqual(tracker.getTrackedFiles()[0].hash, initialHash);
    assert.equal(tracker.getTrackedFiles()[0].mtimeMs, changedStat.mtimeMs);

    fs.rmSync(root, { recursive: true, force: true });
});
