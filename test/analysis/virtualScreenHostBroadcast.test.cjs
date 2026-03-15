const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const brokerSource = fs.readFileSync(
    path.join(projectRoot, 'src', 'servers', 'runtime', 'virtualScreen', 'sessionVirtualScreenBroker.ts'),
    'utf8',
);
const orchestratorSource = fs.readFileSync(
    path.join(projectRoot, 'src', 'code_analysis', 'engine', 'servers', 'serverLaunchOrchestrator.ts'),
    'utf8',
);
const activeAnalysesSource = fs.readFileSync(
    path.join(projectRoot, 'src', 'code_analysis', 'views', 'subsections', 'active_analyses', 'commands', 'activeAnalysesCommands.ts'),
    'utf8',
);

const brokerModulePath = path.join(
    projectRoot,
    'out',
    'servers',
    'runtime',
    'virtualScreen',
    'sessionVirtualScreenBroker.js',
);

test('virtual screen host broadcast broker declares the signaling contract for viewers and host broadcaster', () => {
    assert.match(brokerSource, /viewer-join/);
    assert.match(brokerSource, /viewer-leave/);
    assert.match(brokerSource, /host-register/);
    assert.match(brokerSource, /host-status/);
    assert.match(brokerSource, /offer/);
    assert.match(brokerSource, /answer/);
    assert.match(brokerSource, /ice-candidate/);
    assert.match(brokerSource, /request-host-start/);
    assert.match(brokerSource, /host-stopped/);
    assert.match(brokerSource, /getDisplayMedia/);
    assert.match(brokerSource, /RTCPeerConnection/);
});

test('compiled virtual screen broker serves the host broadcaster page and protects it with a token', () => {
    assert.equal(fs.existsSync(brokerModulePath), true, 'compiled broker module should exist after compile-tests');
    const { SessionVirtualScreenBroker } = require(brokerModulePath);
    const broker = new SessionVirtualScreenBroker({
        sessionId: 'session-123',
        signalPath: '/codexr/virtual-screen/ws',
        hostPath: '/codexr/virtual-screen/host',
        hostBroadcasterToken: 'secret-token',
        displayName: 'XR File: demo',
    });

    const forbiddenResponse = createResponseCapture();
    const forbiddenHandled = broker.handleHttpRequest(
        { url: '/codexr/virtual-screen/host?token=wrong-token' },
        forbiddenResponse.res,
    );
    assert.equal(forbiddenHandled, true);
    assert.equal(forbiddenResponse.statusCode, 403);
    assert.match(forbiddenResponse.body, /Forbidden/);

    const okResponse = createResponseCapture();
    const okHandled = broker.handleHttpRequest(
        { url: '/codexr/virtual-screen/host?token=secret-token' },
        okResponse.res,
    );
    assert.equal(okHandled, true);
    assert.equal(okResponse.statusCode, 200);
    assert.match(okResponse.body, /CodeXR Host Broadcaster/);
    assert.match(okResponse.body, /host-register/);
    assert.match(okResponse.body, /Start host sharing/);

    broker.dispose();
});

test('server launch orchestration and active analyses expose host broadcaster metadata without leaking the token to viewers', () => {
    assert.match(orchestratorSource, /hostBroadcasterToken/);
    assert.match(orchestratorSource, /hostBroadcasterPath/);
    assert.match(orchestratorSource, /hostBroadcasterUrl/);
    assert.match(orchestratorSource, /Open Host Broadcaster/);
    assert.match(activeAnalysesSource, /Open Host Broadcaster/);
    assert.match(activeAnalysesSource, /hostBroadcasterUrl/);
});

function createResponseCapture() {
    const capture = {
        statusCode: 0,
        headers: {},
        body: '',
    };

    return {
        get statusCode() {
            return capture.statusCode;
        },
        get headers() {
            return capture.headers;
        },
        get body() {
            return capture.body;
        },
        res: {
            writeHead(statusCode, headers) {
                capture.statusCode = statusCode;
                capture.headers = headers;
            },
            end(body) {
                capture.body = body;
            },
        },
    };
}
