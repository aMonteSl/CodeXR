const test = require('node:test');
const assert = require('node:assert/strict');
const {
    shouldSkipWorkspaceEntry,
    sortWorkspaceEntries,
} = require('../../out/code_analysis/services/workspaceSnapshotModel.js');

test('shouldSkipWorkspaceEntry filters hidden and generated entries', () => {
    assert.equal(shouldSkipWorkspaceEntry('.git'), true);
    assert.equal(shouldSkipWorkspaceEntry('.env'), true);
    assert.equal(shouldSkipWorkspaceEntry('node_modules'), true);
    assert.equal(shouldSkipWorkspaceEntry('__pycache__'), true);
    assert.equal(shouldSkipWorkspaceEntry('src'), false);
    assert.equal(shouldSkipWorkspaceEntry('index.ts'), false);
});

test('sortWorkspaceEntries keeps directories first and sorts alphabetically', () => {
    const sorted = sortWorkspaceEntries([
        { name: 'zeta.ts', isDirectory: false },
        { name: 'src', isDirectory: true },
        { name: 'assets', isDirectory: true },
        { name: 'app.ts', isDirectory: false },
    ]);

    assert.deepEqual(sorted, [
        { name: 'assets', isDirectory: true },
        { name: 'src', isDirectory: true },
        { name: 'app.ts', isDirectory: false },
        { name: 'zeta.ts', isDirectory: false },
    ]);
});
