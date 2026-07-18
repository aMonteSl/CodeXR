// == virtualScreenRuntime.js | part 40: shared-state (assembled with its siblings; see COMPONENTS.md) ==
    function setSharedBroadcastState(snapshot) {
      refs.broadcastState = normalizeBroadcastState(snapshot);
      return refs.broadcastState;
    }

    function syncLocalBroadcastState() {
      if (state.streamSourceType === 'local') {
        setSharedBroadcastState({
          active: state.broadcastStatus === 'connecting' || state.broadcastStatus === 'live',
          broadcasterPeerId: getCollaborationClient()?.getPeerId?.() || getOwnerPeerId(),
          hasAudio: state.hasAudio,
          sourceKind: state.lastIntent || 'screen',
        });
        return refs.broadcastState;
      }
      if (state.streamSourceType !== 'remote' && state.broadcastRole !== 'viewer') {
        setSharedBroadcastState({
          active: false,
          broadcasterPeerId: '',
          hasAudio: false,
          sourceKind: refs.broadcastState?.sourceKind || '',
        });
      }
      return refs.broadcastState;
    }

    function getManagerCallbacks() {
      return refs.managerCallbacks || null;
    }

    function setMode(mode, message) {
      state.mode = mode;
      if (typeof message === 'string' && message.length > 0) {
        state.statusMessage = message;
      }
      if (mode === 'idle') {
        state.chromeVisible = false;
      }
      layout();
      refreshUi();
    }

    function getTransformSnapshot() {
      if (!refs.root) {
        return null;
      }
      return {
        position: cloneVector(refs.root.getAttribute('position')),
        rotation: cloneVector(refs.root.getAttribute('rotation')),
      };
    }

    function getSerializableFollowTransform() {
      if (!state.followTransform?.position) {
        return null;
      }
      return {
        position: {
          x: state.followTransform.position.x,
          y: state.followTransform.position.y,
          z: state.followTransform.position.z,
        },
        distance: typeof state.followTransform.distance === 'number' ? state.followTransform.distance : null,
      };
    }

    function buildSharedScreenState() {
      const broadcast = syncLocalBroadcastState();
      return {
        entityKind: 'screen',
        entityId: getScreenId(),
        screenId: getScreenId(),
        ownerPeerId: getOwnerPeerId() || null,
        managed: !!refs.config.managedScreen,
        displayName: getDisplayName(),
        presentationMode: state.presentationMode,
        lookAtCameraEnabled: state.lookAtCameraEnabled,
        follow: state.follow,
        followTransform: getSerializableFollowTransform(),
        screenWidth: state.screenWidth,
        broadcastStatus: state.broadcastStatus,
        hasAudio: state.hasAudio,
        gestureOwnerPeerId: state.gestureOwnerPeerId,
        collaborationSource: refs.config.collaborationSource || 'local',
        broadcast,
        transform: getTransformSnapshot(),
      };
    }

    function publishSharedScreenState(eventType) {
      if (state.suppressSharedPublish || refs.config.collaborationEnabled === false) {
        return false;
      }
      const sharedState = buildSharedScreenState();
      const managerCallbacks = getManagerCallbacks();
      if (managerCallbacks?.onStateChange) {
        return managerCallbacks.onStateChange(sharedState, {
          eventType: eventType || 'entity-updated',
        }) !== false;
      }
      const client = getCollaborationClient();
      if (!client || typeof client.sendEntityState !== 'function') {
        return false;
      }
      return client.sendEntityState(sharedState, eventType || 'entity-updated');
    }

    function publishSharedTransform(forceImmediate) {
      if (state.suppressSharedPublish || refs.config.collaborationEnabled === false) {
        return false;
      }
      const managerCallbacks = getManagerCallbacks();
      const transform = getTransformSnapshot();
      if (!transform) {
        return false;
      }
      const sendThroughManager = function () {
        refs.sharedTransformTimer = null;
        return managerCallbacks.onTransformChange(transform, {
          forceImmediate: forceImmediate === true,
        }) !== false;
      };
      if (managerCallbacks?.onTransformChange) {
        if (forceImmediate === true) {
          if (refs.sharedTransformTimer) {
            clearTimeout(refs.sharedTransformTimer);
            refs.sharedTransformTimer = null;
          }
          return sendThroughManager();
        }
        if (refs.sharedTransformTimer) {
          return true;
        }
        refs.sharedTransformTimer = setTimeout(sendThroughManager, 60);
        return true;
      }
      const client = getCollaborationClient();
      if (!client || typeof client.sendEntityTransform !== 'function') {
        return false;
      }

      const sendNow = function () {
        refs.sharedTransformTimer = null;
        client.sendEntityTransform({
          entityKind: 'screen',
          entityId: getScreenId(),
          transform,
        });
      };

      if (forceImmediate === true) {
        if (refs.sharedTransformTimer) {
          clearTimeout(refs.sharedTransformTimer);
          refs.sharedTransformTimer = null;
        }
        sendNow();
        return true;
      }

      if (refs.sharedTransformTimer) {
        return true;
      }

      refs.sharedTransformTimer = setTimeout(sendNow, 60);
      return true;
    }

    function applySharedScreenState(snapshot, meta) {
      if (!snapshot || typeof snapshot !== 'object') {
        return false;
      }

      state.suppressSharedPublish = true;
      try {
        if (typeof snapshot.displayName === 'string' && snapshot.displayName.trim().length > 0) {
          state.displayName = snapshot.displayName.trim();
        }
        if (typeof snapshot.lookAtCameraEnabled === 'boolean') {
          state.lookAtCameraEnabled = snapshot.lookAtCameraEnabled;
        }
        if (snapshot.presentationMode === 'minimized' || snapshot.presentationMode === 'expanded') {
          state.presentationMode = snapshot.presentationMode;
        }
        if (typeof snapshot.screenWidth === 'number') {
          setScreenWidth(snapshot.screenWidth, { silent: true });
        }
        if (typeof snapshot.follow === 'boolean') {
          state.follow = snapshot.follow;
        }
        if (snapshot.followTransform?.position && global.THREE) {
          state.followTransform = {
            position: new global.THREE.Vector3(
              Number(snapshot.followTransform.position.x) || 0,
              Number(snapshot.followTransform.position.y) || 0,
              Number(snapshot.followTransform.position.z) || 0,
            ),
            distance: Number(snapshot.followTransform.distance) || 0,
          };
        } else if (!snapshot.follow) {
          state.followTransform = null;
        }
        if (snapshot.transform?.position) {
          refs.root?.setAttribute('position', formatVector(snapshot.transform.position));
        }
        if (snapshot.transform?.rotation) {
          refs.root?.setAttribute('rotation', formatVector(snapshot.transform.rotation));
        }
        if (typeof snapshot.ownerPeerId === 'string' && snapshot.ownerPeerId.trim().length > 0) {
          refs.config.ownerPeerId = snapshot.ownerPeerId.trim();
        }
        state.gestureOwnerPeerId = snapshot.gestureOwnerPeerId || null;
        if (typeof snapshot.broadcastStatus === 'string' && state.streamSourceType !== 'local') {
          state.broadcastStatus = snapshot.broadcastStatus;
        }
        state.hasAudio = snapshot.hasAudio === true;
        const sharedBroadcast = normalizeBroadcastState(snapshot.broadcast);
        setSharedBroadcastState(sharedBroadcast);
        if (state.streamSourceType !== 'local') {
          if (sharedBroadcast.active) {
            setBroadcastState('viewer', state.streamSourceType === 'remote' ? 'live' : 'connecting');
          } else if (state.streamSourceType !== 'remote') {
            setBroadcastState('none', 'idle');
          }
        }
        layout();
        refreshUi();
        if (meta?.type === 'entity-lock-denied') {
          updateStatus(refs.config.labels.collaborationLocked);
        }
        if (state.streamSourceType !== 'local') {
          if (sharedBroadcast.active) {
            ensureRemoteBroadcastSubscription(sharedBroadcast);
          } else if (state.streamSourceType === 'remote') {
            detachRemoteBroadcast(refs.config.labels.broadcastStopped, {
              notifyServer: false,
              preserveStatus: false,
            });
          }
        }
        return true;
      } finally {
        state.suppressSharedPublish = false;
      }
    }

    function publishInitialSharedState() {
      if (isRemoteScreen()) {
        return false;
      }
      if (refs.initialSharedStatePublished) {
        return true;
      }
      if (refs.initialSharedStateDeferred) {
        return false;
      }
      const published = publishSharedScreenState('entity-added');
      if (published) {
        refs.initialSharedStatePublished = true;
      }
      return published;
    }

    function flushInitialSharedState() {
      refs.initialSharedStateDeferred = false;
      return publishInitialSharedState();
    }

    function handleCollaborationMessage(message) {
      if (!message?.type) {
        return;
      }
      if (message.type === 'entity-lock-denied') {
        state.gestureOwnerPeerId = message.payload?.gestureOwnerPeerId || null;
        if (state.drag) {
          endDrag();
        }
        updateStatus(refs.config.labels.collaborationLocked);
        refreshUi();
        return;
      }
      if (message.payload?.entityKind === 'screen' && message.payload?.entityId === getScreenId()) {
        state.gestureOwnerPeerId = message.payload?.gestureOwnerPeerId || null;
        refreshUi();
      }
    }

    function buildCaptureOptions(intent) {
      const options = {
        video: {
          cursor: 'always',
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
        systemAudio: 'include',
        windowAudio: 'system',
        surfaceSwitching: 'include',
        selfBrowserSurface: 'exclude',
      };
      options.monitorTypeSurfaces = intent === 'screen' ? 'include' : 'exclude';
      return options;
    }

    async function requestCapture(intent) {
      if (!win.navigator?.mediaDevices?.getDisplayMedia) {
        throw new Error(refs.config.labels.unavailable);
      }
      return win.navigator.mediaDevices.getDisplayMedia(buildCaptureOptions(intent));
    }
