// == virtualScreenRuntime.js | part 20: sources-and-chrome (assembled with its siblings; see COMPONENTS.md) ==
    function getDocument() {
      return win.document;
    }

    function getScopedId(baseId) {
      const instanceId = String(refs.config.instanceId || '').trim();
      return instanceId ? `${baseId}-${instanceId}` : baseId;
    }

    function getVideoElementId() {
      const configured = String(refs.config.videoElementId || '').trim();
      return configured || getScopedId('codexrVirtualScreenVideo');
    }

    function getScreenId() {
      const configured = String(refs.config.screenId || refs.config.instanceId || '').trim();
      return configured || 'default';
    }

    function getDisplayName() {
      return String(state.displayName || refs.config.displayName || getScreenId()).trim();
    }

    function getOwnerPeerId() {
      const configured = String(refs.config.ownerPeerId || '').trim();
      if (configured) {
        return configured;
      }
      return getCollaborationClient()?.getPeerId?.() || '';
    }

    function getResolvedRoomId() {
      const configured = String(refs.config.roomId || '').trim();
      if (configured) {
        return configured;
      }
      return getCollaborationClient()?.getRoomId?.() || '';
    }

    function isRemoteScreen() {
      return refs.config.collaborationSource === 'remote';
    }

    function getCollaborationClient() {
      const collaborationRuntime = global.CodeXRCollaborationRuntime;
      if (!collaborationRuntime || typeof collaborationRuntime.getClient !== 'function') {
        return null;
      }
      const client = collaborationRuntime.getClient(win);
      if (!client || typeof client.connect !== 'function') {
        return null;
      }
      client.connect({
        collaborationEnabled: refs.config.collaborationEnabled !== false,
        presenceEnabled: refs.config.presenceEnabled !== false,
        cursorPresenceEnabled: refs.config.cursorPresenceEnabled === true,
        roomId: refs.config.roomId || '',
        roomSignalingPath: refs.config.roomSignalingPath || '/codexr-room',
        sessionEndpoint: refs.config.sessionEndpoint || '/api/collaboration/session',
        virtualScreenConfig: refs.config,
        sceneSelector: refs.config.sceneSelector || 'a-scene',
      });
      return client;
    }

    function getOrCreateClientId() {
      if (state.clientId) {
        return state.clientId;
      }
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        state.clientId = global.crypto.randomUUID();
      } else {
        state.clientId = `client-${Math.random().toString(36).slice(2, 10)}`;
      }
      return state.clientId;
    }

    function isMinimized() {
      return state.presentationMode === 'minimized';
    }

    function hasDisplayedStream() {
      return state.mode === 'broadcasting' || state.mode === 'viewing';
    }

    function isSecureBroadcastContext() {
      if (win.isSecureContext) {
        return true;
      }
      const hostname = String(win.location?.hostname || '').toLowerCase();
      return hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '[::1]';
    }

    function canUseBroadcastTransport() {
      return !!(
        refs.config.broadcastEnabled
        && typeof win.WebSocket === 'function'
        && typeof win.RTCPeerConnection === 'function'
        && isSecureBroadcastContext()
      );
    }

    function buildSignalingUrl() {
      const location = win.location;
      if (!location?.host) {
        return null;
      }
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const path = refs.config.signalingPath || DEFAULT_CONFIG.signalingPath;
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      return `${protocol}//${location.host}${normalizedPath}`;
    }

    function getScene() {
      if (refs.scene && refs.scene.isConnected) {
        return refs.scene;
      }
      refs.scene = getDocument()?.querySelector(refs.config.sceneSelector) || null;
      return refs.scene;
    }

    function getFollowAnchor() {
      if (refs.followAnchor && refs.followAnchor.isConnected) {
        return refs.followAnchor;
      }
      refs.followAnchor = getDocument()?.querySelector(refs.config.followAnchorSelector) || getScene();
      return refs.followAnchor;
    }

    function getCameraWorldQuaternion() {
      if (!global.THREE) {
        return null;
      }
      const scene = getScene();
      if (scene?.camera?.getWorldQuaternion) {
        const quaternion = new global.THREE.Quaternion();
        scene.camera.getWorldQuaternion(quaternion);
        return quaternion;
      }
      const cameraEntity = getDocument()?.querySelector('a-camera, [camera]');
      return getWorldQuaternion(cameraEntity) || getWorldQuaternion(getFollowAnchor());
    }

    function ensureVideoSource() {
      if (refs.videoSource && refs.videoSource.isConnected) {
        return refs.videoSource;
      }
      const document = getDocument();
      if (!document) {
        return null;
      }
      const videoElementId = getVideoElementId();
      let video = document.getElementById(videoElementId);
      if (!video) {
        video = document.createElement('video');
        video.id = videoElementId;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        video.style.display = 'none';
        document.body.appendChild(video);
      }
      refs.videoSource = video;
      return video;
    }

    function ensureRemoteAudioSource() {
      if (refs.remoteAudioSource && refs.remoteAudioSource.isConnected) {
        return refs.remoteAudioSource;
      }
      const document = getDocument();
      if (!document) {
        return null;
      }
      const audioElementId = getScopedId('codexrVirtualScreenRemoteAudio');
      let audio = document.getElementById(audioElementId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = audioElementId;
        audio.autoplay = true;
        audio.muted = false;
        audio.playsInline = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }
      refs.remoteAudioSource = audio;
      return audio;
    }

    function clearRemoteAudioPlayback() {
      state.audioUnlockRequired = false;
      const audio = refs.remoteAudioSource || getDocument()?.getElementById(getScopedId('codexrVirtualScreenRemoteAudio')) || null;
      if (!audio) {
        refreshUi();
        return;
      }
      try {
        audio.pause();
      } catch (_error) {
        // Ignore audio pause issues during cleanup.
      }
      audio.srcObject = null;
      refreshUi();
    }

    function syncRemoteAudioPlayback(stream) {
      const hasRemoteAudio = state.streamSourceType === 'remote'
        && state.hasAudio
        && typeof stream?.getAudioTracks === 'function'
        && stream.getAudioTracks().length > 0;

      if (!hasRemoteAudio) {
        clearRemoteAudioPlayback();
        return;
      }

      const audio = ensureRemoteAudioSource();
      if (!audio) {
        return;
      }

      audio.muted = false;
      audio.srcObject = stream;
      const playResult = audio.play();
      if (playResult && typeof playResult.then === 'function') {
        playResult.then(() => {
          state.audioUnlockRequired = false;
          refreshUi();
        }).catch(() => {
          state.audioUnlockRequired = true;
          refreshUi();
        });
      } else {
        state.audioUnlockRequired = false;
        refreshUi();
      }
    }

    function createEntity(tagName, attributes) {
      const entity = getDocument().createElement(tagName);
      Object.entries(attributes || {}).forEach(([key, value]) => entity.setAttribute(key, value));
      return entity;
    }

    function setEntityVisible(entity, visible) {
      entity?.setAttribute('visible', visible ? 'true' : 'false');
    }

    function setMaterial(entity, material) {
      if (entity) {
        entity.setAttribute('material', material);
      }
    }

    function setText(entity, label, color, width, wrapCount) {
      if (!entity) {
        return;
      }
      const target = entity.__codexrTextEntity || entity;
      if (target.tagName?.toLowerCase?.() === 'a-text') {
        target.setAttribute('value', label);
        target.setAttribute('color', color);
        target.setAttribute('align', 'center');
        target.setAttribute('width', String(width));
        target.setAttribute('wrap-count', String(wrapCount));
        return;
      }
      target.setAttribute('text', `value: ${label}; color: ${color}; align: center; width: ${width}; wrapCount: ${wrapCount};`);
    }

    function createButton(id, glyph, width, height, textWidth, wrapCount) {
      const button = createEntity('a-plane', {
        id: getScopedId(id),
        class: 'babiaxraycasterclass codexr-screen-button',
        width: String(width),
        height: String(height),
        color: '#0F172A',
        material: 'color: #0F172A; opacity: 0.18; transparent: true; shader: flat;',
      });
      const label = createEntity('a-text', {
        value: glyph,
        color: '#F8FAFC',
        align: 'center',
        width: String(textWidth),
        'wrap-count': String(wrapCount),
        position: '0 0 0.02',
      });
      button.appendChild(label);
      button.__codexrGlyph = glyph;
      button.__codexrTextWidth = textWidth;
      button.__codexrWrapCount = wrapCount;
      button.__codexrTextEntity = label;
      setText(button, glyph, '#F8FAFC', textWidth, wrapCount);
      return button;
    }

    function createHandle(id, width, height) {
      return createEntity('a-plane', {
        id: getScopedId(id),
        class: 'babiaxraycasterclass codexr-screen-handle',
        width: String(width),
        height: String(height),
        color: '#FFFFFF',
        material: 'color: #FFFFFF; opacity: 0.0; transparent: true; shader: flat;',
      });
    }

    function setButtonStyle(entity, opacity, fillColor, textColor) {
      if (!entity) {
        return;
      }
      entity.setAttribute('color', fillColor);
      setMaterial(entity, `color: ${fillColor}; opacity: ${opacity}; transparent: true; shader: flat;`);
      setText(entity, entity.__codexrGlyph || '', textColor, entity.__codexrTextWidth || 1, entity.__codexrWrapCount || 4);
    }

    function getControlLegend() {
      const lookAtLabel = state.lookAtCameraEnabled ? 'Purple look-at' : 'Pink look-at off';
      const followLabel = state.follow ? 'Orange follow active' : 'Blue follow';
      if (isMinimized()) {
        return `${lookAtLabel}\n${followLabel}\nGreen expand\nRed stop\nMove: sides drag\nDepth: wheel/thumbstick while dragging`;
      }
      return `${lookAtLabel}\n${followLabel}\nYellow minimize\nRed stop\nMove: sides drag\nResize: corners\nDepth: wheel/thumbstick while dragging`;
    }

    function getLegendLayoutMetrics(width, minimized) {
      const legendTextValue = getControlLegend();
      const legendLines = legendTextValue.split('\n');
      const maxLegendLineLength = legendLines.reduce((maxLength, line) => Math.max(maxLength, line.length), 0);
      const horizontalPadding = minimized ? 0.34 : 0.40;
      const verticalPadding = minimized ? 0.24 : 0.30;
      const lineHeight = minimized ? 0.22 : 0.25;
      const estimatedTextWidth = maxLegendLineLength * (minimized ? 0.075 : 0.080);
      const legendWidth = clamp(
        Math.max(width * 0.72, estimatedTextWidth + (horizontalPadding * 2)),
        minimized ? 3.0 : 3.4,
        minimized ? 5.8 : 7.2,
      );
      const legendHeight = clamp(
        (legendLines.length * lineHeight) + (verticalPadding * 2),
        minimized ? 1.55 : 2.10,
        minimized ? 2.65 : 3.35,
      );
      const textWidth = Math.max(2.4, legendWidth - (horizontalPadding * 2));
      const wrapCount = Math.max(maxLegendLineLength + 4, minimized ? 26 : 30);
      return {
        legendWidth,
        legendHeight,
        textWidth,
        wrapCount,
        horizontalPadding,
        verticalPadding,
      };
    }

    function setHandleStyle(entity, visible) {
      if (!entity) {
        return;
      }
      setMaterial(entity, `color: #FFFFFF; opacity: ${visible ? 0.34 : 0.0}; transparent: true; shader: flat;`);
    }
