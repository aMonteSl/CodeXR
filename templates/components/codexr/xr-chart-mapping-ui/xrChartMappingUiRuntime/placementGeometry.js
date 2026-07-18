// == xrChartMappingUiRuntime.js | placementGeometry (assembled per manifest.json; see COMPONENTS.md) ==
  function parsePosition(rawPosition) {
    var tokens = String(rawPosition || '0 0 0').trim().split(/\s+/);
    return {
      x: Number(tokens[0]) || 0,
      y: Number(tokens[1]) || 0,
      z: Number(tokens[2]) || 0
    };
  }

  function toPosition(position) {
    return position.x + ' ' + position.y + ' ' + position.z;
  }

  function parseRotation(rawRotation) {
    var tokens = String(rawRotation || '0 0 0').trim().split(/\s+/);
    return {
      x: Number(tokens[0]) || 0,
      y: Number(tokens[1]) || 0,
      z: Number(tokens[2]) || 0
    };
  }

  function getScene() {
    var document = getDoc();
    return document ? document.querySelector('a-scene') : null;
  }

  function getCollaborationClient() {
    var collaborationRuntime = root.CodeXRCollaborationRuntime;
    if (!collaborationRuntime || typeof collaborationRuntime.getClient !== 'function') {
      return null;
    }
    return collaborationRuntime.getClient(root);
  }

  function getCameraWorldPosition() {
    var scene = getScene();
    if (!scene || !root.THREE) {
      return null;
    }
    if (scene.camera && scene.camera.getWorldPosition) {
      var fromSceneCamera = new root.THREE.Vector3();
      scene.camera.getWorldPosition(fromSceneCamera);
      return fromSceneCamera;
    }
    var cameraEntity = getDoc().querySelector('a-camera, [camera]');
    if (!cameraEntity || !cameraEntity.object3D || !cameraEntity.object3D.getWorldPosition) {
      return null;
    }
    var fromEntity = new root.THREE.Vector3();
    cameraEntity.object3D.getWorldPosition(fromEntity);
    return fromEntity;
  }

  function buildAdaptiveCorners(config) {
    if (!config || !config.adaptiveCorner) {
      return [];
    }

    var table = config.adaptiveCorner.table || {};
    var anchorX = Number(table.anchorX);
    var anchorY = Number(table.anchorY);
    var anchorZ = Number(table.anchorZ);
    var width = Number(table.width);
    var depth = Number(table.depth);

    if (!isFinite(anchorX) || !isFinite(anchorZ) || !isFinite(width) || !isFinite(depth) || width <= 0 || depth <= 0) {
      return [];
    }

    var safeAnchorY = isFinite(anchorY) ? anchorY : parsePosition(config.panelPosition).y;
    var marginX = Number(config.adaptiveCorner.marginX);
    var marginZ = Number(config.adaptiveCorner.marginZ);
    var halfX = width * 0.5 + (isFinite(marginX) ? marginX : 0.45);
    var halfZ = depth * 0.5 + (isFinite(marginZ) ? marginZ : 0.45);

    return [
      { id: 'front-right', x: anchorX + halfX, y: safeAnchorY, z: anchorZ + halfZ },
      { id: 'front-left', x: anchorX - halfX, y: safeAnchorY, z: anchorZ + halfZ },
      { id: 'back-right', x: anchorX + halfX, y: safeAnchorY, z: anchorZ - halfZ },
      { id: 'back-left', x: anchorX - halfX, y: safeAnchorY, z: anchorZ - halfZ }
    ];
  }

  function pickNearestCorner(config, cameraWorldPosition) {
    var corners = buildAdaptiveCorners(config);
    if (!cameraWorldPosition || corners.length === 0) {
      return null;
    }

    var current = null;
    var best = null;

    corners.forEach(function (corner) {
      var dx = corner.x - cameraWorldPosition.x;
      var dz = corner.z - cameraWorldPosition.z;
      var squaredDistance = dx * dx + dz * dz;
      if (corner.id === state.activeCornerId) {
        current = { corner: corner, squaredDistance: squaredDistance };
      }
      if (!best || squaredDistance < best.squaredDistance) {
        best = { corner: corner, squaredDistance: squaredDistance };
      }
    });

    if (!best) {
      return null;
    }

    if (!current) {
      return best.corner;
    }

    var now = Date.now();
    var threshold = Number(config.adaptiveCorner.switchThreshold);
    var effectiveThreshold = isFinite(threshold) ? threshold : ADAPTIVE_DEFAULTS.cornerSwitchThreshold;
    var thresholdSquared = effectiveThreshold * effectiveThreshold;
    var cooldownMs = Number(config.adaptiveCorner.switchCooldownMs);
    var effectiveCooldownMs = isFinite(cooldownMs) ? cooldownMs : ADAPTIVE_DEFAULTS.cornerSwitchCooldownMs;

    if (now - state.lastCornerSwitchAt < effectiveCooldownMs) {
      return current.corner;
    }

    if (best.corner.id !== current.corner.id && (current.squaredDistance - best.squaredDistance) > thresholdSquared) {
      state.lastCornerSwitchAt = now;
      return best.corner;
    }

    return current.corner;
  }

  function orientPanelToCamera(config, targetPosition, cameraWorldPosition) {
    if (!refs.panel || !targetPosition || !cameraWorldPosition) {
      return;
    }

    var dx = cameraWorldPosition.x - targetPosition.x;
    var dz = cameraWorldPosition.z - targetPosition.z;
    if (Math.abs(dx) < 0.000001 && Math.abs(dz) < 0.000001) {
      return;
    }

    var yawDeg = Math.atan2(dx, dz) * (180 / Math.PI);
    var currentRotation = parseRotation(config.panelRotation || '0 0 0');
    refs.panel.setAttribute('rotation', currentRotation.x + ' ' + yawDeg.toFixed(2) + ' ' + currentRotation.z);
  }

  function applyAdaptivePlacement(config) {
    if (!config || !config.adaptiveCorner || !refs.panel || !refs.panel.parentElement) {
      return;
    }

    var cameraWorldPosition = getCameraWorldPosition();
    if (!cameraWorldPosition) {
      return;
    }

    var corner = pickNearestCorner(config, cameraWorldPosition);
    if (!corner) {
      return;
    }

    state.activeCornerId = corner.id;

    var panelLift = Number(config.adaptiveCorner.panelLift);
    var forwardOffset = Number(config.adaptiveCorner.panelForwardOffset);
    var safeLift = isFinite(panelLift) ? panelLift : ADAPTIVE_DEFAULTS.panelLift;
    var safeForwardOffset = isFinite(forwardOffset) ? forwardOffset : ADAPTIVE_DEFAULTS.panelForwardOffset;

    var towardCameraX = cameraWorldPosition.x - corner.x;
    var towardCameraZ = cameraWorldPosition.z - corner.z;
    var magnitude = Math.sqrt(towardCameraX * towardCameraX + towardCameraZ * towardCameraZ) || 1;

    var targetPosition = {
      x: corner.x + (towardCameraX / magnitude) * safeForwardOffset,
      y: corner.y + safeLift,
      z: corner.z + (towardCameraZ / magnitude) * safeForwardOffset
    };

    refs.panel.setAttribute('position', toPosition(targetPosition));
    orientPanelToCamera(config, targetPosition, cameraWorldPosition);
  }

  function updateAdaptivePlacement() {
    var config = getConfig();
    if (!config || !config.adaptiveCorner || !refs.panel || !refs.panel.isConnected) {
      state.adaptiveLoopActive = false;
      return;
    }

    applyAdaptivePlacement(config);
    var nextFrame = root.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    nextFrame(updateAdaptivePlacement);
  }

  function ensureAdaptivePlacementLoop() {
    if (state.adaptiveLoopActive) {
      return;
    }
    state.adaptiveLoopActive = true;
    updateAdaptivePlacement();
  }
