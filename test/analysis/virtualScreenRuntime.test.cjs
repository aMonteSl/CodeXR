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

test('XR and DOM templates load the shared virtual screen runtime and keep controller-ready pointers', () => {
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const domTemplate = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');

    assert.match(xrTemplate, /<script id="codexr-tooling-config-virtual-screen" type="application\/json">/);
    assert.match(xrTemplate, /"followAnchorSelector":"#rig"/);
    assert.match(xrTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.match(xrTemplate, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(xrTemplate, /codexr-multi-screen-manager="maxScreens: 5; wall: west"/);
    assert.match(xrTemplate, /id="rightController"/);
    assert.match(xrTemplate, /cursor="rayOrigin: entity; fuse: false"/);

    assert.match(domTemplate, /window\.__CODEXR_VIRTUAL_SCREEN_CONFIG__ = \{/);
    assert.match(domTemplate, /followAnchorSelector: '#cameraRig'/);
    assert.match(domTemplate, /src="\.\/virtualScreenRuntime\.js"/);
    assert.doesNotMatch(domTemplate, /codexr-multi-screen-manager/);
    assert.match(domTemplate, /id="rightController"/);
    assert.match(domTemplate, /cursor="rayOrigin: mouse"/);
});

test('XR and DOM parsers package the active local virtual-screen assets without broadcast injection', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const domParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'visualizeDOMParser.ts');
    const componentAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'virtualScreenComponentAsset.ts');
    const roomAsset = readProjectFile('src', 'code_analysis', 'engine', 'components', 'customComponents', 'codexrRoomComponentAsset.ts');
    const activeAnalyses = readProjectFile('src', 'code_analysis', 'views', 'subsections', 'active_analyses', 'commands', 'activeAnalysesCommands.ts');
    const orchestrator = readProjectFile('src', 'code_analysis', 'engine', 'servers', 'serverLaunchOrchestrator.ts');

    assert.match(fileParser, /copyVirtualScreenRuntimeToOutput/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(fileParser, /copyCodeXrRoomAssetsToOutput/);
    assert.match(fileParser, /loadedFiles\.has\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME\)/);
    assert.doesNotMatch(fileParser, /injectVirtualScreenViewerConfig/);

    assert.match(directoryParser, /readVirtualScreenRuntimeContent/);
    assert.match(directoryParser, /readVirtualScreenManagerRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME, virtualScreenManagerRuntimeContent\)/);
    assert.doesNotMatch(directoryParser, /virtualScreenSignalPath/);

    assert.match(domParser, /readVirtualScreenRuntimeContent/);
    assert.match(domParser, /resultFiles\.set\(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntime\)/);
    assert.doesNotMatch(domParser, /injectVirtualScreenViewerConfig/);

    assert.match(componentAsset, /templates',\s*'components',\s*'codexr',\s*'virtual-screen'/);
    assert.match(componentAsset, /copyVirtualScreenRuntimeToOutput/);
    assert.match(componentAsset, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(roomAsset, /copyCodeXrRoomAssetsToOutput/);

    assert.doesNotMatch(activeAnalyses, /Open Host Broadcaster/);
    assert.doesNotMatch(activeAnalyses, /hostBroadcasterUrl/);
    assert.doesNotMatch(orchestrator, /hostBroadcaster/);
});

test('virtual screen runtime keeps the current local-screen UX and no longer includes host-broadcast code', () => {
    assert.match(runtimeSource, /codexrShareSource/);
    assert.doesNotMatch(runtimeSource, /codexrVirtualScreenSourceMenu/);
    assert.doesNotMatch(runtimeSource, /codexrShareAnalysisHost/);
    assert.doesNotMatch(runtimeSource, /Analysis host computer/);
    assert.doesNotMatch(runtimeSource, /request-host-start/);
    assert.doesNotMatch(runtimeSource, /connectHostBroadcastViewer/);
    assert.doesNotMatch(runtimeSource, /toggleSourceMenu/);
    assert.doesNotMatch(runtimeSource, /remoteSocket/);
    assert.doesNotMatch(runtimeSource, /remotePeer/);
    assert.doesNotMatch(runtimeSource, /virtualScreenSignalPath/);
    assert.doesNotMatch(runtimeSource, /virtualScreenSupportsHostBroadcast/);

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
    assert.match(runtimeSource, /codexrVirtualScreenLegendRoot/);
    assert.match(runtimeSource, /codexrVirtualScreenLegendPanel/);
    assert.match(runtimeSource, /codexrVirtualScreenLegendText/);
    assert.match(runtimeSource, /codexrLegendToggle/);
    assert.match(runtimeSource, /lookAtCameraEnabled: true/);
    assert.match(runtimeSource, /legendCollapsed: false/);
    assert.match(runtimeSource, /maxWidth: 10\.0/);
    assert.match(runtimeSource, /dragDepthStep: 0\.45/);
    assert.match(runtimeSource, /controllerDepthStep: 0\.08/);
    assert.match(runtimeSource, /function switchSource\(\) \{\s*void startCapture\('screen'\);/s);
    assert.match(runtimeSource, /function updateDragDepthSmoothing\(\)/);
    assert.match(runtimeSource, /function handleWheelDuringDrag\(evt\)/);
    assert.match(runtimeSource, /function handleThumbstickDuringDrag\(evt\)/);
    assert.match(runtimeSource, /function updateFaceCamera\(\)/);
    assert.match(runtimeSource, /function ensureFaceCameraLoop\(\)/);
    assert.match(runtimeSource, /function ensureFollowLoop\(\)/);
    assert.match(runtimeSource, /function updateLegendSide\(\)/);
    assert.match(runtimeSource, /Math\.max\(width \* 0\.72, estimatedTextWidth \+ \(horizontalPadding \* 2\)\)/);
    assert.match(runtimeSource, /Purple look-at/);
    assert.match(runtimeSource, /Pink look-at off/);
    assert.match(runtimeSource, /Orange follow active/);
});

test('virtual screen runtime exposes local capture helpers without requiring a DOM', async () => {
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
    assert.equal(typeof runtime.switchSource, 'function');
    assert.equal(typeof runtime.toggleLookAtCamera, 'function');

    await runtime.requestCapture('screen');
    assert.deepEqual(capturedOptions, screenOptions);
});

test('virtual screen runtime state reflects the local-only feature set', () => {
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
    assert.equal(state.chromeVisible, false);
    assert.equal(state.lookAtCameraEnabled, true);
    assert.equal(state.dragPointerType, null);
    assert.equal(state.dragDepthOffset, 0);
    assert.equal(state.dragTargetDepthOffset, 0);
    assert.equal(state.legendCollapsed, false);
    assert.equal(state.legendSide, 'right');
    assert.equal(state.followTrackingActive, false);
    assert.equal(state.faceCameraTrackingActive, false);
    assert.equal(state.hasFollowTransform, false);
    assert.equal(Object.prototype.hasOwnProperty.call(state, 'remoteStatus'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(state, 'sourceMenuOpen'), false);
});
