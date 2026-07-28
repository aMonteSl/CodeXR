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

function loadAvatarComponentDefinition() {
    const modulePath = path.join(
        projectRoot, 'templates', 'components', 'codexr', 'avatar', 'codexrAvatarRuntime.js',
    );
    const captured = {};
    const previousAframe = globalThis.AFRAME;
    globalThis.AFRAME = {
        components: {},
        registerComponent(name, definition) {
            captured[name] = definition;
        },
    };
    delete require.cache[require.resolve(modulePath)];
    require(modulePath);
    delete require.cache[require.resolve(modulePath)];
    globalThis.AFRAME = previousAframe;
    return captured['codexr-avatar'];
}

test('avatar models are scaled to a human height whatever units they were authored in', () => {
    const definition = loadAvatarComponentDefinition();
    assert.ok(definition, 'codexr-avatar component should be registered');
    const targetHeight = definition.schema.avatarHeight.default;
    assert.equal(targetHeight, 1.55);
    // The player colour has to actually override the model's own materials.
    assert.ok(definition.schema.tintStrength.default >= 0.5);

    // Robot Expressive is authored in centimetres: ~4.6 units tall, feet at ~0.
    const bounds = { min: { x: -1, y: -0.02, z: -1 }, max: { x: 1, y: 4.578, z: 1 } };
    const previousThree = globalThis.THREE;
    globalThis.THREE = {
        Box3: class {
            setFromObject() {
                this.min = bounds.min;
                this.max = bounds.max;
                return this;
            }
        },
    };

    const applied = [];
    const labelApplied = [];
    const context = {
        data: { avatarHeight: targetHeight },
        modelEl: {
            object3D: { updateMatrixWorld() {} },
            setAttribute(name, value) { applied.push([name, value]); },
        },
        labelRoot: { setAttribute(name, value) { labelApplied.push([name, value]); } },
    };

    try {
        definition.fitModelToAvatarHeight.call(context, {});
    } finally {
        globalThis.THREE = previousThree;
    }

    // The name tag is parked above the fitted model's crown, not at a fixed
    // height, so a taller model can never grow into it.
    assert.equal(labelApplied.length, 1);
    const labelY = Number(labelApplied[0][1].split(' ')[1]);
    const modelTop = -1.62 + targetHeight;
    assert.ok(labelY >= 0.55, `label should sit at least 0.55 above the head point, got ${labelY}`);
    assert.ok(labelY - modelTop >= 0.6, `label should clear the model crown, got ${labelY - modelTop}`);

    // Measured unscaled first, so a reload cannot compound the previous fit.
    assert.deepEqual(applied[0], ['scale', '1 1 1']);

    const expectedScale = targetHeight / (bounds.max.y - bounds.min.y);
    const [scaleName, scaleValue] = applied[1];
    assert.equal(scaleName, 'scale');
    const scaleParts = scaleValue.split(' ').map(Number);
    assert.equal(scaleParts.length, 3);
    scaleParts.forEach((part) => assert.ok(Math.abs(part - expectedScale) < 1e-9));

    // The fitted model stands 1.7 m tall with its feet on the floor.
    const [positionName, positionValue] = applied[2];
    assert.equal(positionName, 'position');
    const y = Number(positionValue.split(' ')[1]);
    assert.ok(Math.abs(y - (-1.62 - bounds.min.y * expectedScale)) < 1e-9);
    assert.ok(Math.abs((bounds.max.y - bounds.min.y) * expectedScale - targetHeight) < 1e-9);
});

