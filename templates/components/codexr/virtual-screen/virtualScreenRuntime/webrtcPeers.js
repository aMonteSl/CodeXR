// == virtualScreenRuntime.js | webrtcPeers (assembled per manifest.json; see COMPONENTS.md) ==
    /** How long a peer-to-peer viewer waits for real media before relaying. */
    const PEER_FIRST_FRAME_TIMEOUT_MS = 6000;
    /** How long a joining viewer waits for any answer before re-joining. */
    const VIEWER_JOIN_RETRY_MS = 5000;

    function classifyCaptureError(error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return refs.config.labels.permissionDenied;
      }
      if (name === 'AbortError') {
        return 'Screen sharing was cancelled.';
      }
      if (name === 'NotFoundError') {
        return 'No shareable screen, tab, or window is currently available.';
      }
      return error?.message || 'Unable to start screen sharing.';
    }

    function updateVideoSource(stream) {
      const video = ensureVideoSource();
      if (!video) {
        return;
      }
      video.muted = true;
      video.srcObject = stream;
      const playResult = video.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {});
      }
      syncRemoteAudioPlayback(stream);
    }

    function releaseStream(stopTracks) {
      if (!state.stream) {
        clearRemoteAudioPlayback();
        return;
      }
      if (stopTracks && state.streamSourceType === 'local' && typeof state.stream.getTracks === 'function') {
        state.stream.getTracks().forEach((track) => track.stop());
      }
      state.stream = null;
      state.streamSourceType = null;
      state.audioUnlockRequired = false;
      const video = ensureVideoSource();
      if (video) {
        video.srcObject = null;
      }
      clearRemoteAudioPlayback();
    }

    function closePeerConnection(peerId) {
      const connection = refs.peerConnections.get(peerId);
      if (!connection) {
        return;
      }
      try {
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.onconnectionstatechange = null;
        connection.oniceconnectionstatechange = null;
        connection.close();
      } catch (_error) {
        // Ignore peer teardown issues during cleanup.
      }
      refs.peerConnections.delete(peerId);
    }

    function closeAllPeerConnections() {
      Array.from(refs.peerConnections.keys()).forEach(closePeerConnection);
    }

    function closeSignalingSocket() {
      if (refs.signalingReconnectTimer) {
        clearTimeout(refs.signalingReconnectTimer);
        refs.signalingReconnectTimer = null;
      }
      if (!refs.signalingSocket) {
        return;
      }
      const socket = refs.signalingSocket;
      refs.signalingSocket = null;
      refs.broadcastRegistered = false;
      try {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
      } catch (_error) {
        // Ignore socket close errors on teardown.
      }
    }

    function sendSignaling(payload) {
      if (!refs.signalingSocket || refs.signalingSocket.readyState !== win.WebSocket.OPEN) {
        return false;
      }
      refs.signalingSocket.send(JSON.stringify({
        ...payload,
        roomId: payload?.roomId || getResolvedRoomId(),
        screenId: payload?.screenId || getScreenId(),
      }));
      return true;
    }

    function setBroadcastState(role, status) {
      state.broadcastRole = role;
      state.broadcastStatus = status;
      syncLocalBroadcastState();
    }

    function createPeerConnection(peerId, role) {
      const existing = refs.peerConnections.get(peerId);
      if (existing) {
        return existing;
      }

      const connection = new win.RTCPeerConnection(refs.config.rtcConfiguration || {});
      refs.peerConnections.set(peerId, connection);

      connection.onicecandidate = function (event) {
        if (!event.candidate) {
          return;
        }
        sendSignaling({
          type: 'signal-ice',
          clientId: getOrCreateClientId(),
          screenId: getScreenId(),
          targetId: peerId,
          candidate: event.candidate,
        });
      };

      if (role === 'viewer') {
        connection.ontrack = function (event) {
          const stream = event.streams?.[0];
          if (!stream) {
            return;
          }
          refs.remoteStream = stream;
          refs.activeBroadcasterId = peerId;
          releaseStream(false);
          state.stream = stream;
          state.streamSourceType = 'remote';
          state.hasAudio = typeof stream.getAudioTracks === 'function' && stream.getAudioTracks().length > 0;
          state.currentSourceLabel = refs.config.labels.receiving;
          state.presentationMode = 'expanded';
          updateVideoSource(stream);
          // ontrack only means the track object exists: media has not flowed
          // yet, and if ICE never connects it never will. Claiming 'live' here
          // is what used to leave viewers on a silent black screen.
          setBroadcastState('viewer', 'connecting');
          updateStatus(refs.config.labels.connecting);
          watchForFirstRemoteFrame();
        };
      }

      connection.onconnectionstatechange = function () {
        if (role === 'viewer' && ['failed', 'closed', 'disconnected'].includes(connection.connectionState || '')) {
          // Once the relay owns the session, a dying peer connection is just
          // the abandoned direct attempt — it must not tear the relay down.
          if (refs.relayReceiver) {
            return;
          }
          if (peerId === refs.activeBroadcasterId) {
            const message = connection.connectionState === 'failed'
              ? refs.config.labels.iceFailed
              : refs.config.labels.noSignal;
            detachRemoteBroadcast(message, { notifyServer: false, skipSharedPublish: true });
          }
        }
      };

      connection.oniceconnectionstatechange = function () {
        if (role === 'viewer' && ['failed', 'closed', 'disconnected'].includes(connection.iceConnectionState || '')) {
          if (refs.relayReceiver) {
            return;
          }
          if (peerId === refs.activeBroadcasterId) {
            const message = connection.iceConnectionState === 'failed'
              ? refs.config.labels.iceFailed
              : refs.config.labels.noSignal;
            detachRemoteBroadcast(message, { notifyServer: false, skipSharedPublish: true });
          }
        }
      };

      return connection;
    }

    /**
     * Wait for the first real frame of a peer-to-peer broadcast. If none
     * arrives — restrictive NAT, blocked UDP — ask the server to relay the
     * media instead, which is a path every viewer can reach.
     */
    function watchForFirstRemoteFrame() {
      const video = ensureVideoSource();
      if (!video || refs.remoteFrameWatchTimer) {
        return;
      }

      let settled = false;
      const settle = function (live) {
        if (settled) {
          return;
        }
        settled = true;
        if (refs.remoteFrameWatchTimer) {
          win.clearTimeout(refs.remoteFrameWatchTimer);
          refs.remoteFrameWatchTimer = null;
        }
        if (live) {
          markPeerBroadcastLive();
        } else if (
          state.streamSourceType === 'remote'
          && state.broadcastStatus !== 'live'
          && !refs.relayReceiver
        ) {
          requestRelayFallback();
        }
      };

      if (typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(function () {
          settle(true);
        });
      } else {
        video.addEventListener('playing', function onPlaying() {
          video.removeEventListener('playing', onPlaying);
          settle(true);
        });
      }

      refs.remoteFrameWatchTimer = win.setTimeout(function () {
        refs.remoteFrameWatchTimer = null;
        settle(video.currentTime > 0 && video.readyState >= 2);
      }, PEER_FIRST_FRAME_TIMEOUT_MS);
    }

    function markPeerBroadcastLive() {
      if (state.streamSourceType !== 'remote') {
        return;
      }
      setBroadcastState('viewer', 'live');
      setMode('viewing', refs.config.labels.receiving);
      showChrome();
    }

    function requestRelayFallback() {
      updateStatus(refs.config.labels.relayFallback);
      sendSignaling({
        type: 'relay-request',
        clientId: getOrCreateClientId(),
      });
    }

    function ensureRemoteBroadcastSubscription(sharedBroadcast) {
      if (state.streamSourceType === 'local' || sharedBroadcast?.active !== true) {
        return;
      }
      connectSignaling();
      if (!refs.signalingSocket || refs.signalingSocket.readyState !== win.WebSocket.OPEN || refs.broadcastRegistered !== true) {
        return;
      }
      if (state.streamSourceType === 'remote') {
        return;
      }
      if (
        state.broadcastRole === 'viewer'
        && state.broadcastStatus === 'connecting'
        && (!sharedBroadcast?.broadcasterPeerId || refs.activeBroadcasterId === sharedBroadcast.broadcasterPeerId)
      ) {
        return;
      }
      void startViewerConnection(sharedBroadcast?.broadcasterPeerId || '');
    }

    async function startViewerConnection(broadcasterId) {
      if (!canUseBroadcastTransport() || state.streamSourceType === 'local') {
        return;
      }
      if (state.broadcastRole === 'viewer' && state.broadcastStatus === 'connecting') {
        // Only suppress a duplicate join sent over THIS socket. After a
        // reconnect the server forgot us, so the rejoin must go out — the old
        // blanket guard left viewers stuck on "connecting" forever.
        if (
          refs.joinAttemptSocket === refs.signalingSocket
          && (!broadcasterId || refs.activeBroadcasterId === broadcasterId)
        ) {
          return;
        }
      }
      if (broadcasterId && refs.activeBroadcasterId === broadcasterId && state.broadcastStatus === 'live') {
        return;
      }

      detachRemoteBroadcast('', {
        notifyServer: false,
        preserveStatus: true,
        skipSharedPublish: true,
      });
      if (broadcasterId) {
        refs.activeBroadcasterId = broadcasterId;
      }
      setBroadcastState('viewer', 'connecting');
      updateStatus(refs.config.labels.connecting);
      if (sendSignaling({ type: 'viewer-join', clientId: getOrCreateClientId() })) {
        refs.joinAttemptSocket = refs.signalingSocket;
      }
      scheduleViewerJoinWatchdog();
    }

    /**
     * A viewer stuck on "connecting" with neither an offer nor a relay-ready
     * re-sends its join on a bounded interval. The server parks early joins,
     * so a duplicate join is idempotent — it just refreshes the offer.
     */
    function scheduleViewerJoinWatchdog() {
      if (refs.viewerJoinWatchdogTimer) {
        win.clearTimeout(refs.viewerJoinWatchdogTimer);
      }
      refs.viewerJoinWatchdogTimer = win.setTimeout(function () {
        refs.viewerJoinWatchdogTimer = null;
        if (
          refs.destroyed
          || refs.relayReceiver
          || state.broadcastRole !== 'viewer'
          || state.broadcastStatus !== 'connecting'
        ) {
          return;
        }
        refs.joinAttemptSocket = null;
        void startViewerConnection(refs.activeBroadcasterId || '');
      }, VIEWER_JOIN_RETRY_MS);
    }

    async function handleViewerJoin(viewerId) {
      if (!viewerId || state.streamSourceType !== 'local' || !state.stream) {
        return;
      }

      closePeerConnection(viewerId);
      const connection = createPeerConnection(viewerId, 'sender');
      if (typeof state.stream.getTracks === 'function') {
        state.stream.getTracks().forEach((track) => {
          connection.addTrack(track, state.stream);
        });
      }

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      sendSignaling({
        type: 'signal-offer',
        clientId: getOrCreateClientId(),
        targetId: viewerId,
        description: connection.localDescription,
      });
    }

    function asRtcDescription(description) {
      if (!description) {
        return null;
      }
      return typeof win.RTCSessionDescription === 'function'
        ? new win.RTCSessionDescription(description)
        : description;
    }

    function asIceCandidate(candidate) {
      if (!candidate) {
        return null;
      }
      return typeof win.RTCIceCandidate === 'function'
        ? new win.RTCIceCandidate(candidate)
        : candidate;
    }

    async function applyRemoteOffer(broadcasterId, description) {
      if (!broadcasterId || !description) {
        return;
      }
      const connection = createPeerConnection(broadcasterId, 'viewer');
      refs.activeBroadcasterId = broadcasterId;
      await connection.setRemoteDescription(asRtcDescription(description));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendSignaling({
        type: 'signal-answer',
        clientId: getOrCreateClientId(),
        targetId: broadcasterId,
        description: connection.localDescription,
      });
    }

    async function applyRemoteAnswer(viewerId, description) {
      const connection = refs.peerConnections.get(viewerId);
      if (!connection || !description) {
        return;
      }
      await connection.setRemoteDescription(asRtcDescription(description));
    }

    async function applyRemoteIce(peerId, candidate) {
      const connection = refs.peerConnections.get(peerId);
      if (!connection || !candidate) {
        return;
      }
      await connection.addIceCandidate(asIceCandidate(candidate));
    }

    function announceBroadcastStart() {
      if (!canUseBroadcastTransport() || state.streamSourceType !== 'local' || !state.stream) {
        return;
      }
      sendSignaling({
        type: 'broadcast-start',
        clientId: getOrCreateClientId(),
        hasAudio: state.hasAudio,
      });
    }

    function scheduleSignalingReconnect() {
      if (refs.signalingReconnectTimer || refs.destroyed || !refs.config.broadcastEnabled || !canUseBroadcastTransport()) {
        return;
      }
      refs.signalingReconnectTimer = setTimeout(function () {
        refs.signalingReconnectTimer = null;
        connectSignaling();
      }, 1400);
    }
