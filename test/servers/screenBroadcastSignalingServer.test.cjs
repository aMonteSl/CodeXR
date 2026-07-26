const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const WebSocket = require('ws');

const projectRoot = path.resolve(__dirname, '..', '..');

function loadBroadcastSignalingServer() {
    return require(path.join(projectRoot, 'out', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.js'));
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
        const timeout = setTimeout(() => {
            reject(new Error('Timed out waiting for signaling message'));
        }, 2500);

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

function waitForSilence(socket, durationMs, predicate) {
    return new Promise((resolve, reject) => {
        function onMessage(raw) {
            const payload = JSON.parse(raw.toString('utf8'));
            if (predicate(payload)) {
                clearTimeout(timeout);
                socket.off('message', onMessage);
                reject(new Error(`Unexpected signaling message: ${payload.type}`));
            }
        }

        const timeout = setTimeout(() => {
            socket.off('message', onMessage);
            resolve();
        }, durationMs);

        socket.on('message', onMessage);
    });
}

test('screen broadcast signaling routes presence and WebRTC messages by roomId + screenId', async () => {
    const { ScreenBroadcastSignalingServer } = loadBroadcastSignalingServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const signaling = new ScreenBroadcastSignalingServer(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `ws://127.0.0.1:${port}/codexr-broadcast`;
    const roomId = 'codexr-session:test-room';

    const broadcaster = new WebSocket(url);
    const viewer = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(viewer)]);

        broadcaster.send(JSON.stringify({
            type: 'register',
            clientId: 'sender-1',
            roomId,
            screenId: 'default',
        }));
        viewer.send(JSON.stringify({
            type: 'register',
            clientId: 'viewer-1',
            roomId,
            screenId: 'default',
        }));

        const broadcasterRegistered = waitForMessage(broadcaster, (payload) => payload.type === 'registered');
        const viewerRegistered = waitForMessage(viewer, (payload) => payload.type === 'registered');
        assert.equal((await broadcasterRegistered).clientId, 'sender-1');
        assert.equal((await viewerRegistered).clientId, 'viewer-1');

        const viewerAvailability = waitForMessage(viewer, (payload) => payload.type === 'broadcast-available');
        const broadcasterLive = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');

        broadcaster.send(JSON.stringify({
            type: 'broadcast-start',
            clientId: 'sender-1',
            roomId,
            screenId: 'default',
            hasAudio: true,
        }));

        assert.equal((await broadcasterLive).hasAudio, true);
        assert.equal((await viewerAvailability).broadcasterId, 'sender-1');

        const viewerJoinOnBroadcaster = waitForMessage(broadcaster, (payload) => payload.type === 'viewer-join');
        viewer.send(JSON.stringify({
            type: 'viewer-join',
            clientId: 'viewer-1',
            roomId,
            screenId: 'default',
        }));
        assert.equal((await viewerJoinOnBroadcaster).viewerId, 'viewer-1');

        const forwardedOffer = waitForMessage(viewer, (payload) => payload.type === 'signal-offer');
        broadcaster.send(JSON.stringify({
            type: 'signal-offer',
            clientId: 'sender-1',
            roomId,
            screenId: 'default',
            targetId: 'viewer-1',
            description: { type: 'offer', sdp: 'offer-sdp' },
        }));
        assert.deepEqual((await forwardedOffer).description, { type: 'offer', sdp: 'offer-sdp' });

        const forwardedAnswer = waitForMessage(broadcaster, (payload) => payload.type === 'signal-answer');
        viewer.send(JSON.stringify({
            type: 'signal-answer',
            clientId: 'viewer-1',
            roomId,
            screenId: 'default',
            targetId: 'sender-1',
            description: { type: 'answer', sdp: 'answer-sdp' },
        }));
        assert.deepEqual((await forwardedAnswer).description, { type: 'answer', sdp: 'answer-sdp' });

        const forwardedIce = waitForMessage(viewer, (payload) => payload.type === 'signal-ice');
        broadcaster.send(JSON.stringify({
            type: 'signal-ice',
            clientId: 'sender-1',
            roomId,
            screenId: 'default',
            targetId: 'viewer-1',
            candidate: { candidate: 'host 1 udp 1 127.0.0.1 9 typ host' },
        }));
        assert.deepEqual((await forwardedIce).candidate, { candidate: 'host 1 udp 1 127.0.0.1 9 typ host' });

        const stoppedOnViewer = waitForMessage(viewer, (payload) => payload.type === 'broadcast-stopped');
        broadcaster.send(JSON.stringify({
            type: 'broadcast-stop',
            clientId: 'sender-1',
            roomId,
            screenId: 'default',
            reason: 'test-complete',
        }));
        assert.equal((await stoppedOnViewer).reason, 'test-complete');
    } finally {
        broadcaster.close();
        viewer.close();
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('screen broadcast signaling isolates active broadcasts across rooms', async () => {
    const { ScreenBroadcastSignalingServer } = loadBroadcastSignalingServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    const signaling = new ScreenBroadcastSignalingServer(server);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `ws://127.0.0.1:${port}/codexr-broadcast`;

    const broadcaster = new WebSocket(url);
    const sameRoomViewer = new WebSocket(url);
    const otherRoomViewer = new WebSocket(url);

    try {
        await Promise.all([
            waitForOpen(broadcaster),
            waitForOpen(sameRoomViewer),
            waitForOpen(otherRoomViewer),
        ]);

        broadcaster.send(JSON.stringify({
            type: 'register',
            clientId: 'sender-room-a',
            roomId: 'codexr-session:room-a',
            screenId: 'default',
        }));
        sameRoomViewer.send(JSON.stringify({
            type: 'register',
            clientId: 'viewer-room-a',
            roomId: 'codexr-session:room-a',
            screenId: 'default',
        }));
        otherRoomViewer.send(JSON.stringify({
            type: 'register',
            clientId: 'viewer-room-b',
            roomId: 'codexr-session:room-b',
            screenId: 'default',
        }));

        await Promise.all([
            waitForMessage(broadcaster, (payload) => payload.type === 'registered'),
            waitForMessage(sameRoomViewer, (payload) => payload.type === 'registered'),
            waitForMessage(otherRoomViewer, (payload) => payload.type === 'registered'),
        ]);

        const sameRoomAvailability = waitForMessage(sameRoomViewer, (payload) => payload.type === 'broadcast-available');
        const otherRoomSilence = waitForSilence(otherRoomViewer, 350, (payload) => payload.type === 'broadcast-available');

        broadcaster.send(JSON.stringify({
            type: 'broadcast-start',
            clientId: 'sender-room-a',
            roomId: 'codexr-session:room-a',
            screenId: 'default',
            hasAudio: false,
        }));

        assert.equal((await sameRoomAvailability).broadcasterId, 'sender-room-a');
        await otherRoomSilence;
    } finally {
        broadcaster.close();
        sameRoomViewer.close();
        otherRoomViewer.close();
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

// ── Media relay for viewers peer-to-peer cannot reach ────────────────────────

const RELAY_HEADER_BYTES = 12;

function relayFrame(kind, payloadText, temporalLayer = 0) {
    const payload = Buffer.from(payloadText, 'utf8');
    const frame = Buffer.alloc(RELAY_HEADER_BYTES + payload.length);
    frame[0] = 0x43; // 'C'
    frame[1] = 0x58; // 'X'
    frame[2] = 2;    // version
    // The kind byte carries the temporal layer in its high nibble, which is
    // what lets the server thin one encoding per viewer.
    frame[3] = (temporalLayer << 4) | (kind & 0x0f);
    frame.writeBigUInt64BE(123n, 4);
    payload.copy(frame, RELAY_HEADER_BYTES);
    return frame;
}

function waitForBinary(socket, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for a relayed frame')), timeoutMs);
        function onMessage(raw, isBinary) {
            if (!isBinary) {
                return;
            }
            clearTimeout(timeout);
            socket.off('message', onMessage);
            resolve(Buffer.from(raw));
        }
        socket.on('message', onMessage);
    });
}

function expectNoBinary(socket, durationMs) {
    return new Promise((resolve, reject) => {
        function onMessage(_raw, isBinary) {
            if (!isBinary) {
                return;
            }
            clearTimeout(timeout);
            socket.off('message', onMessage);
            reject(new Error('A viewer received relayed media it should not get'));
        }
        const timeout = setTimeout(() => {
            socket.off('message', onMessage);
            resolve();
        }, durationMs);
        socket.on('message', onMessage);
    });
}

async function createRelayServer() {
    const { ScreenBroadcastSignalingServer } = loadBroadcastSignalingServer();
    const server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
    });
    // Production maps this from RemoteAccessPolicy.isRemoteRequest; the test
    // drives it with a header so the routing itself is what is under test.
    const signaling = new ScreenBroadcastSignalingServer(
        server,
        '/codexr-broadcast',
        () => true,
        (request) => (request.headers['x-test-scope'] === 'remote' ? 'remote' : 'local'),
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    return { server, signaling, url: `ws://127.0.0.1:${port}/codexr-broadcast` };
}

function connectScoped(url, scope) {
    return new WebSocket(url, scope === 'remote' ? { headers: { 'x-test-scope': 'remote' } } : undefined);
}

async function registerClient(socket, clientId, roomId, screenId) {
    const registered = waitForMessage(socket, (payload) => payload.type === 'registered');
    socket.send(JSON.stringify({ type: 'register', clientId, roomId, screenId }));
    return registered;
}

test('remote viewers are served by the relay while local viewers keep direct WebRTC', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const remoteViewer = connectScoped(url, 'remote');
    const localViewer = connectScoped(url, 'local');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(remoteViewer), waitForOpen(localViewer)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(remoteViewer, 'remote-1', 'codexr-session:alpha', 'default');
        await registerClient(localViewer, 'local-1', 'codexr-session:alpha', 'default');

        const live = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1', hasAudio: true }));
        await live;

        // The remote viewer must not trigger a peer connection: it gets the relay.
        const relayStart = waitForMessage(broadcaster, (payload) => payload.type === 'relay-start');
        const relayReady = waitForMessage(remoteViewer, (payload) => payload.type === 'relay-ready');
        remoteViewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'remote-1' }));
        const started = await relayStart;
        const ready = await relayReady;
        assert.equal(started.relayViewerCount, 1);
        assert.equal(ready.hasAudio, true);
        assert.equal(ready.broadcasterId, 'sender-1');

        // The local viewer keeps the direct path, untouched.
        const viewerJoin = waitForMessage(broadcaster, (payload) => payload.type === 'viewer-join');
        localViewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'local-1' }));
        assert.equal((await viewerJoin).viewerId, 'local-1');

        // Media reaches the relay viewer byte-for-byte, and nobody else.
        const relayed = waitForBinary(remoteViewer);
        const localSilence = expectNoBinary(localViewer, 300);
        const frame = relayFrame(1, 'keyframe-payload');
        broadcaster.send(frame);
        assert.deepEqual(await relayed, frame);
        await localSilence;

        // A second remote viewer only needs a keyframe, not a second encoder.
        const keyframe = waitForMessage(broadcaster, (payload) => payload.type === 'relay-keyframe');
        const secondViewer = connectScoped(url, 'remote');
        await waitForOpen(secondViewer);
        await registerClient(secondViewer, 'remote-2', 'codexr-session:alpha', 'default');
        secondViewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'remote-2' }));
        assert.equal((await keyframe).relayViewerCount, 2);

        // When the last relay viewer leaves, the encoder is told to stop.
        const relayStop = waitForMessage(broadcaster, (payload) => payload.type === 'relay-stop');
        remoteViewer.send(JSON.stringify({ type: 'viewer-leave', clientId: 'remote-1' }));
        secondViewer.send(JSON.stringify({ type: 'viewer-leave', clientId: 'remote-2' }));
        await relayStop;

        secondViewer.close();
    } finally {
        [broadcaster, remoteViewer, localViewer].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('a viewer whose direct connection never delivered media can ask for the relay', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const viewer = connectScoped(url, 'local');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(viewer)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(viewer, 'viewer-1', 'codexr-session:alpha', 'default');

        const live = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1' }));
        await live;

        const viewerJoin = waitForMessage(broadcaster, (payload) => payload.type === 'viewer-join');
        viewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'viewer-1' }));
        await viewerJoin;

        // ICE never delivered a frame: the viewer falls back to the relay.
        const relayStart = waitForMessage(broadcaster, (payload) => payload.type === 'relay-start');
        const relayReady = waitForMessage(viewer, (payload) => payload.type === 'relay-ready');
        viewer.send(JSON.stringify({ type: 'relay-request', clientId: 'viewer-1' }));
        await Promise.all([relayStart, relayReady]);

        const relayed = waitForBinary(viewer);
        const frame = relayFrame(1, 'after-fallback');
        broadcaster.send(frame);
        assert.deepEqual(await relayed, frame);
    } finally {
        [broadcaster, viewer].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('the relay refuses malformed frames and frames from anyone but the broadcaster', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const remoteViewer = connectScoped(url, 'remote');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(remoteViewer)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(remoteViewer, 'remote-1', 'codexr-session:alpha', 'default');

        const live = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1' }));
        await live;

        const ready = waitForMessage(remoteViewer, (payload) => payload.type === 'relay-ready');
        remoteViewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'remote-1' }));
        await ready;

        // Wrong magic, too short, and a frame injected by a viewer: all dropped.
        const silence = expectNoBinary(remoteViewer, 400);
        broadcaster.send(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
        broadcaster.send(Buffer.from([0x43, 0x58, 1]));
        remoteViewer.send(relayFrame(1, 'not-from-the-broadcaster'));
        await silence;

        // A well-formed frame from the broadcaster still gets through.
        const relayed = waitForBinary(remoteViewer);
        const frame = relayFrame(1, 'valid');
        broadcaster.send(frame);
        assert.deepEqual(await relayed, frame);
    } finally {
        [broadcaster, remoteViewer].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('one encoding serves any number of remote viewers, and the audience size is published', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const viewers = [];

    try {
        await waitForOpen(broadcaster);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        const live = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1' }));
        await live;

        // Six viewers: two more than the old hard cap, which no longer exists.
        let relayStarts = 0;
        broadcaster.on('message', (raw, isBinary) => {
            if (isBinary) {
                return;
            }
            if (JSON.parse(raw.toString('utf8')).type === 'relay-start') {
                relayStarts += 1;
            }
        });

        for (let index = 0; index < 6; index += 1) {
            const viewer = connectScoped(url, 'remote');
            viewers.push(viewer);
            await waitForOpen(viewer);
            await registerClient(viewer, `remote-${index}`, 'codexr-session:alpha', 'default');
            const audience = waitForMessage(
                broadcaster,
                (payload) => payload.type === 'relay-audience' && payload.relayViewerCount === index + 1,
            );
            const ready = waitForMessage(viewer, (payload) => payload.type === 'relay-ready');
            viewer.send(JSON.stringify({ type: 'viewer-join', clientId: `remote-${index}` }));
            await Promise.all([audience, ready]);
        }

        // The whole point: one encoder for the whole audience.
        assert.equal(relayStarts, 1, 'the broadcaster must only be asked to encode once');

        // Every viewer receives the same frame.
        const deliveries = viewers.map((viewer) => waitForBinary(viewer));
        const frame = relayFrame(1, 'one-signal-many-subscribers');
        broadcaster.send(frame);
        for (const delivered of await Promise.all(deliveries)) {
            assert.deepEqual(delivered, frame);
        }

        // Leaving republishes a smaller audience, so quality can recover.
        const shrunk = waitForMessage(
            broadcaster,
            (payload) => payload.type === 'relay-audience' && payload.relayViewerCount === 5,
        );
        viewers[0].send(JSON.stringify({ type: 'viewer-leave', clientId: 'remote-0' }));
        await shrunk;
    } finally {
        [broadcaster, ...viewers].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('a congested viewer loses its top temporal layer while the others keep the full stream', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const healthy = connectScoped(url, 'remote');
    const congested = connectScoped(url, 'remote');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(healthy), waitForOpen(congested)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(healthy, 'healthy', 'codexr-session:alpha', 'default');
        await registerClient(congested, 'congested', 'codexr-session:alpha', 'default');

        const live = waitForMessage(broadcaster, (payload) => payload.type === 'broadcast-live');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1' }));
        await live;

        for (const [viewer, id] of [[healthy, 'healthy'], [congested, 'congested']]) {
            const ready = waitForMessage(viewer, (payload) => payload.type === 'relay-ready');
            viewer.send(JSON.stringify({ type: 'viewer-join', clientId: id }));
            await ready;
        }

        // Simulate a viewer whose socket is badly backed up. The server reads
        // bufferedAmount, so faking it is what isolates the thinning policy.
        const congestedClient = [...signaling.clients.values()].find((client) => client.id === 'congested');
        Object.defineProperty(congestedClient.socket, 'bufferedAmount', {
            configurable: true,
            get: () => 1024 * 1024, // past the top-layer threshold, below the all-deltas one
        });

        // A top-layer delta: only the healthy viewer should see it.
        const healthyGetsTopLayer = waitForBinary(healthy);
        const congestedSilence = expectNoBinary(congested, 300);
        broadcaster.send(relayFrame(2, 'top-layer-delta', 2));
        await Promise.all([healthyGetsTopLayer, congestedSilence]);

        // Base-layer delta and keyframe still reach the congested viewer, so it
        // keeps a moving picture and can always resync.
        const baseDelta = waitForBinary(congested);
        broadcaster.send(relayFrame(2, 'base-layer-delta', 0));
        assert.deepEqual(await baseDelta, relayFrame(2, 'base-layer-delta', 0));

        const keyframe = waitForBinary(congested);
        broadcaster.send(relayFrame(1, 'keyframe', 0));
        assert.deepEqual(await keyframe, relayFrame(1, 'keyframe', 0));
    } finally {
        [broadcaster, healthy, congested].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('viewers that join before the broadcast starts are parked and served, never told it stopped', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const earlyLocal = connectScoped(url, 'local');
    const earlyRemote = connectScoped(url, 'remote');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(earlyLocal), waitForOpen(earlyRemote)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(earlyLocal, 'early-local', 'codexr-session:alpha', 'default');
        await registerClient(earlyRemote, 'early-remote', 'codexr-session:alpha', 'default');

        // The race that used to kill the whole room: the screen entity travels
        // over the room socket and viewers join before broadcast-start lands.
        const localWaiting = waitForMessage(earlyLocal, (payload) => payload.type === 'viewer-waiting');
        const remoteWaiting = waitForMessage(earlyRemote, (payload) => payload.type === 'viewer-waiting');
        const noStoppedForLocal = waitForSilence(earlyLocal, 400, (payload) => payload.type === 'broadcast-stopped');
        const noStoppedForRemote = waitForSilence(earlyRemote, 400, (payload) => payload.type === 'broadcast-stopped');
        earlyLocal.send(JSON.stringify({ type: 'viewer-join', clientId: 'early-local' }));
        earlyRemote.send(JSON.stringify({ type: 'viewer-join', clientId: 'early-remote' }));
        await Promise.all([localWaiting, remoteWaiting, noStoppedForLocal, noStoppedForRemote]);

        // The broadcast starts: the parked direct viewer produces a deferred
        // viewer-join on the broadcaster, the parked relay viewer gets its
        // relay-ready, and the encoder is asked to start.
        const deferredJoin = waitForMessage(
            broadcaster,
            (payload) => payload.type === 'viewer-join' && payload.viewerId === 'early-local',
        );
        const relayStart = waitForMessage(broadcaster, (payload) => payload.type === 'relay-start');
        const relayReady = waitForMessage(earlyRemote, (payload) => payload.type === 'relay-ready');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1', hasAudio: true }));
        const ready = await relayReady;
        assert.equal(ready.broadcasterId, 'sender-1');
        assert.equal(ready.hasAudio, true);
        await Promise.all([deferredJoin, relayStart]);

        // And the relayed media flows to the parked remote viewer.
        const relayed = waitForBinary(earlyRemote);
        const frame = relayFrame(1, 'parked-then-served');
        broadcaster.send(frame);
        assert.deepEqual(await relayed, frame);
    } finally {
        [broadcaster, earlyLocal, earlyRemote].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('a relay-request before any broadcast parks the viewer on the relay side', async () => {
    const { server, signaling, url } = await createRelayServer();
    const broadcaster = connectScoped(url, 'local');
    const viewer = connectScoped(url, 'local');

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(viewer)]);
        await registerClient(broadcaster, 'sender-1', 'codexr-session:alpha', 'default');
        await registerClient(viewer, 'viewer-1', 'codexr-session:alpha', 'default');

        const waiting = waitForMessage(viewer, (payload) => payload.type === 'viewer-waiting');
        viewer.send(JSON.stringify({ type: 'relay-request', clientId: 'viewer-1' }));
        await waiting;

        const relayStart = waitForMessage(broadcaster, (payload) => payload.type === 'relay-start');
        const relayReady = waitForMessage(viewer, (payload) => payload.type === 'relay-ready');
        broadcaster.send(JSON.stringify({ type: 'broadcast-start', clientId: 'sender-1' }));
        await Promise.all([relayStart, relayReady]);
    } finally {
        [broadcaster, viewer].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

// ── One screen, one broadcaster ──────────────────────────────────────────────

test('a live screen cannot be taken over: the intruder is denied and nobody else notices', async () => {
    const { server, signaling, url } = await createRelayServer();
    const holder = connectScoped(url, 'local');
    const intruder = connectScoped(url, 'local');
    const remoteViewer = connectScoped(url, 'remote');

    try {
        await Promise.all([waitForOpen(holder), waitForOpen(intruder), waitForOpen(remoteViewer)]);
        await registerClient(holder, 'holder-1', 'codexr-session:alpha', 'default');
        await registerClient(intruder, 'intruder-1', 'codexr-session:alpha', 'default');
        await registerClient(remoteViewer, 'watcher-1', 'codexr-session:alpha', 'default');

        const live = waitForMessage(holder, (payload) => payload.type === 'broadcast-live');
        holder.send(JSON.stringify({ type: 'broadcast-start', clientId: 'holder-1', hasAudio: true }));
        await live;

        const ready = waitForMessage(remoteViewer, (payload) => payload.type === 'relay-ready');
        remoteViewer.send(JSON.stringify({ type: 'viewer-join', clientId: 'watcher-1' }));
        await ready;

        // The intruder is refused, told who holds the screen, and the holder
        // hears nothing at all about the attempt.
        const denied = waitForMessage(intruder, (payload) => payload.type === 'broadcast-denied');
        const holderSilence = waitForSilence(
            holder,
            400,
            (payload) => ['broadcast-replaced', 'broadcast-stopped', 'broadcast-denied'].includes(payload.type),
        );
        intruder.send(JSON.stringify({ type: 'broadcast-start', clientId: 'intruder-1' }));
        assert.equal((await denied).broadcasterId, 'holder-1');
        await holderSilence;

        // The holder's stream keeps flowing to its viewers, untouched.
        const relayed = waitForBinary(remoteViewer);
        const frame = relayFrame(1, 'still-the-holders-screen');
        holder.send(frame);
        assert.deepEqual(await relayed, frame);
    } finally {
        [holder, intruder, remoteViewer].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});

test('a screen whose holder socket died mid-reconnect frees up for the next broadcaster', async () => {
    const { server, signaling, url } = await createRelayServer();
    const holder = connectScoped(url, 'local');
    const successor = connectScoped(url, 'local');

    try {
        await Promise.all([waitForOpen(holder), waitForOpen(successor)]);
        await registerClient(holder, 'holder-1', 'codexr-session:alpha', 'default');
        await registerClient(successor, 'successor-1', 'codexr-session:alpha', 'default');

        const live = waitForMessage(holder, (payload) => payload.type === 'broadcast-live');
        holder.send(JSON.stringify({ type: 'broadcast-start', clientId: 'holder-1' }));
        await live;

        // A half-finished reconnect: the holder's server-side socket is no
        // longer OPEN but its close has not been processed yet. The screen
        // must not stay locked forever.
        const holderClient = [...signaling.clients.values()].find((client) => client.id === 'holder-1');
        Object.defineProperty(holderClient.socket, 'readyState', {
            configurable: true,
            get: () => 3, // CLOSED
        });

        const successorLive = waitForMessage(successor, (payload) => payload.type === 'broadcast-live');
        successor.send(JSON.stringify({ type: 'broadcast-start', clientId: 'successor-1' }));
        await successorLive;

        // Remove the readyState override (an own property shadowing the ws
        // prototype getter) so teardown can actually close the socket —
        // otherwise server.close stalls for its whole timeout.
        delete holderClient.socket.readyState;
        holderClient.socket.terminate();
    } finally {
        [holder, successor].forEach((socket) => socket.close());
        signaling.dispose();
        await new Promise((resolve) => server.close(resolve));
    }
});
