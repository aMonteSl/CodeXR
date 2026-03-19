const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(projectRoot, 'templates', 'components', 'codexr', 'virtual-screen', 'virtualScreenRuntime.js');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const runtimeModule = require(runtimePath);

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('XR and DOM templates expose the shared virtual screen runtime with broadcast signaling config', () => {
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const domTemplate = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');

    assert.match(xrTemplate, /<script id="codexr-tooling-config-virtual-screen" type="application\/json">/);
    assert.match(xrTemplate, /"broadcastEnabled":true/);
    assert.match(xrTemplate, /"signalingPath":"\/codexr-broadcast"/);
    assert.match(xrTemplate, /"followAnchorSelector":"#rig"/);
    assert.match(xrTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(xrTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(xrTemplate, /codexr-multi-screen-manager="maxScreens: 5; wall: west"/);

    assert.match(domTemplate, /window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{/);
    assert.match(domTemplate, /broadcastEnabled: true/);
    assert.match(domTemplate, /signalingPath: '\/codexr-broadcast'/);
    assert.match(domTemplate, /followAnchorSelector: '#cameraRig'/);
    assert.match(domTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.doesNotMatch(domTemplate, /codexr-multi-screen-manager/);
});

test('virtual screen runtime includes WebRTC broadcasting primitives and multi-screen stable ids', () => {
    const multiScreenManagerSource = readProjectFile('templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js');
    const httpServerSource = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const runtimeIndexSource = readProjectFile('src', 'servers', 'runtime', 'index.ts');

    assert.match(runtimeSource, /broadcastEnabled: true/);
    assert.match(runtimeSource, /signalingPath: '\/codexr-broadcast'/);
    assert.match(runtimeSource, /new win\.WebSocket/);
    assert.match(runtimeSource, /new win\.RTCPeerConnection/);
    assert.match(runtimeSource, /viewer-join/);
    assert.match(runtimeSource, /signal-offer/);
    assert.match(runtimeSource, /signal-answer/);
    assert.match(runtimeSource, /signal-ice/);
    assert.match(runtimeSource, /function restoreState\(/);
    assert.match(runtimeSource, /function destroy\(/);
    assert.match(runtimeSource, /broadcastRole/);
    assert.match(runtimeSource, /broadcastStatus/);
    assert.match(runtimeSource, /screenId/);

    assert.match(multiScreenManagerSource, /screenId: instanceId/);
    assert.match(multiScreenManagerSource, /record\.runtime\.destroy\(\)/);

    assert.match(httpServerSource, /ScreenBroadcastSignalingServer/);
    assert.match(httpServerSource, /new ScreenBroadcastSignalingServer\(server\)/);
    assert.match(runtimeIndexSource, /ScreenBroadcastSignalingServer/);
});

test('virtual screen runtime requests screen audio and exposes broadcast-aware state without a DOM', async () => {
    let capturedOptions = null;
    const fakeWindow = {
        __CODEXR_VIRTUAL_SCREEN_CONFIG__: {
            screenId: 'default',
            broadcastEnabled: true,
            signalingPath: '/codexr-broadcast',
        },
        location: {
            protocol: 'https:',
            host: 'localhost:8443',
            hostname: 'localhost',
        },
        isSecureContext: true,
        WebSocket: function MockWebSocket() {},
        RTCPeerConnection: function MockPeerConnection() {},
        navigator: {
            mediaDevices: {
                async getDisplayMedia(options) {
                    capturedOptions = options;
                    return {
                        getTracks() {
                            return [];
                        },
                        getVideoTracks() {
                            return [];
                        },
                        getAudioTracks() {
                            return [];
                        },
                    };
                },
            },
        },
    };

    const runtime = runtimeModule.createRuntime(fakeWindow);
    const screenOptions = runtime.buildCaptureOptions('screen');
    const windowOptions = runtime.buildCaptureOptions('window');

    assert.equal(screenOptions.monitorTypeSurfaces, 'include');
    assert.equal(windowOptions.monitorTypeSurfaces, 'exclude');
    assert.equal(screenOptions.audio, true);

    await runtime.requestCapture('screen');
    assert.deepEqual(capturedOptions, screenOptions);

    const state = runtime.getState();
    assert.equal(state.mode, 'idle');
    assert.equal(state.presentationMode, 'expanded');
    assert.equal(state.screenId, 'default');
    assert.equal(state.broadcastRole, 'none');
    assert.equal(state.broadcastStatus, 'idle');
    assert.equal(state.hasAudio, false);
    assert.equal(typeof runtime.restoreState, 'function');
    assert.equal(typeof runtime.destroy, 'function');
});

test('analysis asset pipeline still packages the shared runtime without introducing host-broadcast-only code paths', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const domParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'visualizeDOMParser.ts');
    const componentAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'virtualScreenComponentAsset.ts');

    assert.match(fileParser, /copyVirtualScreenRuntimeToOutput/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(directoryParser, /readVirtualScreenRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntimeContent\)/);
    assert.match(domParser, /readVirtualScreenRuntimeContent/);
    assert.match(componentAsset, /copyVirtualScreenRuntimeToOutput/);

    assert.doesNotMatch(runtimeSource, /request-host-start/);
    assert.doesNotMatch(runtimeSource, /virtualScreenSupportsHostBroadcast/);
});