test('name tags yaw toward the viewer regardless of which way the avatar faces', () => {
    const definition = loadAvatarComponentDefinition();
    const previousThree = globalThis.THREE;
    globalThis.THREE = {
        Vector3: class {
            constructor() { this.x = 0; this.y = 0; this.z = 0; }
        },
    };

    const rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    const context = {
        labelRoot: {
            object3D: {
                rotation,
                getWorldPosition() { return { x: 0, y: 2, z: 0 }; },
            },
        },
        // The avatar itself is turned 90°; the tag must cancel that out.
        bodyRoot: { object3D: { rotation: { y: Math.PI / 2 } } },
    };
    const cameraAt = (x, z) => ({ getWorldPosition() { return { x, y: 1.6, z }; } });

    try {
        // Camera straight ahead on +Z: world yaw 0, minus the parent's 90°.
        definition.faceLabelToCamera.call(context, cameraAt(0, 5));
        assert.ok(Math.abs(rotation.y - (0 - Math.PI / 2)) < 1e-9);
        assert.equal(rotation.x, 0, 'no pitch: names must not tilt');
        assert.equal(rotation.z, 0);

        // Camera off to +X: world yaw 90°, cancelling the parent exactly.
        definition.faceLabelToCamera.call(context, cameraAt(5, 0));
        assert.ok(Math.abs(rotation.y - 0) < 1e-9);

        // Camera behind on -Z: world yaw 180°.
        definition.faceLabelToCamera.call(context, cameraAt(0, -5));
        assert.ok(Math.abs(rotation.y - (Math.PI - Math.PI / 2)) < 1e-9);
    } finally {
        globalThis.THREE = previousThree;
    }
});

test('avatar fitting leaves the model alone when it cannot be measured', () => {
    const definition = loadAvatarComponentDefinition();
    const applied = [];
    const context = {
        data: { avatarHeight: 1.7 },
        modelEl: {
            object3D: { updateMatrixWorld() {} },
            setAttribute(name, value) { applied.push([name, value]); },
        },
    };
    const previousThree = globalThis.THREE;
    globalThis.THREE = {
        Box3: class {
            setFromObject() {
                this.min = { x: 0, y: 0, z: 0 };
                this.max = { x: 0, y: 0, z: 0 };
                return this;
            }
        },
    };
    try {
        definition.fitModelToAvatarHeight.call(context, {});
        assert.deepEqual(applied, [['scale', '1 1 1']]);
        applied.length = 0;
        definition.fitModelToAvatarHeight.call(context, null);
        assert.deepEqual(applied, []);
    } finally {
        globalThis.THREE = previousThree;
    }
});

test('collaboration profile defaults to anonymous and sanitizes custom Unicode names', () => {
    assert.deepEqual(collaborationRuntime.DEFAULT_PROFILE, {
        identityMode: 'anonymous',
        customName: '',
        // 'auto' lets each room hand out a colour nobody else there is using.
        avatarId: 'auto',
    });
    assert.equal(collaborationRuntime.sanitizeDisplayName('  Ayla\u0000  Núñez  '), 'Ayla Núñez');
    assert.equal(collaborationRuntime.sanitizeDisplayName('x'), '');
    assert.equal(collaborationRuntime.sanitizeDisplayName('x'.repeat(33)), '');
});

