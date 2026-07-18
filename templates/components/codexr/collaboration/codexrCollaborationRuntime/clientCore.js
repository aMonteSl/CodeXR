// == codexrCollaborationRuntime.js | clientCore (assembled per manifest.json; see COMPONENTS.md) ==
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
