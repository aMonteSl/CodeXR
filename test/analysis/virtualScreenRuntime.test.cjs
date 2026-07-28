const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime, requireAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const runtimeSource = readAssembledRuntime('virtual-screen', 'virtualScreenRuntime.js');
const runtimeModule = requireAssembledRuntime('virtual-screen', 'virtualScreenRuntime.js');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('XR and DOM templates expose the shared virtual screen runtime with broadcast signaling config', () => {
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const domTemplate = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');

    assert.match(xrTemplate, /<script id="codexr-tooling-config-collaboration" type="application\/json">/);
    assert.match(xrTemplate, /"roomSignalingPath":"\/codexr-room"/);
    assert.match(xrTemplate, /"sessionEndpoint":"\/api\/collaboration\/session"/);
    assert.match(xrTemplate, /src="\.\/codexrCollaborationRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.match(xrTemplate, /src="\.\/codexrAvatarRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.doesNotMatch(xrTemplate, /codexrCollaborationUiRuntime/);
    assert.match(xrTemplate, /<script id="codexr-tooling-config-virtual-screen" type="application\/json">/);
    assert.match(xrTemplate, /"broadcastEnabled":true/);
    assert.match(xrTemplate, /"signalingPath":"\/codexr-broadcast"/);
    assert.match(xrTemplate, /"followAnchorSelector":"#rig"/);
    assert.match(xrTemplate, /src="\.\/virtualScreenRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.match(xrTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js(?:\?v=\$\{nonce\})?"/);
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
    assert.match(domTemplate, /src="\.\/codexrAvatarRuntime\.js"/);
    assert.doesNotMatch(domTemplate, /codexrCollaborationUiRuntime/);
    assert.match(domTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(domTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(domTemplate, /src="\.\/codexrDomSceneCollaborationRuntime\.js"/);
});

test('virtual screen runtime includes WebRTC broadcasting primitives and shared-room collaboration hooks', () => {
    const multiScreenManagerSource = readProjectFile('templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js');
    const collaborationRuntimeSource = readAssembledRuntime('collaboration', 'codexrCollaborationRuntime.js');
    const avatarRuntimeSource = readProjectFile('templates', 'components', 'codexr', 'avatar', 'codexrAvatarRuntime.js');
    const httpServerSource = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const sessionApiSource = readProjectFile('src', 'servers', 'runtime', 'collaboration', 'collaborationSessionApi.ts');
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
    assert.match(runtimeSource, /stun:stun\.cloudflare\.com:3478/);
    assert.match(runtimeSource, /restrictive NAT/);
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
    assert.match(multiScreenManagerSource, /const canDelete = entry\.managed === true && !this\.wellKnownScreens\?\.has\(entry\.instanceId\)/);
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
    assert.doesNotMatch(collaborationRuntimeSource, /identity-update/);
    assert.match(collaborationRuntimeSource, /participant-kick/);
    assert.match(collaborationRuntimeSource, /host-transfer/);
    assert.match(collaborationRuntimeSource, /presenter-started/);
    assert.doesNotMatch(collaborationRuntimeSource, /followParticipant/);
    assert.doesNotMatch(collaborationRuntimeSource, /teleportToParticipant/);
    assert.doesNotMatch(collaborationRuntimeSource, /profile-config-updated/);
    assert.match(collaborationRuntimeSource, /body: getPoseFromEntity\(getBodyEntity\(\)\)/);
    assert.match(collaborationRuntimeSource, /getTrackedControllerPose/);
    assert.match(collaborationRuntimeSource, /ray:/);
    assert.match(avatarRuntimeSource, /codexr-avatar/);
    assert.match(avatarRuntimeSource, /configureAsset/);
    assert.doesNotMatch(avatarRuntimeSource, /codexr-avatar-assets-consent-required/);
    assert.match(avatarRuntimeSource, /setAttribute\('rotation', '0 180 0'\)/);
    assert.match(avatarRuntimeSource, /horizontalDistance/);
    assert.match(avatarRuntimeSource, /!this\.modelActive/);
    assert.match(avatarRuntimeSource, /animation-mixer/);
    assert.match(avatarRuntimeSource, /lodDistance/);
    assert.match(broadcastServerSource, /roomId/);
    assert.match(broadcastServerSource, /DEFAULT_ROOM_ID/);
    assert.match(broadcastServerSource, /getScreenKey/);
    assert.match(broadcastServerSource, /roomId \|\| client\.roomId/);

    assert.match(httpServerSource, /CollaborationRoomServer/);
    assert.match(httpServerSource, /case '\/collaboration\/session'/);
    assert.match(httpServerSource, /case '\/collaboration\/avatar-model'/);
    // The session descriptor and room-id derivation live in the extracted
    // CollaborationSessionApi module.
    assert.match(sessionApiSource, /CollaborationProfileManager/);
    assert.match(sessionApiSource, /roomId: `codexr-session:\$\{activeServerId\}`/);
    assert.match(httpServerSource, /new CollaborationRoomServer\(server, '\/codexr-room'/);
    assert.match(httpServerSource, /ScreenBroadcastSignalingServer/);
    assert.match(httpServerSource, /new ScreenBroadcastSignalingServer\(/);
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
    const avatarAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'avatarComponentAsset.ts');

    assert.match(fileParser, /copyVirtualScreenRuntimeToOutput/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(fileParser, /copyCodeXrCollaborationRuntimeToOutput/);
    assert.match(fileParser, /copyCodeXrAvatarRuntimeToOutput/);
    assert.doesNotMatch(fileParser, /CollaborationUi/);
    assert.match(directoryParser, /readVirtualScreenRuntimeContent/);
    assert.match(directoryParser, /readCodeXrCollaborationRuntimeContent/);
    assert.match(directoryParser, /readCodeXrAvatarRuntimeContent/);
    assert.doesNotMatch(directoryParser, /CollaborationUi/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME, collaborationRuntimeContent\)/);
    assert.match(domParser, /readVirtualScreenRuntimeContent/);
    assert.match(domParser, /readCodeXrCollaborationRuntimeContent/);
    assert.match(domParser, /readCodeXrAvatarRuntimeContent/);
    assert.doesNotMatch(domParser, /CollaborationUi/);
    assert.match(domParser, /readVirtualScreenManagerRuntimeContent/);
    assert.match(domParser, /readCodeXrDomSceneCollaborationRuntimeContent/);
    assert.match(componentAsset, /copyVirtualScreenRuntimeToOutput/);
    assert.match(collaborationAsset, /copyCodeXrCollaborationRuntimeToOutput/);
    assert.match(collaborationAsset, /copyCodeXrDomSceneCollaborationRuntimeToOutput/);
    assert.match(avatarAsset, /copyCodeXrAvatarRuntimeToOutput/);

    assert.doesNotMatch(runtimeSource, /request-host-start/);
    assert.doesNotMatch(runtimeSource, /virtualScreenSupportsHostBroadcast/);
});

test('virtual screen supports fixed-content subtypes through the provider seam', () => {
    // Config surface + provider registry are part of the public API.
    assert.match(runtimeSource, /contentKind: 'broadcast'/);
    assert.match(runtimeSource, /function registerContentProvider/);
    assert.match(runtimeSource, /function getContentProvider/);
    assert.equal(typeof runtimeModule.registerContentProvider, 'function');
    assert.equal(typeof runtimeModule.getContentProvider, 'function');
    assert.equal(runtimeModule.registerContentProvider('test-provider', () => {}), true);
    assert.equal(typeof runtimeModule.getContentProvider('test-provider'), 'function');
    assert.equal(runtimeModule.getContentProvider('missing-provider'), null);
    // Invalid registrations are rejected.
    assert.equal(runtimeModule.registerContentProvider('', () => {}), false);
    assert.equal(runtimeModule.registerContentProvider('no-build', null), false);

    // Fixed screens swap the video surface for the provider-filled content slot,
    // never build the share button, and skip the hidden <video> element.
    assert.match(runtimeSource, /isFixedContent\(refs\.config\)/);
    assert.match(runtimeSource, /codexrVirtualScreenContent/);
    assert.match(runtimeSource, /refs\.shareButton = isFixedContent\(refs\.config\)/);
    assert.match(runtimeSource, /Fixed-content screens never stream/);
    // Content scales with the screen width against its design width.
    assert.match(runtimeSource, /refs\.config\.contentDesignWidth \|\| width/);

    // The subtype markers travel with the shared entity so remote peers can
    // materialize (or safely skip) fixed screens.
    assert.match(runtimeSource, /contentKind: refs\.config\.contentKind \|\| 'broadcast'/);
    assert.match(runtimeSource, /contentProviderId: refs\.config\.contentProviderId \|\| ''/);
    assert.match(runtimeSource, /contentDesignWidth: refs\.config\.contentDesignWidth \|\| 0/);

    const managerSource = readProjectFile(
        'templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js',
    );
    // Well-known screens (default, guide…) sync in place and are never treated
    // as removable remote screens; unknown fixed providers are skipped instead
    // of materializing as dead video screens.
    assert.match(managerSource, /registerWellKnownScreen/);
    assert.match(managerSource, /this\.wellKnownScreens = new Set\(this\.runtimeFactory\?\.getWellKnownScreenIds\?\.\(\) \|\| \['default'\]\)/);
    assert.match(managerSource, /wellKnownScreens\?\.has\(sharedState\.entityId\)/);
    assert.match(managerSource, /skipping fixed screen without a registered provider/);
    assert.match(managerSource, /contentKind: sharedState\.contentKind === 'fixed' \? 'fixed' : 'broadcast'/);
});

test('hidden screen chrome leaves the raycaster world (raycastable ⇔ visible)', () => {
    // A-Frame's raycaster intersects entities regardless of `visible`, so the
    // runtime must drop the raycast class whenever it hides interactive chrome.
    assert.match(runtimeSource, /function setInteractive/);
    assert.match(runtimeSource, /entity\.classList\?\.toggle\(RAYCAST_CLASS, !!on\)/);
    assert.match(runtimeSource, /function scheduleRaycasterRefresh/);
    assert.match(runtimeSource, /refreshObjects\?\.\(\)/);

    // Raycast-only surfaces must never write depth: with depthWrite the
    // near-invisible planes clip every transparent object behind them (the
    // diagonal-cut artifact seen while dragging a screen across the room).
    const utilityPlaneMaterial = 'color: #FFFFFF; opacity: 0.001; transparent: true; side: double; depthWrite: false;';
    const utilityPlaneCount = runtimeSource.split(utilityPlaneMaterial).length - 1;
    assert.equal(utilityPlaneCount, 2, 'interactionPlane and dragPlane must both be depth-inert');

    // The 28x18 drag plane is the worst offender: it must be created WITHOUT
    // the raycast class and only gain it while a drag is active.
    assert.match(runtimeSource, /class: 'codexr-screen-drag-plane'/);
    assert.doesNotMatch(runtimeSource, /babiaxraycasterclass codexr-screen-drag-plane/);
    assert.match(runtimeSource, /setInteractive\(refs\.dragPlane, true\)/);
    assert.match(runtimeSource, /setInteractive\(refs\.dragPlane, false\)/);
    assert.match(runtimeSource, /setInteractive\(refs\.dragPlane, !!state\.drag\)/);

    // Every interactive chrome element follows the same rule in refreshUi.
    assert.match(runtimeSource, /setInteractive\(refs\.interactionPlane, expanded\)/);
    assert.match(runtimeSource, /setInteractive\(refs\.shareButton, showShareButton\)/);
    assert.match(runtimeSource, /setInteractive\(refs\.audioUnlockButton, showAudioUnlock\)/);
    assert.match(runtimeSource, /setInteractive\(button, headerVisible\)/);
    assert.match(runtimeSource, /setInteractive\(handle, expanded && chromeVisible\)/);
    assert.match(runtimeSource, /setInteractive\(handle, chromeVisible\)/);
    assert.match(runtimeSource, /setInteractive\(refs\.legendToggle, showLegend\)/);
});

test('dependency graph parks the normal charts without leaving raycastable ghosts', () => {
    const graphSource = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
    // Fallback parking (no surface runtime) must suspend raycast classes on the
    // hidden subtree and restore them on unpark — same marker attribute as the
    // historical-comparison runtime so cross-runtime handoffs line up.
    assert.match(graphSource, /data-codexr-raycast-suspended/);
    assert.match(graphSource, /function suspendSubtreeRaycast/);
    assert.match(graphSource, /function restoreSubtreeRaycast/);
    assert.match(graphSource, /suspendSubtreeRaycast\(element\)/);
    assert.match(graphSource, /forEach\(restoreSubtreeRaycast\)/);
});

test('screens control panel: guarded delete, min/exp, rich rows, gated refresh', () => {
    const managerSource = readProjectFile(
        'templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js',
    );
    // Well-known screens (default, guide) are never deletable; only managed
    // screens (Add Screen / remote copies) get the Del button.
    assert.match(managerSource, /entry\.managed === true && !this\.wellKnownScreens\?\.has\(entry\.instanceId\)/);
    assert.doesNotMatch(managerSource, /canDelete = entry\.instanceId !== 'default'/);
    // Min/Exp toggle drives the runtime's (room-shared) presentation mode.
    assert.match(managerSource, /entry\.runtime\?\.expand\?\.\(\)/);
    assert.match(managerSource, /entry\.runtime\?\.minimize\?\.\(\)/);
    // Rich rows: accent chip per kind + owner lookup for remote screens.
    assert.match(managerSource, /const PANEL_KINDS = \{/);
    assert.match(managerSource, /getParticipant\?\.\(entry\.ownerPeerId\)\?\.displayName/);
    // The 350 ms poll only rebuilds when the content signature changes.
    assert.match(managerSource, /computePanelSignature/);
    assert.match(managerSource, /signature === this\.panelSignature/);
    // Layout is constant-driven and the plane resizes to the row count.
    assert.match(managerSource, /const PANEL_LAYOUT = \{/);
    assert.match(managerSource, /panelPlane\?\.setAttribute\('height', String\(height\)\)/);
});

test('well-known screen ids are reserved at script load and survive materialization races', () => {
    // Parent registry: subtypes reserve their id when their script loads,
    // before any collaboration snapshot can replay.
    assert.match(runtimeSource, /const WELL_KNOWN_SCREEN_IDS = new Set\(\['default'\]\)/);
    assert.match(runtimeSource, /function reserveWellKnownScreenId/);
    assert.match(runtimeSource, /function getWellKnownScreenIds/);
    assert.equal(typeof runtimeModule.reserveWellKnownScreenId, 'function');
    assert.equal(runtimeModule.reserveWellKnownScreenId('test-screen'), true);
    assert.ok(runtimeModule.getWellKnownScreenIds().includes('test-screen'));
    assert.ok(runtimeModule.getWellKnownScreenIds().includes('default'));
    assert.equal(runtimeModule.reserveWellKnownScreenId(''), false);

    const managerSource = readProjectFile(
        'templates', 'components', 'codexr', 'virtual-screen', 'codexrMultiScreenManagerRuntime.js',
    );
    // Manager seeds its set from the registry (not a hardcoded list) and
    // destroys any race-materialized copy before adopting the local runtime.
    assert.match(managerSource, /new Set\(this\.runtimeFactory\?\.getWellKnownScreenIds\?\.\(\) \|\| \['default'\]\)/);
    assert.match(managerSource, /stale\.runtime\.destroy\?\.\(\)/);
    // Geometry survives materialization: aspectRatio flows shared-state →
    // ensureRemoteScreen → buildRuntimeInitConfig.
    assert.match(runtimeSource, /aspectRatio: refs\.config\.aspectRatio \|\| 0/);
    assert.match(managerSource, /aspectRatio: Number\(sharedState\.aspectRatio\) \|\| 0/);
    assert.match(managerSource, /aspectRatio: Number\(options\?\.aspectRatio\) > 0/);

    // Server never resurrects an entity from a bare transform.
    const serverSource = readProjectFile('src', 'servers', 'runtime', 'collaboration', 'collaborationRoomServer.ts');
    assert.match(serverSource, /Never resurrect an entity from a bare transform/);
    assert.doesNotMatch(serverSource, /room\.entities\.get\(key\) \|\| \{ entityKind, entityId \}/);
});

test('collision bumpers stop look-at, drag, and resize at walls and screens', () => {
    // Config surface: enabled by default, room-derived bounds with override.
    assert.match(runtimeSource, /collisionEnabled: true/);
    assert.match(runtimeSource, /collisionMargin: 0\.05/);
    assert.match(runtimeSource, /merged\.collisionEnabled = userConfig\?\.collisionEnabled !== false/);
    // Bounds derive from the codexr-room shell; collisionBounds overrides.
    assert.match(runtimeSource, /function getCollisionBounds/);
    assert.match(runtimeSource, /querySelector\('\[codexr-room\]'\)/);
    assert.match(runtimeSource, /refs\.config\.collisionBounds/);
    // Other screens are thin oriented-box obstacles.
    assert.match(runtimeSource, /function getScreenObstacles/);
    assert.match(runtimeSource, /inverseMatrix/);
    // Rotation bumper: full look-at first, then shrinking slerp fractions,
    // else hold the pose (a stop, never a limit while clear of obstacles).
    assert.match(runtimeSource, /function constrainOrientation/);
    assert.match(runtimeSource, /\[0\.5, 0\.25, 0\.1\]/);
    assert.match(runtimeSource, /constrainOrientation\(\s*rootWorldPosition,\s*computeFaceUserQuaternion/);
    // Movement bumper slides along the obstacle instead of sticking.
    assert.match(runtimeSource, /function constrainPosition/);
    assert.match(runtimeSource, /constrainPosition\(\s*intersectionPoint\.clone\(\)/);
    // Resize bumper: growth into an obstacle is refused, shrinking is free.
    assert.match(runtimeSource, /nextWidth > state\.screenWidth/);
    // The fixed-cone experiment is fully removed (no legacy).
    assert.doesNotMatch(runtimeSource, /lookAtMaxAngleDeg/);
    assert.doesNotMatch(runtimeSource, /mountQuaternion/);
    assert.doesNotMatch(runtimeSource, /rotateTowards/);

    // Screens sit back on the wall; the bumper is what keeps them out of it.
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    assert.match(xrTemplate, /"anchoredPosition":\{"x":0,"y":4\.2,"z":-22\}/);
});

test('grab-and-reach: the grabbing hand\'s stick pushes/pulls the screen per frame', () => {
    // The handler only RECORDS the deflection — thumbstickmoved fires on axis
    // CHANGE, so applying per event froze the screen while the stick was held
    // (the shipped behaviour the emulator exposed). Motion happens per frame.
    assert.match(runtimeSource, /state\.drag\.depthStickY = Math\.abs\(axisY\) < 0\.15 \? 0 : axisY/);
    assert.doesNotMatch(runtimeSource, /adjustDragDepth\(axisY/);
    assert.match(runtimeSource, /function applyStickDepth/);
    assert.match(runtimeSource, /applyStickDepth\(\);\s*\n\s*updateDragDepthSmoothing\(\)/);
    // Stick forward (negative y) pushes AWAY (Quest convention), stick right
    // (positive x) slides the screen to the user's right — both scaled by
    // time, not by event count, at the same speed.
    assert.match(runtimeSource, /adjustDragDepth\(-deflectionY \* speed \* dtSeconds\)/);
    assert.match(runtimeSource, /adjustDragLateral\(deflectionX \* speed \* dtSeconds\)/);
    assert.match(runtimeSource, /state\.drag\.depthStickX = Math\.abs\(axisX\) < 0\.15 \? 0 : axisX/);
    // The sideways axis is horizontal and perpendicular to the depth axis
    // (depth x up), so it degenerates safely for an overhead screen.
    assert.match(runtimeSource, /\.cross\(new global\.THREE\.Vector3\(0, 1, 0\)\)/);
    // Depth shifts the interaction plane (that is what slides the ray-plane
    // intersection); lateral must shift ONLY the screen reference — an
    // in-plane plane shift does not move the intersection at all.
    assert.match(runtimeSource, /const rootOffsetVector = currentDepthVector\.clone\(\)/);
    assert.match(runtimeSource, /rootOffsetVector\.add\(state\.drag\.lateralAxis\.clone\(\)/);
    assert.match(runtimeSource, /currentStartPoint = state\.drag\.startPoint\.clone\(\)\.add\(currentDepthVector\)/);
    assert.match(runtimeSource, /currentStartRootWorldPosition = state\.drag\.startRootWorldPosition\.clone\(\)\.add\(rootOffsetVector\)/);
    assert.match(runtimeSource, /controllerDepthSpeed: 1\.8/);
    assert.doesNotMatch(runtimeSource, /controllerDepthStep/);
    // The depth target is clamped: bounded lead (the collision bumper is a
    // physical stop — unbounded accumulation made reversing dead) and a
    // minimum pull distance so the screen stops before the user's head.
    assert.match(runtimeSource, /dragDepthMaxLead: 1\.2/);
    assert.match(runtimeSource, /dragDepthMinDistance: 0\.6/);
    assert.match(runtimeSource, /Math\.min\(Math\.max\(target, current - maxLead\), current \+ maxLead\)/);
    assert.match(runtimeSource, /minDistance - state\.drag\.startDepthDistance/);
    // The per-frame depth log died with the per-event step: adjustDragDepth
    // now runs every frame and must not spam the console.
    assert.doesNotMatch(runtimeSource, /VIRTUAL_SCREEN: depth update/);
});

test('a controller drag claims its stick and owns the pointer for its duration', () => {
    // The grabbing hand's stick is claimed away from aframe-extras locomotion
    // (the gate lives in codexr-immersive-rig; lazy global lookup because
    // screens load before the rig runtime) and the scene is marked so
    // codexr-pointer-policy does not hand the laser away mid-grab.
    assert.match(runtimeSource, /CodeXRStickGateRuntime\?\.claim\?\.\(state\.drag\.gateHand\)/);
    assert.match(runtimeSource, /CodeXRStickGateRuntime\?\.release\?\.\(state\.drag\.gateHand\)/);
    assert.match(runtimeSource, /addState\('codexr-screen-drag'\)/);
    assert.match(runtimeSource, /removeState\?\.\('codexr-screen-drag'\)/);
    // Claim/release and state add/remove are paired through endDrag, which
    // runs on every drag-end path (handle/scene/window mouseup and blur).
    assert.match(runtimeSource, /ownsSceneDragState/);
    // Only the two known controller ids map to a claimable hand.
    assert.match(runtimeSource, /'leftController'\s*\n?\s*\? 'left'/);
});

// ── Relay transport: media for viewers peer-to-peer cannot reach ─────────────

test('the relay wire format matches the one the server relays and validates', () => {
    const serverSource = readProjectFile(
        'src', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.ts',
    );

    // Header layout has to agree on both ends or every frame is dropped.
    assert.match(runtimeSource, /const RELAY_HEADER_BYTES = 12;/);
    assert.match(serverSource, /const FRAME_HEADER_BYTES = 12;/);
    assert.match(runtimeSource, /const RELAY_MAGIC_0 = 0x43;/);
    assert.match(serverSource, /const FRAME_MAGIC_0 = 0x43;/);
    assert.match(runtimeSource, /const RELAY_MAGIC_1 = 0x58;/);
    assert.match(serverSource, /const FRAME_MAGIC_1 = 0x58;/);
    // The server only ever drops delta video under backpressure, and the
    // runtime must be numbering its kinds the same way for that to be true.
    assert.match(runtimeSource, /videoDelta: 2,/);
    assert.match(serverSource, /const FRAME_KIND_VIDEO_DELTA = 2;/);
    assert.match(serverSource, /\(kindByte & FRAME_KIND_MASK\) === FRAME_KIND_VIDEO_DELTA/);
    // Both ends pack the temporal layer into the same nibble of the same byte.
    assert.match(runtimeSource, /const RELAY_VERSION = 2;/);
    assert.match(runtimeSource, /const RELAY_LAYER_SHIFT = 4;/);
    assert.match(serverSource, /const FRAME_LAYER_SHIFT = 4;/);
    assert.match(runtimeSource, /\(layer << RELAY_LAYER_SHIFT\) \| \(kind & RELAY_KIND_MASK\)/);
    assert.match(serverSource, /const temporalLayer = kindByte >> FRAME_LAYER_SHIFT;/);
});

test('the relay picks WebCodecs when available and whole images when not', () => {
    // Encoded path: VP8 video plus Opus audio, both from track processors.
    assert.match(runtimeSource, /function hasWebCodecs\(\)/);
    assert.match(runtimeSource, /typeof win\.VideoEncoder === 'function'/);
    assert.match(runtimeSource, /typeof win\.MediaStreamTrackProcessor === 'function'/);
    assert.match(runtimeSource, /codec: 'vp8'/);
    assert.match(runtimeSource, /codec: 'opus'/);
    // Fallback path for browsers without WebCodecs.
    assert.match(runtimeSource, /function startImagePump\(/);
    assert.match(runtimeSource, /'image\/jpeg', RELAY_IMAGE_QUALITY/);
    // Latency over fluidity: frames are skipped rather than queued.
    assert.match(runtimeSource, /if \(encoder\.encodeQueueSize > 2\) \{/);
    // The decoded picture reaches the existing texture through a canvas stream,
    // so nothing downstream needs to know the media was relayed.
    assert.match(runtimeSource, /canvas\.captureStream\(30\)/);
    assert.match(runtimeSource, /updateVideoSource\(receiver\.stream\)/);
});

test('a viewer is only live once a real frame arrives, and falls back to the relay if none does', () => {
    // ontrack no longer declares success by itself: that was the black screen.
    const ontrack = runtimeSource.match(/connection\.ontrack = function[\s\S]*?\n        \};/)?.[0] || '';
    assert.ok(ontrack, 'the viewer ontrack handler should still exist');
    assert.match(ontrack, /setBroadcastState\('viewer', 'connecting'\)/);
    assert.doesNotMatch(ontrack, /setBroadcastState\('viewer', 'live'\)/);
    assert.match(ontrack, /watchForFirstRemoteFrame\(\)/);

    // Live is declared by the frame watcher and by the relay painter, nowhere else.
    assert.match(runtimeSource, /function markPeerBroadcastLive\(\)/);
    assert.match(runtimeSource, /function markRelayLive\(receiver\)/);
    assert.match(runtimeSource, /requestVideoFrameCallback/);
    // Without media, the viewer asks the server to relay instead of waiting forever.
    assert.match(runtimeSource, /const PEER_FIRST_FRAME_TIMEOUT_MS = 6000;/);
    assert.match(runtimeSource, /type: 'relay-request'/);
});

test('relayed media is torn down with the broadcast, on both ends', () => {
    // Encoders and decoders outliving their broadcast would keep encoding into
    // the void and hold the capture alive.
    assert.match(runtimeSource, /function stopRelaySender\(\)/);
    assert.match(runtimeSource, /function stopRelayReceiver\(\)/);
    // Viewer leaving a broadcast, and the screen being destroyed.
    const detach = runtimeSource.match(/function detachRemoteBroadcast[\s\S]*?\n    \}/)?.[0] || '';
    assert.match(detach, /stopRelayReceiver\(\);/);
    // The sender stops when capture stops.
    const stopCapture = runtimeSource.match(/function stopCapture[\s\S]*?\n    \}/)?.[0] || '';
    assert.match(stopCapture, /stopRelaySender\(\);/);
    // The socket carrying the frames must be in binary mode or every frame
    // arrives as an unparseable string.
    assert.match(runtimeSource, /socket\.binaryType = 'arraybuffer';/);
    assert.match(runtimeSource, /if \(event\.data instanceof win\.ArrayBuffer\) \{\s*handleRelayFrame\(event\.data\);/);
});

test('one encoder serves the whole audience, reconfigured instead of duplicated', () => {
    // A second viewer must never start a second encoding.
    assert.match(runtimeSource, /function startRelaySender\(message\) \{\s*\n\s*\/\/[\s\S]*?\n\s*if \(refs\.relaySender \|\| state\.streamSourceType !== 'local' \|\| !state\.stream\) \{\s*\n\s*return;/);
    // Audience changes retune that same encoder and resync viewers.
    assert.match(runtimeSource, /function updateRelayAudience\(message\)/);
    assert.match(runtimeSource, /sender\.appliedQuality !== sender\.quality/);
    assert.match(runtimeSource, /encoder\.configure\(buildVideoEncoderConfig\(sender, rawFrame, sender\.temporalLayers\)\);/);
    assert.match(runtimeSource, /sender\.keyframeRequested = true;/);
    // Exactly one VideoEncoder is ever constructed.
    assert.equal((runtimeSource.match(/new win\.VideoEncoder\(/g) || []).length, 1);
});

test('quality follows the audience down to a floor, because every viewer costs another copy', () => {
    const tiers = runtimeSource.match(/const RELAY_QUALITY_TIERS = \[[\s\S]*?\];/)?.[0] || '';
    assert.ok(tiers, 'the quality tiers should exist');
    // Descending bitrate with a floor, and a widest tier that catches any size.
    assert.match(tiers, /maxViewers: 2, bitrate: 1500000/);
    assert.match(tiers, /maxViewers: Infinity, bitrate: 350000/);
    const bitrates = [...tiers.matchAll(/bitrate: (\d+)/g)].map((match) => Number(match[1]));
    assert.deepEqual(bitrates, [...bitrates].sort((left, right) => right - left), 'tiers must descend');
    // The host is told the audience and what it is costing them upstream.
    assert.match(runtimeSource, /function describeRelayBroadcast\(sender\)/);
    assert.match(runtimeSource, /Mbps up/);
});

test('temporal layers are only requested when the browser confirms support', () => {
    assert.match(runtimeSource, /config\.scalabilityMode = 'L1T3';/);
    assert.match(runtimeSource, /await win\.VideoEncoder\.isConfigSupported\(layered\)/);
    assert.match(runtimeSource, /if \(support\?\.supported\) \{\s*\n\s*sender\.temporalLayers = true;/);
    // Without support the stream is still valid, just single-layer.
    assert.match(runtimeSource, /sender\.temporalLayers = false;\s*\n\s*return buildVideoEncoderConfig\(sender, rawFrame, false\);/);
    // The layer of each chunk comes from the encoder, not guessed.
    assert.match(runtimeSource, /metadata\?\.svc\?\.temporalLayerId \|\| 0/);
});

test('no viewer is ever refused: the capacity rejection is gone from both ends', () => {
    const serverSource = readProjectFile(
        'src', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.ts',
    );
    assert.doesNotMatch(serverSource, /MAX_RELAY_VIEWERS/);
    assert.doesNotMatch(serverSource, /relay-capacity/);
    assert.doesNotMatch(runtimeSource, /relayCapacity/);
    // Congestion is handled by thinning per viewer instead.
    assert.match(serverSource, /private shouldThinFrame\(viewer: BroadcastClient, temporalLayer: number\): boolean/);
    assert.match(serverSource, /const RELAY_THIN_TOP_LAYER_BYTES/);
    assert.match(serverSource, /const RELAY_THIN_ALL_DELTAS_BYTES/);
});

test('viewers never publish broadcast state they do not own', () => {
    // The room's screen entity belongs to the sender. A viewer publishing
    // active:false from a server message once convinced the whole room a live
    // broadcast had stopped ("Live sharing stopped" on every guest).
    const stoppedCase = runtimeSource.match(/case 'broadcast-stopped':[\s\S]*?\n          return;/)?.[0] || '';
    assert.ok(stoppedCase, 'the broadcast-stopped handler should exist');
    const publishes = stoppedCase.match(/publishSharedScreenState\(\)/g) || [];
    assert.equal(publishes.length, 1, 'only one publish, and it belongs to the sender branch');
    assert.match(stoppedCase, /streamSourceType === 'local'[\s\S]*publishSharedScreenState\(\)/);
    assert.match(stoppedCase, /skipSharedPublish: true/);
    // Server-triggered detaches never publish the entity either: both ICE
    // failure handlers use the exact non-publishing call.
    assert.equal(
        (runtimeSource.match(/detachRemoteBroadcast\(message, \{ notifyServer: false, skipSharedPublish: true \}\)/g) || []).length,
        2,
    );
});

test('an early viewer waits instead of giving up, and rejoins are only suppressed per socket', () => {
    // Parked by the server: still connecting, nothing to tear down.
    assert.match(runtimeSource, /case 'viewer-waiting':/);
    // The rejoin guard compares the socket the join went out on, so a
    // reconnected socket can rejoin instead of hanging on "connecting".
    assert.match(runtimeSource, /refs\.joinAttemptSocket === refs\.signalingSocket/);
    assert.match(runtimeSource, /function scheduleViewerJoinWatchdog\(\)/);
    assert.match(runtimeSource, /const VIEWER_JOIN_RETRY_MS = 5000;/);
});

test('the relay takes ownership of the session away from the dying direct attempt', () => {
    // Starting the receiver closes the abandoned peer connections and cancels
    // the first-frame watchdog...
    const receiverStart = runtimeSource.match(/function startRelayReceiver[\s\S]*?const canvas = /)?.[0] || '';
    assert.match(receiverStart, /closeAllPeerConnections\(\);/);
    assert.match(receiverStart, /refs\.remoteFrameWatchTimer = null;/);
    // ...and both connection-state handlers stand down once a relay receiver
    // exists (the guard only appears there, once per handler).
    assert.equal((runtimeSource.match(/if \(refs\.relayReceiver\) \{\s*\n\s*return;\s*\n\s*\}/g) || []).length, 2);
});

test('a viewer only reaches live through its own first frame, never the sender snapshot', () => {
    // The status adoption skips active viewers...
    assert.match(runtimeSource, /state\.broadcastRole !== 'viewer'\s*\n\s*\) \{\s*\n\s*state\.broadcastStatus = snapshot\.broadcastStatus;/);
    // ...and applying an active broadcast preserves live only for a viewer
    // that already earned it.
    assert.match(runtimeSource, /const alreadyLiveViewer = state\.broadcastRole === 'viewer' && state\.broadcastStatus === 'live';/);
    // The server, for its part, parks early viewers instead of refusing them.
    const serverSource = readProjectFile(
        'src', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.ts',
    );
    assert.match(serverSource, /private parkViewer\(/);
    assert.match(serverSource, /type: 'viewer-waiting'/);
    assert.doesNotMatch(serverSource, /'no-signal'/);
});

// ── Role-aware screen controls: join / share / leave, without accidents ──────

test('sharing over someone else\'s live broadcast is refused up front, with no detach', () => {
    const startCaptureBlock = runtimeSource.match(/async function startCapture\(intent\) \{[\s\S]*?\n    \}/)?.[0] || '';
    assert.ok(startCaptureBlock, 'startCapture should exist');
    // The old accident: detaching the viewer from the stream they were
    // watching before even opening the native picker.
    assert.doesNotMatch(startCaptureBlock, /detachRemoteBroadcast/);
    assert.match(startCaptureBlock, /if \(isForeignBroadcastActive\(\)\) \{/);
    assert.match(startCaptureBlock, /labels\.screenBusy/);
    // And the server guarantees it even if two clients race: the denied share
    // rolls back and returns to being a viewer.
    assert.match(runtimeSource, /case 'broadcast-denied':/);
    assert.doesNotMatch(runtimeSource, /broadcast-replaced/);
    const serverSource = readProjectFile(
        'src', 'servers', 'runtime', 'broadcast', 'screenBroadcastSignalingServer.ts',
    );
    assert.match(serverSource, /type: 'broadcast-denied'/);
    assert.doesNotMatch(serverSource, /broadcast-replaced/);
    assert.match(serverSource, /previousBroadcaster\.socket\.readyState === WebSocket\.OPEN/);
});

test('leaving is explicit, local, and sticks until the viewer presses Join', () => {
    // Any non-sender pressing stop takes the leave path: opt-out plus a
    // detach that never publishes the room entity (it belongs to the sender).
    const stopBlock = runtimeSource.match(/function stopCapture\(message, options\) \{[\s\S]*?function attachTrackEndedListener/)?.[0] || '';
    assert.match(stopBlock, /state\.streamSourceType !== 'local'/);
    assert.match(stopBlock, /state\.viewerOptOut = true;/);
    assert.match(stopBlock, /skipSharedPublish: true/);
    // Every auto-join path respects the opt-out...
    assert.match(runtimeSource, /function ensureRemoteBroadcastSubscription[\s\S]*?if \(state\.viewerOptOut\) \{\s*\n\s*return;/);
    assert.match(runtimeSource, /\|\| state\.viewerOptOut\s*\|\| state\.broadcastRole !== 'viewer'/);
    // ...and only Join clears it (plus the broadcast ending or changing hands).
    assert.match(runtimeSource, /function joinBroadcast\(\) \{\s*\n\s*state\.viewerOptOut = false;/);
    assert.match(runtimeSource, /state\.viewerOptOut = false;\s*\n\s*\}\s*\n\s*if \(state\.streamSourceType !== 'local'\) \{/);
});

test('the center slot alternates Share and Join, and clicking content only shows who is sharing', () => {
    // Mutually exclusive predicates on the same slot: share needs a free
    // screen, join needs a live broadcast you are not watching.
    assert.match(runtimeSource, /const showShareButton = !fixedContent && state\.mode === 'idle' && !foreignBroadcast;/);
    assert.match(runtimeSource, /const showJoinButton = !fixedContent && expanded && foreignBroadcast && !watchingBroadcast;/);
    // The join button names the broadcaster, resolved from the room.
    assert.match(runtimeSource, /getBroadcasterDisplayName\(\)/);
    assert.match(runtimeSource, /getParticipant\?\.\(peerId\)/);
    // Clicking the content surface is wired to the info overlay and nothing else.
    assert.match(runtimeSource, /refs\.interactionPlane\.addEventListener\('click', function \(\) \{\s*\n[\s\S]{0,220}?showSharingInfoOverlay\(\);/);
    // The overlay is display-only: visible, never raycastable.
    assert.match(runtimeSource, /setEntityVisible\(refs\.infoOverlay, showInfoOverlay\);/);
    assert.doesNotMatch(runtimeSource, /setInteractive\(refs\.infoOverlay/);
    // And it fades on its own.
    assert.match(runtimeSource, /refs\.infoOverlayTimer = win\.setTimeout/);
});

test('a viewer auto-joins by default and settles to idle when the broadcast ends', () => {
    const runtime = runtimeModule.createRuntime({
        document: null,
        location: { protocol: 'https:', host: 'localhost:8443', hostname: 'localhost' },
        isSecureContext: true,
        WebSocket: undefined,
        setTimeout: () => 0,
        clearTimeout: () => undefined,
        __CODEXR_VIRTUAL_SCREEN_CONFIG__: { screenId: 'default', broadcastEnabled: true },
    });

    const activeEntity = {
        entityKind: 'screen',
        entityId: 'default',
        screenId: 'default',
        broadcastStatus: 'live',
        hasAudio: false,
        broadcast: { active: true, broadcasterPeerId: 'peer-sender', hasAudio: false, sourceKind: 'screen' },
    };

    // Default: an active broadcast pulls the viewer in (connecting), and
    // 'live' is never adopted from the sender's own status.
    runtime.applySharedScreenState(activeEntity);
    assert.equal(runtime.getState().broadcastRole, 'viewer');
    assert.equal(runtime.getState().broadcastStatus, 'connecting');
    assert.equal(runtime.getState().viewerOptOut, false);

    // The broadcast ends: back to idle, opt-out stays clear.
    runtime.applySharedScreenState({
        ...activeEntity,
        broadcastStatus: 'idle',
        broadcast: { active: false, broadcasterPeerId: '', hasAudio: false, sourceKind: 'screen' },
    });
    assert.equal(runtime.getState().broadcastStatus, 'idle');
    assert.equal(runtime.getState().viewerOptOut, false);

    // A new broadcast pulls them in again.
    runtime.applySharedScreenState(activeEntity);
    assert.equal(runtime.getState().broadcastStatus, 'connecting');
});
