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

test('screen broadcast signaling routes presence and WebRTC messages by screenId', async () => {
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
    const viewer = new WebSocket(url);

    try {
        await Promise.all([waitForOpen(broadcaster), waitForOpen(viewer)]);

        broadcaster.send(JSON.stringify({
            type: 'register',
            clientId: 'sender-1',
            screenId: 'default',
        }));
        viewer.send(JSON.stringify({
            type: 'register',
            clientId: 'viewer-1',
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
            screenId: 'default',
            hasAudio: true,
        }));

        assert.equal((await broadcasterLive).hasAudio, true);
        assert.equal((await viewerAvailability).broadcasterId, 'sender-1');

        const viewerJoinOnBroadcaster = waitForMessage(broadcaster, (payload) => payload.type === 'viewer-join');
        viewer.send(JSON.stringify({
            type: 'viewer-join',
            clientId: 'viewer-1',
            screenId: 'default',
        }));
        assert.equal((await viewerJoinOnBroadcaster).viewerId, 'viewer-1');

        const forwardedOffer = waitForMessage(viewer, (payload) => payload.type === 'signal-offer');
        broadcaster.send(JSON.stringify({
            type: 'signal-offer',
            clientId: 'sender-1',
            screenId: 'default',
            targetId: 'viewer-1',
            description: { type: 'offer', sdp: 'offer-sdp' },
        }));
        assert.deepEqual((await forwardedOffer).description, { type: 'offer', sdp: 'offer-sdp' });

        const forwardedAnswer = waitForMessage(broadcaster, (payload) => payload.type === 'signal-answer');
        viewer.send(JSON.stringify({
            type: 'signal-answer',
            clientId: 'viewer-1',
            screenId: 'default',
            targetId: 'sender-1',
            description: { type: 'answer', sdp: 'answer-sdp' },
        }));
        assert.deepEqual((await forwardedAnswer).description, { type: 'answer', sdp: 'answer-sdp' });

        const forwardedIce = waitForMessage(viewer, (payload) => payload.type === 'signal-ice');
        broadcaster.send(JSON.stringify({
            type: 'signal-ice',
            clientId: 'sender-1',
            screenId: 'default',
            targetId: 'viewer-1',
            candidate: { candidate: 'host 1 udp 1 127.0.0.1 9 typ host' },
        }));
        assert.deepEqual((await forwardedIce).candidate, { candidate: 'host 1 udp 1 127.0.0.1 9 typ host' });

        const stoppedOnViewer = waitForMessage(viewer, (payload) => payload.type === 'broadcast-stopped');
        broadcaster.send(JSON.stringify({
            type: 'broadcast-stop',
            clientId: 'sender-1',
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
