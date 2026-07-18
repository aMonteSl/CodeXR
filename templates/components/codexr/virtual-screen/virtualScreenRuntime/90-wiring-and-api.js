// == virtualScreenRuntime.js | part 90: wiring-and-api (assembled with its siblings; see COMPONENTS.md) ==
    function wireCleanupHandlers() {
      if (refs.cleanupBound || !win.addEventListener) {
        return;
      }
      refs.cleanupBound = true;
      win.addEventListener('mouseup', endDrag);
      win.addEventListener('blur', endDrag);
    }

    function wireDepthInputHandlers() {
      if (refs.inputHandlersBound || !win.addEventListener) {
        return;
      }
      refs.inputHandlersBound = true;
      win.addEventListener('wheel', handleWheelDuringDrag, { passive: false });
      const scene = getScene();
      if (scene) {
        scene.addEventListener('thumbstickmoved', handleThumbstickDuringDrag);
      }
      const controllerSelector = '#rightController, #leftController, [laser-controls], [tracked-controls], [oculus-touch-controls], [vive-controls], [windows-motion-controls], [generic-tracked-controller-controls]';
      refs.controllerTargets = Array.from(getDocument()?.querySelectorAll(controllerSelector) || []);
      refs.controllerTargets.forEach((controller) => {
        controller.addEventListener('thumbstickmoved', handleThumbstickDuringDrag);
      });
    }

    function wireControlHandlers() {
      refs.shareButton.addEventListener('click', function () {
        void startCapture('screen');
      });
      refs.audioUnlockButton.addEventListener('click', function () {
        if (!state.stream || state.streamSourceType !== 'remote') {
          return;
        }
        state.audioUnlockRequired = false;
        syncRemoteAudioPlayback(state.stream);
        showChrome();
      });
      refs.headerButtons.lookAt.addEventListener('click', function () {
        toggleLookAtCamera();
      });
      refs.headerButtons.follow.addEventListener('click', function () {
        toggleFollow();
      });
      refs.legendToggle.addEventListener('click', function () {
        toggleLegend();
      });
      refs.headerButtons.minimize.addEventListener('click', function () {
        if (isMinimized()) {
          expand();
        } else {
          minimize();
        }
      });
      refs.headerButtons.stop.addEventListener('click', function () {
        stopCapture('Sharing stopped.', { minimizeAfterStop: true });
        showChrome();
      });
    }

    function wireDragHandlers() {
      Object.entries(refs.cornerHandles).forEach(([key, handle]) => {
        handle.addEventListener('mousedown', function (evt) {
          startDrag('resize', key, evt);
        });
        handle.addEventListener('mouseup', endDrag);
      });
      Object.entries(refs.edgeHandles).forEach(([key, handle]) => {
        handle.addEventListener('mousedown', function (evt) {
          startDrag('move', key, evt);
        });
        handle.addEventListener('mouseup', endDrag);
      });
      const scene = getScene();
      if (scene) {
        scene.addEventListener('mouseup', endDrag);
      }
    }

    function finishInitialization() {
      ensureVideoSource();
      getOrCreateClientId();
      state.screenWidth = refs.config.sizeSteps[clamp(refs.config.defaultSizeIndex || DEFAULT_CONFIG.defaultSizeIndex, 0, refs.config.sizeSteps.length - 1)];
      state.sizeIndex = findClosestSizeIndex(state.screenWidth);
      state.displayName = refs.config.displayName || state.displayName;
      createUi();
      setAnchoredTransform();
      if (refs.config.placeInFrontOfUserOnInit === true) {
        placeInFrontOfUser({
          publishState: false,
          publishTransform: false,
          updateStatus: false,
          showChrome: false,
        });
      }
      if (state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
      }
      layout();
      setMode('idle', refs.config.labels.idle);
      if (state.lookAtCameraEnabled) {
        ensureFaceCameraLoop();
      }
      if (refs.config.broadcastEnabled && canUseBroadcastTransport()) {
        connectSignaling();
      }
      state.initialized = true;
      getCollaborationClient()?.registerEntityRuntime?.({
        entityKind: 'screen',
        entityId: getScreenId(),
        applySharedState: applySharedScreenState,
        publishInitialSharedState: publishInitialSharedState,
        handleCollaborationMessage: handleCollaborationMessage,
      });
    }

    function init(userConfig) {
      refs.config = mergeConfig(userConfig || readConfigFromJsonScript(win) || win.__CODEXR_VIRTUAL_SCREEN_CONFIG__);
      refs.initialSharedStateDeferred = refs.config.deferInitialSharedState === true;
      refs.initialSharedStatePublished = false;
      if (!refs.config.enabled) {
        return api;
      }
      const scene = getScene();
      if (!scene || state.initialized) {
        return api;
      }
      const start = function () {
        finishInitialization();
      };
      if (scene.hasLoaded) {
        start();
      } else {
        scene.addEventListener('loaded', start, { once: true });
      }
      return api;
    }

    function autoInit() {
      init(readConfigFromJsonScript(win) || win.__CODEXR_VIRTUAL_SCREEN_CONFIG__);
    }

    function restoreState(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        return api;
      }
      if (typeof snapshot.screenWidth === 'number') {
        setScreenWidth(snapshot.screenWidth, { silent: true });
      }
      if (snapshot.presentationMode === 'minimized') {
        state.presentationMode = 'minimized';
      } else if (snapshot.presentationMode === 'expanded') {
        state.presentationMode = 'expanded';
      }
      if (typeof snapshot.lookAtCameraEnabled === 'boolean') {
        state.lookAtCameraEnabled = snapshot.lookAtCameraEnabled;
      }
      if (typeof snapshot.displayName === 'string' && snapshot.displayName.trim().length > 0) {
        state.displayName = snapshot.displayName.trim();
      }
      layout();
      refreshUi();
      return api;
    }

    function destroy() {
      refs.destroyed = true;
      if (!isRemoteScreen() && refs.config.managedScreen) {
        const managerCallbacks = getManagerCallbacks();
        if (managerCallbacks?.onRemoveEntity) {
          managerCallbacks.onRemoveEntity(getScreenId(), { runtime: api });
        } else {
          getCollaborationClient()?.removeEntity?.('screen', getScreenId());
        }
      }
      stopCapture('Virtual screen closed.', { minimizeAfterStop: false });
      closeAllPeerConnections();
      closeSignalingSocket();
      getCollaborationClient()?.unregisterEntityRuntime?.('screen', getScreenId());
      if (refs.root?.parentElement) {
        refs.root.parentElement.removeChild(refs.root);
      }
      refs.root = null;
      const video = refs.videoSource || getDocument()?.getElementById(getVideoElementId()) || null;
      if (video?.parentElement) {
        video.parentElement.removeChild(video);
      }
      refs.videoSource = null;
      const audio = refs.remoteAudioSource || getDocument()?.getElementById(getScopedId('codexrVirtualScreenRemoteAudio')) || null;
      if (audio?.parentElement) {
        audio.parentElement.removeChild(audio);
      }
      refs.remoteAudioSource = null;
    }

    const api = {
      init,
      autoInit,
      buildCaptureOptions,
      requestCapture,
      classifyCaptureError,
      startCapture,
      stopCapture,
      switchSource,
      minimize,
      expand,
      toggleLookAtCamera,
      toggleFollow,
      recenter,
      adjustSize,
      setScreenWidth,
      setDisplayName,
      placeInFrontOfUser,
      publishInitialSharedState,
      flushInitialSharedState,
      applySharedScreenState,
      handleCollaborationMessage,
      getSharedScreenState: buildSharedScreenState,
      setManagerCallbacks(callbacks) {
        refs.managerCallbacks = callbacks || null;
        return api;
      },
      isRemoteScreen,
      restoreState,
      destroy,
      getState() {
        return {
          mode: state.mode,
          presentationMode: state.presentationMode,
          lookAtCameraEnabled: state.lookAtCameraEnabled,
          follow: state.follow,
          chromeVisible: state.chromeVisible,
          sizeIndex: state.sizeIndex,
          screenWidth: state.screenWidth,
          currentSourceLabel: state.currentSourceLabel,
          displayName: getDisplayName(),
          screenId: getScreenId(),
          managed: !!refs.config.managedScreen,
          collaborationSource: refs.config.collaborationSource || 'local',
          ownerPeerId: getOwnerPeerId() || null,
          broadcastRole: state.broadcastRole,
          broadcastStatus: state.broadcastStatus,
          hasAudio: state.hasAudio,
          audioUnlockRequired: state.audioUnlockRequired,
          gestureOwnerPeerId: state.gestureOwnerPeerId,
          activeBroadcasterId: refs.activeBroadcasterId || null,
          lastIntent: state.lastIntent,
          clientId: state.clientId,
          initialized: state.initialized,
          dragActive: !!state.drag,
            dragPointerType: state.drag?.pointerType || null,
            dragDepthOffset: state.drag?.currentDepthOffset || 0,
            dragTargetDepthOffset: state.drag?.targetDepthOffset || 0,
            legendCollapsed: state.legendCollapsed,
            legendSide: state.legendSide,
            followTrackingActive: state.follow && !!state.followTransform,
            faceCameraTrackingActive: !state.follow && !state.drag && state.faceCameraLoopActive,
            hasFollowTransform: !!state.followTransform,
          };
        },
    };

    api.DEFAULT_CONFIG = DEFAULT_CONFIG;
    api.mergeConfig = mergeConfig;
    api.createRuntime = createRuntime;
    api.getSharedRoomClient = function () {
      return getCollaborationClient();
    };
    return api;
  }

  const runtime = createRuntime(global);
  runtime.DEFAULT_CONFIG = DEFAULT_CONFIG;
  runtime.mergeConfig = mergeConfig;
  runtime.createRuntime = createRuntime;
  runtime.getSharedRoomClient = function () {
    return global.CodeXRCollaborationRuntime?.getClient?.(global) || null;
  };
  return runtime;
});





























