// == codexrCollaborationRuntime.js | part 40: presence-avatars (assembled with its siblings; see COMPONENTS.md) ==
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
