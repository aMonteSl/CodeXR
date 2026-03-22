const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { scanDirectoryScope } = require('../../out/code_analysis/engine/watchers/directorySnapshot.js');

function createTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('scanDirectoryScope respects deep mode and ignores excluded directories', async () => {
    const root = createTempDir('codexr-scan-');
    const nested = path.join(root, 'src');
    const ignored = path.join(root, '.git');

    fs.mkdirSync(nested, { recursive: true });
    fs.mkdirSync(ignored, { recursive: true });

    fs.writeFileSync(path.join(root, 'app.ts'), 'export const app = 1;');
    fs.writeFileSync(path.join(root, 'notes.txt'), 'ignore me');
    fs.writeFileSync(path.join(nested, 'util.ts'), 'export const util = 2;');
    fs.writeFileSync(path.join(ignored, 'config'), 'hidden');

    const shallow = await scanDirectoryScope(root, false);
    assert.deepEqual(shallow.watchedDirectories.sort(), [root].sort());
    assert.deepEqual(shallow.files.map((entry) => path.basename(entry.filePath)).sort(), ['app.ts']);

    const deep = await scanDirectoryScope(root, true);
    assert.ok(deep.watchedDirectories.includes(root));
    assert.ok(deep.watchedDirectories.includes(nested));
    assert.equal(deep.watchedDirectories.some((directory) => directory.includes('.git')), false);
    assert.deepEqual(deep.files.map((entry) => path.basename(entry.filePath)).sort(), ['app.ts', 'util.ts']);

    fs.rmSync(root, { recursive: true, force: true });
});
