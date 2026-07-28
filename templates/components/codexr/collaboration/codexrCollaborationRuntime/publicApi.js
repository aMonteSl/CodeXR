// == codexrCollaborationRuntime.js | publicApi (assembled per manifest.json; see COMPONENTS.md) ==
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
      isOfflineExport() {
        return Boolean(shared.offlineExport);
      },
      getOfflineExportManifest() {
        return shared.offlineExport || null;
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