test('automatic avatar colour survives profile normalization and validation', () => {
    const {
        AUTO_AVATAR_ID,
        DEFAULT_COLLABORATION_PROFILE,
        ASSIGNABLE_AVATAR_IDS,
        VALID_AVATAR_IDS,
        normalizeCollaborationProfile,
    } = require(path.join(projectRoot, 'out', 'collaboration', 'model', 'collaborationProfile.js'));

    assert.equal(AUTO_AVATAR_ID, 'auto');
    assert.equal(DEFAULT_COLLABORATION_PROFILE.avatarId, AUTO_AVATAR_ID);
    // 'auto' is assignable but is NOT part of the palette rooms allocate from.
    assert.equal(ASSIGNABLE_AVATAR_IDS.has(AUTO_AVATAR_ID), true);
    assert.equal(VALID_AVATAR_IDS.has(AUTO_AVATAR_ID), false);

    assert.equal(normalizeCollaborationProfile({ avatarId: 'auto' }).avatarId, 'auto');
    assert.equal(normalizeCollaborationProfile({ avatarId: 'avatar-4' }).avatarId, 'avatar-4');
    assert.equal(normalizeCollaborationProfile({ avatarId: 'nope' }).avatarId, 'auto');
    assert.equal(normalizeCollaborationProfile({}).avatarId, 'auto');
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
    assert.equal(manager.getState().sizeLabel, '0.44 MiB');
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

test('a session-ended message shows the disconnect screen once and stops the reconnect loop', async () => {
    const sockets = [];
    const timeouts = [];

    function createFakeElement(tag) {
        return {
            tagName: String(tag || '').toUpperCase(),
            id: '',
            style: {},
            children: [],
            textContent: '',
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            setAttribute() {},
        };
    }
    const body = createFakeElement('body');
    function findById(node, id) {
        if (node.id === id) {
            return node;
        }
        for (const child of node.children || []) {
            const hit = findById(child, id);
            if (hit) {
                return hit;
            }
        }
        return null;
    }
    function FakeWebSocket(url) {
        this.url = url;
        this.readyState = 0;
        this.closed = false;
        sockets.push(this);
    }
    FakeWebSocket.prototype.send = function () {};
    FakeWebSocket.prototype.close = function () {
        this.closed = true;
    };
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CONNECTING = 0;

    const fakeWindow = {
        document: {
            body,
            readyState: 'complete',
            createElement: createFakeElement,
            getElementById(id) {
                return findById(body, id);
            },
            querySelector() {
                return null;
            },
            addEventListener() {},
            dispatchEvent() {
                return true;
            },
        },
        location: { protocol: 'http:', host: '127.0.0.1:7777' },
        WebSocket: FakeWebSocket,
        CustomEvent: class {
            constructor(type, init) {
                this.type = type;
                this.detail = init && init.detail;
            }
        },
        addEventListener() {},
        setTimeout(fn, ms) {
            timeouts.push({ fn, ms });
            return timeouts.length;
        },
        clearTimeout() {},
        console: { log() {}, warn() {}, error() {} },
    };

    const client = collaborationRuntime.createClient(fakeWindow);
    client.connect({ presenceEnabled: false, cursorPresenceEnabled: false });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(sockets.length, 1, 'connect should open one socket');
    const socket = sockets[0];

    socket.onmessage({ data: JSON.stringify({ type: 'session-ended', payload: { reason: 'host-closed' } }) });

    const state = client.getState();
    assert.equal(state.sessionEnded, true);
    assert.equal(state.connectionStatus, 'ended');
    assert.equal(socket.closed, true, 'the client should close its own socket');

    const screen = findById(body, 'codexrDisconnectScreen');
    assert.ok(screen, 'the disconnect screen should be on the page');
    const texts = screen.children.map((child) => child.textContent);
    assert.ok(texts.includes('Session ended'), `missing title, got: ${texts.join(' | ')}`);
    assert.ok(texts.includes('The host closed the session.'), `missing message, got: ${texts.join(' | ')}`);

    // The socket close that follows must not schedule a reconnect...
    socket.onclose({ code: 4002 });
    assert.equal(timeouts.length, 0, 'no reconnect may be scheduled after session-ended');
    assert.equal(client.getState().connectionStatus, 'ended');

    // ...and a duplicate message must not stack a second screen.
    socket.onmessage({ data: JSON.stringify({ type: 'session-ended', payload: { reason: 'host-closed' } }) });
    const screens = body.children.filter((child) => child.id === 'codexrDisconnectScreen');
    assert.equal(screens.length, 1);
});

// ── Self-contained exports ───────────────────────────────────────────────────
// When the session endpoint is unreachable AND codexr-export-manifest.json is
// served next to the scene, the client must switch to offline-export mode:
// capabilities come from the manifest, its entity snapshots are injected
// through the same path a room snapshot uses, and no WebSocket is ever opened.

function buildOfflineFakeWindow(options) {
    const sockets = [];
    function FakeWebSocket() {
        sockets.push(this);
    }
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.CONNECTING = 0;
    FakeWebSocket.prototype.close = function () {};

    const manifest = options.manifest;
    const fakeWindow = {
        document: null,
        location: { protocol: 'http:', host: '127.0.0.1:7777' },
        WebSocket: FakeWebSocket,
        addEventListener() {},
        setTimeout(fn) { return globalThis.setTimeout(fn, 0); },
        clearTimeout(id) { globalThis.clearTimeout(id); },
        console: { log() {}, warn() {}, error() {}, info() {} },
        fetch(url) {
            const target = String(url);
            if (target.includes('/api/collaboration/session')) {
                return options.sessionOk
                    ? Promise.resolve({ ok: true, json: async () => ({ roomId: 'room-1', capabilities: { dependencyGraph: true } }) })
                    : Promise.reject(new Error('offline'));
            }
            if (target.includes('codexr-export-manifest.json')) {
                return manifest
                    ? Promise.resolve({ ok: true, json: async () => manifest })
                    : Promise.resolve({ ok: false });
            }
            if (target.includes('./comparison/revision-1.json')) {
                return Promise.resolve({ ok: true, json: async () => ({ revision: 1, mode: 'historical-compare' }) });
            }
            return Promise.resolve({ ok: false });
        },
    };
    return { fakeWindow, sockets };
}

const OFFLINE_MANIFEST = {
    kind: 'codexr-export',
    capabilities: {
        dependencyGraph: true,
        dependencyGraphReason: '',
        historicalComparison: true,
        historicalComparisonReason: 'Replay only: new comparisons need the live CodeXR session.',
        projectEvolution: false,
        projectEvolutionReason: 'No evolution movie was generated before export.',
    },
    entities: [
        {
            entityKind: 'dependency-graph',
            entityId: 'main',
            mode: 'dependency-graph',
            status: 'ready',
            datasetUrl: './dependencies/dependency-graph-3.json',
            revision: 3,
        },
        {
            entityKind: 'historical-comparison',
            entityId: 'main',
            mode: 'historical-compare',
            resultUrl: './comparison/revision-1.json',
        },
    ],
    historicalComparison: { comparisons: [] },
};

test('offline export: manifest capabilities stand in for the session, entities inject, and no socket opens', async () => {
    const { fakeWindow, sockets } = buildOfflineFakeWindow({ sessionOk: false, manifest: OFFLINE_MANIFEST });
    const client = collaborationRuntime.createClient(fakeWindow);

    // A runtime registered BEFORE the manifest resolves must still get its
    // snapshot (through pendingEntities or direct application).
    const dependencyStates = [];
    client.registerEntityRuntime({
        entityKind: 'dependency-graph',
        entityId: 'main',
        applySharedState(state) { dependencyStates.push(state); },
    });

    client.connect({ presenceEnabled: false, cursorPresenceEnabled: false });
    const info = await client.getSessionInfoAsync();
    // Let the entity fetch/injection microtasks drain.
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(client.isOfflineExport(), true);
    assert.equal(info.offlineExport, true);
    assert.equal(info.capabilities.dependencyGraph, true);
    assert.match(info.capabilities.historicalComparisonReason, /Replay only/);
    assert.equal(sockets.length, 0, 'an offline export must never open a WebSocket');

    assert.equal(dependencyStates.length, 1, 'the early registrant should receive its snapshot');
    assert.equal(dependencyStates[0].datasetUrl, './dependencies/dependency-graph-3.json');

    // A runtime registered AFTER the injection gets its entity replayed, with
    // the resultUrl already resolved into a result.
    const historicalStates = [];
    client.registerEntityRuntime({
        entityKind: 'historical-comparison',
        entityId: 'main',
        applySharedState(state) { historicalStates.push(state); },
    });
    assert.equal(historicalStates.length, 1, 'the late registrant should receive the pending snapshot');
    assert.equal(historicalStates[0].result.revision, 1);

    assert.equal(client.getOfflineExportManifest().kind, 'codexr-export');
});

test('online regression: a reachable session keeps the socket path and never flags offline', async () => {
    const { fakeWindow, sockets } = buildOfflineFakeWindow({ sessionOk: true, manifest: OFFLINE_MANIFEST });
    const client = collaborationRuntime.createClient(fakeWindow);

    client.connect({ presenceEnabled: false, cursorPresenceEnabled: false });
    const info = await client.getSessionInfoAsync();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(client.isOfflineExport(), false);
    assert.equal(info.offlineExport, undefined);
    assert.equal(sockets.length, 1, 'a live session must open its WebSocket exactly as before');
});

test('offline export: a session failure WITHOUT a manifest keeps the plain fallback (no offline flag)', async () => {
    const { fakeWindow, sockets } = buildOfflineFakeWindow({ sessionOk: false, manifest: null });
    const client = collaborationRuntime.createClient(fakeWindow);

    client.connect({ presenceEnabled: false, cursorPresenceEnabled: false });
    const info = await client.getSessionInfoAsync();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(client.isOfflineExport(), false);
    assert.equal(info.offlineExport, undefined);
    // No offline manifest: the client keeps trying to reach the room, exactly
    // like a temporarily unreachable live server.
    assert.equal(sockets.length, 1);
});
