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

    assert.match(xrTemplate, /<script id="codexr-tooling-config-collaboration" type="application\/json">/);
    assert.match(xrTemplate, /"roomSignalingPath":"\/codexr-room"/);
    assert.match(xrTemplate, /"sessionEndpoint":"\/api\/collaboration\/session"/);
    assert.match(xrTemplate, /src="\.\/codexrCollaborationRuntime\.js"/);
    assert.match(xrTemplate, /<script id="codexr-tooling-config-virtual-screen" type="application\/json">/);
    assert.match(xrTemplate, /"broadcastEnabled":true/);
    assert.match(xrTemplate, /"signalingPath":"\/codexr-broadcast"/);
    assert.match(xrTemplate, /"followAnchorSelector":"#rig"/);
    assert.match(xrTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(xrTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(xrTemplate, /codexr-multi-screen-manager="maxScreens: 5; wall: west"/);

    assert.match(domTemplate, /<script id="codexr-tooling-config-collaboration" type="application\/json">/);
    assert.match(domTemplate, /cursorPresenceEnabled":true/);
    assert.match(domTemplate, /roomSignalingPath":"\/codexr-room"/);
    assert.match(domTemplate, /sessionEndpoint":"\/api\/collaboration\/session"/);
    assert.match(domTemplate, /window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{/);
    assert.match(domTemplate, /broadcastEnabled: true/);
    assert.match(domTemplate, /signalingPath: '\/codexr-broadcast'/);
    assert.match(domTemplate, /followAnchorSelector: '#cameraRig'/);
    assert.match(domTemplate, /codexr-multi-screen-manager="maxScreens: 5; wall: west; showPanel: false"/);
    assert.match(domTemplate, /src="\.\/codexrCollaborationRuntime\.js"/);
    assert.match(domTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(domTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(domTemplate, /src="\.\/codexrDomSceneCollaborationRuntime\.js"/);
});

test('virtual screen runtime includes WebRTC broadcasting primitives and shared-room collaboration hooks', () => {
    const multiScreenManagerSource = readProjectFile('templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js');
    const collaborationRuntimeSource = readProjectFile('templates', 'components', 'codexr', 'collaboration', 'codexrCollaborationRuntime.js');
    const httpServerSource = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const broadcastServerSource = readProjectFile('src', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.ts');
    const runtimeIndexSource = readProjectFile('src', 'servers', 'runtime', 'index.ts');

    assert.match(runtimeSource, /broadcastEnabled: true/);
    assert.match(runtimeSource, /signalingPath: '\/codexr-broadcast'/);
    assert.match(runtimeSource, /roomSignalingPath: '\/codexr-room'/);
    assert.match(runtimeSource, /sessionEndpoint: '\/api\/collaboration\/session'/);
    assert.match(runtimeSource, /CodeXRCollaborationRuntime/);
    assert.match(runtimeSource, /function cloneVector\(/);
    assert.match(runtimeSource, /placeInFrontOfUserOnInit/);
    assert.match(runtimeSource, /deferInitialSharedState/);
    assert.match(runtimeSource, /function flushInitialSharedState\(/);
    assert.match(runtimeSource, /function ensureRemoteAudioSource\(/);
    assert.match(runtimeSource, /function syncRemoteAudioPlayback\(/);
    assert.match(runtimeSource, /audioUnlockRequired/);
    assert.match(runtimeSource, /systemAudio: 'include'/);
    assert.match(runtimeSource, /windowAudio: 'system'/);
    assert.doesNotMatch(runtimeSource, /preferCurrentTab/);
    assert.match(runtimeSource, /ownerPeerId/);
    assert.match(runtimeSource, /normalizeBroadcastState/);
    assert.match(runtimeSource, /setManagerCallbacks/);
    assert.match(runtimeSource, /roomId: payload\?\.roomId \|\| getResolvedRoomId\(\)/);
    assert.match(runtimeSource, /sendEntityState/);
    assert.match(runtimeSource, /sendEntityTransform/);
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
    assert.match(runtimeSource, /collaborationSource/);
    assert.match(runtimeSource, /gestureOwnerPeerId/);
    assert.match(runtimeSource, /broadcast,/);

    assert.match(multiScreenManagerSource, /registerManager/);
    assert.match(multiScreenManagerSource, /applyCollaborationSnapshot/);
    assert.match(multiScreenManagerSource, /ensureRemoteScreen/);
    assert.match(multiScreenManagerSource, /buildManagedScreenId/);
    assert.match(multiScreenManagerSource, /bringScreenInFrontOfUser/);
    assert.match(multiScreenManagerSource, /schedulePlaceScreenInFrontOfUser/);
    assert.match(multiScreenManagerSource, /this\.schedulePlaceScreenInFrontOfUser\(instanceId/);
    assert.match(multiScreenManagerSource, /deferInitialSharedState: true/);
    assert.match(multiScreenManagerSource, /runtime\?\.flushInitialSharedState\?\.\(\)/);
    assert.match(multiScreenManagerSource, /const canDelete = entry\.instanceId !== 'default'/);
    assert.match(multiScreenManagerSource, /screen:\$\{peerId\}:\$\{counter\}/);
    assert.match(multiScreenManagerSource, /setManagerCallbacks/);
    assert.match(multiScreenManagerSource, /onStateChange/);
    assert.match(multiScreenManagerSource, /onTransformChange/);
    assert.doesNotMatch(multiScreenManagerSource, /placeInFrontOfUser: true/);
    assert.doesNotMatch(multiScreenManagerSource, /managed-\$\{this\.nextManagedInstance\}/);
    assert.doesNotMatch(multiScreenManagerSource, /Spawn Zone/);
    assert.doesNotMatch(multiScreenManagerSource, /Add and Bring stack here/);
    assert.doesNotMatch(multiScreenManagerSource, /Focus/);
    assert.match(multiScreenManagerSource, /showPanel: \{ type: 'boolean', default: true \}/);
    assert.match(collaborationRuntimeSource, /room-join/);
    assert.match(collaborationRuntimeSource, /room-snapshot/);
    assert.match(collaborationRuntimeSource, /entity-transform/);
    assert.match(collaborationRuntimeSource, /presence-update/);
    assert.match(collaborationRuntimeSource, /cursorPresenceEnabled/);
    assert.match(collaborationRuntimeSource, /getPresenceLabel/);
    assert.match(collaborationRuntimeSource, /displayName/);
    assert.match(broadcastServerSource, /roomId/);
    assert.match(broadcastServerSource, /DEFAULT_ROOM_ID/);
    assert.match(broadcastServerSource, /getScreenKey/);
    assert.match(broadcastServerSource, /roomId \|\| client\.roomId/);

    assert.match(httpServerSource, /CollaborationRoomServer/);
    assert.match(httpServerSource, /case '\/collaboration\/session'/);
    assert.match(httpServerSource, /roomId: `codexr-session:\$\{activeServerId\}`/);
    assert.match(httpServerSource, /new CollaborationRoomServer\(server\)/);
    assert.match(httpServerSource, /ScreenBroadcastSignalingServer/);
    assert.match(httpServerSource, /new ScreenBroadcastSignalingServer\(server\)/);
    assert.match(runtimeIndexSource, /CollaborationRoomServer/);
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
    assert.equal('preferCurrentTab' in screenOptions, false);

    await runtime.requestCapture('screen');
    assert.deepEqual(capturedOptions, screenOptions);

    const state = runtime.getState();
    assert.equal(state.mode, 'idle');
    assert.equal(state.presentationMode, 'expanded');
    assert.equal(state.screenId, 'default');
    assert.equal(state.ownerPeerId, null);
    assert.equal(state.broadcastRole, 'none');
    assert.equal(state.broadcastStatus, 'idle');
    assert.equal(state.hasAudio, false);
    assert.equal(state.audioUnlockRequired, false);
    assert.equal(typeof runtime.restoreState, 'function');
    assert.equal(typeof runtime.placeInFrontOfUser, 'function');
    assert.equal(typeof runtime.flushInitialSharedState, 'function');
    assert.equal(typeof runtime.destroy, 'function');
});

test('analysis asset pipeline packages collaboration, screen, manager, and DOM shared runtimes together', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const domParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'visualizeDOMParser.ts');
    const componentAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'virtualScreenComponentAsset.ts');
    const collaborationAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'collaborationComponentAsset.ts');

    assert.match(fileParser, /copyVirtualScreenRuntimeToOutput/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(fileParser, /copyCodeXrCollaborationRuntimeToOutput/);
    assert.match(directoryParser, /readVirtualScreenRuntimeContent/);
    assert.match(directoryParser, /readCodeXrCollaborationRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME, collaborationRuntimeContent\)/);
    assert.match(domParser, /readVirtualScreenRuntimeContent/);
    assert.match(domParser, /readCodeXrCollaborationRuntimeContent/);
    assert.match(domParser, /readVirtualScreenManagerRuntimeContent/);
    assert.match(domParser, /readCodeXrDomSceneCollaborationRuntimeContent/);
    assert.match(componentAsset, /copyVirtualScreenRuntimeToOutput/);
    assert.match(collaborationAsset, /copyCodeXrCollaborationRuntimeToOutput/);
    assert.match(collaborationAsset, /copyCodeXrDomSceneCollaborationRuntimeToOutput/);

    assert.doesNotMatch(runtimeSource, /request-host-start/);
    assert.doesNotMatch(runtimeSource, /virtualScreenSupportsHostBroadcast/);
});
