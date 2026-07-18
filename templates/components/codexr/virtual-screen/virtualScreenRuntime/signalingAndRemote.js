// == virtualScreenRuntime.js | signalingAndRemote (assembled per manifest.json; see COMPONENTS.md) ==
    function handleSignalMessage(message) {
      switch (message?.type) {
        case 'registered':
          refs.broadcastRegistered = true;
          state.clientId = message.clientId || state.clientId;
          if (state.streamSourceType === 'local') {
            announceBroadcastStart();
          } else if (refs.broadcastState.active) {
            ensureRemoteBroadcastSubscription(refs.broadcastState);
          }
          return;
        case 'broadcast-live':
          setBroadcastState('sender', 'live');
          setSharedBroadcastState({
            active: true,
            broadcasterPeerId: getCollaborationClient()?.getPeerId?.() || getOwnerPeerId(),
            hasAudio: state.hasAudio,
            sourceKind: state.lastIntent || 'screen',
          });
          updateStatus(refs.config.labels.broadcasting);
          publishSharedScreenState();
          return;
        case 'broadcast-available':
          if (state.streamSourceType === 'local') {
            return;
          }
          setSharedBroadcastState({
            active: true,
            broadcasterPeerId: refs.broadcastState?.broadcasterPeerId || '',
            hasAudio: message.hasAudio === true,
            sourceKind: refs.broadcastState?.sourceKind || 'screen',
          });
          void startViewerConnection(message.broadcasterId || '');
          return;
        case 'broadcast-stopped':
          if (state.streamSourceType === 'remote') {
            detachRemoteBroadcast(refs.config.labels.broadcastStopped, { notifyServer: false });
          } else if (state.streamSourceType === 'local') {
            setBroadcastState('sender', 'idle');
          }
          setSharedBroadcastState({
            active: false,
            broadcasterPeerId: '',
            hasAudio: false,
            sourceKind: refs.broadcastState?.sourceKind || '',
          });
          publishSharedScreenState();
          return;
        case 'broadcast-replaced':
          if (state.streamSourceType === 'local') {
            setBroadcastState('none', 'idle');
            updateStatus(refs.config.labels.broadcastStopped);
          }
          setSharedBroadcastState({
            active: false,
            broadcasterPeerId: '',
            hasAudio: false,
            sourceKind: refs.broadcastState?.sourceKind || '',
          });
          publishSharedScreenState();
          return;
        case 'viewer-join':
          void handleViewerJoin(message.viewerId || '');
          return;
        case 'signal-offer':
          void applyRemoteOffer(message.clientId || '', message.description);
          return;
        case 'signal-answer':
          void applyRemoteAnswer(message.clientId || '', message.description);
          return;
        case 'signal-ice':
          void applyRemoteIce(message.clientId || '', message.candidate);
          return;
        default:
          return;
      }
    }

    function connectSignaling() {
      if (refs.destroyed || !refs.config.broadcastEnabled || !canUseBroadcastTransport()) {
        return;
      }
      if (refs.signalingSocket && [win.WebSocket.OPEN, win.WebSocket.CONNECTING].includes(refs.signalingSocket.readyState)) {
        return;
      }

      const signalingUrl = buildSignalingUrl();
      if (!signalingUrl) {
        return;
      }

      const socket = new win.WebSocket(signalingUrl);
      refs.signalingSocket = socket;
      refs.broadcastRegistered = false;

      socket.onopen = function () {
        refs.broadcastRegistered = false;
        setBroadcastState(state.broadcastRole, state.streamSourceType === 'local' ? 'connecting' : state.broadcastStatus);
        sendSignaling({
          type: 'register',
          clientId: getOrCreateClientId(),
        });
      };

      socket.onmessage = function (event) {
        try {
          handleSignalMessage(JSON.parse(event.data));
        } catch (_error) {
          updateStatus(refs.config.labels.broadcastError);
        }
      };

      socket.onerror = function () {
        if (state.streamSourceType === 'local') {
          setBroadcastState('none', 'error');
          updateStatus(refs.config.labels.broadcastError);
        }
      };

      socket.onclose = function () {
        refs.broadcastRegistered = false;
        refs.signalingSocket = null;
        if (refs.destroyed) {
          return;
        }
        if (state.streamSourceType === 'local') {
          setBroadcastState('sender', 'connecting');
        }
        scheduleSignalingReconnect();
      };
    }

    function detachRemoteBroadcast(message, options) {
      const broadcasterId = refs.activeBroadcasterId;
      if (options?.notifyServer !== false && broadcasterId) {
        sendSignaling({
          type: 'viewer-leave',
          clientId: getOrCreateClientId(),
        });
      }

      refs.activeBroadcasterId = '';
      closeAllPeerConnections();
      refs.remoteStream = null;

      if (state.streamSourceType === 'remote') {
        releaseStream(false);
      }

      state.hasAudio = false;
      state.currentSourceLabel = '';

      if (!options?.preserveStatus) {
        setBroadcastState('none', 'idle');
        setMode('idle', message || refs.config.labels.noSignal);
      }

      if (options?.clearSharedBroadcast === true) {
        setSharedBroadcastState({
          active: false,
          broadcasterPeerId: '',
          hasAudio: false,
          sourceKind: refs.broadcastState?.sourceKind || '',
        });
      }

      if (options?.skipSharedPublish !== true) {
        publishSharedScreenState();
      }
    }

    function stopCapture(message, options) {
      if (state.streamSourceType === 'remote') {
        detachRemoteBroadcast(message || refs.config.labels.broadcastStopped, {
          notifyServer: true,
          skipSharedPublish: true,
        });
        if (options?.minimizeAfterStop === true) {
          state.presentationMode = 'minimized';
          layout();
          refreshUi();
        }
        return;
      }

      sendSignaling({
        type: 'broadcast-stop',
        clientId: getOrCreateClientId(),
        reason: message || refs.config.labels.broadcastStopped,
      });
      closeAllPeerConnections();
      const shouldMinimize = options?.minimizeAfterStop === true;
      releaseStream(true);
      state.hasAudio = false;
      state.currentSourceLabel = '';
      refs.activeBroadcasterId = '';
      setBroadcastState('none', 'idle');
      setSharedBroadcastState({
        active: false,
        broadcasterPeerId: '',
        hasAudio: false,
        sourceKind: refs.broadcastState?.sourceKind || '',
      });
      state.presentationMode = shouldMinimize ? 'minimized' : 'expanded';
      if (shouldMinimize) {
        setMode('idle', message || refs.config.labels.minimized);
      } else {
        setMode('idle', message || refs.config.labels.idle);
      }
      publishSharedScreenState();
    }

    function attachTrackEndedListener(stream) {
      const tracks = typeof stream?.getVideoTracks === 'function' ? stream.getVideoTracks() : [];
      const track = tracks[0];
      if (!track) {
        return;
      }
      track.addEventListener('ended', function () {
        stopCapture(refs.config.labels.sourceEnded, { minimizeAfterStop: false });
      }, { once: true });
    }

    async function startCapture(intent) {
      if (!refs.config.virtualScreenSupportsLocalCapture) {
        setMode('idle', 'Local screen capture is disabled for this scene.');
        return;
      }
      if (state.streamSourceType === 'remote') {
        detachRemoteBroadcast('', { notifyServer: true, preserveStatus: true });
      }
      const previousStream = state.stream;
      const previousLabel = state.currentSourceLabel;
      state.lastIntent = intent;
      showChrome();
      setMode('idle', SOURCE_MESSAGES[intent].pending);

      try {
        const stream = await requestCapture(intent);
        if (previousStream && previousStream !== stream) {
          releaseStream(true);
        }
        state.stream = stream;
        state.streamSourceType = 'local';
        state.hasAudio = typeof stream.getAudioTracks === 'function' && stream.getAudioTracks().length > 0;
        updateVideoSource(stream);
        attachTrackEndedListener(stream);
        state.currentSourceLabel = SOURCE_MESSAGES[intent].active;
        state.presentationMode = 'expanded';
        setMode('broadcasting', SOURCE_MESSAGES[intent].active);
        setSharedBroadcastState({
          active: true,
          broadcasterPeerId: getCollaborationClient()?.getPeerId?.() || getOwnerPeerId(),
          hasAudio: state.hasAudio,
          sourceKind: intent || 'screen',
        });
        if (canUseBroadcastTransport()) {
          setBroadcastState('sender', 'connecting');
          connectSignaling();
          announceBroadcastStart();
        } else if (refs.config.broadcastEnabled) {
          setBroadcastState('none', 'error');
          updateStatus(refs.config.labels.broadcastUnavailable);
        } else {
          setBroadcastState('none', 'idle');
        }
        publishSharedScreenState();
      } catch (error) {
        if (previousStream) {
          state.stream = previousStream;
          state.currentSourceLabel = previousLabel;
          setMode('broadcasting', previousLabel || refs.config.labels.idle);
          publishSharedScreenState();
          return;
        }
        state.currentSourceLabel = '';
        state.hasAudio = false;
        setSharedBroadcastState({
          active: false,
          broadcasterPeerId: '',
          hasAudio: false,
          sourceKind: intent || refs.broadcastState?.sourceKind || 'screen',
        });
        setMode('idle', classifyCaptureError(error));
        publishSharedScreenState();
      }
    }

    function switchSource() {
      void startCapture('screen');
    }