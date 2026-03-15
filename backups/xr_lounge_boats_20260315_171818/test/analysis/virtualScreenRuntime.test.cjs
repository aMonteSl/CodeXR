const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(projectRoot, 'templates', 'xr', 'shared', 'virtualScreenRuntime.js');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const runtimeModule = require(runtimePath);

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('XR and DOM templates load the shared virtual screen runtime with explicit scene config and controller-ready pointers', () => {
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const domTemplate = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');

    assert.match(xrTemplate, /window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{/);
    assert.match(xrTemplate, /followAnchorSelector: '#rig'/);
    assert.match(xrTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(xrTemplate, /id="rightController"/);
    assert.match(xrTemplate, /cursor="rayOrigin: entity; fuse: false"/);

    assert.match(domTemplate, /window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{/);
    assert.match(domTemplate, /followAnchorSelector: '#cameraRig'/);
    assert.match(domTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(domTemplate, /id="rightController"/);
    assert.match(domTemplate, /cursor="rayOrigin: entity; fuse: false"/);
    assert.match(domTemplate, /cursor="rayOrigin: mouse"/);
});

test('XR and DOM parsers package virtualScreenRuntime.js with generated analysis files', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const domParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'visualizeDOMParser.ts');
    const injector = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'virtualScreenConfigInjector.ts');

    assert.match(fileParser, /virtualScreenRuntime\.js/);
    assert.match(fileParser, /loadedFiles\.has\('virtualScreenRuntime\.js'\)/);
    assert.match(fileParser, /injectVirtualScreenViewerConfig/);
    assert.match(directoryParser, /generatedFiles\.set\('virtualScreenRuntime\.js', virtualScreenRuntimeContent\)/);
    assert.match(directoryParser, /virtualScreenSignalPath: '\/codexr\/virtual-screen\/ws'/);
    assert.match(domParser, /resultFiles\.set\('virtualScreenRuntime\.js', virtualScreenRuntime\)/);
    assert.match(domParser, /processHTMLTemplates\([\s\S]*virtualScreenSessionId/s);
    assert.match(injector, /virtualScreenSessionId/);
    assert.match(injector, /virtualScreenSupportsHostBroadcast/);
});

test('virtual screen runtime uses contextual chrome, side legend controls, source chooser, and smoothed 3D drag depth', () => {
    assert.match(runtimeSource, /codexrShareSource/);
    assert.doesNotMatch(runtimeSource, /codexrShareWindow/);
    assert.doesNotMatch(runtimeSource, /codexrShareVSCode/);
    assert.match(runtimeSource, /codexrVirtualScreenSourceMenu/);
    assert.match(runtimeSource, /codexrShareThisDevice/);
    assert.match(runtimeSource, /codexrShareAnalysisHost/);
    assert.match(runtimeSource, /sourceMenuOpen: false/);
    assert.match(runtimeSource, /sourceMode: null/);
    assert.match(runtimeSource, /remoteStatus: 'idle'/);
    assert.match(runtimeSource, /remoteViewerId: null/);
    assert.match(runtimeSource, /remotePeer: null/);
    assert.match(runtimeSource, /remoteSocket: null/);
    assert.match(runtimeSource, /remotePendingCandidates: \[\]/);
    assert.match(runtimeSource, /virtualScreenSignalPath/);
    assert.match(runtimeSource, /virtualScreenSupportsHostBroadcast/);
    assert.match(runtimeSource, /virtualScreenSupportsLocalCapture/);
    assert.match(runtimeSource, /SOURCE_MESSAGES = \{[\s\S]*'analysis-host'/s);
    assert.match(runtimeSource, /codexrHeaderLookAt/);
    assert.match(runtimeSource, /codexrHeaderFollow/);
    assert.match(runtimeSource, /codexrHeaderMinimize/);
    assert.match(runtimeSource, /codexrHeaderStop/);
    assert.match(runtimeSource, /codexrResizeTopLeft/);
    assert.match(runtimeSource, /codexrResizeTopRight/);
    assert.match(runtimeSource, /codexrResizeBottomLeft/);
    assert.match(runtimeSource, /codexrResizeBottomRight/);
    assert.match(runtimeSource, /codexrMoveTop/);
    assert.match(runtimeSource, /codexrMoveRight/);
    assert.match(runtimeSource, /codexrMoveBottom/);
    assert.match(runtimeSource, /codexrMoveLeft/);
    assert.match(runtimeSource, /codexrVirtualScreenDragPlane/);
    assert.match(runtimeSource, /followTransform: null/);
    assert.match(runtimeSource, /lookAtCameraEnabled: true/);
    assert.match(runtimeSource, /legendSide: 'right'/);
    assert.match(runtimeSource, /maxWidth: 10\.0/);
    assert.match(runtimeSource, /dragDepthStep: 0\.45/);
    assert.match(runtimeSource, /controllerDepthStep: 0\.08/);
    assert.match(runtimeSource, /legendCollapsed: false/);
    assert.match(runtimeSource, /button\.__codexrTextEntity = label/);
    assert.match(runtimeSource, /const target = entity\.__codexrTextEntity \|\| entity;/);
    assert.match(runtimeSource, /codexrVirtualScreenLegendRoot/);
    assert.match(runtimeSource, /codexrVirtualScreenLegendPanel/);
    assert.match(runtimeSource, /codexrVirtualScreenLegendText/);
    assert.match(runtimeSource, /codexrLegendToggle/);
    assert.match(runtimeSource, /function toggleLegend\(\)/);
    assert.match(runtimeSource, /function toggleSourceMenu\(\)/);
    assert.match(runtimeSource, /function toggleLookAtCamera\(\)/);
    assert.match(runtimeSource, /function connectHostBroadcastViewer\(\)/);
    assert.match(runtimeSource, /function sendRemoteSignal\(/);
    assert.match(runtimeSource, /function createHostBroadcastPeer\(/);
    assert.match(runtimeSource, /function handleHostBroadcastMessage\(/);
    assert.match(runtimeSource, /function getLegendLayoutMetrics\(width, minimized\)/);
    assert.match(runtimeSource, /function updateLegendSide\(\)/);
    assert.match(runtimeSource, /getCameraWorldQuaternion/);
    assert.match(runtimeSource, /getCameraWorldPosition/);
    assert.match(runtimeSource, /captureFollowTransformFromCamera/);
    assert.match(runtimeSource, /computeFaceUserQuaternion/);
    assert.match(runtimeSource, /applyFaceCameraOrientation/);
    assert.match(runtimeSource, /applyFollowTransform/);
    assert.match(runtimeSource, /ensureFollowLoop/);
    assert.match(runtimeSource, /followLoopActive: false/);
    assert.match(runtimeSource, /faceCameraLoopActive: false/);
    assert.match(runtimeSource, /function updateFaceCamera\(\)/);
    assert.match(runtimeSource, /function ensureFaceCameraLoop\(\)/);
    assert.match(runtimeSource, /state\.follow \|\| !state\.lookAtCameraEnabled \|\| !refs\.root\?\.isConnected/);
    assert.match(runtimeSource, /state\.faceCameraLoopActive \|\| !state\.lookAtCameraEnabled/);
    assert.match(runtimeSource, /buildDragPlane\(startPoint, planeNormal\)/);
    assert.match(runtimeSource, /evt\?\.detail\?\.cursorEl \|\| evt\?\.detail\?\.raycasterEl \|\| null/);
    assert.match(runtimeSource, /pointerType: getPointerType\(pointerEl\)/);
    assert.match(runtimeSource, /depthAxis: kind === 'move' \? getDragDepthAxis\(rootWorldPosition\) : null/);
    assert.match(runtimeSource, /currentDepthOffset: 0/);
    assert.match(runtimeSource, /targetDepthOffset: 0/);
    assert.match(runtimeSource, /function updateDragDepthSmoothing\(\)/);
    assert.match(runtimeSource, /function handleWheelDuringDrag\(evt\)/);
    assert.match(runtimeSource, /function handleThumbstickDuringDrag\(evt\)/);
    assert.match(runtimeSource, /thumbstickmoved/);
    assert.match(runtimeSource, /dragPointerType: state\.drag\?\.pointerType \|\| null/);
    assert.match(runtimeSource, /dragDepthOffset: state\.drag\?\.currentDepthOffset \|\| 0/);
    assert.match(runtimeSource, /dragTargetDepthOffset: state\.drag\?\.targetDepthOffset \|\| 0/);
    assert.match(runtimeSource, /lookAtCameraEnabled: state\.lookAtCameraEnabled/);
    assert.match(runtimeSource, /legendCollapsed: state\.legendCollapsed/);
    assert.match(runtimeSource, /legendSide: state\.legendSide/);
    assert.match(runtimeSource, /sourceMode: state\.sourceMode/);
    assert.match(runtimeSource, /remoteStatus: state\.remoteStatus/);
    assert.match(runtimeSource, /sourceMenuOpen: state\.sourceMenuOpen/);
    assert.match(runtimeSource, /signalingConnected: state\.remoteSocket\?\.readyState === 1/);
    assert.match(runtimeSource, /if \(\(state\.mode === 'minimized' && kind === 'resize'\)/);
    assert.match(runtimeSource, /Object\.values\(refs\.edgeHandles\)\.forEach\(\(handle\) => setEntityVisible\(handle, chromeVisible\)\);/);
    assert.match(runtimeSource, /Object\.values\(refs\.edgeHandles\)\.forEach\(\(handle\) => setHandleStyle\(handle, chromeVisible\)\);/);
    assert.match(runtimeSource, /console\.log\('VIRTUAL_SCREEN: drag start'/);
    assert.match(runtimeSource, /console\.log\('VIRTUAL_SCREEN: depth update'/);
    assert.match(runtimeSource, /console\.log\('VIRTUAL_SCREEN: drag end'/);
    assert.match(runtimeSource, /console\.log\('VIRTUAL_SCREEN: drag intersection missing'/);
    assert.match(runtimeSource, /Purple look-at/);
    assert.match(runtimeSource, /Pink look-at off/);
    assert.match(runtimeSource, /Orange follow active/);
    assert.match(runtimeSource, /state\.lookAtCameraEnabled \? '#7C3AED' : '#C08497'/);
    assert.match(runtimeSource, /state\.legendCollapsed \? '#16A34A' : '#F59E0B'/);
    assert.match(runtimeSource, /state\.follow \? '#F97316' : '#2563EB'/);
    assert.match(runtimeSource, /anchor: 'left'/);
    assert.match(runtimeSource, /baseline: 'top'/);
    assert.match(runtimeSource, /Math\.max\(width \* 0\.72, estimatedTextWidth \+ \(horizontalPadding \* 2\)\)/);
    assert.match(runtimeSource, /maxLegendLineLength/);
    assert.match(runtimeSource, /screenInViewSpace\.x > legendSwitchThreshold/);
    assert.match(runtimeSource, /legendSideSign = state\.legendSide === 'left' \? -1 : 1/);
    assert.match(runtimeSource, /computeFaceUserQuaternion\(targetWorldPosition, cameraWorldPosition\)/);
    assert.match(runtimeSource, /computeFaceUserQuaternion\(rootWorldPosition, cameraWorldPosition\)/);
    assert.match(runtimeSource, /chromeVisible/);
    assert.match(runtimeSource, /mouseenter', showChrome/);
    assert.match(runtimeSource, /mouseleave', scheduleChromeHide/);
    assert.match(runtimeSource, /if \(state\.mode === 'active' \|\| state\.mode === 'minimized'\) \{\s*return '';/s);
    assert.doesNotMatch(runtimeSource, /followTransform\.quaternion/);
    assert.doesNotMatch(runtimeSource, /preserveWorldTransform\(root, followAnchor\)/);
    assert.doesNotMatch(runtimeSource, /preserveWorldTransform\(root, scene\)/);
    assert.doesNotMatch(runtimeSource, /preserveWorldTransform\(refs\.root, followAnchor\)/);
});

test('virtual screen runtime exposes capture helpers and requests the unified native picker intent', async () => {
    let capturedOptions = null;
    const fakeWindow = {
        __CODEXR_VIRTUAL_SCREEN_CONFIG__: {},
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
    assert.equal(screenOptions.audio, false);
    assert.equal(typeof runtime.connectHostBroadcastViewer, 'function');
    assert.equal(typeof runtime.toggleSourceMenu, 'function');

    await runtime.requestCapture('screen');
    assert.deepEqual(capturedOptions, screenOptions);
});

test('virtual screen runtime classifies permission errors and keeps the exported helpers available without a DOM', () => {
    const runtime = runtimeModule.createRuntime({
        __CODEXR_VIRTUAL_SCREEN_CONFIG__: {},
        navigator: {},
    });

    const denied = runtime.classifyCaptureError({ name: 'NotAllowedError' });
    const unavailable = runtime.classifyCaptureError({ message: 'unsupported' });
    const state = runtime.getState();

    assert.match(denied, /permission/i);
    assert.equal(unavailable, 'unsupported');
    assert.equal(typeof runtime.DEFAULT_CONFIG, 'object');
    assert.equal(typeof runtime.mergeConfig, 'function');
    assert.equal(typeof runtime.adjustSize, 'function');
    assert.equal(typeof runtime.toggleLookAtCamera, 'function');
    assert.equal(typeof runtime.toggleFollow, 'function');
    assert.equal(state.chromeVisible, false);
    assert.equal(state.lookAtCameraEnabled, true);
    assert.equal(state.dragPointerType, null);
    assert.equal(state.dragDepthOffset, 0);
    assert.equal(state.dragTargetDepthOffset, 0);
    assert.equal(state.legendCollapsed, false);
    assert.equal(state.legendSide, 'right');
    assert.equal(state.sourceMode, null);
    assert.equal(state.remoteStatus, 'idle');
    assert.equal(state.sourceMenuOpen, false);
    assert.equal(state.followTrackingActive, false);
    assert.equal(state.faceCameraTrackingActive, false);
    assert.equal(state.hasFollowTransform, false);
});
