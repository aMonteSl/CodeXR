(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : window;
  const runtime = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = runtime;
  }
  root.CodeXRCollaborationRuntime = runtime;
  if (root.document) {
    const start = function () { runtime.autoInit(); };
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
})(function (global) {
  'use strict';

  const CONFIG_SCRIPT_ID = 'codexr-tooling-config-collaboration';
  const STATE_CHANGED_EVENT = 'codexr-collaboration-state-changed';
  const DEFAULT_PROFILE = {
    identityMode: 'anonymous',
    customName: '',
    avatarId: 'avatar-1',
  };
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
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readConfigFromJsonScript(win) {
    const configScript = win.document?.getElementById(CONFIG_SCRIPT_ID);
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
      if (virtualScreenConfig.followAnchorSelector) {
        merged.followAnchorSelector = virtualScreenConfig.followAnchorSelector;
      }
    }
    merged.collaborationEnabled = merged.collaborationEnabled !== false;
    merged.presenceEnabled = merged.presenceEnabled !== false;
    merged.cursorPresenceEnabled = merged.cursorPresenceEnabled === true;
    return merged;
  }

  function sanitizeDisplayName(value) {
    const sanitized = String(value || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const length = Array.from(sanitized).length;
    return length >= 2 && length <= 32 ? sanitized : '';
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

  function getPresenceLabel(presenceState) {
    return String(presenceState?.displayName || presenceState?.peerId || '').trim().slice(0, 32);
  }

  function serializeEulerDegreesFromQuaternion(quaternion, THREE) {
    if (!quaternion || !THREE) {
      return null;
    }
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    return {
      x: THREE.MathUtils.radToDeg(euler.x),
      y: THREE.MathUtils.radToDeg(euler.y),
      z: THREE.MathUtils.radToDeg(euler.z),
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
      connectionStatus: 'disconnected',
      error: null,
      kicked: false,
      profile: { ...DEFAULT_PROFILE },
      participants: new Map(),
      remotePresence: new Map(),
      presenterPeerId: null,
      roomEntities: new Map(),
      pendingEntities: new Map(),
      entityRuntimes: new Map(),
      messageListeners: new Map(),
      manager: null,
      destroyed: false,
      presenceLoopActive: false,
      lastPresenceSentAt: 0,
      lastPresenceSignature: '',
      cursorTrackingAttached: false,
      localCursorState: null,
      remoteAvatars: new Map(),
      remoteCursors: new Map(),
      remoteRays: new Map(),
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

    function getPublicState() {
      const localParticipant = shared.participants.get(shared.peerId) || null;
      return {
        connectionStatus: shared.connectionStatus,
        error: shared.error,
        peerId: shared.peerId,
        roomId: shared.roomId,
        localParticipant: localParticipant ? { ...localParticipant } : null,
        participants: Array.from(shared.participants.values()).map(function (participant) {
          return { ...participant };
        }),
        presenterPeerId: shared.presenterPeerId,
        profile: { ...shared.profile },
        kicked: shared.kicked,
      };
    }

    function emitStateChanged() {
      getDocument()?.dispatchEvent(new win.CustomEvent(STATE_CHANGED_EVENT, {
        detail: getPublicState(),
      }));
    }

    function setConnectionStatus(status) {
      shared.connectionStatus = status;
      emitStateChanged();
    }

    function setError(error) {
      shared.error = error || null;
      emitStateChanged();
    }

    function getSocketUrl(pathname) {
      const location = win.location;
      if (!location?.host) {
        return null;
      }
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const normalizedPath = pathname?.startsWith('/') ? pathname : `/${pathname || 'codexr-room'}`;
      return `${protocol}//${location.host}${normalizedPath}`;
    }

    async function resolveSessionInfo() {
      if (shared.sessionInfo) {
        return shared.sessionInfo;
      }
      if (shared.sessionInfoPromise) {
        return shared.sessionInfoPromise;
      }

      const fallback = {
        roomId: String(shared.config.roomId || '').trim() || 'codexr-session:local',
        roomSocketPath: shared.config.roomSignalingPath || '/codexr-room',
        broadcastSocketPath: shared.config.broadcastSocketPath || '/codexr-broadcast',
      };
      if (!shared.config.collaborationEnabled || typeof win.fetch !== 'function') {
        shared.sessionInfo = fallback;
        return fallback;
      }

      shared.sessionInfoPromise = win.fetch(shared.config.sessionEndpoint || '/api/collaboration/session', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      }).then(async function (response) {
        if (!response.ok) {
          throw new Error(`Collaboration session request failed with ${response.status}`);
        }
        shared.sessionInfo = { ...fallback, ...(await response.json()) };
        applyExtensionConfiguration(shared.sessionInfo);
        return shared.sessionInfo;
      }).catch(function () {
        shared.sessionInfo = fallback;
        return fallback;
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

    function applyExtensionConfiguration(configuration) {
      const profile = configuration?.profile || configuration?.collaborationProfile;
      if (profile && typeof profile === 'object') {
        const customName = sanitizeDisplayName(profile.customName);
        shared.profile = {
          identityMode: profile.identityMode === 'custom' && customName ? 'custom' : 'anonymous',
          customName,
          avatarId: /^avatar-[1-6]$/.test(profile.avatarId) ? profile.avatarId : DEFAULT_PROFILE.avatarId,
        };
      }
      global.CodeXRAvatarRuntime?.configureAsset?.({
        available: configuration?.avatarModelAvailable === true,
        modelUrl: '/api/collaboration/avatar-model',
      });
    }

    function scheduleReconnect() {
      if (shared.destroyed || shared.kicked || shared.reconnectTimer || !shared.config.collaborationEnabled) {
        return;
      }
      shared.reconnectTimer = win.setTimeout(function () {
        shared.reconnectTimer = null;
        void ensureSocket();
      }, shared.config.reconnectDelayMs || DEFAULT_CONFIG.reconnectDelayMs);
    }

    async function ensureSocket() {
      if (
        shared.destroyed
        || shared.kicked
        || !shared.config.collaborationEnabled
        || typeof win.WebSocket !== 'function'
      ) {
        return;
      }
      if (shared.socket && [win.WebSocket.OPEN, win.WebSocket.CONNECTING].includes(shared.socket.readyState)) {
        return;
      }

      const sessionInfo = await resolveSessionInfo();
      shared.roomId = String(sessionInfo.roomId || '').trim() || shared.roomId || 'codexr-session:local';
      const url = getSocketUrl(sessionInfo.roomSocketPath || shared.config.roomSignalingPath);
      if (!url) {
        return;
      }

      setConnectionStatus('connecting');
      const socket = new win.WebSocket(url);
      shared.socket = socket;
      socket.onopen = function () {
        shared.joinedRoom = false;
        shared.snapshotReady = false;
        setError(null);
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
        if (shared.socket === socket) {
          shared.socket = null;
        }
        setConnectionStatus(shared.kicked ? 'removed' : 'disconnected');
        scheduleReconnect();
      };
      socket.onerror = function () {
        if (shared.socket === socket) {
          shared.socket = null;
        }
        setError({ code: 'connection-error', message: 'Could not connect to the collaboration room.' });
      };
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
          shared.peerId = String(message.peerId || '').trim();
          shared.roomId = String(message.roomId || shared.roomId).trim();
          shared.joinedRoom = true;
          if (message.payload?.participant) {
            upsertParticipant(message.payload.participant);
          }
          setConnectionStatus('connected');
          ensurePresenceLoop();
          return;
        case 'room-snapshot':
          shared.snapshotReady = true;
          handleSnapshotEntities(message.payload?.entities || []);
          replaceParticipants(message.payload?.participants || []);
          shared.presenterPeerId = message.payload?.presenterPeerId || null;
          handleSnapshotPresence(message.payload?.presence || []);
          emitStateChanged();
          return;
        case 'participant-updated':
        case 'role-updated':
          upsertParticipant(message.payload);
          return;
        case 'participant-kick':
          shared.kicked = true;
          shared.socket?.close();
          setError({ code: 'removed', message: 'The room host removed this connection.' });
          return;
        case 'presenter-started':
          upsertParticipant(message.payload);
          shared.presenterPeerId = message.payload?.peerId || null;
          emitStateChanged();
          return;
        case 'presenter-stopped':
          upsertParticipant(message.payload);
          if (shared.presenterPeerId === message.payload?.peerId) {
            shared.presenterPeerId = null;
          }
          emitStateChanged();
          return;
        case 'error':
          setError(message.payload || { code: 'server-error', message: 'Collaboration operation failed.' });
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
          removeParticipant(message.payload?.peerId);
          removeRemotePresence(message.payload?.peerId);
          return;
        default:
          emitMessage(message.type, message);
          return;
      }
    }

    function emitMessage(type, message) {
      const listeners = shared.messageListeners.get(String(type || ''));
      if (!listeners) {
        return;
      }
      listeners.forEach(function (listener) {
        try {
          listener(message);
        } catch (error) {
          console.error('[CodeXR][Collaboration] Message listener failed:', error);
        }
      });
    }

    function replaceParticipants(participants) {
      shared.participants.clear();
      (Array.isArray(participants) ? participants : []).forEach(upsertParticipant);
    }

    function upsertParticipant(participant) {
      if (!participant?.peerId) {
        return;
      }
      shared.participants.set(participant.peerId, { ...participant });
      if (participant.peerId === shared.peerId) {
        shared.profile.avatarId = participant.avatarId || shared.profile.avatarId;
        if (participant.identityMode === 'custom') {
          shared.profile.identityMode = 'custom';
          shared.profile.customName = participant.displayName || shared.profile.customName;
        } else {
          shared.profile.identityMode = 'anonymous';
        }
      }
      const remotePresence = shared.remotePresence.get(participant.peerId);
      if (remotePresence) {
        applyPresenceState({ ...remotePresence, ...participant });
      }
      emitStateChanged();
    }

    function removeParticipant(peerId) {
      if (!peerId) {
        return;
      }
      shared.participants.delete(peerId);
      shared.remotePresence.delete(peerId);
      if (shared.presenterPeerId === peerId) {
        shared.presenterPeerId = null;
      }
      emitStateChanged();
    }

    function handleSnapshotEntities(entities) {
      shared.roomEntities.clear();
      (Array.isArray(entities) ? entities : []).forEach(function (entity) {
        if (!entity?.entityKind || !entity?.entityId) {
          return;
        }
        shared.roomEntities.set(getEntityKey(entity.entityKind, entity.entityId), entity);
        applyEntityStateToRuntime(entity, { source: 'snapshot', type: 'room-snapshot' });
      });
      shared.manager?.applyCollaborationSnapshot?.(entities);
      publishMissingInitialStates();
    }

    function handleSnapshotPresence(presenceStates) {
      clearRemotePresence();
      (Array.isArray(presenceStates) ? presenceStates : []).forEach(function (presenceState) {
        if (presenceState?.peerId && presenceState.peerId !== shared.peerId) {
          applyPresenceState(presenceState);
        }
      });
    }

    function handleEntityMessage(message) {
      const entity = message.payload;
      if (!entity?.entityKind || !entity?.entityId) {
        return;
      }
      shared.roomEntities.set(getEntityKey(entity.entityKind, entity.entityId), entity);
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
      shared.entityRuntimes.get(key)?.handleCollaborationMessage?.(message);
      if (entityKind === 'screen') {
        shared.manager?.removeRemoteScreen?.(entityId);
      }
    }

    function handleEntityLockDenied(message) {
      const key = getEntityKey(message.payload?.entityKind, message.payload?.entityId);
      shared.entityRuntimes.get(key)?.handleCollaborationMessage?.({
        ...message,
        type: 'entity-lock-denied',
      });
    }

    function applyEntityStateToRuntime(entity, meta) {
      const key = getEntityKey(entity.entityKind, entity.entityId);
      const runtime = shared.entityRuntimes.get(key);
      if (runtime?.applySharedState) {
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
        if (!shared.roomEntities.has(key)) {
          runtime.publishInitialSharedState?.();
        }
      });
    }

    function getHeadEntity() {
      return getDocument()?.querySelector('#head') || getDocument()?.querySelector('[camera]') || null;
    }

    function getBodyEntity() {
      return getDocument()?.querySelector('#rig')
        || getDocument()?.querySelector('#cameraRig')
        || getHeadEntity();
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
        position: { x: position.x, y: position.y, z: position.z },
        rotation: serializeEulerDegreesFromQuaternion(quaternion, global.THREE),
      };
    }

    function getTrackedControllerPose(selector) {
      const scene = getScene();
      const controller = getDocument()?.querySelector(selector);
      const trackedControls = controller?.components?.['tracked-controls'];
      const controllerPresent = trackedControls?.controllerPresent === true
        || !!trackedControls?.controller;
      if (!scene?.is?.('vr-mode') || !controllerPresent) {
        return null;
      }
      return getPoseFromEntity(controller);
    }

    function getControllerRay() {
      const controller = getDocument()?.querySelector('#rightController');
      const trackedControls = controller?.components?.['tracked-controls'];
      const controllerPresent = trackedControls?.controllerPresent === true
        || !!trackedControls?.controller;
      if (!controller?.object3D || !global.THREE || !getScene()?.is?.('vr-mode') || !controllerPresent) {
        return null;
      }
      const origin = controller.object3D.getWorldPosition(new global.THREE.Vector3());
      const direction = new global.THREE.Vector3(0, 0, -1)
        .applyQuaternion(controller.object3D.getWorldQuaternion(new global.THREE.Quaternion()))
        .normalize();
      return {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
        length: 8,
        visible: true,
      };
    }

    function getDesktopRay() {
      if (!shared.localCursorState?.visible || !getScene()?.camera || !global.THREE) {
        return null;
      }
      const camera = getScene().camera;
      const origin = camera.getWorldPosition(new global.THREE.Vector3());
      const point = new global.THREE.Vector3(
        (shared.localCursorState.x * 2) - 1,
        -(shared.localCursorState.y * 2) + 1,
        0.5,
      ).unproject(camera);
      const direction = point.sub(origin).normalize();
      return {
        origin: { x: origin.x, y: origin.y, z: origin.z },
        direction: { x: direction.x, y: direction.y, z: direction.z },
        length: 8,
        visible: true,
      };
    }

    function buildPresenceState() {
      const participant = shared.participants.get(shared.peerId) || {};
      return {
        peerId: shared.peerId || '',
        displayName: participant.displayName || '',
        identityMode: participant.identityMode || shared.profile.identityMode,
        avatarId: participant.avatarId || shared.profile.avatarId,
        role: participant.role || 'guest',
        isPresenter: participant.isPresenter === true,
        head: getPoseFromEntity(getHeadEntity()),
        body: getPoseFromEntity(getBodyEntity()),
        leftHand: getTrackedControllerPose('#leftController'),
        rightHand: getTrackedControllerPose('#rightController'),
        ray: getControllerRay() || getDesktopRay(),
        cursor: shared.config.cursorPresenceEnabled ? shared.localCursorState : null,
        viewport: shared.config.cursorPresenceEnabled
          ? { width: win.innerWidth || 0, height: win.innerHeight || 0 }
          : null,
        lastSeenAt: new Date().toISOString(),
      };
    }

    function sendPresenceUpdate(force) {
      if (!shared.joinedRoom || !shared.config.presenceEnabled) {
        return;
      }
      const now = Date.now();
      if (!force && now - shared.lastPresenceSentAt < shared.config.presenceIntervalMs) {
        return;
      }
      const presenceState = buildPresenceState();
      const signature = JSON.stringify(presenceState);
      if (!force && signature === shared.lastPresenceSignature) {
        return;
      }
      shared.lastPresenceSentAt = now;
      shared.lastPresenceSignature = signature;
      send({ type: 'presence-update', roomId: shared.roomId, payload: presenceState });
    }

    function updatePresenceLoop() {
      if (!shared.config.presenceEnabled || shared.destroyed) {
        shared.presenceLoopActive = false;
        return;
      }
      sendPresenceUpdate(false);
      (win.requestAnimationFrame || function (callback) { return win.setTimeout(callback, 80); })(updatePresenceLoop);
    }

    function ensurePresenceLoop() {
      if (!shared.presenceLoopActive && shared.config.presenceEnabled) {
        shared.presenceLoopActive = true;
        updatePresenceLoop();
      }
    }

    function ensurePresenceRoot() {
      const scene = getScene();
      if (!scene) {
        return null;
      }
      if (shared.presenceRoot?.isConnected) {
        return shared.presenceRoot;
      }
      shared.presenceRoot = getDocument().createElement('a-entity');
      shared.presenceRoot.id = 'codexrRemotePresenceRoot';
      scene.appendChild(shared.presenceRoot);
      return shared.presenceRoot;
    }

    function ensureRemoteAvatar(peerId) {
      if (shared.remoteAvatars.has(peerId)) {
        return shared.remoteAvatars.get(peerId);
      }
      const root = ensurePresenceRoot();
      if (!root) {
        return null;
      }
      const participant = shared.participants.get(peerId) || {};
      const avatar = getDocument().createElement('a-entity');
      avatar.id = `codexr-avatar-${String(peerId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      avatar.setAttribute('codexr-avatar', {
        peerId,
        displayName: participant.displayName || peerId.slice(0, 6),
        avatarId: participant.avatarId || 'avatar-1',
      });
      root.appendChild(avatar);
      shared.remoteAvatars.set(peerId, avatar);
      return avatar;
    }

    function ensureRemoteRay(peerId) {
      if (shared.remoteRays.has(peerId)) {
        return shared.remoteRays.get(peerId);
      }
      const root = ensurePresenceRoot();
      if (!root) {
        return null;
      }
      const ray = getDocument().createElement('a-entity');
      ray.setAttribute('visible', false);
      root.appendChild(ray);
      shared.remoteRays.set(peerId, ray);
      return ray;
    }

    function applyRayState(peerId, rayState) {
      const ray = ensureRemoteRay(peerId);
      if (!ray || !rayState?.visible || !rayState.origin || !rayState.direction) {
        ray?.setAttribute('visible', false);
        return;
      }
      const length = clamp(Number(rayState.length || 8), 0.2, 20);
      const end = {
        x: rayState.origin.x + (rayState.direction.x * length),
        y: rayState.origin.y + (rayState.direction.y * length),
        z: rayState.origin.z + (rayState.direction.z * length),
      };
      const color = global.CodeXRAvatarRuntime?.getSkin(
        shared.participants.get(peerId)?.avatarId,
      )?.color || '#38bdf8';
      ray.setAttribute('line', `start: ${rayState.origin.x} ${rayState.origin.y} ${rayState.origin.z}; end: ${end.x} ${end.y} ${end.z}; color: ${color}; opacity: 0.72`);
      ray.setAttribute('visible', true);
    }

    function ensureCursorOverlayRoot() {
      if (!shared.config.cursorPresenceEnabled || !getDocument()?.body) {
        return null;
      }
      if (shared.cursorOverlayRoot?.isConnected) {
        return shared.cursorOverlayRoot;
      }
      const overlay = getDocument().createElement('div');
      overlay.id = 'codexrRemoteCursorOverlay';
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '2147483646',
      });
      getDocument().body.appendChild(overlay);
      shared.cursorOverlayRoot = overlay;
      return overlay;
    }

    function ensureRemoteCursor(peerId) {
      if (shared.remoteCursors.has(peerId)) {
        return shared.remoteCursors.get(peerId);
      }
      const overlay = ensureCursorOverlayRoot();
      if (!overlay) {
        return null;
      }
      const rootEl = getDocument().createElement('div');
      const dot = getDocument().createElement('div');
      const label = getDocument().createElement('div');
      Object.assign(rootEl.style, {
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        display: 'none',
      });
      Object.assign(dot.style, {
        width: '14px',
        height: '14px',
        borderRadius: '999px',
        background: '#38bdf8',
        boxShadow: '0 0 0 2px rgba(15, 23, 42, 0.55)',
      });
      Object.assign(label.style, {
        marginTop: '4px',
        padding: '2px 6px',
        borderRadius: '999px',
        background: 'rgba(15, 23, 42, 0.86)',
        color: '#e2e8f0',
        font: '12px monospace',
        whiteSpace: 'nowrap',
      });
      rootEl.appendChild(dot);
      rootEl.appendChild(label);
      overlay.appendChild(rootEl);
      const cursor = { rootEl, labelEl: label };
      shared.remoteCursors.set(peerId, cursor);
      return cursor;
    }

    function applyPresenceState(presenceState) {
      if (!presenceState?.peerId) {
        return;
      }
      const participant = shared.participants.get(presenceState.peerId);
      const merged = { ...presenceState, ...(participant || {}) };
      shared.remotePresence.set(presenceState.peerId, merged);
      const avatar = ensureRemoteAvatar(presenceState.peerId);
      const avatarComponent = avatar?.components?.['codexr-avatar'];
      if (avatarComponent?.setPresenceState) {
        avatarComponent.setPresenceState(merged);
      } else {
        avatar?.addEventListener('componentinitialized', function onInitialized(event) {
          if (event.detail?.name !== 'codexr-avatar') {
            return;
          }
          avatar.removeEventListener('componentinitialized', onInitialized);
          avatar.components?.['codexr-avatar']?.setPresenceState?.(merged);
        });
      }
      applyRayState(presenceState.peerId, merged.ray);

      if (shared.config.cursorPresenceEnabled && merged.cursor) {
        const cursor = ensureRemoteCursor(presenceState.peerId);
        if (cursor) {
          cursor.labelEl.textContent = getPresenceLabel(merged);
          cursor.rootEl.style.display = merged.cursor.visible === false ? 'none' : 'block';
          cursor.rootEl.style.left = `${clamp(Number(merged.cursor.x || 0), 0, 1) * (win.innerWidth || 0)}px`;
          cursor.rootEl.style.top = `${clamp(Number(merged.cursor.y || 0), 0, 1) * (win.innerHeight || 0)}px`;
        }
      }
    }

    function removeRemotePresence(peerId) {
      shared.remotePresence.delete(peerId);
      [shared.remoteAvatars, shared.remoteRays].forEach(function (map) {
        const element = map.get(peerId);
        element?.parentElement?.removeChild(element);
        map.delete(peerId);
      });
      const cursor = shared.remoteCursors.get(peerId);
      cursor?.rootEl?.parentElement?.removeChild(cursor.rootEl);
      shared.remoteCursors.delete(peerId);
    }

    function clearRemotePresence() {
      Array.from(new Set([
        ...shared.remoteAvatars.keys(),
        ...shared.remoteCursors.keys(),
        ...shared.remoteRays.keys(),
      ])).forEach(removeRemotePresence);
    }

    function ensureCursorTracking() {
      if (shared.cursorTrackingAttached || !getDocument()) {
        return;
      }
      shared.cursorTrackingAttached = true;
      const updateCursor = function (clientX, clientY, visible) {
        shared.localCursorState = {
          x: clamp(clientX / Math.max(1, win.innerWidth || 1), 0, 1),
          y: clamp(clientY / Math.max(1, win.innerHeight || 1), 0, 1),
          visible: visible !== false,
        };
      };
      getDocument().addEventListener('mousemove', function (event) {
        updateCursor(event.clientX || 0, event.clientY || 0, true);
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

    function connect(userConfig) {
      shared.config = mergeConfig(shared.config, userConfig || {});
      if (!shared.config.enabled || !shared.config.collaborationEnabled) {
        return client;
      }
      if (getDocument()) {
        ensureCursorTracking();
        ensurePresenceLoop();
      }
      void ensureSocket();
      return client;
    }

    function registerEntityRuntime(runtime) {
      if (!runtime?.entityKind || !runtime?.entityId) {
        return null;
      }
      const key = getEntityKey(runtime.entityKind, runtime.entityId);
      shared.entityRuntimes.set(key, runtime);
      if (shared.pendingEntities.has(key)) {
        const state = shared.pendingEntities.get(key);
        shared.pendingEntities.delete(key);
        runtime.applySharedState?.(state, { source: 'pending-snapshot' });
      } else if (shared.snapshotReady && shared.roomEntities.has(key)) {
        runtime.applySharedState?.(shared.roomEntities.get(key), { source: 'room-entity' });
      } else if (shared.snapshotReady) {
        runtime.publishInitialSharedState?.();
      }
      return runtime;
    }

    function sendEntityState(entityState, eventType) {
      if (!entityState?.entityKind || !entityState?.entityId) {
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

    const client = {
      connect,
      getState: getPublicState,
      getParticipants() {
        return getPublicState().participants;
      },
      getParticipant(peerId) {
        const participant = shared.participants.get(peerId);
        return participant ? { ...participant } : null;
      },
      transferHost(peerId) {
        return send({ type: 'host-transfer', roomId: shared.roomId, payload: { peerId } });
      },
      kickParticipant(peerId) {
        return send({ type: 'participant-kick', roomId: shared.roomId, payload: { peerId } });
      },
      startPresentation() {
        return send({ type: 'presenter-started', roomId: shared.roomId });
      },
      stopPresentation(peerId) {
        return send({
          type: 'presenter-stopped',
          roomId: shared.roomId,
          payload: peerId ? { peerId } : {},
        });
      },
      registerEntityRuntime,
      unregisterEntityRuntime(entityKind, entityId) {
        shared.entityRuntimes.delete(getEntityKey(entityKind, entityId));
      },
      registerManager(manager) {
        shared.manager = manager || null;
        if (shared.snapshotReady) {
          manager?.applyCollaborationSnapshot?.(Array.from(shared.roomEntities.values()));
        }
      },
      unregisterManager(manager) {
        if (shared.manager === manager) {
          shared.manager = null;
        }
      },
      sendEntityState,
      sendMessage(type, payload) {
        if (!type) {
          return false;
        }
        return send({
          type: String(type),
          roomId: shared.roomId,
          payload: payload || {},
        });
      },
      onMessage(type, listener) {
        const messageType = String(type || '');
        if (!messageType || typeof listener !== 'function') {
          return function () {};
        }
        if (!shared.messageListeners.has(messageType)) {
          shared.messageListeners.set(messageType, new Set());
        }
        shared.messageListeners.get(messageType).add(listener);
        return function () {
          const listeners = shared.messageListeners.get(messageType);
          listeners?.delete(listener);
          if (listeners && listeners.size === 0) {
            shared.messageListeners.delete(messageType);
          }
        };
      },
      sendEntityTransform(payload) {
        if (!payload?.entityKind || !payload?.entityId) {
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
      },
      lockEntity(entityKind, entityId) {
        return send({
          type: 'entity-lock',
          roomId: shared.roomId,
          entityKind,
          entityId,
          payload: { entityKind, entityId },
        });
      },
      unlockEntity(entityKind, entityId) {
        return send({
          type: 'entity-unlock',
          roomId: shared.roomId,
          entityKind,
          entityId,
          payload: { entityKind, entityId },
        });
      },
      removeEntity(entityKind, entityId) {
        return send({
          type: 'entity-removed',
          roomId: shared.roomId,
          entityKind,
          entityId,
          payload: { entityKind, entityId },
        });
      },
      getPeerId() {
        return shared.peerId || '';
      },
      getRoomId() {
        return shared.roomId || '';
      },
      getSessionInfo() {
        return shared.sessionInfo;
      },
      getSessionInfoAsync() {
        return resolveSessionInfo();
      },
      getConfig() {
        return shared.config;
      },
      sendPresenceUpdate(force) {
        sendPresenceUpdate(force === true);
      },
      destroy() {
        shared.destroyed = true;
        shared.socket?.close();
        clearRemotePresence();
        shared.messageListeners.clear();
      },
    };

    return client;
  }

  function getClient(win) {
    if (!win.__CODEXR_COLLABORATION_CLIENT__) {
      win.__CODEXR_COLLABORATION_CLIENT__ = createClient(win);
    }
    return win.__CODEXR_COLLABORATION_CLIENT__;
  }

  return {
    DEFAULT_CONFIG,
    DEFAULT_PROFILE,
    STATE_CHANGED_EVENT,
    mergeConfig,
    sanitizeDisplayName,
    createClient,
    getClient: function (win) {
      return getClient(win || global);
    },
    autoInit: function () {
      const client = getClient(global);
      client.connect(readConfigFromJsonScript(global) || global.__CODEXR_COLLABORATION_CONFIG__ || {});
      return client;
    },
  };
});
