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

  root.CodeXRCollaborationRuntime = runtime;

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

  const CONFIG_SCRIPT_ID = 'codexr-tooling-config-collaboration';
  const DEFAULT_CONFIG = {
    enabled: true,
    collaborationEnabled: true,
    presenceEnabled: true,
    cursorPresenceEnabled: false,
    sceneSelector: 'a-scene',
    roomSignalingPath: '/codexr-room',
    sessionEndpoint: '/api/collaboration/session',
    reconnectDelayMs: 900,
    presenceIntervalMs: 100,
    positionDelta: 0.005,
    rotationDelta: 0.75,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readConfigFromJsonScript(win) {
    const document = win?.document;
    if (!document) {
      return null;
    }
    const configScript = document.getElementById(CONFIG_SCRIPT_ID);
    if (!configScript || typeof configScript.textContent !== 'string') {
      return null;
    }
    try {
      return JSON.parse(configScript.textContent);
    } catch (error) {
      console.warn('CODEXR_COLLAB: invalid JSON config script', error);
      return null;
    }
  }

  function mergeConfig(baseConfig, userConfig) {
    const virtualScreenConfig = userConfig?.virtualScreenConfig || userConfig?.screenConfig || null;
    const merged = { ...DEFAULT_CONFIG, ...(baseConfig || {}), ...(userConfig || {}) };
    if (virtualScreenConfig) {
      if (virtualScreenConfig.presenceEnabled === false) {
        merged.presenceEnabled = false;
      }
      if (virtualScreenConfig.cursorPresenceEnabled === true) {
        merged.cursorPresenceEnabled = true;
      }
    }
    merged.collaborationEnabled = merged.collaborationEnabled !== false;
    merged.presenceEnabled = merged.presenceEnabled !== false;
    merged.cursorPresenceEnabled = merged.cursorPresenceEnabled === true;
    return merged;
  }

  function hashString(input) {
    let hash = 0;
    const text = String(input || '');
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function getPeerStyle(peerId) {
    const colors = ['#38bdf8', '#f97316', '#22c55e', '#e879f9', '#facc15', '#fb7185'];
    const shapes = ['sphere', 'box', 'cylinder', 'octahedron'];
    const hash = hashString(peerId);
    return {
      color: colors[hash % colors.length],
      shape: shapes[hash % shapes.length],
    };
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

  function cloneTransform(transform) {
    if (!transform || typeof transform !== 'object') {
      return null;
    }
    return {
      position: cloneVector(transform.position),
      rotation: cloneVector(transform.rotation),
    };
  }

  function sanitizeId(value) {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function vectorToString(vector) {
    if (!vector) {
      return '0 0 0';
    }
    return `${vector.x} ${vector.y} ${vector.z}`;
  }

  function serializeEulerDegreesFromQuaternion(quaternion, THREE) {
    if (!quaternion || !THREE) {
      return null;
    }
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion, 'YXZ');
    return {
      x: euler.x * (180 / Math.PI),
      y: euler.y * (180 / Math.PI),
      z: euler.z * (180 / Math.PI),
    };
  }

  function createClient(win) {
    const shared = {
      config: mergeConfig(readConfigFromJsonScript(win) || win.__CODEXR_COLLABORATION_CONFIG__, {
        virtualScreenConfig: win.__CODEXR_VIRTUAL_SCREEN_CONFIG__ || null,
      }),
      socket: null,
      reconnectTimer: null,
      sessionInfo: null,
      sessionInfoPromise: null,
      peerId: '',
      roomId: '',
      joinedRoom: false,
      snapshotReady: false,
      revision: 0,
      roomEntities: new Map(),
      pendingEntities: new Map(),
      entityRuntimes: new Map(),
      manager: null,
      destroyed: false,
      presenceLoopActive: false,
      lastPresenceSentAt: 0,
      lastPresenceSignature: '',
      cursorTrackingAttached: false,
      localCursorState: null,
      remoteAvatars: new Map(),
      remoteCursors: new Map(),
      presenceRoot: null,
      cursorOverlayRoot: null,
    };

    function getDocument() {
      return win.document;
    }

    function getScene() {
      return getDocument()?.querySelector(shared.config.sceneSelector || 'a-scene') || null;
    }

    function getEntityKey(entityKind, entityId) {
      return `${String(entityKind || '').trim()}:${String(entityId || '').trim()}`;
    }

    function getResolvedConfig() {
      return shared.config;
    }

    function getSocketUrl(pathname) {
      const location = win.location;
      if (!location?.host) {
        return null;
      }
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const normalizedPath = pathname && pathname.startsWith('/') ? pathname : `/${pathname || 'codexr-room'}`;
      return `${protocol}//${location.host}${normalizedPath}`;
    }

    async function resolveSessionInfo() {
      if (shared.sessionInfo) {
        return shared.sessionInfo;
      }
      if (shared.sessionInfoPromise) {
        return shared.sessionInfoPromise;
      }

      const explicitRoomId = String(shared.config.roomId || '').trim();
      const fallback = {
        roomId: explicitRoomId || 'codexr-session:local',
        activeServerId: '',
        fileUri: null,
        capabilities: {
          collaboration: true,
          presence: shared.config.presenceEnabled !== false,
          media: true,
        },
        roomSocketPath: shared.config.roomSignalingPath || '/codexr-room',
        broadcastSocketPath: shared.config.broadcastSocketPath || '/codexr-broadcast',
      };

      if (!shared.config.collaborationEnabled || typeof win.fetch !== 'function') {
        shared.sessionInfo = fallback;
        return fallback;
      }

      const sessionEndpoint = shared.config.sessionEndpoint || '/api/collaboration/session';
      shared.sessionInfoPromise = win.fetch(sessionEndpoint, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      }).then(async function (response) {
        if (!response.ok) {
          throw new Error(`Collaboration session request failed with ${response.status}`);
        }
        const payload = await response.json();
        shared.sessionInfo = {
          ...fallback,
          ...(payload || {}),
        };
        return shared.sessionInfo;
      }).catch(function () {
        shared.sessionInfo = fallback;
        return shared.sessionInfo;
      }).finally(function () {
        shared.sessionInfoPromise = null;
      });

      return shared.sessionInfoPromise;
    }

    function send(message) {
      if (!shared.socket || shared.socket.readyState !== win.WebSocket.OPEN) {
        return false;
      }
      shared.socket.send(JSON.stringify(message));
      return true;
    }

    function scheduleReconnect() {
      if (shared.destroyed || shared.reconnectTimer || !shared.config.collaborationEnabled) {
        return;
      }
      shared.reconnectTimer = win.setTimeout(function () {
        shared.reconnectTimer = null;
        void ensureSocket();
      }, shared.config.reconnectDelayMs || DEFAULT_CONFIG.reconnectDelayMs);
    }

    async function ensureSocket() {
      if (shared.destroyed || !shared.config.collaborationEnabled || typeof win.WebSocket !== 'function') {
        return;
      }
      if (shared.socket && [win.WebSocket.OPEN, win.WebSocket.CONNECTING].includes(shared.socket.readyState)) {
        return;
      }

      const sessionInfo = await resolveSessionInfo();
      shared.roomId = String(sessionInfo.roomId || '').trim() || shared.roomId || 'codexr-session:local';
      const url = getSocketUrl(sessionInfo.roomSocketPath || shared.config.roomSignalingPath || '/codexr-room');
      if (!url) {
        return;
      }

      const socket = new win.WebSocket(url);
      shared.socket = socket;

      socket.onopen = function () {
        shared.joinedRoom = false;
        shared.snapshotReady = false;
        send({
          type: 'room-join',
          roomId: shared.roomId,
        });
      };

      socket.onmessage = function (event) {
        try {
          handleServerMessage(JSON.parse(event.data));
        } catch (_error) {
          // Ignore malformed collaboration payloads.
        }
      };

      socket.onclose = function () {
        shared.joinedRoom = false;
        shared.socket = null;
        scheduleReconnect();
      };

      socket.onerror = function () {
        if (shared.socket === socket) {
          shared.socket = null;
        }
      };
    }

    function normalizeSnapshotEntities(rawEntities) {
      if (!Array.isArray(rawEntities)) {
        return [];
      }
      return rawEntities.filter(function (entity) {
        return entity && typeof entity === 'object' && entity.entityKind && entity.entityId;
      });
    }

    function normalizeSnapshotPresence(rawPresence) {
      if (!Array.isArray(rawPresence)) {
        return [];
      }
      return rawPresence.filter(function (presenceState) {
        return presenceState && typeof presenceState === 'object' && presenceState.peerId;
      });
    }

    function handleSnapshotEntities(entities) {
      shared.roomEntities.clear();
      normalizeSnapshotEntities(entities).forEach(function (entity) {
        const key = getEntityKey(entity.entityKind, entity.entityId);
        shared.roomEntities.set(key, entity);
        applyEntityStateToRuntime(entity, {
          source: 'snapshot',
          type: 'room-snapshot',
        });
      });

      if (shared.manager && typeof shared.manager.applyCollaborationSnapshot === 'function') {
        shared.manager.applyCollaborationSnapshot(entities);
      }

      publishMissingInitialStates();
    }

    function handleSnapshotPresence(presenceStates) {
      clearRemotePresence();
      normalizeSnapshotPresence(presenceStates).forEach(function (presenceState) {
        if (!presenceState || presenceState.peerId === shared.peerId) {
          return;
        }
        applyPresenceState(presenceState);
      });
    }

    function handleServerMessage(message) {
      if (!message || typeof message !== 'object' || !message.type) {
        return;
      }
      if (typeof message.revision === 'number') {
        shared.revision = Math.max(shared.revision, message.revision);
      }

      switch (message.type) {
        case 'room-joined':
          shared.peerId = String(message.peerId || shared.peerId || '').trim();
          shared.roomId = String(message.roomId || shared.roomId || '').trim();
          shared.joinedRoom = true;
          ensurePresenceLoop();
          return;
        case 'room-snapshot':
          shared.snapshotReady = true;
          handleSnapshotEntities(message.payload?.entities || []);
          handleSnapshotPresence(message.payload?.presence || []);
          return;
        case 'entity-added':
        case 'entity-updated':
        case 'entity-transform':
        case 'entity-lock':
        case 'entity-unlock':
          handleEntityMessage(message);
          return;
        case 'entity-removed':
          handleEntityRemoved(message);
          return;
        case 'entity-lock-denied':
          handleEntityLockDenied(message);
          return;
        case 'presence-joined':
        case 'presence-updated':
          if (message.payload?.peerId && message.payload.peerId !== shared.peerId) {
            applyPresenceState(message.payload);
          }
          return;
        case 'presence-left':
          removeRemotePresence(message.payload?.peerId);
          return;
        default:
          return;
      }
    }

    function handleEntityMessage(message) {
      const entity = message.payload;
      if (!entity || !entity.entityKind || !entity.entityId) {
        return;
      }
      const key = getEntityKey(entity.entityKind, entity.entityId);
      shared.roomEntities.set(key, entity);
      applyEntityStateToRuntime(entity, {
        source: 'room',
        type: message.type,
        peerId: message.peerId || '',
      });
    }

    function handleEntityRemoved(message) {
      const entityKind = String(message.payload?.entityKind || '').trim();
      const entityId = String(message.payload?.entityId || '').trim();
      if (!entityKind || !entityId) {
        return;
      }
      const key = getEntityKey(entityKind, entityId);
      shared.roomEntities.delete(key);
      const runtime = shared.entityRuntimes.get(key);
      runtime?.handleCollaborationMessage?.(message);
      if (entityKind === 'screen') {
        shared.manager?.removeRemoteScreen?.(entityId);
      }
    }

    function handleEntityLockDenied(message) {
      const entityKind = String(message.payload?.entityKind || '').trim();
      const entityId = String(message.payload?.entityId || '').trim();
      if (!entityKind || !entityId) {
        return;
      }
      const key = getEntityKey(entityKind, entityId);
      const runtime = shared.entityRuntimes.get(key);
      runtime?.handleCollaborationMessage?.({
        ...message,
        type: 'entity-lock-denied',
      });
    }

    function applyEntityStateToRuntime(entity, meta) {
      const key = getEntityKey(entity.entityKind, entity.entityId);
      const runtime = shared.entityRuntimes.get(key);
      if (runtime && typeof runtime.applySharedState === 'function') {
        runtime.applySharedState(entity, meta || { source: 'room' });
        return;
      }

      shared.pendingEntities.set(key, entity);
      if (entity.entityKind === 'screen') {
        shared.manager?.ensureRemoteScreen?.(entity);
      }
    }

    function publishMissingInitialStates() {
      shared.entityRuntimes.forEach(function (runtime, key) {
        if (shared.roomEntities.has(key)) {
          return;
        }
        runtime.publishInitialSharedState?.();
      });
    }

    function connect(userConfig) {
      shared.config = mergeConfig(shared.config, userConfig || {});
      if (!shared.config.enabled || !shared.config.collaborationEnabled) {
        return client;
      }
      if (shared.config.cursorPresenceEnabled) {
        ensureCursorTracking();
      }
      void ensureSocket();
      ensurePresenceLoop();
      return client;
    }

    function getHeadEntity() {
      const document = getDocument();
      if (!document) {
        return null;
      }
      return document.querySelector('#head') || document.querySelector('[camera]') || null;
    }

    function getPoseFromEntity(entity) {
      if (!entity?.object3D || !global.THREE) {
        return null;
      }
      const position = new global.THREE.Vector3();
      const quaternion = new global.THREE.Quaternion();
      entity.object3D.getWorldPosition(position);
      entity.object3D.getWorldQuaternion(quaternion);
      return {
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        rotation: serializeEulerDegreesFromQuaternion(quaternion, global.THREE),
      };
    }

    function buildPresenceState() {
      const cursorState = shared.config.cursorPresenceEnabled ? shared.localCursorState : null;
      return {
        peerId: shared.peerId || '',
        head: getPoseFromEntity(getHeadEntity()),
        leftHand: getPoseFromEntity(getDocument()?.querySelector('#leftController')),
        rightHand: getPoseFromEntity(getDocument()?.querySelector('#rightController')),
        cursor: cursorState,
        viewport: shared.config.cursorPresenceEnabled
          ? {
              width: win.innerWidth || 0,
              height: win.innerHeight || 0,
            }
          : null,
        lastSeenAt: new Date().toISOString(),
      };
    }

    function getPresenceSignature(presenceState) {
      return JSON.stringify(presenceState);
    }

    function sendPresenceUpdate(force) {
      if (!shared.joinedRoom || !shared.config.presenceEnabled) {
        return;
      }
      const now = Date.now();
      if (!force && (now - shared.lastPresenceSentAt) < (shared.config.presenceIntervalMs || DEFAULT_CONFIG.presenceIntervalMs)) {
        return;
      }
      const presenceState = buildPresenceState();
      const signature = getPresenceSignature(presenceState);
      if (!force && signature === shared.lastPresenceSignature) {
        return;
      }
      shared.lastPresenceSentAt = now;
      shared.lastPresenceSignature = signature;
      send({
        type: 'presence-update',
        roomId: shared.roomId,
        payload: presenceState,
      });
    }

    function updatePresenceLoop() {
      if (!shared.config.presenceEnabled || shared.destroyed) {
        shared.presenceLoopActive = false;
        return;
      }
      sendPresenceUpdate(false);
      const nextFrame = win.requestAnimationFrame || function (cb) { return win.setTimeout(cb, 80); };
      nextFrame(updatePresenceLoop);
    }

    function ensurePresenceLoop() {
      if (shared.presenceLoopActive || !shared.config.presenceEnabled) {
        return;
      }
      shared.presenceLoopActive = true;
      updatePresenceLoop();
    }

    function ensureCursorOverlayRoot() {
      if (!shared.config.cursorPresenceEnabled || !getDocument()?.body) {
        return null;
      }
      if (shared.cursorOverlayRoot && shared.cursorOverlayRoot.isConnected) {
        return shared.cursorOverlayRoot;
      }
      const overlay = getDocument().createElement('div');
      overlay.id = 'codexrRemoteCursorOverlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483646';
      getDocument().body.appendChild(overlay);
      shared.cursorOverlayRoot = overlay;
      return overlay;
    }

    function ensurePresenceRoot() {
      const scene = getScene();
      if (!scene) {
        return null;
      }
      if (shared.presenceRoot && shared.presenceRoot.isConnected) {
        return shared.presenceRoot;
      }
      const rootEl = getDocument().createElement('a-entity');
      rootEl.setAttribute('id', 'codexrRemotePresenceRoot');
      scene.appendChild(rootEl);
      shared.presenceRoot = rootEl;
      return rootEl;
    }

    function ensureRemoteAvatar(peerId) {
      const existing = shared.remoteAvatars.get(peerId);
      if (existing) {
        return existing;
      }
      const presenceRoot = ensurePresenceRoot();
      if (!presenceRoot) {
        return null;
      }
      const style = getPeerStyle(peerId);
      const avatar = {
        style,
        head: getDocument().createElement('a-entity'),
        leftHand: getDocument().createElement('a-entity'),
        rightHand: getDocument().createElement('a-entity'),
        label: getDocument().createElement('a-text'),
      };
      avatar.head.setAttribute('geometry', `primitive: ${style.shape}; radius: 0.14; width: 0.2; height: 0.2; depth: 0.2;`);
      avatar.leftHand.setAttribute('geometry', 'primitive: sphere; radius: 0.06;');
      avatar.rightHand.setAttribute('geometry', 'primitive: sphere; radius: 0.06;');
      avatar.label.setAttribute('align', 'center');
      avatar.label.setAttribute('color', style.color);
      avatar.label.setAttribute('width', '2.6');
      avatar.label.setAttribute('value', peerId.slice(0, 6));

      [avatar.head, avatar.leftHand, avatar.rightHand].forEach(function (entity) {
        entity.setAttribute('material', `color: ${style.color}; opacity: 0.92; transparent: true; shader: flat;`);
        presenceRoot.appendChild(entity);
      });
      presenceRoot.appendChild(avatar.label);
      shared.remoteAvatars.set(peerId, avatar);
      return avatar;
    }

    function ensureRemoteCursor(peerId) {
      const existing = shared.remoteCursors.get(peerId);
      if (existing) {
        return existing;
      }
      const overlayRoot = ensureCursorOverlayRoot();
      if (!overlayRoot) {
        return null;
      }
      const style = getPeerStyle(peerId);
      const rootEl = getDocument().createElement('div');
      const dot = getDocument().createElement('div');
      const label = getDocument().createElement('div');

      rootEl.style.position = 'absolute';
      rootEl.style.transform = 'translate(-50%, -50%)';
      rootEl.style.display = 'none';

      dot.style.width = '14px';
      dot.style.height = '14px';
      dot.style.borderRadius = '999px';
      dot.style.background = style.color;
      dot.style.boxShadow = '0 0 0 2px rgba(15, 23, 42, 0.55)';

      label.style.marginTop = '4px';
      label.style.padding = '2px 6px';
      label.style.borderRadius = '999px';
      label.style.background = 'rgba(15, 23, 42, 0.86)';
      label.style.color = '#e2e8f0';
      label.style.font = '12px monospace';
      label.style.whiteSpace = 'nowrap';
      label.textContent = peerId.slice(0, 6);

      rootEl.appendChild(dot);
      rootEl.appendChild(label);
      overlayRoot.appendChild(rootEl);

      const cursor = { rootEl };
      shared.remoteCursors.set(peerId, cursor);
      return cursor;
    }

    function setPoseEntity(entity, pose, isVisible) {
      if (!entity) {
        return;
      }
      entity.setAttribute('visible', !!(isVisible && pose?.position));
      if (!pose?.position) {
        return;
      }
      entity.setAttribute('position', vectorToString(pose.position));
      if (pose.rotation) {
        entity.setAttribute('rotation', vectorToString(pose.rotation));
      }
    }

    function applyPresenceState(presenceState) {
      if (!presenceState || !presenceState.peerId) {
        return;
      }

      if (presenceState.head || presenceState.leftHand || presenceState.rightHand) {
        const avatar = ensureRemoteAvatar(presenceState.peerId);
        if (avatar) {
          setPoseEntity(avatar.head, presenceState.head, true);
          setPoseEntity(avatar.leftHand, presenceState.leftHand, true);
          setPoseEntity(avatar.rightHand, presenceState.rightHand, true);
          if (presenceState.head?.position) {
            avatar.label.setAttribute('visible', true);
            avatar.label.setAttribute('position', vectorToString({
              x: presenceState.head.position.x,
              y: presenceState.head.position.y + 0.28,
              z: presenceState.head.position.z,
            }));
          } else {
            avatar.label.setAttribute('visible', false);
          }
        }
      }

      if (shared.config.cursorPresenceEnabled && presenceState.cursor) {
        const cursor = ensureRemoteCursor(presenceState.peerId);
        if (cursor) {
          if (presenceState.cursor.visible === false) {
            cursor.rootEl.style.display = 'none';
          } else {
            cursor.rootEl.style.display = 'block';
            const x = clamp(Number(presenceState.cursor.x || 0), 0, 1) * (win.innerWidth || 0);
            const y = clamp(Number(presenceState.cursor.y || 0), 0, 1) * (win.innerHeight || 0);
            cursor.rootEl.style.left = `${x}px`;
            cursor.rootEl.style.top = `${y}px`;
          }
        }
      }
    }

    function removeRemotePresence(peerId) {
      const avatar = shared.remoteAvatars.get(peerId);
      if (avatar) {
        [avatar.head, avatar.leftHand, avatar.rightHand, avatar.label].forEach(function (entity) {
          entity.parentElement?.removeChild(entity);
        });
        shared.remoteAvatars.delete(peerId);
      }
      const cursor = shared.remoteCursors.get(peerId);
      if (cursor) {
        cursor.rootEl.parentElement?.removeChild(cursor.rootEl);
        shared.remoteCursors.delete(peerId);
      }
    }

    function clearRemotePresence() {
      Array.from(shared.remoteAvatars.keys()).forEach(removeRemotePresence);
      Array.from(shared.remoteCursors.keys()).forEach(removeRemotePresence);
    }

    function ensureCursorTracking() {
      if (shared.cursorTrackingAttached || !shared.config.cursorPresenceEnabled || !getDocument()) {
        return;
      }
      shared.cursorTrackingAttached = true;

      const updateCursor = function (clientX, clientY, visible) {
        const width = Math.max(1, win.innerWidth || 1);
        const height = Math.max(1, win.innerHeight || 1);
        shared.localCursorState = {
          x: clamp(clientX / width, 0, 1),
          y: clamp(clientY / height, 0, 1),
          visible: visible !== false,
        };
      };

      getDocument().addEventListener('mousemove', function (evt) {
        updateCursor(evt.clientX || 0, evt.clientY || 0, true);
      });
      getDocument().addEventListener('mouseleave', function () {
        if (shared.localCursorState) {
          shared.localCursorState.visible = false;
        }
      });
      win.addEventListener?.('blur', function () {
        if (shared.localCursorState) {
          shared.localCursorState.visible = false;
        }
      });
      updateCursor(0, 0, false);
    }

    function registerEntityRuntime(runtime) {
      if (!runtime || !runtime.entityKind || !runtime.entityId) {
        return null;
      }
      const key = getEntityKey(runtime.entityKind, runtime.entityId);
      shared.entityRuntimes.set(key, runtime);
      if (shared.pendingEntities.has(key)) {
        const pendingState = shared.pendingEntities.get(key);
        shared.pendingEntities.delete(key);
        runtime.applySharedState?.(pendingState, { source: 'pending-snapshot' });
      } else if (shared.snapshotReady && shared.roomEntities.has(key)) {
        runtime.applySharedState?.(shared.roomEntities.get(key), { source: 'room-entity' });
      } else if (shared.snapshotReady) {
        runtime.publishInitialSharedState?.();
      }
      return runtime;
    }

    function unregisterEntityRuntime(entityKind, entityId) {
      shared.entityRuntimes.delete(getEntityKey(entityKind, entityId));
    }

    function registerManager(manager) {
      shared.manager = manager || null;
      if (shared.snapshotReady && manager?.applyCollaborationSnapshot) {
        manager.applyCollaborationSnapshot(Array.from(shared.roomEntities.values()));
      }
    }

    function unregisterManager(manager) {
      if (shared.manager === manager) {
        shared.manager = null;
      }
    }

    function sendEntityState(entityState, eventType) {
      if (!entityState || !entityState.entityKind || !entityState.entityId) {
        return false;
      }
      return send({
        type: eventType || 'entity-updated',
        roomId: shared.roomId,
        payload: {
          ...entityState,
          transform: cloneTransform(entityState.transform),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    function sendEntityTransform(payload) {
      if (!payload || !payload.entityKind || !payload.entityId) {
        return false;
      }
      return send({
        type: 'entity-transform',
        roomId: shared.roomId,
        entityKind: payload.entityKind,
        entityId: payload.entityId,
        payload: {
          entityKind: payload.entityKind,
          entityId: payload.entityId,
          transform: cloneTransform(payload.transform),
        },
      });
    }

    function lockEntity(entityKind, entityId) {
      return send({
        type: 'entity-lock',
        roomId: shared.roomId,
        entityKind,
        entityId,
        payload: { entityKind, entityId },
      });
    }

    function unlockEntity(entityKind, entityId) {
      return send({
        type: 'entity-unlock',
        roomId: shared.roomId,
        entityKind,
        entityId,
        payload: { entityKind, entityId },
      });
    }

    function removeEntity(entityKind, entityId) {
      return send({
        type: 'entity-removed',
        roomId: shared.roomId,
        entityKind,
        entityId,
        payload: { entityKind, entityId },
      });
    }

    const client = {
      connect,
      registerEntityRuntime,
      unregisterEntityRuntime,
      registerManager,
      unregisterManager,
      sendEntityState,
      sendEntityTransform,
      lockEntity,
      unlockEntity,
      removeEntity,
      getPeerId() {
        return shared.peerId || '';
      },
      getRoomId() {
        return shared.roomId || '';
      },
      getSessionInfo() {
        return shared.sessionInfo;
      },
      getConfig() {
        return getResolvedConfig();
      },
      sendPresenceUpdate(force) {
        sendPresenceUpdate(force === true);
      },
    };

    return client;
  }

  function getClient(win) {
    if (win.__CODEXR_COLLABORATION_CLIENT__) {
      return win.__CODEXR_COLLABORATION_CLIENT__;
    }
    const client = createClient(win);
    win.__CODEXR_COLLABORATION_CLIENT__ = client;
    return client;
  }

  const runtime = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    mergeConfig: mergeConfig,
    createClient: createClient,
    getClient: function (win) {
      return getClient(win || global);
    },
    autoInit: function () {
      const client = getClient(global);
      client.connect(readConfigFromJsonScript(global) || global.__CODEXR_COLLABORATION_CONFIG__ || {});
      return client;
    },
  };

  return runtime;
});
