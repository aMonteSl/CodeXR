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
  var SHARED_ENTITY_KIND = 'mapping';
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

  var DEFAULT_ROTATION_BY_CHART = {
    donut: '0 0 0',
    pie: '0 0 0'
  };

  var CONTROLLER_PANEL_BY_VIEW = {
    'visualization-menu': 'visualization-mode',
    'single.mapping': 'mapping',
    'dependency.settings': 'dependency-graph',
    'historical.selection': 'historical-selection',
    'historical.mapping': 'mapping',
    'project-evolution': 'project-evolution',
    'project-evolution.selection': 'project-evolution',
    'project-evolution.playback': 'project-evolution'
  };

  var CONTROLLER_VIEW_BY_PANEL = {
    'visualization-mode': 'visualization-menu',
    mapping: 'single.mapping',
    'dependency-graph': 'dependency.settings',
    'historical-selection': 'historical.selection',
    'project-evolution': 'project-evolution'
  };

  var refs = {
    panel: null,
    panelContent: null,
    panelTitle: null,
    panelTitleBackdrop: null,
    toggle: null,
    rowsRoot: null,
    chartRoot: null,
    panelBackground: null,
    panelBorder: null,
    statusText: null
  };

  var state = {
    initialized: false,
    visible: true,
    selectedByDimension: {},
    lastKnownGoodMapping: {},
    invalidOptionsByDimension: {},
    adaptiveLoopActive: false,
    activeCornerId: null,
    lastCornerSwitchAt: 0,
    lastConfigSnapshot: null,
    delayedRenormalizeTimer: null,
    pendingValidationTimers: [],
    pendingMappingToken: 0,
    pendingMapping: null,
    statusMessage: '',
    statusLevel: 'info',
    statusClearTimer: null,
    suppressSharedPublish: false,
    chartEntityIdsOverride: null,
    activeMappingContextId: 'normal-analysis',
    mappingProfiles: {},
    activePanelView: 'mapping',
    mappingPanelHeight: 2.45,
    panelViews: {},
    panelViewObservers: {},
    runtimeConfig: null,
    activeChartId: null,
    mode: 'single',
    activeControllerView: 'single.mapping',
    modeMemory: {}
  };

  var ADAPTIVE_DEFAULTS = {
    cornerSwitchThreshold: 0.35,
    cornerSwitchCooldownMs: 500,
    panelLift: 0.04,
    panelForwardOffset: 0.12
  };

  var PANEL_LAYOUT = {
    left: -2.85,
    right: 2.55,
    labelWidth: 7.4,
    buttonGap: 0.08,
    rowGap: 0.28,
    sectionGap: 0.32,
    labelToButtonsGap: 0.3,
    maxChartRows: 3,
    chartRootHeightOffset: 0.34,
    rowsRootHeightOffset: 1.72,
    panelHeightPadding: 2.95
  };

  function getPanelContentWidth() {
    return PANEL_LAYOUT.right - PANEL_LAYOUT.left;
  }

  function getGridButtonWidth(cols) {
    var safeCols = Math.max(1, Number(cols) || 1);
    return (getPanelContentWidth() - PANEL_LAYOUT.buttonGap * (safeCols - 1)) / safeCols;
  }

  function getGridButtonX(colIndex, buttonWidth) {
    return PANEL_LAYOUT.left + colIndex * (buttonWidth + PANEL_LAYOUT.buttonGap) + buttonWidth * 0.5;
  }

  function getDoc() {
    return root.document;
  }

  function getConfig() {
    if (state.runtimeConfig) {
      return state.runtimeConfig;
    }
    var document = getDoc();
    var configScript = document ? document.getElementById(CONFIG_SCRIPT_ID) : null;
    if (configScript && typeof configScript.textContent === 'string') {
      try {
        state.runtimeConfig = JSON.parse(configScript.textContent);
        state.activeChartId = state.runtimeConfig.chartId || null;
        return state.runtimeConfig;
      } catch (error) {
        console.warn('CODEXR_MAPPING_UI: invalid JSON config script', error);
      }
    }
    state.runtimeConfig = root[CONFIG_KEY] || null;
    state.activeChartId = state.runtimeConfig.chartId || null;
    return state.runtimeConfig;
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

  function humanizeFieldName(rawName) {
    return String(rawName || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  function getFriendlyAxisLabel(config, dimensionId) {
    var dimension = getDimensionConfig(config, dimensionId);
    if (dimension && dimension.label) {
      return String(dimension.label);
    }
    return humanizeFieldName(dimensionId || 'this axis') || 'this axis';
  }

  function buildFriendlyInvalidMappingMessage(config, dimensionId, fieldName, reason, includeRestoreLine) {
    var axisLabel = getFriendlyAxisLabel(config, dimensionId);
    var fieldLabel = humanizeFieldName(fieldName);
    var lines = [];

    if (reason && /no chart data is available yet/i.test(reason)) {
      lines.push('This chart is still loading data for ' + axisLabel + '.');
      lines.push('CodeXR kept the last valid mapping until the visualization is ready.');
      lines.push('Try again once the chart finishes loading.');
      return lines.join('\n');
    }

    if (fieldLabel) {
      lines.push('"' + fieldLabel + '" caused an invalid chart for ' + axisLabel + '.');
    } else {
      lines.push('That field caused an invalid chart for ' + axisLabel + '.');
    }

    if (includeRestoreLine === false) {
      lines.push('CodeXR blocked this option because Babia failed the last time it was used.');
    } else {
      lines.push('CodeXR restored the last valid mapping to keep the visualization stable.');
    }

    lines.push('Try another field for this axis.');
    return lines.join('\n');
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

  function getChartEntity(config) {
    var entities = getChartEntities(config);
    return entities.length ? entities[0] : null;
  }

  function getConfiguredChartEntityIds(config) {
    return Array.isArray(state.chartEntityIdsOverride) && state.chartEntityIdsOverride.length
      ? state.chartEntityIdsOverride
      : (Array.isArray(config && config.chartEntityIds) && config.chartEntityIds.length
        ? config.chartEntityIds
        : [config && config.chartEntityId]);
  }

  function hasEntityAttribute(entity, attributeName) {
    if (!entity || !attributeName) {
      return false;
    }
    if (typeof entity.hasAttribute === 'function') {
      return entity.hasAttribute(attributeName);
    }
    return typeof entity.getAttribute === 'function' && entity.getAttribute(attributeName) !== undefined;
  }

  function isAnalysisRootEntity(entity) {
    return !!(entity && (
      hasEntityAttribute(entity, 'data-codexr-analysis-root')
      || hasEntityAttribute(entity, 'data-codexr-normal-root')
      || hasEntityAttribute(entity, 'data-codexr-analysis-surface')
    ));
  }

  function isChartMappingEntity(entity, componentName) {
    if (!entity) {
      return false;
    }
    if (hasEntityAttribute(entity, 'codexr-chart-containment')) {
      return true;
    }
    if (isAnalysisRootEntity(entity)) {
      return false;
    }
    return !!(componentName && hasEntityAttribute(entity, componentName));
  }

  function queryEntities(scope, selector) {
    if (!scope || typeof scope.querySelectorAll !== 'function') {
      return [];
    }
    try {
      return Array.prototype.slice.call(scope.querySelectorAll(selector) || []);
    } catch (error) {
      return [];
    }
  }

  function getChartSearchScopes(config) {
    var document = getDoc();
    if (!document) {
      return [];
    }

    var scopeIds = [
      config && config.normalRootId,
      config && config.normalSurfaceId,
      'codexrNormalAnalysisRoot',
      'codexrAnalysisSurface'
    ].filter(Boolean);
    var scopes = [];
    scopeIds.forEach(function (id) {
      if (!document.getElementById) {
        return;
      }
      var scope = document.getElementById(id);
      if (scope && scopes.indexOf(scope) === -1) {
        scopes.push(scope);
      }
    });
    scopes.push(document);
    return scopes;
  }

  function findFallbackChartEntity(config, preferredId) {
    var document = getDoc();
    if (!document) {
      return null;
    }
    var componentName = getChartComponentName(config);

    if (preferredId && document.getElementById) {
      var preferred = document.getElementById(preferredId);
      if (isChartMappingEntity(preferred, componentName)) {
        return preferred;
      }
      var contained = queryEntities(preferred, '[codexr-chart-containment]');
      if (contained.length) {
        var containedMatch = componentName
          ? contained.find(function (entity) { return hasEntityAttribute(entity, componentName); })
          : null;
        return containedMatch || contained[0];
      }
    }

    var scopes = getChartSearchScopes(config);
    for (var i = 0; i < scopes.length; i += 1) {
      var charts = queryEntities(scopes[i], '[codexr-chart-containment]');
      if (!charts.length) {
        continue;
      }
      if (componentName) {
        var componentMatch = charts.find(function (entity) {
          return hasEntityAttribute(entity, componentName);
        });
        if (componentMatch) {
          return componentMatch;
        }
      }
      return charts[0];
    }
    return null;
  }

  function buildChartValidationTargets(config) {
    var ids = getConfiguredChartEntityIds(config).filter(Boolean).map(String);
    if (!ids.length) {
      return [function resolveChartTarget() {
        return findFallbackChartEntity(config);
      }];
    }
    return ids.map(function (id) {
      return function resolveChartTarget() {
        return findFallbackChartEntity(config, id);
      };
    });
  }

  function getChartEntities(config) {
    var document = getDoc();
    if (!document || !config) {
      return [];
    }
    var ids = getConfiguredChartEntityIds(config);
    var componentName = getChartComponentName(config);
    var directMatches = ids
      .filter(Boolean)
      .map(function (id) { return document.getElementById(id); })
      .filter(function (entity) { return isChartMappingEntity(entity, componentName); });
    if (directMatches.length) {
      return directMatches;
    }

    var fallback = findFallbackChartEntity(config);
    return fallback ? [fallback] : [];
  }

  function cloneMapping(mapping) {
    return Object.assign({}, mapping || {});
  }

  function cloneInvalidOptions(invalidOptionsByDimension) {
    return JSON.parse(JSON.stringify(invalidOptionsByDimension || {}));
  }

  function getActiveChartId(config) {
    return state.activeChartId || (config && config.chartId) || '';
  }

  function getMappingProfileKey(contextId, chartId) {
    return String(contextId || 'default') + '::' + String(chartId || 'default-chart');
  }

  function getDimensionsForChart(config, chartId) {
    var byChart = config && config.dimensionsByChart;
    var dimensions = byChart && Array.isArray(byChart[chartId])
      ? byChart[chartId]
      : (Array.isArray(config && config.dimensions) ? config.dimensions : []);
    return dimensions;
  }

  function getDefaultMappingForChart(config, chartId) {
    var defaultsByChart = config && config.defaultMappingsByChart;
    if (defaultsByChart && defaultsByChart[chartId]) {
      return cloneMapping(defaultsByChart[chartId]);
    }
    var selectedByDimension = {};
    getDimensionsForChart(config, chartId).forEach(function (dimension) {
      if (!dimension || !dimension.id) {
        return;
      }
      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      selectedByDimension[dimension.id] = dimension.currentField || fields[0] || '';
    });
    return selectedByDimension;
  }

  function buildDefaultMappingSnapshot(config) {
    var selectedByDimension = getDefaultMappingForChart(config, getActiveChartId(config));
    return {
      visible: config && config.panelVisible !== false,
      selectedByDimension: cloneMapping(selectedByDimension),
      lastKnownGoodMapping: cloneMapping(selectedByDimension),
      invalidOptionsByDimension: {}
    };
  }

  function normalizeMappingSnapshot(snapshot, config) {
    var fallback = buildDefaultMappingSnapshot(config);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return fallback;
    }
    var selected = snapshot.selectedByDimension && typeof snapshot.selectedByDimension === 'object' && !Array.isArray(snapshot.selectedByDimension)
      ? snapshot.selectedByDimension
      : fallback.selectedByDimension;
    var lastKnownGood = snapshot.lastKnownGoodMapping && typeof snapshot.lastKnownGoodMapping === 'object' && !Array.isArray(snapshot.lastKnownGoodMapping)
      ? snapshot.lastKnownGoodMapping
      : selected;
    return {
      visible: typeof snapshot.visible === 'boolean' ? snapshot.visible : fallback.visible,
      selectedByDimension: cloneMapping(selected),
      lastKnownGoodMapping: cloneMapping(lastKnownGood),
      invalidOptionsByDimension: cloneInvalidOptions(snapshot.invalidOptionsByDimension)
    };
  }

  function captureMappingProfile() {
    var confirmedMapping = Object.keys(state.lastKnownGoodMapping || {}).length
      ? state.lastKnownGoodMapping
      : state.selectedByDimension;
    return {
      visible: state.visible,
      selectedByDimension: cloneMapping(confirmedMapping),
      lastKnownGoodMapping: cloneMapping(confirmedMapping),
      invalidOptionsByDimension: cloneInvalidOptions(state.invalidOptionsByDimension)
    };
  }

  function saveActiveMappingProfile() {
    var contextId = state.activeMappingContextId || 'default';
    var chartId = getActiveChartId(getConfig());
    var profileKey = getMappingProfileKey(contextId, chartId);
    state.mappingProfiles[profileKey] = captureMappingProfile();
    return state.mappingProfiles[profileKey];
  }

  function applyMappingRuntimeState(config, runtimeState, reason) {
    var snapshot = normalizeMappingSnapshot(runtimeState, config);
    clearPendingValidationTimers();
    clearStatusTimer();
    state.pendingMapping = null;
    state.statusMessage = '';
    state.statusLevel = 'info';
    state.visible = snapshot.visible;
    state.selectedByDimension = cloneMapping(snapshot.selectedByDimension);
    state.lastKnownGoodMapping = cloneMapping(snapshot.lastKnownGoodMapping || snapshot.selectedByDimension);
    state.invalidOptionsByDimension = cloneInvalidOptions(snapshot.invalidOptionsByDimension);
    applyMappingSnapshot(config, state.lastKnownGoodMapping, reason || 'mapping-ui-restore');
    state.selectedByDimension = cloneMapping(state.lastKnownGoodMapping);
    setVisible(config, state.visible);
    renderRows(config);
    requestChartContainmentRenormalize(reason || 'mapping-ui-restore');
    saveActiveMappingProfile();
    return true;
  }

  function mappingsEqual(left, right) {
    var leftKeys = Object.keys(left || {});
    var rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every(function (key) {
      return (left || {})[key] === (right || {})[key];
    });
  }

  function getChartComponentName(config) {
    return COMPONENT_BY_CHART[(state.activeChartId || (config && config.chartId)) || ''] || null;
  }

  function buildChartComponentUpdate(chartEntity, componentName, mappingSnapshot) {
    var currentData = chartEntity && componentName
      ? chartEntity.getAttribute(componentName)
      : null;
    var preservedData = currentData && typeof currentData === 'object' && !Array.isArray(currentData)
      ? currentData
      : {};
    return Object.assign({}, preservedData, mappingSnapshot || {});
  }

  function applyMappingToCharts(chartEntities, componentName, mappingSnapshot) {
    chartEntities.forEach(function (chartEntity) {
      chartEntity.setAttribute(
        componentName,
        buildChartComponentUpdate(chartEntity, componentName, mappingSnapshot)
      );
    });
  }

  function isHierarchicalChart(chartId) {
    return chartId === 'boats';
  }

  function getChartFromSource(chartId, existingData) {
    if (existingData && existingData.from) {
      var fromValue = String(existingData.from);
      if (isHierarchicalChart(chartId)) {
        if (/Tree/i.test(fromValue) || fromValue === 'tree') {
          return fromValue;
        }
        return 'tree';
      }
      if (/Comparison/i.test(fromValue) && !/Tree/i.test(fromValue)) {
        return fromValue;
      }
    }
    return isHierarchicalChart(chartId) ? 'tree' : 'data';
  }

  function buildRuntimeChartData(chartId, existingData, mappingSnapshot) {
    var data = Object.assign({}, mappingSnapshot || {});
    var source = getChartFromSource(chartId, existingData);
    data.from = source;
    data.legend = true;
    data.palette = existingData.palette || 'ubuntu';
    data.title = existingData.title || 'CodeXR Analysis';
    data.axis_name = true;

    if (chartId === 'boats') {
      return Object.assign({
        legend_text: '{name}\\n{path}',
        height_building_legend: -0.5,
        legend_scale: 0.25,
        legend_lookat: '[laser-controls]',
        extra: 1,
        separation: 0.5,
        zone_elevation: 0.01,
        height_quarter_legend_box: 0.01,
        height_quarter_legend_title: 2.5
      }, data);
    }

    return data;
  }

  function readCurrentChartData(chartEntity) {
    if (!chartEntity || typeof chartEntity.getAttribute !== 'function') {
      return {};
    }
    var componentNames = Object.keys(COMPONENT_BY_CHART).map(function (chartId) {
      return COMPONENT_BY_CHART[chartId];
    }).filter(function (componentName, index, list) {
      return componentName && list.indexOf(componentName) === index;
    });
    for (var i = 0; i < componentNames.length; i += 1) {
      var value = chartEntity.getAttribute(componentNames[i]);
      if (value && typeof value === 'object') {
        return value;
      }
    }
    return {};
  }

  function clearChartComponents(chartEntity) {
    Object.keys(COMPONENT_BY_CHART).forEach(function (chartId) {
      var componentName = COMPONENT_BY_CHART[chartId];
      if (componentName && chartEntity.removeAttribute) {
        chartEntity.removeAttribute(componentName);
      }
    });
  }

  function clearChartGeneratedChildren(chartEntity) {
    if (!chartEntity || typeof chartEntity.removeChild !== 'function') {
      return;
    }
    while (chartEntity.firstChild) {
      chartEntity.removeChild(chartEntity.firstChild);
    }
  }

  function applyChartDefaultTransform(chartEntity, chartId) {
    if (!chartEntity || typeof chartEntity.setAttribute !== 'function') {
      return;
    }
    var rotation = DEFAULT_ROTATION_BY_CHART[chartId] || '0 0 0';
    chartEntity.setAttribute('rotation', rotation);
  }

  function applyChartTypeToEntity(chartEntity, chartId, mappingSnapshot) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chartEntity || !componentName || typeof chartEntity.setAttribute !== 'function') {
      return false;
    }
    var existingData = readCurrentChartData(chartEntity);
    clearChartComponents(chartEntity);
    clearChartGeneratedChildren(chartEntity);
    applyChartDefaultTransform(chartEntity, chartId);
    chartEntity.setAttribute(componentName, buildRuntimeChartData(chartId, existingData, mappingSnapshot));
    chartEntity.setAttribute('data-codexr-active-chart-id', chartId);
    return true;
  }

  function applyChartTypeToEntities(config, chartId, mappingSnapshot) {
    var chartEntities = getChartEntities(config);
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chartEntities.length || !componentName) {
      return false;
    }
    chartEntities.forEach(function (chartEntity) {
      applyChartTypeToEntity(chartEntity, chartId, mappingSnapshot);
    });
    return true;
  }

  function getDimensionConfig(config, dimensionId) {
    var dimensions = Array.isArray(config && config.dimensions) ? config.dimensions : [];
    for (var i = 0; i < dimensions.length; i += 1) {
      if (dimensions[i] && dimensions[i].id === dimensionId) {
        return dimensions[i];
      }
    }
    return null;
  }

  function clearPendingValidationTimers() {
    while (state.pendingValidationTimers.length > 0) {
      clearTimeout(state.pendingValidationTimers.pop());
    }
  }

  function updateStatusText() {
    if (!refs.statusText) {
      return;
    }
    refs.statusText.setAttribute('value', state.statusMessage || '');
    refs.statusText.setAttribute('color', state.statusLevel === 'error' ? '#fca5a5' : '#fde68a');
    refs.statusText.setAttribute('visible', !!state.statusMessage);
  }

  function clearStatusTimer() {
    if (state.statusClearTimer) {
      clearTimeout(state.statusClearTimer);
      state.statusClearTimer = null;
    }
  }

  function setStatusMessage(message, level, ttlMs) {
    state.statusMessage = message || '';
    state.statusLevel = level || 'warning';
    updateStatusText();
    clearStatusTimer();
    if (state.statusMessage && ttlMs !== 0) {
      state.statusClearTimer = setTimeout(function () {
        state.statusClearTimer = null;
        state.statusMessage = '';
        updateStatusText();
      }, typeof ttlMs === 'number' ? ttlMs : 3200);
    }
  }

  function markInvalidOption(dimensionId, fieldName, reason) {
    if (!state.invalidOptionsByDimension[dimensionId]) {
      state.invalidOptionsByDimension[dimensionId] = {};
    }
    state.invalidOptionsByDimension[dimensionId][fieldName] = reason || 'This mapping is currently invalid.';
  }

  function clearInvalidOption(dimensionId, fieldName) {
    if (!state.invalidOptionsByDimension[dimensionId]) {
      return;
    }
    delete state.invalidOptionsByDimension[dimensionId][fieldName];
    if (Object.keys(state.invalidOptionsByDimension[dimensionId]).length === 0) {
      delete state.invalidOptionsByDimension[dimensionId];
    }
  }

  function getInvalidOptionReason(dimensionId, fieldName) {
    return state.invalidOptionsByDimension[dimensionId] && state.invalidOptionsByDimension[dimensionId][fieldName]
      ? state.invalidOptionsByDimension[dimensionId][fieldName]
      : '';
  }

  function applyMappingSnapshot(config, mappingSnapshot, reason) {
    var chartEntities = getChartEntities(config);
    var componentName = getChartComponentName(config);
    if (!chartEntities.length || !componentName || !mappingSnapshot) {
      return false;
    }

    applyMappingToCharts(chartEntities, componentName, mappingSnapshot);
    state.selectedByDimension = cloneMapping(mappingSnapshot);
    requestChartContainmentRenormalize(reason || 'mapping-ui-snapshot');
    return true;
  }

  function inspectChartStatus(config) {
    var chartTargets = buildChartValidationTargets(config);
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.getChartStatus !== 'function') {
      return { ready: true, valid: true, reason: 'containment-runtime-unavailable' };
    }
    var statuses = chartTargets.map(function (resolveChartTarget) {
      return analysisTableRuntime.getChartStatus(resolveChartTarget());
    });
    var pending = statuses.find(function (status) { return !status || status.ready === false; });
    if (pending) {
      return pending;
    }
    return statuses.find(function (status) { return status.valid === false; })
      || { ready: true, valid: true, reason: 'ok' };
  }

  function getSharedMappingEntityId(config) {
    var baseId = config && (config.chartEntityId || config.chartSelector || config.chartId)
        ? String(config.chartEntityId || config.chartSelector || config.chartId)
        : 'default-chart';
    return String(baseId).replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function buildSharedMappingState(config) {
    return {
      entityKind: SHARED_ENTITY_KIND,
      entityId: getSharedMappingEntityId(config),
      chartId: getActiveChartId(config),
      componentName: getChartComponentName(config) || '',
      selectedByDimension: cloneMapping(state.lastKnownGoodMapping || state.selectedByDimension)
    };
  }

  function publishSharedMappingState(config, eventType) {
    if (state.suppressSharedPublish) {
      return false;
    }
    var client = getCollaborationClient();
    if (!client || typeof client.sendEntityState !== 'function') {
      return false;
    }
    return client.sendEntityState(buildSharedMappingState(config), eventType || 'entity-updated');
  }

  function applySharedMappingState(config, snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.selectedByDimension) {
      return false;
    }

    state.suppressSharedPublish = true;
    try {
      clearPendingValidationTimers();
      state.pendingMapping = null;
      if (snapshot.chartId && snapshot.chartId !== getActiveChartId(config)) {
        selectChart(snapshot.chartId);
      }
      state.selectedByDimension = cloneMapping(snapshot.selectedByDimension);
      state.lastKnownGoodMapping = cloneMapping(snapshot.selectedByDimension);
      applyMappingSnapshot(config, snapshot.selectedByDimension, 'mapping-ui-room-sync');
      saveActiveMappingProfile();
      renderRows(config);
      notifyMappingConfirmed(state.lastKnownGoodMapping);
      return true;
    } finally {
      state.suppressSharedPublish = false;
    }
  }

  function publishInitialSharedMappingState(config) {
    return publishSharedMappingState(config, 'entity-added');
  }

  function registerSharedMappingEntity(config) {
    var client = getCollaborationClient();
    if (!client || typeof client.registerEntityRuntime !== 'function') {
      return;
    }

    client.registerEntityRuntime({
      entityKind: SHARED_ENTITY_KIND,
      entityId: getSharedMappingEntityId(config),
      applySharedState: function (snapshot) {
        applySharedMappingState(config, snapshot);
      },
      publishInitialSharedState: function () {
        publishInitialSharedMappingState(config);
      }
    });
  }

  function notifyMappingConfirmed(mapping) {
    var document = getDoc();
    if (!document || typeof document.dispatchEvent !== 'function') {
      return;
    }
    var detail = {
      selectedByDimension: cloneMapping(mapping || {}),
      chartId: getActiveChartId(getConfig()),
      mappingContextId: state.activeMappingContextId
    };
    if (typeof root.CustomEvent === 'function') {
      document.dispatchEvent(new root.CustomEvent('codexr-mapping-confirmed', { detail: detail }));
      return;
    }
    document.dispatchEvent({
      type: 'codexr-mapping-confirmed',
      detail: detail
    });
  }

  function confirmPendingMapping(config, token) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }
    clearInvalidOption(state.pendingMapping.dimensionId, state.pendingMapping.fieldName);
    state.lastKnownGoodMapping = cloneMapping(state.pendingMapping.nextMapping);
    state.pendingMapping = null;
    clearPendingValidationTimers();
    saveActiveMappingProfile();
    resizeTrace('mapping-confirmed', {
      token: token,
      selectedByDimension: state.lastKnownGoodMapping
    });
    publishSharedMappingState(config);
    notifyMappingConfirmed(state.lastKnownGoodMapping);
  }

  function revertPendingMapping(config, token, reason) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }
    var friendlyMessage = buildFriendlyInvalidMappingMessage(
      config,
      state.pendingMapping.dimensionId,
      state.pendingMapping.fieldName,
      reason,
      true
    );
    markInvalidOption(state.pendingMapping.dimensionId, state.pendingMapping.fieldName, friendlyMessage);
    applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-revert');
    setStatusMessage(friendlyMessage, 'error', 4800);
    resizeTrace('mapping-reverted-invalid-babia-frame', {
      token: token,
      reason: reason || 'invalid-chart-state'
    });
    state.pendingMapping = null;
    clearPendingValidationTimers();
    renderRows(config);
  }

  function evaluatePendingMapping(config, token, result) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }

    if (result && result.valid && result.stabilized) {
      confirmPendingMapping(config, token);
      renderRows(config);
      return;
    }

    if (result && result.valid && !result.stabilized) {
      applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-unstable-revert');
      state.pendingMapping = null;
      clearPendingValidationTimers();
      scheduleContainmentValidationBursts('mapping-ui-revert');
      setStatusMessage(
        'The chart did not stabilize inside the table after changing this metric. CodeXR restored the previous mapping.',
        'error',
        4800
      );
      resizeTrace('mapping-reverted-unstable-containment', {
        token: token,
        reason: result.reason || result.state || 'not-stabilized'
      });
      renderRows(config);
      return;
    }

    if (result && result.state === 'invalid') {
      var invalidStatus = (result.statuses || []).find(function (status) {
        return status && status.valid === false && status.ready === true;
      });
      revertPendingMapping(
        config,
        token,
        invalidStatus?.message || 'The selected mapping produced invalid chart geometry.'
      );
      return;
    }

    applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-timeout-revert');
    state.pendingMapping = null;
    clearPendingValidationTimers();
    scheduleContainmentValidationBursts('mapping-ui-timeout-revert');
    setStatusMessage(
      'The chart did not finish rebuilding. CodeXR restored the previous mapping; you can try this field again.',
      'error',
      4800
    );
    renderRows(config);
  }

  function schedulePendingMappingValidation(config, token) {
    clearPendingValidationTimers();
    var runtime = root.CodeXRAnalysisTableRuntime;
    var chartTargets = buildChartValidationTargets(config);
    requestChartContainmentRenormalize('mapping-ui-validation-start');
    scheduleContainmentValidationBursts('mapping-ui-validation');
    if (!runtime || typeof runtime.waitForChartsStable !== 'function') {
      var timer = setTimeout(function () {
        var status = inspectChartStatus(config);
        evaluatePendingMapping(config, token, {
          state: status && status.valid ? 'stabilized' : 'invalid',
          valid: !!(status && status.valid),
          stabilized: !!(status && status.valid),
          statuses: status ? [status] : []
        });
      }, 1200);
      state.pendingValidationTimers.push(timer);
      return;
    }

    runtime.waitForChartsStable(chartTargets, {
      timeoutMs: 26000,
      pollMs: 120,
      stablePasses: 2
    }).then(function (result) {
      evaluatePendingMapping(config, token, result);
    });
  }

  function scheduleContainmentValidationBursts(reason) {
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.renormalizeAll !== 'function') {
      return;
    }
    [650, 1300, 2200, 3600, 5200, 7600, 10500, 14000, 18000].forEach(function (delayMs, index) {
      var timer = setTimeout(function () {
        analysisTableRuntime.renormalizeAll((reason || 'mapping-ui-validation') + '-burst-' + (index + 1));
      }, delayMs);
      state.pendingValidationTimers.push(timer);
    });
  }

  function resizeTrace(label, payload) {
    if (payload !== undefined) {
      console.log('[Re-size] ' + label, payload);
      return;
    }
    console.log('[Re-size] ' + label);
  }

  function requestChartContainmentRenormalize(reason) {
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.renormalizeAll !== 'function') {
      return;
    }

    var nextFrame = root.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    nextFrame(function () {
      analysisTableRuntime.renormalizeAll(reason || 'mapping-ui-change');
    });

    if (state.delayedRenormalizeTimer) {
      clearTimeout(state.delayedRenormalizeTimer);
    }
    state.delayedRenormalizeTimer = setTimeout(function () {
      state.delayedRenormalizeTimer = null;
      analysisTableRuntime.renormalizeAll((reason || 'mapping-ui-change') + '-settled');
    }, 300);
  }

  function applyDimensionSelection(config, dimensionId, fieldName, options) {
    var chartEntities = getChartEntities(config);
    var componentName = getChartComponentName(config);
    var alreadySelected = state.selectedByDimension[dimensionId] === fieldName;
    var forceSelection = !!(options && options.force === true);
    var invalidOptionReason = getInvalidOptionReason(dimensionId, fieldName);

    if (!chartEntities.length || !componentName) {
      return false;
    }

    if (alreadySelected && !forceSelection) {
      return false;
    }

    if (invalidOptionReason && !forceSelection) {
      setStatusMessage(invalidOptionReason, 'error', 3600);
      resizeTrace('mapping-selection-blocked', {
        chartId: config && config.chartId,
        dimensionId: dimensionId,
        fieldName: fieldName,
        reason: invalidOptionReason,
        phase: 'disabled-option'
      });
      return false;
    }

    var previousMapping = cloneMapping(state.selectedByDimension);
    var nextMapping = cloneMapping(previousMapping);
    nextMapping[dimensionId] = fieldName;

    applyMappingToCharts(chartEntities, componentName, nextMapping);

    state.selectedByDimension = cloneMapping(nextMapping);
    clearStatusTimer();

    if (!options || options.trackPending !== false) {
      clearPendingValidationTimers();
      state.pendingMappingToken += 1;
      state.pendingMapping = {
        token: state.pendingMappingToken,
        dimensionId: dimensionId,
        fieldName: fieldName,
        previousMapping: previousMapping,
        nextMapping: nextMapping
      };
      schedulePendingMappingValidation(config, state.pendingMappingToken);
    } else {
      clearInvalidOption(dimensionId, fieldName);
      state.lastKnownGoodMapping = cloneMapping(nextMapping);
      saveActiveMappingProfile();
      state.pendingMapping = null;
    }

    if (!options || options.renormalize !== false) {
      requestChartContainmentRenormalize('mapping-ui-change');
    }

    return true;
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
    syncPanelInteractions();
    syncToggleLabel(config);
  }

  function setEntityInteractionEnabled(entity, enabled) {
    if (!entity) {
      return;
    }
    var controls = [entity].concat(
      entity.querySelectorAll
        ? Array.prototype.slice.call(entity.querySelectorAll('[data-codexr-interactive="true"]'))
        : []
    );
    controls.forEach(function (control) {
      if (!control || !control.classList) {
        return;
      }
      if (enabled) {
        control.classList.add('babiaxraycasterclass');
      } else {
        control.classList.remove('babiaxraycasterclass');
      }
    });
  }

  function syncPanelViewInteraction(viewId) {
    var view = state.panelViews[viewId];
    if (!view || !view.content) {
      return;
    }
    setEntityInteractionEnabled(view.content, state.visible && state.activePanelView === viewId);
  }

  function syncPanelInteractions() {
    if (refs.rowsRoot) {
      setEntityInteractionEnabled(refs.rowsRoot, state.visible && state.activePanelView === 'mapping');
    }
    if (refs.chartRoot) {
      setEntityInteractionEnabled(refs.chartRoot, state.visible && state.activePanelView === 'mapping');
    }
    Object.keys(state.panelViews).forEach(syncPanelViewInteraction);
  }

  function applyPanelHeight(panelHeight) {
    var height = Math.max(2.45, Number(panelHeight) || 2.45);
    if (refs.panelBackground) {
      refs.panelBackground.setAttribute('height', height);
    }
    if (refs.panelBorder) {
      refs.panelBorder.setAttribute('height', height + 0.05);
    }
    if (refs.panelTitleBackdrop) {
      refs.panelTitleBackdrop.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.02');
    }
    if (refs.panelTitle) {
      refs.panelTitle.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.03');
    }
    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('position', '-0.05 ' + (height * 0.45 - PANEL_LAYOUT.rowsRootHeightOffset) + ' 0.02');
    }
    if (refs.chartRoot) {
      refs.chartRoot.setAttribute('position', '-0.05 ' + (height * 0.45 - PANEL_LAYOUT.chartRootHeightOffset) + ' 0.03');
    }
    if (refs.statusText) {
      refs.statusText.setAttribute('position', '-2.85 ' + (-height * 0.5 + 0.36) + ' 0.03');
    }
    if (refs.toggle) {
      refs.toggle.setAttribute('position', '2.95 ' + (height * 0.5 + 0.17) + ' 0.04');
    }
    Object.keys(state.panelViews).map(function (viewId) {
      return state.panelViews[viewId];
    }).filter(function (view) {
      return !!view.button;
    }).forEach(function (view, index) {
      view.button?.setAttribute(
        'position',
        (2.53 - (index * 0.42)) + ' ' + (height * 0.5 + 0.17) + ' 0.04'
      );
    });
  }

  function syncPanelViewButtons() {
    Object.keys(state.panelViews).forEach(function (viewId) {
      var view = state.panelViews[viewId];
      var active = state.activePanelView === viewId;
      view.button?.setAttribute('material', {
        color: active ? '#be123c' : '#0e7490',
        opacity: 0.98,
        shader: 'flat',
        transparent: true
      });
      view.button?.setAttribute('text', {
        value: view.buttonLabel,
        align: 'center',
        color: '#ffffff',
        width: 1,
        baseline: 'center',
        anchor: 'center'
      });
    });
  }

  function showPanelView(viewId) {
    var targetView = viewId && viewId !== 'mapping' ? state.panelViews[viewId] : null;
    var nextViewId = targetView ? viewId : 'mapping';
    if (CONTROLLER_VIEW_BY_PANEL[nextViewId]) {
      state.activeControllerView = CONTROLLER_VIEW_BY_PANEL[nextViewId];
    }
    root.console?.log?.('[CodeXR.Debug]: Mapping panel view requested', {
      requested: viewId || 'mapping',
      resolved: nextViewId,
      previous: state.activePanelView
    });
    var previousView = state.panelViews[state.activePanelView];
    if (previousView && previousView.id !== nextViewId) {
      previousView.content.setAttribute('visible', false);
      previousView.onHide?.();
    }

    state.activePanelView = nextViewId;
    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('visible', nextViewId === 'mapping');
    }
    if (refs.chartRoot) {
      refs.chartRoot.setAttribute('visible', nextViewId === 'mapping');
    }
    if (refs.statusText) {
      refs.statusText.setAttribute('visible', nextViewId === 'mapping' && !!state.statusMessage);
    }

    if (nextViewId === 'mapping') {
      if (refs.panelTitle) {
        refs.panelTitle.setAttribute('value', 'CodeXR Field Mapping');
      }
      Object.keys(state.panelViews).forEach(function (registeredViewId) {
        state.panelViews[registeredViewId].content.setAttribute('visible', false);
      });
      applyPanelHeight(state.mappingPanelHeight);
    } else {
      targetView.content.setAttribute('visible', true);
      if (refs.panelTitle) {
        refs.panelTitle.setAttribute('value', targetView.title);
      }
      applyPanelHeight(targetView.panelHeight);
      targetView.onShow?.();
    }

    syncPanelInteractions();
    setVisible(getConfig() || {}, true);
    syncPanelViewButtons();
    return nextViewId;
  }

  function normalizeControllerView(viewId) {
    var requested = String(viewId || 'single.mapping');
    return CONTROLLER_PANEL_BY_VIEW[requested] ? requested : 'single.mapping';
  }

  function inferModeFromControllerView(viewId) {
    if (viewId === 'visualization-menu') {
      return 'selection';
    }
    if (viewId.indexOf('dependency.') === 0) {
      return 'dependency-graph';
    }
    if (viewId.indexOf('historical.') === 0) {
      return 'historical-compare';
    }
    if (viewId.indexOf('project-evolution') === 0) {
      return 'project-evolution';
    }
    return 'single';
  }

  function showControllerView(viewId, context) {
    var nextViewId = normalizeControllerView(viewId);
    state.activeControllerView = nextViewId;
    state.mode = String(context.mode || inferModeFromControllerView(nextViewId));
    var panelId = CONTROLLER_PANEL_BY_VIEW[nextViewId] || 'mapping';
    if (context.mappingContextId) {
      switchMappingContext(context.mappingContextId, {
        reason: context.reason || ('controller-view-' + nextViewId)
      });
    }
    var resolvedPanel = showPanelView(panelId);
    state.activeControllerView = nextViewId;
    state.mode = String(context.mode || inferModeFromControllerView(nextViewId));
    return {
      mode: state.mode,
      controllerView: nextViewId,
      panelView: resolvedPanel
    };
  }

  function getModeMemory(mode) {
    var key = String(mode || state.mode || 'single');
    return Object.assign({}, state.modeMemory[key] || {});
  }

  function saveModeMemory(mode, patch) {
    var key = String(mode || state.mode || 'single');
    var previous = state.modeMemory[key] || {};
    state.modeMemory[key] = Object.assign({}, previous, patch || {});
    return getModeMemory(key);
  }

  function registerPanelView(options) {
    if (!refs.panel || !refs.panelContent) {
      return null;
    }
    if (!options || !options.id || !options.content) {
      return function () {};
    }
    var viewId = String(options.id);
    var existing = state.panelViews[viewId];
    if (existing) {
      state.panelViewObservers[viewId]?.disconnect?.();
      delete state.panelViewObservers[viewId];
      existing.button?.remove();
      existing.content?.remove();
    }

    var content = options.content;
    content.setAttribute('visible', false);
    setEntityInteractionEnabled(content, false);
    refs.panelContent.appendChild(content);
    var observer = null;
    if (typeof root.MutationObserver === 'function') {
      observer = new root.MutationObserver(function () {
        syncPanelViewInteraction(viewId);
      });
      observer.observe(content, { childList: true, subtree: true });
      state.panelViewObservers[viewId] = observer;
    }
    var button = null;
    if (options.headerButton === true) {
      button = createEntity('a-plane', {
        id: 'codexrMappingUiView-' + viewId,
        class: 'babiaxraycasterclass codexr-mapping-ui-view-toggle',
        'data-codexr-interactive': 'true',
        width: 0.34,
        height: 0.34
      });
      refs.panel.appendChild(button);
    }

    state.panelViews[viewId] = {
      id: viewId,
      title: String(options.title || viewId),
      buttonLabel: String(options.buttonLabel || 'V').slice(0, 1).toUpperCase(),
      panelHeight: Math.max(2.45, Number(options.panelHeight) || 2.45),
      content: content,
      button: button,
      onShow: typeof options.onShow === 'function' ? options.onShow : null,
      onHide: typeof options.onHide === 'function' ? options.onHide : null,
      onToggleActive: typeof options.onToggleActive === 'function'
        ? options.onToggleActive
        : null
    };
    button?.addEventListener('click', function () {
      root.console?.log?.('[CodeXR.Debug]: Mapping panel header button clicked', {
        viewId: viewId,
        activePanelView: state.activePanelView
      });
      if (state.activePanelView === viewId && state.panelViews[viewId]?.onToggleActive) {
        state.panelViews[viewId].onToggleActive();
        return;
      }
      showPanelView(viewId);
    });
    applyPanelHeight(state.activePanelView === 'mapping'
      ? state.mappingPanelHeight
      : state.panelViews[state.activePanelView]?.panelHeight);
    syncPanelViewButtons();

    return function () {
      var view = state.panelViews[viewId];
      if (!view) {
        return;
      }
      if (state.activePanelView === viewId) {
        showPanelView('mapping');
      }
      state.panelViewObservers[viewId]?.disconnect?.();
      delete state.panelViewObservers[viewId];
      view.button?.remove();
      view.content?.remove();
      delete state.panelViews[viewId];
      applyPanelHeight(state.mappingPanelHeight);
    };
  }

  function setPanelViewTitle(viewId, title) {
    var view = state.panelViews[String(viewId || '')];
    if (!view) {
      return false;
    }
    view.title = String(title || view.title);
    if (state.activePanelView === view.id && refs.panelTitle) {
      refs.panelTitle.setAttribute('value', view.title);
    }
    return true;
  }

  function setPanelViewHeight(viewId, panelHeight) {
    var view = state.panelViews[String(viewId || '')];
    if (!view) {
      return false;
    }
    view.panelHeight = Math.max(2.45, Number(panelHeight) || view.panelHeight);
    if (state.activePanelView === view.id) {
      applyPanelHeight(view.panelHeight);
    }
    return true;
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
        width: PANEL_LAYOUT.labelWidth,
        position: PANEL_LAYOUT.left + ' ' + (cursorY - 0.05) + ' 0.02'
      });
      refs.rowsRoot.appendChild(label);
      cursorY -= PANEL_LAYOUT.labelToButtonsGap;

      var cols = pickColumns(fields.length);
      var buttonWidth = getGridButtonWidth(cols);

      fields.forEach(function (fieldName, fieldIndex) {
        var rowIndex = Math.floor(fieldIndex / cols);
        var colIndex = fieldIndex % cols;
        var isActive = state.selectedByDimension[dimension.id] === fieldName;
        var invalidReason = getInvalidOptionReason(dimension.id, fieldName);
        var isDisabled = !!invalidReason && !isActive;

        var x = getGridButtonX(colIndex, buttonWidth);
        var y = cursorY - rowIndex * PANEL_LAYOUT.rowGap;

        var button = createEntity('a-plane', {
          class: 'babiaxraycasterclass codexr-mapping-ui-option',
          'data-codexr-interactive': 'true',
          color: isActive ? '#be123c' : (isDisabled ? '#334155' : '#1e3a5f'),
          width: buttonWidth,
          height: 0.22,
          opacity: isActive ? 0.98 : (isDisabled ? 0.55 : 0.92),
          position: x + ' ' + y + ' 0.01'
        });

        var text = createEntity('a-text', {
          value: compactLabel(fieldName),
          align: 'center',
          color: isDisabled ? '#cbd5e1' : '#ffffff',
          width: buttonWidth * 1.9,
          position: '0 0 0.01'
        });

        button.appendChild(text);
        button.addEventListener('click', function () {
          if (isDisabled) {
            setStatusMessage(invalidReason, 'error', 4000);
            return;
          }
          var changed = applyDimensionSelection(config, dimension.id, fieldName);
          if (changed) {
            renderRows(config);
          }
        });

        refs.rowsRoot.appendChild(button);
      });

      cursorY -= Math.ceil(fields.length / cols) * PANEL_LAYOUT.rowGap + PANEL_LAYOUT.sectionGap;
    });

    var panelHeight = Math.max(2.9, Math.abs(cursorY) + PANEL_LAYOUT.panelHeightPadding);
    state.mappingPanelHeight = panelHeight;
    if (state.activePanelView === 'mapping') {
      applyPanelHeight(panelHeight);
    }
    if (refs.statusText) {
      updateStatusText();
    }
  }

  function renderChartSelector(config) {
    if (!refs.chartRoot) {
      return;
    }
    clearEntity(refs.chartRoot);
    var charts = Array.isArray(config && config.availableCharts) ? config.availableCharts : [];
    if (!charts.length) {
      return;
    }
    refs.chartRoot.appendChild(createEntity('a-text', {
      value: 'Chart',
      align: 'left',
      color: '#cde7ff',
      width: PANEL_LAYOUT.labelWidth,
      position: PANEL_LAYOUT.left + ' 0.02 0.02'
    }));
    var visibleCharts = charts.slice(0, 9);
    var cols = Math.min(3, Math.max(1, visibleCharts.length));
    var buttonWidth = getGridButtonWidth(cols);
    visibleCharts.forEach(function (chart, index) {
      var rowIndex = Math.floor(index / cols);
      var colIndex = index % cols;
      var active = chart.id === getActiveChartId(config);
      var x = getGridButtonX(colIndex, buttonWidth);
      var y = -PANEL_LAYOUT.labelToButtonsGap - rowIndex * PANEL_LAYOUT.rowGap;
      var button = createEntity('a-plane', {
        class: 'babiaxraycasterclass codexr-mapping-ui-chart-option',
        'data-codexr-interactive': 'true',
        'data-codexr-chart-id': chart.id,
        color: active ? '#be123c' : '#0f3a5f',
        width: buttonWidth,
        height: 0.22,
        opacity: active ? 0.98 : 0.9,
        position: x + ' ' + y + ' 0.01'
      });
      button.appendChild(createEntity('a-text', {
        value: compactLabel(chart.name || chart.id),
        align: 'center',
        color: '#ffffff',
        width: buttonWidth * 1.8,
        position: '0 0 0.01'
      }));
      button.addEventListener('click', function () {
        selectChart(chart.id);
      });
      refs.chartRoot.appendChild(button);
    });
  }

  function selectChart(chartId) {
    var config = getConfig();
    if (!config || !chartId || chartId === getActiveChartId(config)) {
      return false;
    }
    var chart = (config.availableCharts || []).find(function (candidate) {
      return candidate && candidate.id === chartId;
    });
    if (!chart || !COMPONENT_BY_CHART[chartId]) {
      setStatusMessage('This chart is not available in the current XR scene.', 'error', 4200);
      return false;
    }

    saveActiveMappingProfile();
    var previousChartId = getActiveChartId(config);
    var previousDimensions = config.dimensions;
    var nextDimensions = getDimensionsForChart(config, chartId);
    var profileKey = getMappingProfileKey(state.activeMappingContextId, chartId);
    var nextSnapshot = state.mappingProfiles[profileKey] || {
      visible: state.visible,
      selectedByDimension: getDefaultMappingForChart(config, chartId),
      lastKnownGoodMapping: getDefaultMappingForChart(config, chartId),
      invalidOptionsByDimension: {}
    };

    if (!nextDimensions.length) {
      setStatusMessage('This chart has no compatible fields for the current analysis data.', 'error', 4200);
      return false;
    }

    if (!applyChartTypeToEntities(config, chartId, nextSnapshot.lastKnownGoodMapping || nextSnapshot.selectedByDimension)) {
      config.dimensions = previousDimensions;
      state.activeChartId = previousChartId;
      setStatusMessage('CodeXR could not switch chart; the previous chart was kept.', 'error', 4800);
      return false;
    }

    state.activeChartId = chartId;
    config.chartId = chartId;
    config.dimensions = nextDimensions;
    applyMappingRuntimeState(config, nextSnapshot, 'mapping-ui-chart-switch-' + chartId);
    renderChartSelector(config);
    renderRows(config);
    requestChartContainmentRenormalize('mapping-ui-chart-switch');
    scheduleContainmentValidationBursts('mapping-ui-chart-switch');
    setStatusMessage('Chart changed to ' + (chart.name || chartId) + '.', 'info', 2600);
    publishSharedMappingState(config);
    notifyMappingConfirmed(state.lastKnownGoodMapping);
    return true;
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

    if (config.hideOnEnterAr === true) {
      refs.panel.setAttribute('hide-on-enter-ar', '');
    } else {
      refs.panel.removeAttribute('hide-on-enter-ar');
    }

    refs.panelContent = createEntity('a-entity', {
      position: '0 0 0',
      visible: state.visible !== false
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
      position: '-0.05 -0.18 0.02'
    });

    refs.chartRoot = createEntity('a-entity', {
      position: '-0.05 0.9 0.03'
    });

    refs.statusText = createEntity('a-text', {
      value: '',
      align: 'left',
      color: '#fde68a',
      width: 5.9,
      position: '-2.85 -0.86 0.03',
      visible: false,
      'wrap-count': 30,
      baseline: 'top'
    });

    refs.panelContent.appendChild(refs.panelBackground);
    refs.panelContent.appendChild(refs.panelBorder);
    refs.panelContent.appendChild(refs.panelTitleBackdrop);
    refs.panelContent.appendChild(refs.panelTitle);
    refs.panelContent.appendChild(refs.chartRoot);
    refs.panelContent.appendChild(refs.rowsRoot);
    refs.panelContent.appendChild(refs.statusText);
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
    state.activeCornerId = null;
    syncToggleLabel(config);
    setVisible(config, state.visible);
    updateStatusText();
    renderChartSelector(config);
    renderRows(config);

    if (config.adaptiveCorner) {
      applyAdaptivePlacement(config);
      ensureAdaptivePlacementLoop();
    }
  }

  function hydrateStateFromConfig(config) {
    state.activeMappingContextId = state.activeMappingContextId || 'normal-analysis';
    state.activeChartId = state.activeChartId || (config && config.chartId) || null;
    var profileKey = getMappingProfileKey(state.activeMappingContextId, getActiveChartId(config));
    var snapshot = state.mappingProfiles[profileKey] || buildDefaultMappingSnapshot(config);
    applyMappingRuntimeState(config, snapshot, 'mapping-ui-hydrate');
  }

  function switchMappingContext(contextId, options) {
    var config = getConfig();
    if (!config) {
      return false;
    }
    var nextContextId = String(contextId || 'default');
    saveActiveMappingProfile();
    state.activeMappingContextId = nextContextId;
    var profileKey = getMappingProfileKey(nextContextId, getActiveChartId(config));
    var profile = state.mappingProfiles[profileKey] || buildDefaultMappingSnapshot(config);
    applyMappingRuntimeState(config, profile, (options && options.reason) || ('mapping-ui-context-' + nextContextId));
    return getState();
  }

  function getState() {
    return {
      visible: state.visible,
      mode: state.mode,
      controllerView: state.activeControllerView,
      mappingContextId: state.activeMappingContextId,
      chartId: getActiveChartId(getConfig()),
      selectedByDimension: Object.assign({}, state.selectedByDimension),
      lastKnownGoodMapping: Object.assign({}, state.lastKnownGoodMapping),
      invalidOptionsByDimension: cloneInvalidOptions(state.invalidOptionsByDimension || {})
    };
  }

  function restoreState(runtimeState) {
    var config = getConfig();
    if (!config || !runtimeState || typeof runtimeState !== 'object' || Array.isArray(runtimeState)) {
      console.warn('[CodeXR][MappingUI] Invalid state snapshot; restore skipped.');
      return false;
    }

    return applyMappingRuntimeState(config, runtimeState, 'mapping-ui-restore');
  }

  function autoInit() {
    var config = getConfig();
    if (!config || state.initialized) {
      return;
    }

    state.initialized = true;

    hydrateStateFromConfig(config);
    buildUi(config);
    registerSharedMappingEntity(config);
  }

  var runtime = {
    autoInit: autoInit,
    getState: getState,
    restoreState: restoreState,
    selectChart: selectChart,
    switchMappingContext: switchMappingContext,
    showView: showControllerView,
    getModeMemory: getModeMemory,
    saveModeMemory: saveModeMemory,
    getControllerState: function () {
      return {
        mode: state.mode,
        controllerView: state.activeControllerView,
        panelView: state.activePanelView
      };
    },
    getMappingContext: function () {
      return state.activeMappingContextId;
    },
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
    },
    registerPanelView: registerPanelView,
    showPanelView: showPanelView,
    setPanelViewTitle: setPanelViewTitle,
    setPanelViewHeight: setPanelViewHeight,
    getActivePanelView: function () {
      return state.activePanelView;
    },
    isPanelReady: function () {
      return !!(refs.panel && refs.panelContent);
    },
    setChartEntityIds: function (chartEntityIds) {
      state.chartEntityIdsOverride = Array.isArray(chartEntityIds)
        ? chartEntityIds.filter(Boolean).map(String)
        : null;
      requestChartContainmentRenormalize('mapping-ui-targets-changed');
      return state.chartEntityIdsOverride ? state.chartEntityIdsOverride.slice() : [];
    },
    __testing: {
      getInvalidOptionReason: getInvalidOptionReason,
      buildChartComponentUpdate: buildChartComponentUpdate,
      buildRuntimeChartData: buildRuntimeChartData,
      applyChartTypeToEntity: applyChartTypeToEntity,
      applyChartTypeToEntities: applyChartTypeToEntities,
      isHierarchicalChart: isHierarchicalChart,
      clearChartGeneratedChildren: clearChartGeneratedChildren,
      applyChartDefaultTransform: applyChartDefaultTransform,
      getMappingProfileKey: getMappingProfileKey,
      PANEL_LAYOUT: PANEL_LAYOUT,
      getGridButtonWidth: getGridButtonWidth,
      getGridButtonX: getGridButtonX
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
  root.CodeXRAnalysisControllerRuntime = runtime;
  return runtime;
});
