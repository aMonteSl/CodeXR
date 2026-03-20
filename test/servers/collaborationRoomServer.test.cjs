const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');

const projectRoot = path.resolve(__dirname, '..', '..');

function loadCollaborationRoomServer() {
    return require(path.join(projectRoot, 'out', 'servers', 'runtime', 'collaboration', 'collaborationRoomServer.js'));
}

function waitForOpen(socket) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket open')), 2500);
        socket.once('open', () => {
            clearTimeout(timeout);
            resolve();
        });
        socket.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

function waitForMessage(socket, predicate) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for collaboration message')), 2500);

        function onMessage(raw) {
            const payload = JSON.parse(raw.toString('utf8'));
            if (!predicate(payload)) {
                return;
            }
            clearTimeout(timeout);
            socket.off('message', onMessage);
            resolve(payload);
        }

        socket.on('message', onMessage);
    });
}

test('collaboration room server isolates rooms, snapshots shared state, and releases locks on disconnect', async () => {
    const { CollaborationRoomServer } = loadCollaborationRoomServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const collaboration = new CollaborationRoomServer(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `ws://127.0.0.1:${port}/codexr-room`;

    const host = new WebSocket(url);
    const peer = new WebSocket(url);
    const isolated = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(host), waitForOpen(peer), waitForOpen(isolated)]);

        host.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        peer.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        isolated.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:beta' }));

        await Promise.all([
            waitForMessage(host, (payload) => payload.type === 'room-snapshot'),
            waitForMessage(peer, (payload) => payload.type === 'room-snapshot'),
            waitForMessage(isolated, (payload) => payload.type === 'room-snapshot'),
        ]);

        const peerPresence = waitForMessage(peer, (payload) => payload.type === 'presence-joined');
        host.send(JSON.stringify({
            type: 'presence-update',
            roomId: 'codexr-session:alpha',
            payload: {
                head: { position: { x: 1, y: 2, z: 3 } },
            },
        }));
        assert.equal((await peerPresence).payload.head.position.x, 1);

        const sharedEntity = {
            entityKind: 'screen',
            entityId: 'managed-1',
            displayName: 'Team screen',
            transform: {
                position: { x: 1, y: 2, z: 3 },
                rotation: { x: 0, y: 90, z: 0 },
            },
        };

        const forwardedEntity = waitForMessage(peer, (payload) => payload.type === 'entity-added');
        host.send(JSON.stringify({
            type: 'entity-added',
            roomId: 'codexr-session:alpha',
            payload: sharedEntity,
        }));
        assert.equal((await forwardedEntity).payload.entityId, 'managed-1');

        const lateJoiner = new WebSocket(url);
        await waitForOpen(lateJoiner);
        lateJoiner.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        const lateSnapshot = await waitForMessage(lateJoiner, (payload) => payload.type === 'room-snapshot');
        assert.equal(lateSnapshot.payload.entities.length, 1);
        assert.equal(lateSnapshot.payload.entities[0].entityId, 'managed-1');
        assert.equal(lateSnapshot.payload.presence.length, 1);

        isolated.send(JSON.stringify({
            type: 'room-join',
            roomId: 'codexr-session:beta',
        }));
        const betaSnapshot = await waitForMessage(isolated, (payload) => payload.type === 'room-snapshot');
        assert.equal(betaSnapshot.payload.entities.length, 0);

        const peerLockEvent = waitForMessage(peer, (payload) => payload.type === 'entity-lock');
        host.send(JSON.stringify({
            type: 'entity-lock',
            roomId: 'codexr-session:alpha',
            entityKind: 'screen',
            entityId: 'managed-1',
            payload: { entityKind: 'screen', entityId: 'managed-1' },
        }));
        assert.equal((await peerLockEvent).payload.gestureOwnerPeerId.length > 0, true);

        const deniedLock = waitForMessage(peer, (payload) => payload.type === 'entity-lock-denied');
        peer.send(JSON.stringify({
            type: 'entity-lock',
            roomId: 'codexr-session:alpha',
            entityKind: 'screen',
            entityId: 'managed-1',
            payload: { entityKind: 'screen', entityId: 'managed-1' },
        }));
        assert.equal((await deniedLock).payload.entityId, 'managed-1');

        const unlockEvent = waitForMessage(peer, (payload) => payload.type === 'entity-unlock');
        host.close();
        assert.equal((await unlockEvent).payload.entityId, 'managed-1');

        lateJoiner.close();
    } finally {
        host.close();
        peer.close();
        isolated.close();
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});
