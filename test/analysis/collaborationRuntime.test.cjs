const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const { requireAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const collaborationRuntime = requireAssembledRuntime('collaboration', 'codexrCollaborationRuntime.js');
const avatarRuntime = require(path.join(
    projectRoot,
    'templates',
    'components',
    'codexr',
    'avatar',
    'codexrAvatarRuntime.js',
));

test('collaboration profile defaults to anonymous and sanitizes custom Unicode names', () => {
    assert.deepEqual(collaborationRuntime.DEFAULT_PROFILE, {
        identityMode: 'anonymous',
        customName: '',
        avatarId: 'avatar-1',
    });
    assert.equal(collaborationRuntime.sanitizeDisplayName('  Ayla\u0000  Núñez  '), 'Ayla Núñez');
    assert.equal(collaborationRuntime.sanitizeDisplayName('x'), '');
    assert.equal(collaborationRuntime.sanitizeDisplayName('x'.repeat(33)), '');
});

test('avatar assets are enabled only by the extension configuration and load once', async () => {
    let fetchCount = 0;
    const fakeResponse = {
        ok: true,
        async blob() {
            return new Blob(['glb']);
        },
    };
    const fakeWindow = {
        document: null,
        CustomEvent: class {},
        URL: {
            createObjectURL() {
                return 'blob:codexr-avatar';
            },
        },
        async fetch() {
            fetchCount += 1;
            return fakeResponse;
        },
    };
    const manager = avatarRuntime.createAssetManager(fakeWindow);
    assert.equal(manager.getState().available, false);
    assert.equal(manager.getState().sizeLabel, '2.16 MiB');
    assert.equal(await manager.load(), null);
    assert.equal(fetchCount, 0);

    assert.equal(await manager.configure({
        available: true,
        modelUrl: '/api/collaboration/avatar-model',
    }), 'blob:codexr-avatar');
    assert.equal(fetchCount, 1);
    assert.equal(manager.getState().ready, true);
    assert.equal(await manager.load(), 'blob:codexr-avatar');
    assert.equal(fetchCount, 1);
});
