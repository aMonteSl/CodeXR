(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.CodeXRMappingUiRuntime = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CONFIG_KEY = '__CODEXR_XR_MAPPING_UI__';
  var CONFIG_SCRIPT_ID = 'codexr-tooling-config-xr-mapping-ui';
  var COMPONENT_BY_CHART = {
    bars: 'babia-bars',
    barsmap: 'babia-barsmap',
    cyls: 'babia-cyls',
    cylsmap: 'babia-cylsmap',
    donut: 'babia-doughnut',
    pie: 'babia-pie',
    bubbles: 'babia-bubbles',
    boats: 'babia-boats'
  };

  var refs = {
    panel: null,
    panelContent: null,
    panelTitle: null,
    panelTitleBackdrop: null,
    toggle: null,
    rowsRoot: null,
    panelBackground: null,
    panelBorder: null
  };

  var state = {
    initialized: false,
    visible: true,
    selectedByDimension: {},
    adaptiveLoopActive: false,
    activeCornerId: null,
    lastCornerSwitchAt: 0,
    lastConfigSnapshot: null
  };

  var ADAPTIVE_DEFAULTS = {
    cornerSwitchThreshold: 0.35,
    cornerSwitchCooldownMs: 500,
    panelLift: 0.04,
    panelForwardOffset: 0.12
  };

  function getDoc() {
    return root.document;
  }

  function getConfig() {
    var document = getDoc();
    var configScript = document ? document.getElementById(CONFIG_SCRIPT_ID) : null;
    if (configScript && typeof configScript.textContent === 'string') {
      try {
        return JSON.parse(configScript.textContent);
      } catch (error) {
        console.warn('CODEXR_MAPPING_UI: invalid JSON config script', error);
      }
    }
    return root[CONFIG_KEY] || null;
  }

  function createEntity(tagName, attributes) {
    var entity = getDoc().createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      entity.setAttribute(key, attributes[key]);
    });
    return entity;
  }

  function clearEntity(entity) {
    while (entity && entity.firstChild) {
      entity.removeChild(entity.firstChild);
    }
  }

  function pickColumns(fieldCount) {
    if (fieldCount <= 5) {
      return 2;
    }
    if (fieldCount <= 10) {
      return 3;
    }
    return 4;
  }

  function compactLabel(rawName) {
    var map = {
      Complexity: 'Cplx',
      Number: 'No',
      Function: 'Fn',
      Average: 'Avg',
      Cyclomatic: 'Cyclo',
      Nesting: 'Nest',
      Parameters: 'Params',
      Parameter: 'Param',
      Count: 'Cnt',
      Maximum: 'Max',
      Minimum: 'Min'
    };
    var normalized = String(rawName || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();

    var compacted = normalized
      .split(/\s+/)
      .map(function (word) {
        return map[word] || word;
      })
      .join(' ');

    if (compacted.length <= 18) {
      return compacted;
    }
    return compacted.slice(0, 15) + '...';
  }

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

  function getChartEntity(config) {
    return getDoc().getElementById(config.chartEntityId || '');
  }

  function applyDimensionSelection(config, dimensionId, fieldName) {
    var chartEntity = getChartEntity(config);
    var componentName = COMPONENT_BY_CHART[config.chartId || ''];

    if (!chartEntity || !componentName) {
      return;
    }

    chartEntity.setAttribute(componentName, (function () {
      var update = {};
      update[dimensionId] = fieldName;
      return update;
    })());
  }

  function syncToggleLabel(config) {
    if (!refs.toggle) {
      return;
    }
    refs.toggle.setAttribute('material', {
      color: state.visible ? '#f3b108' : '#16a34a',
      opacity: 0.98,
      shader: 'flat',
      transparent: true
    });
    refs.toggle.setAttribute('text', {
      value: state.visible ? '-' : '+',
      align: 'center',
      color: '#ffffff',
      width: 1,
      baseline: 'center',
      anchor: 'center'
    });
  }

  function setVisible(config, visible) {
    state.visible = !!visible;
    if (refs.panelContent) {
      refs.panelContent.setAttribute('visible', state.visible);
    }
    syncToggleLabel(config);
  }

  function renderRows(config) {
    if (!refs.rowsRoot) {
      return;
    }

    clearEntity(refs.rowsRoot);

    var dimensions = Array.isArray(config.dimensions) ? config.dimensions : [];
    var cursorY = 0;

    dimensions.forEach(function (dimension) {
      if (!dimension || dimension.hidden) {
        return;
      }

      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      if (fields.length === 0) {
        return;
      }

      var label = createEntity('a-text', {
        value: (dimension.label || dimension.id) + (dimension.dataType === 'numeric' ? ' [N]' : ''),
        align: 'left',
        color: '#cde7ff',
        width: 7.8,
        position: '-2.85 ' + (cursorY - 0.05) + ' 0.02'
      });
      refs.rowsRoot.appendChild(label);
      cursorY -= 0.3;

      var cols = pickColumns(fields.length);
      var buttonWidth = 5.8 / cols;
      var spacing = 0.08;
      var colWidth = buttonWidth + spacing;

      fields.forEach(function (fieldName, fieldIndex) {
        var rowIndex = Math.floor(fieldIndex / cols);
        var colIndex = fieldIndex % cols;
        var isActive = state.selectedByDimension[dimension.id] === fieldName;

        var x = -2.85 + colIndex * colWidth + buttonWidth * 0.5;
        var y = cursorY - rowIndex * 0.28;

        var button = createEntity('a-plane', {
          class: 'babiaxraycasterclass codexr-mapping-ui-option',
          color: isActive ? '#be123c' : '#1e3a5f',
          width: buttonWidth,
          height: 0.22,
          opacity: isActive ? 0.98 : 0.92,
          position: x + ' ' + y + ' 0.01'
        });

        var text = createEntity('a-text', {
          value: compactLabel(fieldName),
          align: 'center',
          color: '#ffffff',
          width: buttonWidth * 1.9,
          position: '0 0 0.01'
        });

        button.appendChild(text);
        button.addEventListener('click', function () {
          state.selectedByDimension[dimension.id] = fieldName;
          applyDimensionSelection(config, dimension.id, fieldName);
          renderRows(config);
        });

        refs.rowsRoot.appendChild(button);
      });

      cursorY -= Math.ceil(fields.length / cols) * 0.28 + 0.2;
    });

    var panelHeight = Math.max(2.2, Math.abs(cursorY) + 0.5);
    if (refs.panelBackground) {
      refs.panelBackground.setAttribute('height', panelHeight);
    }
    if (refs.panelBorder) {
      refs.panelBorder.setAttribute('height', panelHeight + 0.05);
    }
    if (refs.panelTitleBackdrop) {
      refs.panelTitleBackdrop.setAttribute('position', '0 ' + (panelHeight * 0.5 + 0.23) + ' 0.02');
    }
    if (refs.panelTitle) {
      refs.panelTitle.setAttribute('position', '0 ' + (panelHeight * 0.5 + 0.23) + ' 0.03');
    }

    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('position', '-0.05 ' + (panelHeight * 0.45 - 0.4) + ' 0.02');
    }
  }

  function buildUi(config) {
    var scene = getDoc().querySelector(config.sceneSelector || '#scene');
    if (!scene) {
      return;
    }

    var existingPanel = getDoc().getElementById(config.panelId || 'codexrMappingUiPanel');
    var existingToggle = getDoc().getElementById(config.toggleId || 'codexrMappingUiToggle');
    if (existingPanel) {
      existingPanel.remove();
    }
    if (existingToggle) {
      existingToggle.remove();
    }

    refs.panel = createEntity('a-entity', {
      id: config.panelId || 'codexrMappingUiPanel',
      position: config.panelPosition || '8 2 -8',
      rotation: config.panelRotation || '0 -70 0',
      scale: (config.panelScale || 0.2) + ' ' + (config.panelScale || 0.2) + ' ' + (config.panelScale || 0.2),
      class: 'codexr-mapping-ui-panel',
      visible: true
    });

    if (config.hideOnEnterAr) {
      refs.panel.setAttribute('hide-on-enter-ar', '');
    }

    refs.panelContent = createEntity('a-entity', {
      position: '0 0 0',
      visible: config.panelVisible !== false
    });

    refs.panelBackground = createEntity('a-plane', {
      color: '#0A1628',
      opacity: 0.94,
      width: 6.2,
      height: 2.2,
      position: '0 0 0'
    });

    refs.panelBorder = createEntity('a-box', {
      color: '#22d3ee',
      opacity: 0.5,
      width: 6.25,
      height: 2.25,
      depth: 0.01,
      position: '0 0 -0.01'
    });

    refs.panelTitleBackdrop = createEntity('a-plane', {
      color: '#0b4f6c',
      opacity: 0.96,
      width: 2.7,
      height: 0.34,
      position: '0 1.32 0.02'
    });

    refs.panelTitle = createEntity('a-text', {
      value: 'CodeXR Field Mapping',
      align: 'center',
      color: '#eaf4ff',
      width: 7,
      position: '0 1.32 0.03'
    });

    refs.rowsRoot = createEntity('a-entity', {
      position: '-0.05 0.55 0.02'
    });

    refs.panelContent.appendChild(refs.panelBackground);
    refs.panelContent.appendChild(refs.panelBorder);
    refs.panelContent.appendChild(refs.panelTitleBackdrop);
    refs.panelContent.appendChild(refs.panelTitle);
    refs.panelContent.appendChild(refs.rowsRoot);
    refs.panel.appendChild(refs.panelContent);

    refs.toggle = createEntity('a-plane', {
      id: config.toggleId || 'codexrMappingUiToggle',
      class: 'babiaxraycasterclass codexr-mapping-ui-toggle',
      width: 0.34,
      height: 0.34,
      position: '2.95 1.26 0.04'
    });

    refs.toggle.addEventListener('click', function () {
      setVisible(config, !state.visible);
    });

    refs.panel.appendChild(refs.toggle);
    scene.appendChild(refs.panel);
    state.visible = config.panelVisible !== false;
    state.activeCornerId = null;
    syncToggleLabel(config);
    setVisible(config, state.visible);
    renderRows(config);

    if (config.adaptiveCorner) {
      applyAdaptivePlacement(config);
      ensureAdaptivePlacementLoop();
    }
  }

  function hydrateStateFromConfig(config) {
    state.selectedByDimension = {};
    var dimensions = Array.isArray(config.dimensions) ? config.dimensions : [];
    dimensions.forEach(function (dimension) {
      if (!dimension || !dimension.id) {
        return;
      }
      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      var fallback = fields.length > 0 ? fields[0] : '';
      state.selectedByDimension[dimension.id] = dimension.currentField || fallback;
    });
    state.visible = config.panelVisible !== false;
  }

  function getState() {
    return {
      visible: state.visible,
      selectedByDimension: Object.assign({}, state.selectedByDimension)
    };
  }

  function restoreState(runtimeState) {
    var config = getConfig();
    if (!config || !runtimeState || typeof runtimeState !== 'object' || Array.isArray(runtimeState)) {
      console.warn('[CodeXR][MappingUI] Invalid state snapshot; restore skipped.');
      return false;
    }

    state.visible = typeof runtimeState.visible === 'boolean' ? runtimeState.visible : state.visible;
    state.selectedByDimension = Object.assign(
      {},
      state.selectedByDimension,
      runtimeState.selectedByDimension && typeof runtimeState.selectedByDimension === 'object' && !Array.isArray(runtimeState.selectedByDimension)
        ? runtimeState.selectedByDimension
        : {}
    );

    var dimensions = Array.isArray(config.dimensions) ? config.dimensions : [];
    dimensions.forEach(function (dimension) {
      if (!dimension || !dimension.id) {
        return;
      }
      var selectedField = state.selectedByDimension[dimension.id];
      if (selectedField) {
        applyDimensionSelection(config, dimension.id, selectedField);
      }
    });

    setVisible(config, state.visible);
    renderRows(config);
    return true;
  }

  function autoInit() {
    var config = getConfig();
    if (!config || state.initialized) {
      return;
    }

    state.initialized = true;

    hydrateStateFromConfig(config);
    buildUi(config);
  }

  var runtime = {
    autoInit: autoInit,
    getState: getState,
    restoreState: restoreState,
    refreshAdaptivePlacement: function () {
      var config = getConfig();
      if (!config || !config.adaptiveCorner) {
        return;
      }
      applyAdaptivePlacement(config);
      ensureAdaptivePlacementLoop();
    },
    setVisible: function (visible) {
      var config = getConfig();
      if (!config) {
        return;
      }
      setVisible(config, visible);
    }
  };

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        runtime.autoInit();
      }, { once: true });
    } else {
      runtime.autoInit();
    }
  }

  root.CodeXRMappingUiRuntime = runtime;
  return runtime;
});
