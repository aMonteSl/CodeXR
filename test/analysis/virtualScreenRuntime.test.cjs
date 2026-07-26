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
