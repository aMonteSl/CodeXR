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

async function joinRoom(socket, roomId) {
    const joinedPromise = waitForMessage(socket, (payload) => payload.type === 'room-joined');
    const snapshotPromise = waitForMessage(socket, (payload) => payload.type === 'room-snapshot');
    socket.send(JSON.stringify({
        type: 'room-join',
        roomId,
    }));
    const joined = await joinedPromise;
    const snapshot = await snapshotPromise;
    return { joined, snapshot };
}

async function createCollaborationServer() {
    const { CollaborationRoomServer } = loadCollaborationRoomServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const collaboration = new CollaborationRoomServer(server);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return {
        server,
        collaboration,
        url: `ws://127.0.0.1:${port}/codexr-room`,
    };
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

        const hostJoined = waitForMessage(host, (payload) => payload.type === 'room-joined');
        const peerJoined = waitForMessage(peer, (payload) => payload.type === 'room-joined');
        const isolatedJoined = waitForMessage(isolated, (payload) => payload.type === 'room-joined');
        const hostSnapshot = waitForMessage(host, (payload) => payload.type === 'room-snapshot');
        const peerSnapshot = waitForMessage(peer, (payload) => payload.type === 'room-snapshot');
        const isolatedSnapshot = waitForMessage(isolated, (payload) => payload.type === 'room-snapshot');

        host.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        peer.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        isolated.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:beta' }));

        await Promise.all([
            hostJoined,
            peerJoined,
            isolatedJoined,
            hostSnapshot,
            peerSnapshot,
            isolatedSnapshot,
        ]);

        const peerPresence = waitForMessage(peer, (payload) => payload.type === 'presence-joined');
        host.send(JSON.stringify({
            type: 'presence-update',
            roomId: 'codexr-session:alpha',
            payload: {
                head: { position: { x: 1, y: 2, z: 3 } },
            },
        }));
        const receivedPresence = await peerPresence;
        assert.equal(receivedPresence.payload.head.position.x, 1);
        assert.equal(typeof receivedPresence.payload.displayName, 'string');
        assert.equal(receivedPresence.payload.displayName.length > 0, true);

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
        const lateJoined = waitForMessage(lateJoiner, (payload) => payload.type === 'room-joined');
        const lateSnapshotPromise = waitForMessage(lateJoiner, (payload) => payload.type === 'room-snapshot');
        lateJoiner.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:alpha' }));
        await lateJoined;
        const lateSnapshot = await lateSnapshotPromise;
        assert.equal(lateSnapshot.payload.entities.length, 1);
        assert.equal(lateSnapshot.payload.entities[0].entityId, 'managed-1');
        assert.equal(lateSnapshot.payload.presence.length, 1);
        assert.equal(typeof lateSnapshot.payload.presence[0].displayName, 'string');
        assert.equal(lateSnapshot.payload.presence[0].displayName.length > 0, true);

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

test('collaboration room server assigns shared Star Wars display names and composes names when the simple pool is exhausted', async () => {
    const { CollaborationRoomServer } = loadCollaborationRoomServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const collaboration = new CollaborationRoomServer(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `ws://127.0.0.1:${port}/codexr-room`;
    const sockets = [];

    try {
        for (let index = 0; index < 15; index += 1) {
            const socket = new WebSocket(url);
            sockets.push(socket);
            await waitForOpen(socket);
            socket.__joinedPromise = waitForMessage(socket, (payload) => payload.type === 'room-joined');
            socket.__snapshotPromise = waitForMessage(socket, (payload) => payload.type === 'room-snapshot');
            socket.send(JSON.stringify({ type: 'room-join', roomId: 'codexr-session:names' }));
        }

        const joinMessages = await Promise.all(sockets.map((socket) => socket.__joinedPromise));
        await Promise.all(sockets.map((socket) => socket.__snapshotPromise));

        const displayNames = joinMessages.map((payload) => payload.displayName);
        assert.equal(new Set(displayNames).size, displayNames.length);
        assert.equal(displayNames.some((name) => typeof name === 'string' && name.includes(' ')), true);
    } finally {
        sockets.forEach((socket) => socket.close());
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('collaboration room server uses authoritative sessions and scopes profile updates', async () => {
    const { CollaborationRoomServer } = loadCollaborationRoomServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const profiles = new Map([
        ['host-session', { identityMode: 'custom', customName: 'Ayla Nunez', avatarId: 'avatar-2' }],
        ['guest-session', { identityMode: 'custom', customName: 'Ayla Nunez', avatarId: 'avatar-3' }],
    ]);
    const collaboration = new CollaborationRoomServer(server, '/codexr-room', {
        resolveSession(request) {
            const sessionId = request.headers['x-test-session'];
            const profile = profiles.get(sessionId);
            return profile ? {
                sessionId,
                installationId: `${sessionId}-installation`,
                profile: { ...profile },
                clientKind: 'codexr',
                remote: false,
                expiresAt: Date.now() + 60_000,
            } : null;
        },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `ws://127.0.0.1:${port}/codexr-room`;
    const host = new WebSocket(url, { headers: { 'x-test-session': 'host-session' } });
    const guest = new WebSocket(url, { headers: { 'x-test-session': 'guest-session' } });
    const direct = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(host), waitForOpen(guest), waitForOpen(direct)]);
        const hostJoin = await joinRoom(host, 'codexr-session:identity');
        const guestJoin = await joinRoom(guest, 'codexr-session:identity');
        const directJoin = await joinRoom(direct, 'codexr-session:identity');
        assert.equal(hostJoin.joined.displayName, 'Ayla Nunez');
        assert.equal(guestJoin.joined.displayName, 'Ayla Nunez 2');
        assert.equal(directJoin.joined.payload.participant.identityMode, 'anonymous');
        const summaries = collaboration.getConnectedParticipants('codexr-session:identity');
        assert.deepEqual(
            summaries.map((participant) => [participant.clientKind, participant.connectionScope]),
            [
                ['codexr', 'local'],
                ['codexr', 'local'],
                ['browser', 'local'],
            ],
        );

        const guestIdentity = waitForMessage(host, (payload) => (
            payload.type === 'participant-updated'
            && payload.payload.peerId === guestJoin.joined.peerId
        ));
        collaboration.updateSessionProfile('guest-session', {
            identityMode: 'custom',
            customName: 'Mara Jade',
            avatarId: 'avatar-4',
        });
        const updated = await guestIdentity;
        assert.equal(updated.payload.displayName, 'Mara Jade');
        assert.equal(updated.payload.avatarId, 'avatar-4');
        assert.equal(hostJoin.joined.displayName, 'Ayla Nunez');
        assert.equal(
            collaboration.getConnectedParticipants('codexr-session:identity')[1].displayName,
            'Mara Jade',
        );
    } finally {
        host.close();
        guest.close();
        direct.close();
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('collaboration room server restricts administration and promotes the oldest guest', async () => {
    const { server, collaboration, url } = await createCollaborationServer();
    const host = new WebSocket(url);
    const oldestGuest = new WebSocket(url);
    const newestGuest = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(host), waitForOpen(oldestGuest), waitForOpen(newestGuest)]);
        const hostJoin = await joinRoom(host, 'codexr-session:roles');
        const oldestJoin = await joinRoom(oldestGuest, 'codexr-session:roles');
        const newestJoin = await joinRoom(newestGuest, 'codexr-session:roles');

        const forbiddenTransfer = waitForMessage(oldestGuest, (payload) => (
            payload.type === 'error' && payload.payload.code === 'forbidden'
        ));
        oldestGuest.send(JSON.stringify({
            type: 'host-transfer',
            payload: { peerId: newestJoin.joined.peerId },
        }));
        await forbiddenTransfer;

        const promotedByTransfer = waitForMessage(newestGuest, (payload) => (
            payload.type === 'role-updated'
            && payload.payload.peerId === newestJoin.joined.peerId
            && payload.payload.role === 'host'
        ));
        host.send(JSON.stringify({
            type: 'host-transfer',
            payload: { peerId: newestJoin.joined.peerId },
        }));
        await promotedByTransfer;

        const forbiddenKick = waitForMessage(host, (payload) => (
            payload.type === 'error' && payload.payload.code === 'forbidden'
        ));
        host.send(JSON.stringify({
            type: 'participant-kick',
            payload: { peerId: oldestJoin.joined.peerId },
        }));
        await forbiddenKick;

        const kicked = waitForMessage(oldestGuest, (payload) => payload.type === 'participant-kick');
        newestGuest.send(JSON.stringify({
            type: 'participant-kick',
            payload: { peerId: oldestJoin.joined.peerId },
        }));
        assert.equal((await kicked).payload.peerId, oldestJoin.joined.peerId);

        const replacementHost = waitForMessage(host, (payload) => (
            payload.type === 'role-updated'
            && payload.payload.peerId === hostJoin.joined.peerId
            && payload.payload.role === 'host'
        ));
        newestGuest.close();
        await replacementHost;
    } finally {
        host.close();
        oldestGuest.close();
        newestGuest.close();
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('collaboration room server keeps one presenter and lets the host stop another presenter', async () => {
    const { server, collaboration, url } = await createCollaborationServer();
    const host = new WebSocket(url);
    const guest = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(host), waitForOpen(guest)]);
        const hostJoin = await joinRoom(host, 'codexr-session:presenter');
        const guestJoin = await joinRoom(guest, 'codexr-session:presenter');

        const hostStarted = waitForMessage(guest, (payload) => (
            payload.type === 'presenter-started' && payload.payload.peerId === hostJoin.joined.peerId
        ));
        host.send(JSON.stringify({ type: 'presenter-started' }));
        await hostStarted;

        const hostStopped = waitForMessage(host, (payload) => (
            payload.type === 'presenter-stopped' && payload.payload.peerId === hostJoin.joined.peerId
        ));
        const guestStarted = waitForMessage(host, (payload) => (
            payload.type === 'presenter-started' && payload.payload.peerId === guestJoin.joined.peerId
        ));
        guest.send(JSON.stringify({ type: 'presenter-started' }));
        await Promise.all([hostStopped, guestStarted]);

        const hostRestarted = waitForMessage(guest, (payload) => (
            payload.type === 'presenter-started' && payload.payload.peerId === hostJoin.joined.peerId
        ));
        host.send(JSON.stringify({ type: 'presenter-started' }));
        await hostRestarted;

        const forbiddenStop = waitForMessage(guest, (payload) => (
            payload.type === 'error' && payload.payload.code === 'forbidden'
        ));
        guest.send(JSON.stringify({
            type: 'presenter-stopped',
            payload: { peerId: hostJoin.joined.peerId },
        }));
        await forbiddenStop;

        const guestRestarted = waitForMessage(host, (payload) => (
            payload.type === 'presenter-started' && payload.payload.peerId === guestJoin.joined.peerId
        ));
        guest.send(JSON.stringify({ type: 'presenter-started' }));
        await guestRestarted;

        const hostForcedStop = waitForMessage(guest, (payload) => (
            payload.type === 'presenter-stopped' && payload.payload.peerId === guestJoin.joined.peerId
        ));
        host.send(JSON.stringify({
            type: 'presenter-stopped',
            payload: { peerId: guestJoin.joined.peerId },
        }));
        await hostForcedStop;
    } finally {
        host.close();
        guest.close();
        collaboration.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});
