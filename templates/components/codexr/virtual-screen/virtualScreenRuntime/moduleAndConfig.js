// == virtualScreenRuntime.js | moduleAndConfig (assembled per manifest.json; see COMPONENTS.md) ==
(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : this;

  const runtime = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }

  root.CodeXRVirtualScreenRuntime = runtime;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        runtime.autoInit();
      }, { once: true });
    } else {
      runtime.autoInit();
    }
  }
})(function (global) {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: true,
    broadcastEnabled: true,
    signalingPath: '/codexr-broadcast',
    sceneSelector: 'a-scene',
    followAnchorSelector: '#rig',
    anchoredPosition: { x: 0, y: 8, z: 6 },
    anchoredRotation: { x: -10, y: 0, z: 0 },
    // Collision stops: the screen tracks the user freely (look-at, drag,
    // resize) until any edge would touch the room shell or another screen —
    // there the motion stops like a physical bumper and resumes when the
    // target comes back inside. Bounds are derived from the codexr-room
    // entity; collisionBounds ({min:{x,y,z}, max:{x,y,z}}) overrides them.
    collisionEnabled: true,
    collisionMargin: 0.05,
    collisionBounds: null,
    followOffset: { x: 0, y: 0.7, z: -2.2 },
    followRotation: { x: 0, y: 0, z: 0 },
    defaultSizeIndex: 2,
    sizeSteps: [3.2, 4.0, 4.8, 5.8, 6.8],
    aspectRatio: 16 / 9,
    minWidth: 2.6,
    maxWidth: 10.0,
    minimizedWidth: 2.1,
    minimizedHeight: 0.42,
    dragDepthStep: 0.45,
    controllerDepthStep: 0.08,
    instanceId: '',
    screenId: '',
    ownerPeerId: '',
    displayName: '',
    // Content subtype: 'broadcast' is the classic WebRTC screen; 'fixed' hosts
    // locally-rendered content from a registered content provider (see
    // registerContentProvider in wiringAndApi.js) — no video surface, no share
    // button, content always visible while expanded. Fixed screens keep every
    // other parent behaviour: chrome, drag/resize, follow, shared transform.
    contentKind: 'broadcast',
    contentProviderId: '',
    // World width the provider designs its content at; layout() scales the
    // content slot by screenWidth / contentDesignWidth so resizing works.
    contentDesignWidth: 0,
    managedScreen: false,
    placeInFrontOfUserOnInit: false,
    deferInitialSharedState: false,
    collaborationSource: 'local',
    collaborationEnabled: true,
    presenceEnabled: true,
    cursorPresenceEnabled: false,
    roomId: '',
    roomSignalingPath: '/codexr-room',
    sessionEndpoint: '/api/collaboration/session',
    videoElementId: '',
    rtcConfiguration: {
      iceServers: [
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    },
    labels: {
      idle: 'Share a screen, window, or browser tab in this XR scene.',
      minimized: 'Virtual screen minimized.',
      permissionDenied: 'Screen sharing permission was denied. Use Share again to retry.',
      unavailable: 'Screen capture is not available in this browser.',
      sourceEnded: 'The shared source stopped. Expand the screen to share again.',
      move: 'Drag a side handle to move the virtual screen.',
      resize: 'Drag a corner handle to resize the virtual screen.',
      broadcasting: 'Broadcasting selected source.',
      receiving: 'Receiving shared source.',
      connecting: 'Connecting live share...',
      noSignal: 'No live source is currently available for this screen.',
      broadcastUnavailable: 'Live broadcasting requires HTTPS or localhost.',
      broadcastError: 'Unable to connect the live broadcast.',
      iceFailed: 'The shared screen could not cross this network (restrictive NAT). Collaboration remains active.',
      relayFallback: 'Direct connection unavailable, switching to the server relay...',
      broadcastStopped: 'Live sharing stopped.',
      collaborationLocked: 'This screen is currently being edited by another user.',
      audioUnlock: 'Enable Audio',
    },
  };

  const SOURCE_MESSAGES = {
    screen: {
      pending: 'Choose a screen, browser tab, or window in the native picker.',
      active: 'Sharing screen/window',
    },
    window: {
      pending: 'Choose the window or app you want to share.',
      active: 'Sharing window/app',
    },
    vscode: {
      pending: 'Choose the VS Code window in the native picker.',
      active: 'Sharing VS Code window',
    },
  };

  const HEADER_BUTTONS = {
    lookAt: 'codexrHeaderLookAt',
    follow: 'codexrHeaderFollow',
    minimize: 'codexrHeaderMinimize',
    stop: 'codexrHeaderStop',
  };

  const CORNER_HANDLES = {
    topLeft: 'codexrResizeTopLeft',
    topRight: 'codexrResizeTopRight',
    bottomLeft: 'codexrResizeBottomLeft',
    bottomRight: 'codexrResizeBottomRight',
  };

  const EDGE_HANDLES = {
    top: 'codexrMoveTop',
    right: 'codexrMoveRight',
    bottom: 'codexrMoveBottom',
    left: 'codexrMoveLeft',
  };

  const CONFIG_SCRIPT_ID = 'codexr-tooling-config-virtual-screen';

  // Scene-wide raycaster whitelist class (see setInteractive: raycastable ⇔
  // visible — hidden chrome must never keep this class).
  const RAYCAST_CLASS = 'babiaxraycasterclass';

  // Fixed-content providers, shared by every runtime instance (local and the
  // ones materialized for remote peers). A provider mounts its content into the
  // screen's content slot: build(contentRoot, runtimeApi).
  const CONTENT_PROVIDERS = new Map();

  function registerContentProvider(providerId, build) {
    const id = String(providerId || '').trim();
    if (!id || typeof build !== 'function') {
      return false;
    }
    CONTENT_PROVIDERS.set(id, build);
    return true;
  }

  function getContentProvider(providerId) {
    return CONTENT_PROVIDERS.get(String(providerId || '').trim()) || null;
  }

  // Well-known screen ids: screens every scene creates itself under a stable
  // id ('default', 'guide'…). Subtypes reserve their id at SCRIPT LOAD — before
  // the scene initializes and before any collaboration snapshot can replay —
  // so the multi-screen manager never materializes a remote copy for them.
  const WELL_KNOWN_SCREEN_IDS = new Set(['default']);

  function reserveWellKnownScreenId(screenId) {
    const id = String(screenId || '').trim();
    if (!id) {
      return false;
    }
    WELL_KNOWN_SCREEN_IDS.add(id);
    return true;
  }

  function getWellKnownScreenIds() {
    return Array.from(WELL_KNOWN_SCREEN_IDS);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatVector(vector) {
    return `${vector.x} ${vector.y} ${vector.z}`;
  }

  function cloneVector(vector) {
    if (!vector || typeof vector !== 'object') {
      return null;
    }
    return {
      x: Number.isFinite(vector.x) ? vector.x : 0,
      y: Number.isFinite(vector.y) ? vector.y : 0,
      z: Number.isFinite(vector.z) ? vector.z : 0,
    };
  }

  function mergeConfig(userConfig) {
    const merged = { ...DEFAULT_CONFIG, ...(userConfig || {}) };
    merged.anchoredPosition = { ...DEFAULT_CONFIG.anchoredPosition, ...(userConfig?.anchoredPosition || {}) };
    merged.anchoredRotation = { ...DEFAULT_CONFIG.anchoredRotation, ...(userConfig?.anchoredRotation || {}) };
    merged.followOffset = { ...DEFAULT_CONFIG.followOffset, ...(userConfig?.followOffset || {}) };
    merged.followRotation = { ...DEFAULT_CONFIG.followRotation, ...(userConfig?.followRotation || {}) };
    merged.rtcConfiguration = { ...DEFAULT_CONFIG.rtcConfiguration, ...(userConfig?.rtcConfiguration || {}) };
    merged.labels = { ...DEFAULT_CONFIG.labels, ...(userConfig?.labels || {}) };
    merged.sizeSteps = Array.isArray(userConfig?.sizeSteps) && userConfig.sizeSteps.length > 0
      ? userConfig.sizeSteps.slice()
      : DEFAULT_CONFIG.sizeSteps.slice();
    merged.minWidth = userConfig?.minWidth || DEFAULT_CONFIG.minWidth;
    merged.maxWidth = userConfig?.maxWidth || DEFAULT_CONFIG.maxWidth;
    merged.broadcastEnabled = userConfig?.broadcastEnabled !== false;
    merged.collaborationEnabled = userConfig?.collaborationEnabled !== false;
    merged.presenceEnabled = userConfig?.presenceEnabled !== false;
    merged.cursorPresenceEnabled = userConfig?.cursorPresenceEnabled === true;
    merged.virtualScreenSupportsLocalCapture = userConfig?.virtualScreenSupportsLocalCapture !== false;
    merged.collisionEnabled = userConfig?.collisionEnabled !== false;
    merged.collisionMargin = Number(userConfig?.collisionMargin) > 0
      ? Number(userConfig.collisionMargin)
      : DEFAULT_CONFIG.collisionMargin;
    merged.collisionBounds = userConfig?.collisionBounds?.min && userConfig?.collisionBounds?.max
      ? userConfig.collisionBounds
      : null;
    merged.contentKind = userConfig?.contentKind === 'fixed' ? 'fixed' : 'broadcast';
    merged.contentProviderId = String(userConfig?.contentProviderId || '');
    merged.contentDesignWidth = Number(userConfig?.contentDesignWidth) || 0;
    return merged;
  }

  function isFixedContent(config) {
    return config?.contentKind === 'fixed';
  }

  function readConfigFromJsonScript(win) {
    const document = win?.document;
    if (!document) {
      return null;
    }
    const scriptEl = document.getElementById(CONFIG_SCRIPT_ID);
    if (!scriptEl || typeof scriptEl.textContent !== 'string') {
      return null;
    }
    try {
      return JSON.parse(scriptEl.textContent);
    } catch (error) {
      console.warn('VIRTUAL_SCREEN: Invalid JSON config script', error);
      return null;
    }
  }

  function createRuntime(win) {
    const state = {
      initialized: false,
      mode: 'idle',
      presentationMode: 'expanded',
      lookAtCameraEnabled: true,
      follow: false,
      followTransform: null,
      legendSide: 'right',
      chromeVisible: false,
      currentSourceLabel: '',
      statusMessage: DEFAULT_CONFIG.labels.idle,
      stream: null,
      streamSourceType: null,
      hasAudio: false,
      audioUnlockRequired: false,
      screenWidth: DEFAULT_CONFIG.sizeSteps[DEFAULT_CONFIG.defaultSizeIndex],
      sizeIndex: DEFAULT_CONFIG.defaultSizeIndex,
      lastIntent: 'screen',
      displayName: '',
      gestureOwnerPeerId: null,
      suppressSharedPublish: false,
      clientId: '',
      broadcastRole: 'none',
      broadcastStatus: 'idle',
      drag: null,
      dragLoopActive: false,
      followLoopActive: false,
      faceCameraLoopActive: false,
      legendCollapsed: false,
    };

    const refs = {
      config: mergeConfig(readConfigFromJsonScript(win) || win.__CODEXR_VIRTUAL_SCREEN_CONFIG__),
      scene: null,
      followAnchor: null,
      videoSource: null,
      remoteAudioSource: null,
      root: null,
      frame: null,
      display: null,
      interactionPlane: null,
      dragPlane: null,
      raycasterRefreshScheduled: false,
      // Collision caches: the room shell is static (cache once found); other
      // screens move, so their obstacle list is refreshed on a short interval.
      collisionBoundsCache: null,
      obstacleCache: null,
      obstacleCacheTime: 0,
      headerStrip: null,
      status: null,
      legendRoot: null,
      legendPanel: null,
      legendText: null,
      legendToggle: null,
      shareButton: null,
      audioUnlockButton: null,
      headerButtons: {},
      cornerHandles: {},
      edgeHandles: {},
      cleanupBound: false,
      inputHandlersBound: false,
      controllerTargets: [],
      chromeHideTimer: null,
      signalingSocket: null,
      signalingReconnectTimer: null,
      peerConnections: new Map(),
      remoteStream: null,
      activeBroadcasterId: '',
      broadcastState: {
        active: false,
        broadcasterPeerId: '',
        hasAudio: false,
        sourceKind: '',
      },
      broadcastRegistered: false,
      // Media relayed through the server, for viewers peer-to-peer cannot
      // reach (see relayTransport.js). sender: encoders + pumps; receiver:
      // decoders drawing into a canvas that feeds the usual video texture.
      relaySender: null,
      relayReceiver: null,
      remoteFrameWatchTimer: null,
      // Which socket the current viewer-join went out on: duplicates are only
      // suppressed for the same socket, so reconnects can rejoin.
      joinAttemptSocket: null,
      viewerJoinWatchdogTimer: null,
      destroyed: false,
      sharedTransformTimer: null,
      managerCallbacks: null,
      initialSharedStateDeferred: false,
      initialSharedStatePublished: false,
    };
