(function registerCodeXRAnalysisTableComponents(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  var COMPONENT_NAME = 'codexr-chart-containment';
  var TABLE_COMPONENT_NAME = 'codexr-analysis-table';
  var RUNTIME_GLOBAL_NAME = 'CodeXRAnalysisTableRuntime';
  var DEBUG_GLOBAL_NAME = 'CodeXRChartDebugBands';
  if (!AFRAME || !AFRAME.registerComponent) {
    return;
  }
  var registerContainment = !AFRAME.components[COMPONENT_NAME];
  var registerTable = !AFRAME.components[TABLE_COMPONENT_NAME];
  if (!registerContainment && !registerTable) {
    return;
  }

  var DEFAULTS = {
    targetWidth: 5.614,
    targetHeight: 1.8,
    targetDepth: 3.218,
    anchorX: 0,
    anchorY: 1,
    anchorZ: -18,
    revealOffsetY: 0.03,
    tableTopSurfaceOffsetY: -0.08,
    tabletopAnchorEpsilon: 0.004,
    tabletopAnchorDeadbandY: 0.015,
    retries: 45,
    retryDelayMs: 90,
    tableTopPadding: 0.9,
    bootstrapPlanarMaxRatio: 0.84,
    minPlanarOccupancyRatio: 0.78,
    maxPlanarOccupancyRatio: 0.92,
    minHeightOccupancyRatio: 0.45,
    heightBandMinRatio: 0.38,
    heightBandMaxRatio: 0.72,
    tableEdgeMargin: 0.18,
    buildingHeightBandEnabled: false,
    yScaleMin: 0.01,
    yScaleMax: 12,
    containmentToleranceRatio: 0.018,
    containmentDamping: 0.985,
    containmentMaxIterations: 8,
    containmentCheckMs: 700,
    periodicContainmentEnabled: true,
    renormalizeDebounceMs: 280,
    stabilizationCheckMs: 140,
    stabilizationMaxChecks: 14,
    stabilizationStablePasses: 3,
    transformTransitionMs: 650,
    hardHeightGuardEnabled: true,
    heightUnderflowCorrectionEnabled: true,
    planarUnderflowCorrectionEnabled: true
  };

  var MODE_THEME_BY_ID = {
    selection: {
      top: 'color: #f8fafc; metalness: 0.04; roughness: 0.86',
      trim: 'color: #cbd5e1; metalness: 0.16; roughness: 0.48',
      base: 'color: #64748b; metalness: 0.2; roughness: 0.68'
    },
    single: {
      top: 'color: #0e7490; metalness: 0.12; roughness: 0.72',
      trim: 'color: #67e8f9; metalness: 0.28; roughness: 0.42',
      base: 'color: #164e63; metalness: 0.24; roughness: 0.66'
    },
    'historical-compare': {
      top: 'color: #be123c; metalness: 0.16; roughness: 0.7',
      trim: 'color: #fb7185; metalness: 0.28; roughness: 0.42',
      base: 'color: #881337; metalness: 0.26; roughness: 0.66'
    },
    'dependency-graph': {
      top: 'color: #7c3aed; metalness: 0.18; roughness: 0.68',
      trim: 'color: #c4b5fd; metalness: 0.3; roughness: 0.38',
      base: 'color: #4c1d95; metalness: 0.3; roughness: 0.62'
    },
    'project-evolution': {
      top: 'color: #f59e0b; metalness: 0.14; roughness: 0.72',
      trim: 'color: #fde68a; metalness: 0.28; roughness: 0.42',
      base: 'color: #92400e; metalness: 0.26; roughness: 0.64'
    }
  };

  var DEBUG_STATE = {
    enabled: false
  };
  var TABLE_DIAGNOSTIC_STATE = {
    key: '',
    firstSeenAt: 0
  };
  var TABLE_WARNING_PERSISTENCE_MS = 2600;

  var FULL_TABLE_ZONE = {
    id: 'single',
    anchorX: DEFAULTS.anchorX,
    anchorZ: DEFAULTS.anchorZ,
    width: DEFAULTS.targetWidth,
    depth: DEFAULTS.targetDepth
  };

  function getAnalysisTableZonesForMode(mode) {
    var fullWidth = DEFAULTS.targetWidth;
    var fullDepth = DEFAULTS.targetDepth;
    if (mode !== 'historical-compare') {
      return [Object.assign({}, FULL_TABLE_ZONE)];
    }
    var centerGap = 0.18;
    var zoneWidth = (fullWidth - centerGap) / 2;
    var centerOffset = (zoneWidth + centerGap) / 2;
    return [
      {
        id: 'left',
        anchorX: -centerOffset,
        anchorZ: DEFAULTS.anchorZ,
        width: zoneWidth,
        depth: fullDepth
      },
      {
        id: 'right',
        anchorX: centerOffset,
        anchorZ: DEFAULTS.anchorZ,
        width: zoneWidth,
        depth: fullDepth
      }
    ];
  }

  function baseContainmentProfileData(zone, overrides) {
    var sourceZone = zone || FULL_TABLE_ZONE;
    return Object.assign({
      enabled: true,
      anchorX: sourceZone.anchorX,
      anchorY: DEFAULTS.anchorY,
      anchorZ: sourceZone.anchorZ,
      tableTopPadding: DEFAULTS.tableTopPadding,
      targetWidth: sourceZone.width,
      targetHeight: DEFAULTS.targetHeight,
      targetDepth: sourceZone.depth,
      bootstrapPlanarMaxRatio: DEFAULTS.bootstrapPlanarMaxRatio,
      minPlanarOccupancyRatio: DEFAULTS.minPlanarOccupancyRatio,
      maxPlanarOccupancyRatio: DEFAULTS.maxPlanarOccupancyRatio,
      minHeightOccupancyRatio: DEFAULTS.minHeightOccupancyRatio,
      heightBandMinRatio: DEFAULTS.heightBandMinRatio,
      heightBandMaxRatio: DEFAULTS.heightBandMaxRatio,
      tableEdgeMargin: DEFAULTS.tableEdgeMargin,
      yScaleMin: DEFAULTS.yScaleMin,
      yScaleMax: DEFAULTS.yScaleMax,
      containmentToleranceRatio: DEFAULTS.containmentToleranceRatio,
      periodicContainmentEnabled: DEFAULTS.periodicContainmentEnabled,
      stabilizationCheckMs: DEFAULTS.stabilizationCheckMs,
      stabilizationMaxChecks: DEFAULTS.stabilizationMaxChecks,
      stabilizationStablePasses: DEFAULTS.stabilizationStablePasses,
      transformTransitionMs: DEFAULTS.transformTransitionMs,
      hardHeightGuardEnabled: DEFAULTS.hardHeightGuardEnabled,
      heightUnderflowCorrectionEnabled: DEFAULTS.heightUnderflowCorrectionEnabled,
      planarUnderflowCorrectionEnabled: DEFAULTS.planarUnderflowCorrectionEnabled
    }, overrides || {});
  }

  function profilePosition(data) {
    return {
      x: data.anchorX,
      y: data.anchorY,
      z: data.anchorZ
    };
  }

  function vectorToAttribute(value) {
    if (typeof value === 'string') {
      return value;
    }
    var source = value || {};
    return String(Number.isFinite(source.x) ? source.x : 0)
      + ' ' + String(Number.isFinite(source.y) ? source.y : 0)
      + ' ' + String(Number.isFinite(source.z) ? source.z : 0);
  }

  function clonePlainObject(value) {
    return Object.assign({}, value || {});
  }

  function createContainmentProfile(id, zone, overrides) {
    var containment = baseContainmentProfileData(zone, overrides);
    return {
      id: id || 'default',
      zone: Object.assign({}, zone || FULL_TABLE_ZONE),
      position: profilePosition(containment),
      containment: containment
    };
  }

  function resolveContainmentProfile(profileOrMode, zone) {
    if (profileOrMode && typeof profileOrMode === 'object') {
      var objectContainment = clonePlainObject(profileOrMode.containment || profileOrMode);
      return {
        id: profileOrMode.id || 'custom',
        zone: profileOrMode.zone ? Object.assign({}, profileOrMode.zone) : null,
        position: profileOrMode.position || profilePosition(objectContainment),
        containment: objectContainment
      };
    }

    var profileId = String(profileOrMode || 'default');
    if (profileId === 'single' || profileId === 'dependency-graph' || profileId === 'project-evolution') {
      return createContainmentProfile(profileId, FULL_TABLE_ZONE);
    }

    if (profileId === 'historical-left' || profileId === 'historical-right') {
      var historicalZones = getAnalysisTableZonesForMode('historical-compare');
      var historicalZone = profileId === 'historical-left' ? historicalZones[0] : historicalZones[1];
      return createContainmentProfile(profileId, historicalZone, {
        tableTopPadding: 0.14,
        tableEdgeMargin: 0.12,
        heightBandMinRatio: 0.34,
        heightBandMaxRatio: 0.68
      });
    }

    if (profileId === 'historical-compare') {
      var zoneId = typeof zone === 'string' ? zone : (zone && zone.id);
      return resolveContainmentProfile(zoneId === 'right' ? 'historical-right' : 'historical-left');
    }

    return createContainmentProfile('default', FULL_TABLE_ZONE);
  }

  var PID_PROFILE = {
    planar: {
      kp: 6.2,
      ki: 0.55,
      kd: 1.15,
      integralLimit: 1.4,
      maxVelocity: 1.3,
      epsilon: 0.0015
    },
    vertical: {
      kp: 5.4,
      ki: 0.45,
      kd: 0.95,
      integralLimit: 1.1,
      maxVelocity: 1.0,
      epsilon: 0.0015
    },
    stableTicks: 8,
    dtMin: 1 / 120,
    dtMax: 0.08
  };

  var CONTENT_AUXILIARY_TOKEN_PATTERN = /(legend|label|title|axis|tick|grid|mapping|debug|tooltip)/i;
  var CONTAINMENT_AUXILIARY_TOKEN_PATTERN = /(legend|label|title|mapping|debug|tooltip)/i;
  var TEXT_COMPONENT_KEYS = ['text', 'troika-text'];

  function toFixedNumber(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(3));
  }

  function toTransformNumber(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(6));
  }

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  function midpoint(minValue, maxValue) {
    return minValue + ((maxValue - minValue) / 2);
  }

  function isFiniteVector3Like(value) {
    return !!value
      && Number.isFinite(value.x)
      && Number.isFinite(value.y)
      && Number.isFinite(value.z);
  }

  function isFiniteBoundsInfo(boundsInfo) {
    return !!boundsInfo
      && !!boundsInfo.bounds
      && !!boundsInfo.bounds.min
      && !!boundsInfo.bounds.max
      && isFiniteVector3Like(boundsInfo.size)
      && isFiniteVector3Like(boundsInfo.center)
      && isFiniteVector3Like(boundsInfo.bounds.min)
      && isFiniteVector3Like(boundsInfo.bounds.max);
  }

  function hasPositiveSize(size) {
    return !!size
      && Number.isFinite(size.x)
      && Number.isFinite(size.y)
      && Number.isFinite(size.z)
      && size.x > 0
      && size.y > 0
      && size.z > 0;
  }

  function hasUsableMeasurements(measurements) {
    return !!measurements
      && isFiniteBoundsInfo(measurements.primary)
      && isFiniteBoundsInfo(measurements.containment)
      && isFiniteBoundsInfo(measurements.full)
      && hasPositiveSize(measurements.primary.size);
  }

  function isChartAnimationActive(chartEl) {
    if (!chartEl || !chartEl.components) {
      return false;
    }
    var boats = chartEl.components['codexr-boats'];
    return !!(boats && boats.animationState && boats.animationState.active);
  }

  function cloneScale(object3D) {
    return {
      x: object3D.scale.x,
      y: object3D.scale.y,
      z: object3D.scale.z
    };
  }

  function cloneTransform(object3D) {
    if (!object3D || !isFiniteVector3Like(object3D.position) || !isFiniteVector3Like(object3D.scale)) {
      return null;
    }

    return {
      position: {
        x: object3D.position.x,
        y: object3D.position.y,
        z: object3D.position.z
      },
      scale: {
        x: object3D.scale.x,
        y: object3D.scale.y,
        z: object3D.scale.z
      },
      visible: object3D.visible !== false
    };
  }

  function formatVector3Like(value) {
    return toTransformNumber(value.x) + ' ' + toTransformNumber(value.y) + ' ' + toTransformNumber(value.z);
  }

  function transformsDiffer(a, b) {
    if (!a || !b || !isFiniteVector3Like(a.position) || !isFiniteVector3Like(a.scale) || !isFiniteVector3Like(b.position) || !isFiniteVector3Like(b.scale)) {
      return false;
    }
    return Math.abs(a.position.x - b.position.x) > 0.0005
      || Math.abs(a.position.y - b.position.y) > 0.0005
      || Math.abs(a.position.z - b.position.z) > 0.0005
      || Math.abs(a.scale.x - b.scale.x) > 0.0005
      || Math.abs(a.scale.y - b.scale.y) > 0.0005
      || Math.abs(a.scale.z - b.scale.z) > 0.0005;
  }

  function restoreTransform(object3D, snapshot) {
    if (!object3D || !snapshot || !isFiniteVector3Like(snapshot.position) || !isFiniteVector3Like(snapshot.scale)) {
      return false;
    }

    object3D.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    object3D.scale.set(snapshot.scale.x, snapshot.scale.y, snapshot.scale.z);
    object3D.visible = snapshot.visible !== false;
    object3D.updateMatrixWorld(true);
    return true;
  }

  function resolvePlanarScale(scaleLike) {
    if (!scaleLike) {
      return 1;
    }
    var planar = Math.max(scaleLike.x, scaleLike.z);
    if (!Number.isFinite(planar) || planar <= 0) {
      return 1;
    }
    return planar;
  }

  function buildBounds(three, object3D) {
    var bounds = new three.Box3();
    var size = new three.Vector3();
    var center = new three.Vector3();
    bounds.setFromObject(object3D);
    bounds.getSize(size);
    bounds.getCenter(center);
    if (!isFiniteVector3Like(size) || !isFiniteVector3Like(center) || !isFiniteVector3Like(bounds.min) || !isFiniteVector3Like(bounds.max)) {
      return null;
    }
    return {
      bounds: bounds,
      size: size,
      center: center
    };
  }

  function debugLog() {
    if (!DEBUG_STATE.enabled) {
      return;
    }
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[CodeXR][AnalysisTable]');
    console.log.apply(console, args);
  }

  function debugTable(label, payload) {
    if (!DEBUG_STATE.enabled || typeof console.table !== 'function') {
      return;
    }
    console.log('[CodeXR][AnalysisTable] ' + label);
    console.table(payload);
  }

  function resizeTrace(label, payload) {
    if (!DEBUG_STATE.enabled) {
      return;
    }
    if (payload !== undefined) {
      console.log('[Re-size] ' + label, payload);
      return;
    }
    console.log('[Re-size] ' + label);
  }

  function collectNonFiniteValueIssues(value, path, issues, depth) {
    var targetIssues = issues || [];
    if (targetIssues.length >= 8 || depth > 4 || value === null || value === undefined) {
      return targetIssues;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        targetIssues.push({
          path: path || 'value',
          value: String(value)
        });
      }
      return targetIssues;
    }

    if (typeof value === 'string') {
      if (/infinity|nan/i.test(value)) {
        targetIssues.push({
          path: path || 'value',
          value: value
        });
      }
      return targetIssues;
    }

    if (Array.isArray(value)) {
      value.slice(0, 12).forEach(function (item, index) {
        collectNonFiniteValueIssues(item, (path || 'value') + '[' + index + ']', targetIssues, depth + 1);
      });
      return targetIssues;
    }

    if (typeof value === 'object') {
      Object.keys(value).slice(0, 16).forEach(function (key) {
        collectNonFiniteValueIssues(value[key], (path ? path + '.' : '') + key, targetIssues, depth + 1);
      });
    }

    return targetIssues;
  }

  function inspectAxisAttributeValue(axisEl, attrName) {
    if (!axisEl || !attrName) {
      return null;
    }

    var attrValue = axisEl.getAttribute ? axisEl.getAttribute(attrName) : null;
    var issues = collectNonFiniteValueIssues(attrValue, attrName, [], 0);
    if ((!issues || issues.length === 0) && axisEl.components && axisEl.components[attrName]) {
      issues = collectNonFiniteValueIssues(axisEl.components[attrName].data, attrName + '.data', [], 0);
    }

    if (!issues || issues.length === 0) {
      return null;
    }

    return {
      reason: 'invalid-axis-length',
      attribute: attrName,
      elementId: axisEl.id || '',
      issues: issues
    };
  }

  function inspectInvalidAxisState(chartEl) {
    if (!chartEl || !chartEl.querySelectorAll) {
      return null;
    }

    var axisSelectors = ['babia-axis-x', 'babia-axis-y', 'babia-axis-z'];
    for (var selectorIndex = 0; selectorIndex < axisSelectors.length; selectorIndex += 1) {
      var attrName = axisSelectors[selectorIndex];
      var matches = chartEl.querySelectorAll('[' + attrName + ']');
      for (var matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
        var issue = inspectAxisAttributeValue(matches[matchIndex], attrName);
        if (issue) {
          return issue;
        }
      }
    }

    return null;
  }

  function findOwningEntity(node) {
    var current = node;
    while (current) {
      if (current.el) {
        return current.el;
      }
      current = current.parent;
    }
    return null;
  }

  function collectNodeMeta(node) {
    var ownerEntity = findOwningEntity(node);
    var classAttr = ownerEntity && ownerEntity.getAttribute ? ownerEntity.getAttribute('class') : '';
    var attributeNames = ownerEntity && ownerEntity.getAttributeNames ? ownerEntity.getAttributeNames() : [];

    return {
      id: ownerEntity && ownerEntity.id ? ownerEntity.id : '',
      className: typeof classAttr === 'string' ? classAttr : '',
      tagName: ownerEntity && ownerEntity.tagName ? ownerEntity.tagName : '',
      name: ownerEntity && ownerEntity.getAttribute ? (ownerEntity.getAttribute('data-name') || ownerEntity.getAttribute('name') || '') : '',
      dataName: ownerEntity && ownerEntity.getAttribute ? (ownerEntity.getAttribute('data-codexr-role') || '') : '',
      attributeNames: Array.isArray(attributeNames) ? attributeNames.join(' ') : '',
      nodeName: node && node.name ? String(node.name) : '',
      hasTextComponent: !!(ownerEntity && ownerEntity.hasAttribute && TEXT_COMPONENT_KEYS.some(function (key) {
        return ownerEntity.hasAttribute(key);
      }))
    };
  }

  function matchesAuxiliaryPattern(meta, pattern) {
    if (!meta) {
      return false;
    }

    var tagName = String(meta.tagName || '').toLowerCase();
    if (tagName === 'a-text') {
      return true;
    }

    if (meta.hasTextComponent) {
      return true;
    }

    if (/\bcodexr-boats-primary\b/.test(String(meta.className || ''))) {
      return false;
    }

    var combined = [
      meta.id || '',
      meta.className || '',
      meta.name || '',
      meta.dataName || '',
      meta.attributeNames || '',
      meta.nodeName || ''
    ].join(' ');

    return pattern.test(combined);
  }

  function matchesIgnoredBoundsMeta(meta) {
    return matchesAuxiliaryPattern(meta, CONTENT_AUXILIARY_TOKEN_PATTERN);
  }

  function matchesIgnoredContainmentBoundsMeta(meta) {
    return matchesAuxiliaryPattern(meta, CONTAINMENT_AUXILIARY_TOKEN_PATTERN);
  }

  function shouldIgnoreNodeForContentBounds(node) {
    if (!node) {
      return false;
    }
    return matchesIgnoredBoundsMeta(collectNodeMeta(node));
  }

  function shouldIgnoreNodeForContainmentBounds(node) {
    if (!node) {
      return false;
    }
    return matchesIgnoredContainmentBoundsMeta(collectNodeMeta(node));
  }

  function buildBoundsFromNodes(three, nodes) {
    if (!three || !three.Box3 || !three.Vector3 || !Array.isArray(nodes) || nodes.length === 0) {
      return null;
    }

    var aggregate = new three.Box3();
    var firstBounds = null;

    nodes.forEach(function (node) {
      if (!node || !node.geometry) {
        return;
      }

      if (!node.geometry.boundingBox && typeof node.geometry.computeBoundingBox === 'function') {
        node.geometry.computeBoundingBox();
      }

      if (!node.geometry.boundingBox || typeof node.geometry.boundingBox.clone !== 'function') {
        return;
      }

      var worldBounds = node.geometry.boundingBox.clone();
      if (typeof worldBounds.applyMatrix4 === 'function' && node.matrixWorld) {
        worldBounds.applyMatrix4(node.matrixWorld);
      }

      if (!isFiniteVector3Like(worldBounds.min) || !isFiniteVector3Like(worldBounds.max)) {
        return;
      }

      if (!firstBounds) {
        firstBounds = worldBounds;
        if (typeof aggregate.copy === 'function') {
          aggregate.copy(worldBounds);
        } else {
          aggregate.min.copy(worldBounds.min);
          aggregate.max.copy(worldBounds.max);
        }
      } else if (typeof aggregate.union === 'function') {
        aggregate.union(worldBounds);
      }
    });

    if (!firstBounds) {
      return null;
    }

    var size = new three.Vector3();
    var center = new three.Vector3();
    aggregate.getSize(size);
    aggregate.getCenter(center);
    if (!isFiniteVector3Like(size) || !isFiniteVector3Like(center)) {
      return null;
    }

    return {
      bounds: aggregate,
      size: size,
      center: center
    };
  }

  function buildFilteredBounds(three, object3D, shouldIgnoreNode) {
    if (!three || !object3D || typeof object3D.traverse !== 'function') {
      return null;
    }

    var nodes = [];
    object3D.updateMatrixWorld(true);
    object3D.traverse(function (node) {
      if (!node || node.visible === false || !node.geometry) {
        return;
      }
      if (shouldIgnoreNode && shouldIgnoreNode(node)) {
        return;
      }
      nodes.push(node);
    });

    return buildBoundsFromNodes(three, nodes);
  }

  function buildContentBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, shouldIgnoreNodeForContentBounds);
  }

  function buildContainmentBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, shouldIgnoreNodeForContainmentBounds);
  }

  function buildRenderableBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, null);
  }

  function shouldUseDerivedBounds(derivedBounds, referenceBounds) {
    if (!isFiniteBoundsInfo(derivedBounds) || !isFiniteBoundsInfo(referenceBounds)) {
      return !!derivedBounds;
    }

    if (derivedBounds.size.x <= 0.05 || derivedBounds.size.y <= 0.01 || derivedBounds.size.z <= 0.05) {
      return false;
    }

    var widthRatio = derivedBounds.size.x / Math.max(referenceBounds.size.x, 0.0001);
    var depthRatio = derivedBounds.size.z / Math.max(referenceBounds.size.z, 0.0001);

    if (widthRatio < 0.015 && depthRatio < 0.015) {
      return false;
    }

    return true;
  }

  function shouldUseContentBounds(contentBounds, fullBounds) {
    return shouldUseDerivedBounds(contentBounds, fullBounds);
  }

  function computePlanarFitFactor(size, targetWidth, targetDepth) {
    if (!size || !Number.isFinite(size.x) || !Number.isFinite(size.z) || size.x <= 0 || size.z <= 0) {
      return null;
    }

    var fitX = targetWidth / size.x;
    var fitZ = targetDepth / size.z;
    var planarFactor = Math.min(fitX, fitZ);
    if (!Number.isFinite(planarFactor) || planarFactor <= 0) {
      return null;
    }

    return planarFactor;
  }

  function resolveHeightBandTargets(data) {
    var minRatio = clamp(
      Number.isFinite(data.heightBandMinRatio) ? data.heightBandMinRatio : DEFAULTS.heightBandMinRatio,
      0.05,
      0.95
    );
    var maxRatio = clamp(
      Number.isFinite(data.heightBandMaxRatio) ? data.heightBandMaxRatio : DEFAULTS.heightBandMaxRatio,
      minRatio + 0.01,
      0.99
    );

    return {
      minHeight: data.targetHeight * minRatio,
      maxHeight: data.targetHeight * maxRatio,
      minRatio: minRatio,
      maxRatio: maxRatio
    };
  }

  function getTableTopY(data) {
    var surfaceOffset = Number.isFinite(data.tableTopSurfaceOffsetY)
      ? data.tableTopSurfaceOffsetY
      : DEFAULTS.tableTopSurfaceOffsetY;
    var epsilon = Number.isFinite(data.tabletopAnchorEpsilon)
      ? data.tabletopAnchorEpsilon
      : DEFAULTS.tabletopAnchorEpsilon;
    return (data.anchorY || 0) + surfaceOffset + Math.max(0, epsilon);
  }

  function computeContainmentLimits(data) {
    var targetWidth = Math.max(data.targetWidth, 0.0001);
    var targetDepth = Math.max(data.targetDepth, 0.0001);
    var topWidth = Math.max(targetWidth, targetWidth + Math.max(0, data.tableTopPadding || 0));
    var topDepth = Math.max(targetDepth, targetDepth + Math.max(0, data.tableTopPadding || 0));
    var edgeMargin = clamp(
      Number.isFinite(data.tableEdgeMargin) ? data.tableEdgeMargin : DEFAULTS.tableEdgeMargin,
      0,
      Math.max(0, (Math.min(topWidth, topDepth) * 0.45))
    );

    return {
      topWidth: topWidth,
      topDepth: topDepth,
      containmentWidthLimit: Math.max(topWidth - (edgeMargin * 2), targetWidth * 0.25),
      containmentDepthLimit: Math.max(topDepth - (edgeMargin * 2), targetDepth * 0.25),
      edgeMargin: edgeMargin
    };
  }

  function computeContainmentPlanarLimit(containmentBounds, data) {
    if (!isFiniteBoundsInfo(containmentBounds) || !data) {
      return null;
    }

    var limits = computeContainmentLimits(data);
    var xFactor = containmentBounds.size.x > 0
      ? (limits.containmentWidthLimit / containmentBounds.size.x)
      : Number.POSITIVE_INFINITY;
    var zFactor = containmentBounds.size.z > 0
      ? (limits.containmentDepthLimit / containmentBounds.size.z)
      : Number.POSITIVE_INFINITY;
    var limit = Math.min(xFactor, zFactor);

    return {
      factor: limit,
      xFactor: xFactor,
      zFactor: zFactor,
      containmentWidthLimit: limits.containmentWidthLimit,
      containmentDepthLimit: limits.containmentDepthLimit,
      edgeMargin: limits.edgeMargin
    };
  }

  function resolveBootstrapPlanarMax(data) {
    return clamp(
      Number.isFinite(data.bootstrapPlanarMaxRatio) ? data.bootstrapPlanarMaxRatio : DEFAULTS.bootstrapPlanarMaxRatio,
      0.05,
      0.99
    );
  }

  function resolveSteadyPlanarRange(data) {
    var minPlanar = clamp(
      Number.isFinite(data.minPlanarOccupancyRatio) ? data.minPlanarOccupancyRatio : DEFAULTS.minPlanarOccupancyRatio,
      0.10,
      0.98
    );
    var maxPlanar = clamp(
      Number.isFinite(data.maxPlanarOccupancyRatio) ? data.maxPlanarOccupancyRatio : DEFAULTS.maxPlanarOccupancyRatio,
      minPlanar + 0.01,
      0.99
    );

    return {
      min: minPlanar,
      max: maxPlanar
    };
  }

  function computeAxisPlanarBandFactor(primarySize, containmentSize, containmentLimitSize, minRatio, maxRatio, allowUnderflowCorrection) {
    if (!Number.isFinite(primarySize) || !Number.isFinite(containmentSize) || !Number.isFinite(containmentLimitSize) || primarySize <= 0 || containmentSize <= 0 || containmentLimitSize <= 0) {
      return null;
    }

    var ratio = primarySize / containmentLimitSize;
    var minRequiredFactor = ratio < minRatio
      ? (minRatio / Math.max(ratio, 0.00001))
      : 1;
    var maxAllowedByRange = ratio > maxRatio
      ? (maxRatio / Math.max(ratio, 0.00001))
      : Number.POSITIVE_INFINITY;
    var maxAllowedByContainment = containmentLimitSize / containmentSize;
    var correctUnderflow = allowUnderflowCorrection !== false;
    var factor = 1;
    var compromised = false;
    var reason = 'within-range';

    if (minRequiredFactor > 1.0005 && !correctUnderflow) {
      reason = 'underflow-accepted';
    } else if (minRequiredFactor > 1.0005) {
      factor = Math.min(minRequiredFactor, maxAllowedByContainment);
      if (factor < minRequiredFactor) {
        compromised = true;
        reason = 'containment-overflow';
      } else {
        reason = 'upscale-minimum';
      }
    } else if (maxAllowedByRange < 0.9995 || maxAllowedByContainment < 0.9995) {
      factor = Math.min(maxAllowedByRange, maxAllowedByContainment);
      if (factor === maxAllowedByContainment && factor < maxAllowedByRange) {
        reason = 'downscale-containment';
      } else {
        reason = 'downscale-range';
      }
    }

    if (!Number.isFinite(factor) || factor <= 0) {
      factor = 1;
      compromised = true;
      reason = 'invalid-factor';
    }

    return {
      factor: factor,
      compromised: compromised,
      reason: reason,
      ratio: ratio,
      minRequiredFactor: minRequiredFactor,
      underflowAllowed: minRequiredFactor > 1.0005 && !correctUnderflow,
      maxAllowedByRange: maxAllowedByRange,
      maxAllowedByContainment: maxAllowedByContainment
    };
  }

  function computePlanarAxisTargetScale(primarySize, containmentSize, currentScale, containmentLimitSize, range, toleranceRatio, allowUnderflowCorrection) {
    if (!Number.isFinite(primarySize) || !Number.isFinite(containmentSize) || !Number.isFinite(currentScale) || !Number.isFinite(containmentLimitSize) || primarySize <= 0 || containmentSize <= 0 || currentScale <= 0 || containmentLimitSize <= 0 || !range) {
      return null;
    }

    var ratio = primarySize / containmentLimitSize;
    var setpointRatio = midpoint(range.min, range.max);
    var containmentTolerance = containmentLimitSize * clamp(
      Number.isFinite(toleranceRatio) ? toleranceRatio : DEFAULTS.containmentToleranceRatio,
      0,
      0.25
    );
    var maxAllowedScale = currentScale * (containmentLimitSize / containmentSize);
    if (!Number.isFinite(maxAllowedScale) || maxAllowedScale <= 0) {
      maxAllowedScale = currentScale;
    }

    var correctUnderflow = allowUnderflowCorrection !== false;
    var underflowing = ratio < range.min;
    var overflowing = containmentSize > (containmentLimitSize + containmentTolerance);
    var underflowAllowed = underflowing && !correctUnderflow && !overflowing;
    var withinBand = (ratio >= range.min && ratio <= range.max) || underflowAllowed;
    var desiredScale = currentScale;
    var reason = 'within-band';

    if (overflowing) {
      desiredScale = Math.min(currentScale, maxAllowedScale);
      reason = 'containment-overflow';
      withinBand = false;
    } else if (underflowAllowed) {
      reason = 'underflow-accepted';
    } else if (!withinBand) {
      desiredScale = currentScale * (setpointRatio / Math.max(ratio, 0.00001));
      reason = ratio < range.min ? 'toward-midpoint-up' : 'toward-midpoint-down';
    }

    var targetScale = Math.min(desiredScale, maxAllowedScale);
    if (!Number.isFinite(targetScale) || targetScale <= 0) {
      targetScale = currentScale;
    }

    return {
      ratio: ratio,
      setpointRatio: setpointRatio,
      targetScale: targetScale,
      maxAllowedScale: maxAllowedScale,
      withinBand: withinBand && !overflowing,
      underflowing: underflowing && !overflowing,
      underflowAllowed: underflowAllowed,
      overflowing: overflowing,
      compromised: targetScale + 0.0005 < desiredScale,
      reason: reason
    };
  }

  function computePeakHeight(boundsInfo, data) {
    if (!isFiniteBoundsInfo(boundsInfo) || !data) {
      return null;
    }

    var peakHeight = boundsInfo.bounds.max.y - getTableTopY(data);
    if (!Number.isFinite(peakHeight)) {
      return null;
    }
    return peakHeight;
  }

  function computeBootstrapPlanarScale(primaryBounds, containmentBounds, data) {
    if (!isFiniteBoundsInfo(primaryBounds) || !isFiniteBoundsInfo(containmentBounds) || !data) {
      return null;
    }

    var targetWidth = Math.max(data.targetWidth, 0.0001);
    var targetDepth = Math.max(data.targetDepth, 0.0001);
    var containmentLimit = computeContainmentPlanarLimit(containmentBounds, data);
    var containmentWidthLimit = containmentLimit ? containmentLimit.containmentWidthLimit : targetWidth;
    var containmentDepthLimit = containmentLimit ? containmentLimit.containmentDepthLimit : targetDepth;
    var bootstrapMax = resolveBootstrapPlanarMax(data);
    var xRatio = primaryBounds.size.x / targetWidth;
    var zRatio = primaryBounds.size.z / targetDepth;
    var xRangeFactor = xRatio > bootstrapMax
      ? (bootstrapMax / Math.max(xRatio, 0.00001))
      : 1;
    var zRangeFactor = zRatio > bootstrapMax
      ? (bootstrapMax / Math.max(zRatio, 0.00001))
      : 1;
    var xContainmentFactor = containmentBounds.size.x > 0
      ? containmentWidthLimit / containmentBounds.size.x
      : 1;
    var zContainmentFactor = containmentBounds.size.z > 0
      ? containmentDepthLimit / containmentBounds.size.z
      : 1;
    var xFactor = Math.min(1, xRangeFactor, xContainmentFactor);
    var zFactor = Math.min(1, zRangeFactor, zContainmentFactor);

    return {
      xFactor: Number.isFinite(xFactor) && xFactor > 0 ? xFactor : 1,
      zFactor: Number.isFinite(zFactor) && zFactor > 0 ? zFactor : 1,
      factor: Math.min(
        Number.isFinite(xFactor) && xFactor > 0 ? xFactor : 1,
        Number.isFinite(zFactor) && zFactor > 0 ? zFactor : 1
      ),
      reason: (xFactor < 0.9995 || zFactor < 0.9995) ? 'bootstrap-containment' : 'bootstrap-visible',
      maxRatioX: xRatio,
      maxRatioZ: zRatio,
      containmentWidthLimit: containmentWidthLimit,
      containmentDepthLimit: containmentDepthLimit,
      edgeMargin: containmentLimit ? containmentLimit.edgeMargin : 0,
      bootstrapPlanarMaxRatio: bootstrapMax
    };
  }

  function computePlanarBandScale(primaryBounds, containmentBounds, data) {
    if (!isFiniteBoundsInfo(primaryBounds) || !isFiniteBoundsInfo(containmentBounds) || !data) {
      return null;
    }

    var targetWidth = Math.max(data.targetWidth, 0.0001);
    var targetDepth = Math.max(data.targetDepth, 0.0001);
    var containmentLimit = computeContainmentPlanarLimit(containmentBounds, data);
    var containmentWidthLimit = containmentLimit ? containmentLimit.containmentWidthLimit : targetWidth;
    var containmentDepthLimit = containmentLimit ? containmentLimit.containmentDepthLimit : targetDepth;
    var steadyRange = resolveSteadyPlanarRange(data);
    var xResult = computeAxisPlanarBandFactor(
      primaryBounds.size.x,
      containmentBounds.size.x,
      containmentWidthLimit,
      steadyRange.min,
      steadyRange.max,
      data.planarUnderflowCorrectionEnabled !== false
    );
    var zResult = computeAxisPlanarBandFactor(
      primaryBounds.size.z,
      containmentBounds.size.z,
      containmentDepthLimit,
      steadyRange.min,
      steadyRange.max,
      data.planarUnderflowCorrectionEnabled !== false
    );

    if (!xResult || !zResult) {
      return null;
    }

    return {
      xFactor: xResult.factor,
      zFactor: zResult.factor,
      factor: Math.min(xResult.factor, zResult.factor),
      compromised: xResult.compromised || zResult.compromised,
      reason: xResult.reason === zResult.reason ? xResult.reason : 'axis-mixed',
      x: xResult,
      z: zResult,
      containmentWidthLimit: containmentWidthLimit,
      containmentDepthLimit: containmentDepthLimit,
      edgeMargin: containmentLimit ? containmentLimit.edgeMargin : 0,
      minRatioX: xResult.ratio,
      minRatioZ: zResult.ratio,
      minPlanar: steadyRange.min,
      maxPlanar: steadyRange.max
    };
  }

  function computeHeightBandScale(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax, allowUnderflowCorrection) {
    if (!Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(currentScaleY) || !bandTargets) {
      return null;
    }

    var targetY = currentScaleY;
    var correctUnderflow = allowUnderflowCorrection !== false;

    if (currentHeight < bandTargets.minHeight && correctUnderflow) {
      targetY = currentScaleY * (bandTargets.minHeight / currentHeight);
    } else if (currentHeight > bandTargets.maxHeight) {
      targetY = currentScaleY * (bandTargets.maxHeight / currentHeight);
    }

    targetY = clamp(targetY, yScaleMin, yScaleMax);

    return {
      changed: Math.abs(targetY - currentScaleY) > 0.0001,
      targetY: targetY
    };
  }

  function computeHeightBandTargetScale(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax, allowUnderflowCorrection) {
    if (!Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(currentScaleY) || !bandTargets) {
      return null;
    }

    var setpointHeight = midpoint(bandTargets.minHeight, bandTargets.maxHeight);
    var correctUnderflow = allowUnderflowCorrection !== false;
    var targetScale = currentScaleY;
    var desiredScale = currentScaleY;
    var reason = 'within-band';
    var underflowing = currentHeight < bandTargets.minHeight;
    var overflowing = currentHeight > bandTargets.maxHeight;
    var underflowAllowed = underflowing && !correctUnderflow;
    var withinBand = (currentHeight >= bandTargets.minHeight && currentHeight <= bandTargets.maxHeight) || underflowAllowed;

    if (underflowAllowed) {
      reason = 'underflow-accepted';
    } else if (!withinBand) {
      desiredScale = currentScaleY * (setpointHeight / currentHeight);
      targetScale = desiredScale;
      reason = underflowing ? 'toward-midpoint-up' : 'toward-midpoint-down';
    }

    targetScale = clamp(targetScale, yScaleMin, yScaleMax);

    return {
      targetScale: targetScale,
      setpointHeight: setpointHeight,
      withinBand: withinBand,
      underflowing: underflowing,
      underflowAllowed: underflowAllowed,
      overflowing: overflowing,
      compromised: Math.abs(targetScale - desiredScale) > 0.0005,
      reason: reason
    };
  }

  function computeHardHeightGuardTarget(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax, enabled) {
    if (enabled === false || !Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(currentScaleY) || currentScaleY <= 0 || !bandTargets || !Number.isFinite(bandTargets.maxHeight) || bandTargets.maxHeight <= 0) {
      return {
        enabled: enabled !== false,
        overflowing: false,
        changed: false,
        targetY: currentScaleY,
        maxHeight: bandTargets && Number.isFinite(bandTargets.maxHeight) ? bandTargets.maxHeight : null,
        heightRatio: null,
        compromised: false
      };
    }

    var heightRatio = currentHeight / bandTargets.maxHeight;
    var overflowing = heightRatio > 1.0005;
    var desiredY = overflowing ? currentScaleY * (bandTargets.maxHeight / currentHeight) : currentScaleY;
    var targetY = clamp(desiredY, yScaleMin, yScaleMax);

    return {
      enabled: true,
      overflowing: overflowing,
      changed: overflowing && Math.abs(targetY - currentScaleY) > 0.0001,
      targetY: targetY,
      maxHeight: bandTargets.maxHeight,
      heightRatio: heightRatio,
      compromised: overflowing && Math.abs(targetY - desiredY) > 0.0005
    };
  }

  function constrainPlanarTargetForHeightCompromise(target, currentScale, yTarget, currentHeight, maxHeight) {
    if (!target || !target.underflowing || !Number.isFinite(currentScale) || currentScale <= 0 || !Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(maxHeight) || maxHeight <= 0) {
      return target;
    }

    if (!yTarget || (!yTarget.compromised && !(currentHeight * (target.targetScale / currentScale) > maxHeight))) {
      return target;
    }

    var maxHeightPreservingScale = currentScale * (maxHeight / currentHeight) * 0.985;
    if (!Number.isFinite(maxHeightPreservingScale) || maxHeightPreservingScale <= 0 || target.targetScale <= maxHeightPreservingScale) {
      return target;
    }

    var constrained = Object.assign({}, target);
    constrained.targetScale = Math.max(0.000001, maxHeightPreservingScale);
    constrained.compromised = true;
    constrained.reason = 'height-overflow-compromise';
    return constrained;
  }

  function createNeutralHeightBandTarget(currentScaleY, reason) {
    var scale = Number.isFinite(currentScaleY) && currentScaleY > 0 ? currentScaleY : 1;
    return {
      targetScale: scale,
      setpointHeight: null,
      withinBand: true,
      underflowing: false,
      overflowing: false,
      compromised: false,
      reason: reason || 'height-unavailable'
    };
  }

  function targetNeedsCorrection(target, currentScale) {
    return !!target
      && !target.withinBand
      && !target.compromised
      && Number.isFinite(target.targetScale)
      && Number.isFinite(currentScale)
      && Math.abs(target.targetScale - currentScale) > 0.0005;
  }

  function buildAxisDiagnostics(target) {
    if (!target) {
      return null;
    }
    return {
      ratio: Number.isFinite(target.ratio) ? toFixedNumber(target.ratio) : null,
      height: Number.isFinite(target.currentHeight) ? toFixedNumber(target.currentHeight) : null,
      targetScale: Number.isFinite(target.targetScale) ? toFixedNumber(target.targetScale) : null,
      setpoint: Number.isFinite(target.setpointRatio)
        ? toFixedNumber(target.setpointRatio)
        : (Number.isFinite(target.setpointHeight) ? toFixedNumber(target.setpointHeight) : null),
      withinBand: !!target.withinBand,
      underflowing: !!target.underflowing,
      underflowAllowed: !!target.underflowAllowed,
      overflowing: !!target.overflowing,
      compromised: !!target.compromised,
      reason: target.reason || ''
    };
  }

  function shouldAnimateContainmentTransform(reason, previousTransform, nextTransform, data) {
    if (!previousTransform || !nextTransform || !transformsDiffer(previousTransform, nextTransform)) {
      return false;
    }
    if (!data || !(data.transformTransitionMs > 0)) {
      return false;
    }
    var text = String(reason || '');
    if (!text || text === 'init' || text === 'bootstrap-visible' || text.indexOf('hard-height-guard') !== -1) {
      return false;
    }
    return text.indexOf('mapping') !== -1
      || text.indexOf('componentchanged') !== -1
      || text.indexOf('chart-rendered') !== -1
      || text.indexOf('analysis-updated') !== -1
      || text.indexOf('dataRefresh') !== -1
      || text.indexOf('manual-renormalize') !== -1
      || text.indexOf('update') !== -1;
  }

  function buildContainmentCorrectionState(measurements, object3D, data) {
    if (!hasUsableMeasurements(measurements) || !object3D || !object3D.scale || !data) {
      return null;
    }

    var steadyRange = resolveSteadyPlanarRange(data);
    var containmentLimits = computeContainmentLimits(data);
    var xTarget = computePlanarAxisTargetScale(
      measurements.primary.size.x,
      measurements.containment.size.x,
      object3D.scale.x,
      containmentLimits.containmentWidthLimit,
      steadyRange,
      data.containmentToleranceRatio,
      data.planarUnderflowCorrectionEnabled !== false
    );
    var zTarget = computePlanarAxisTargetScale(
      measurements.primary.size.z,
      measurements.containment.size.z,
      object3D.scale.z,
      containmentLimits.containmentDepthLimit,
      steadyRange,
      data.containmentToleranceRatio,
      data.planarUnderflowCorrectionEnabled !== false
    );
    var heightTargets = resolveHeightBandTargets(data);
    var hardHeightGuard = computeHardHeightGuardTarget(
      measurements.peakHeight,
      object3D.scale.y,
      heightTargets,
      Math.max(0.001, data.yScaleMin),
      Math.max(data.yScaleMin + 0.001, data.yScaleMax),
      data.hardHeightGuardEnabled !== false
    );
    var yTarget = computeHeightBandTargetScale(
      measurements.peakHeight,
      object3D.scale.y,
      heightTargets,
      Math.max(0.001, data.yScaleMin),
      Math.max(data.yScaleMin + 0.001, data.yScaleMax),
      data.heightUnderflowCorrectionEnabled !== false
    ) || createNeutralHeightBandTarget(object3D.scale.y, 'height-unavailable');

    if (!xTarget || !zTarget) {
      return null;
    }

    xTarget = constrainPlanarTargetForHeightCompromise(xTarget, object3D.scale.x, yTarget, measurements.peakHeight, heightTargets.maxHeight);
    zTarget = constrainPlanarTargetForHeightCompromise(zTarget, object3D.scale.z, yTarget, measurements.peakHeight, heightTargets.maxHeight);

    var xNeedsCorrection = targetNeedsCorrection(xTarget, object3D.scale.x);
    var yNeedsCorrection = targetNeedsCorrection(yTarget, object3D.scale.y) || !!hardHeightGuard.overflowing;
    var zNeedsCorrection = targetNeedsCorrection(zTarget, object3D.scale.z);

    return {
      x: xTarget,
      y: yTarget,
      z: zTarget,
      axes: {
        x: buildAxisDiagnostics(xTarget),
        y: buildAxisDiagnostics(Object.assign({ currentHeight: measurements.peakHeight }, yTarget)),
        z: buildAxisDiagnostics(zTarget)
      },
      needsCorrection: xNeedsCorrection || yNeedsCorrection || zNeedsCorrection,
      compromised: xTarget.compromised || yTarget.compromised || zTarget.compromised,
      outOfBand: !xTarget.withinBand || !yTarget.withinBand || !zTarget.withinBand,
      containmentWidthLimit: containmentLimits.containmentWidthLimit,
      containmentDepthLimit: containmentLimits.containmentDepthLimit,
      minHeight: heightTargets.minHeight,
      maxHeight: heightTargets.maxHeight,
      heightOverflow: !!hardHeightGuard.overflowing,
      heightRatio: hardHeightGuard.heightRatio,
      hardHeightGuardTargetY: hardHeightGuard.targetY,
      hardHeightGuardCompromised: !!hardHeightGuard.compromised
    };
  }

  function buildMeasurementSignature(measurements, object3D) {
    if (!measurements || !measurements.primary || !object3D) {
      return null;
    }

    var primary = measurements.primary;
    var containment = measurements.containment || primary;
    var full = measurements.full || primary;
    var peakHeight = Number.isFinite(measurements.peakHeight) ? measurements.peakHeight : null;

    return [
      toFixedNumber(primary.size.x),
      toFixedNumber(primary.size.y),
      toFixedNumber(primary.size.z),
      toFixedNumber(containment.size.x),
      toFixedNumber(containment.size.y),
      toFixedNumber(containment.size.z),
      toFixedNumber(full.size.x),
      toFixedNumber(full.size.y),
      toFixedNumber(full.size.z),
      toFixedNumber(peakHeight),
      toFixedNumber(object3D.scale.x),
      toFixedNumber(object3D.scale.y),
      toFixedNumber(object3D.scale.z),
      toFixedNumber(object3D.position.x),
      toFixedNumber(object3D.position.y),
      toFixedNumber(object3D.position.z)
    ].join('|');
  }

  function softenFactor(factor, damping) {
    if (!Number.isFinite(factor) || factor <= 0) {
      return 1;
    }
    if (Math.abs(factor - 1) <= 0.0005) {
      return 1;
    }
    if (factor > 1) {
      return 1 + ((factor - 1) * 0.65);
    }
    return 1 - ((1 - factor) * damping);
  }

  function createPidAxisState() {
    return {
      integral: 0,
      lastError: 0,
      initialized: false
    };
  }

  function createPidControllerState() {
    return {
      active: false,
      stableTicks: 0,
      axes: {
        x: createPidAxisState(),
        y: createPidAxisState(),
        z: createPidAxisState()
      }
    };
  }

  function resetPidAxisState(axisState) {
    if (!axisState) {
      return;
    }
    axisState.integral = 0;
    axisState.lastError = 0;
    axisState.initialized = false;
  }

  function stepPidAxis(axisState, currentValue, targetValue, dtSeconds, profile) {
    if (!axisState || !Number.isFinite(currentValue) || !Number.isFinite(targetValue) || !Number.isFinite(dtSeconds) || dtSeconds <= 0 || !profile) {
      return {
        nextValue: currentValue,
        changed: false,
        stable: true,
        error: 0
      };
    }

    var error = targetValue - currentValue;
    if (Math.abs(error) <= profile.epsilon) {
      resetPidAxisState(axisState);
      return {
        nextValue: currentValue,
        changed: false,
        stable: true,
        error: error
      };
    }

    axisState.integral = clamp(
      axisState.integral + (error * dtSeconds),
      -profile.integralLimit,
      profile.integralLimit
    );
    var derivative = axisState.initialized
      ? ((error - axisState.lastError) / Math.max(dtSeconds, 0.0001))
      : 0;
    axisState.lastError = error;
    axisState.initialized = true;

    var velocity = (profile.kp * error) + (profile.ki * axisState.integral) + (profile.kd * derivative);
    velocity = clamp(velocity, -profile.maxVelocity, profile.maxVelocity);

    var nextValue = currentValue + (velocity * dtSeconds);
    if ((error > 0 && nextValue > targetValue) || (error < 0 && nextValue < targetValue)) {
      nextValue = targetValue;
    }

    return {
      nextValue: nextValue,
      changed: Math.abs(nextValue - currentValue) > 0.0001,
      stable: false,
      error: error
    };
  }

  function computeAnchorOffset(measurements, data) {
    if (!measurements || !isFiniteBoundsInfo(measurements.full) || !isFiniteBoundsInfo(measurements.primary) || !data) {
      return null;
    }
    var tableTopY = getTableTopY(data);

    return {
      deltaX: data.anchorX - measurements.primary.center.x,
      deltaY: tableTopY - measurements.primary.bounds.min.y,
      deltaZ: data.anchorZ - measurements.primary.center.z
    };
  }

  function buildTabletopAnchorDiagnostics(measurements, data) {
    if (!measurements || !isFiniteBoundsInfo(measurements.primary) || !data) {
      return null;
    }
    var tableTopY = getTableTopY(data);
    var primaryMinY = measurements.primary.bounds.min.y;
    return {
      tableTopY: toFixedNumber(tableTopY),
      primaryMinY: toFixedNumber(primaryMinY),
      deltaY: toFixedNumber(tableTopY - primaryMinY),
      epsilon: toFixedNumber(Number.isFinite(data.tabletopAnchorEpsilon) ? data.tabletopAnchorEpsilon : DEFAULTS.tabletopAnchorEpsilon),
      deadbandY: toFixedNumber(Number.isFinite(data.tabletopAnchorDeadbandY) ? data.tabletopAnchorDeadbandY : DEFAULTS.tabletopAnchorDeadbandY),
      surfaceOffsetY: toFixedNumber(Number.isFinite(data.tableTopSurfaceOffsetY) ? data.tableTopSurfaceOffsetY : DEFAULTS.tableTopSurfaceOffsetY)
    };
  }

  var componentDefinition = {
    schema: {
      enabled: { default: true },
      targetWidth: { type: 'number', default: DEFAULTS.targetWidth },
      targetHeight: { type: 'number', default: DEFAULTS.targetHeight },
      targetDepth: { type: 'number', default: DEFAULTS.targetDepth },
      anchorX: { type: 'number', default: DEFAULTS.anchorX },
      anchorY: { type: 'number', default: DEFAULTS.anchorY },
      anchorZ: { type: 'number', default: DEFAULTS.anchorZ },
      revealOffsetY: { type: 'number', default: DEFAULTS.revealOffsetY },
      tableTopSurfaceOffsetY: { type: 'number', default: DEFAULTS.tableTopSurfaceOffsetY },
      tabletopAnchorEpsilon: { type: 'number', default: DEFAULTS.tabletopAnchorEpsilon },
      tabletopAnchorDeadbandY: { type: 'number', default: DEFAULTS.tabletopAnchorDeadbandY },
      retries: { type: 'int', default: DEFAULTS.retries },
      retryDelayMs: { type: 'int', default: DEFAULTS.retryDelayMs },
      tableTopPadding: { type: 'number', default: DEFAULTS.tableTopPadding },
      bootstrapPlanarMaxRatio: { type: 'number', default: DEFAULTS.bootstrapPlanarMaxRatio },
      minPlanarOccupancyRatio: { type: 'number', default: DEFAULTS.minPlanarOccupancyRatio },
      maxPlanarOccupancyRatio: { type: 'number', default: DEFAULTS.maxPlanarOccupancyRatio },
      minHeightOccupancyRatio: { type: 'number', default: DEFAULTS.minHeightOccupancyRatio },
      heightBandMinRatio: { type: 'number', default: DEFAULTS.heightBandMinRatio },
      heightBandMaxRatio: { type: 'number', default: DEFAULTS.heightBandMaxRatio },
      tableEdgeMargin: { type: 'number', default: DEFAULTS.tableEdgeMargin },
      buildingHeightBandEnabled: { default: DEFAULTS.buildingHeightBandEnabled },
      yScaleMin: { type: 'number', default: DEFAULTS.yScaleMin },
      yScaleMax: { type: 'number', default: DEFAULTS.yScaleMax },
      containmentToleranceRatio: { type: 'number', default: DEFAULTS.containmentToleranceRatio },
      containmentDamping: { type: 'number', default: DEFAULTS.containmentDamping },
      containmentMaxIterations: { type: 'int', default: DEFAULTS.containmentMaxIterations },
      containmentCheckMs: { type: 'int', default: DEFAULTS.containmentCheckMs },
      periodicContainmentEnabled: { default: DEFAULTS.periodicContainmentEnabled },
      renormalizeDebounceMs: { type: 'int', default: DEFAULTS.renormalizeDebounceMs },
      stabilizationCheckMs: { type: 'int', default: DEFAULTS.stabilizationCheckMs },
      stabilizationMaxChecks: { type: 'int', default: DEFAULTS.stabilizationMaxChecks },
      stabilizationStablePasses: { type: 'int', default: DEFAULTS.stabilizationStablePasses },
      transformTransitionMs: { type: 'int', default: DEFAULTS.transformTransitionMs },
      hardHeightGuardEnabled: { default: DEFAULTS.hardHeightGuardEnabled },
      heightUnderflowCorrectionEnabled: { default: DEFAULTS.heightUnderflowCorrectionEnabled },
      planarUnderflowCorrectionEnabled: { default: DEFAULTS.planarUnderflowCorrectionEnabled }
    },

    init: function () {
      this.retryCount = 0;
      this.retryTimer = null;
      this.stabilizationTimer = null;
      this.stabilizationChecksRemaining = 0;
      this.stabilizationStableCount = 0;
      this.steadyControllerTimer = null;
      this.lastMeasurementSignature = null;
      this.lastRenormalizeRequestAt = 0;
      this.nextContainmentCheckAt = 0;
      this.baseScale = null;
      this.normalized = false;
      this.nextInvalidTransformWarnAt = 0;
      this.nextMinimumCompromisedWarnAt = 0;
      this.normalizationGeneration = 0;
      this.lastStableTransform = null;
      this.lastNormalizationIssue = null;
      this.lastSuccessfulNormalizeAt = 0;
      this.pendingRenormalizeReason = null;
      this.containmentTransition = { active: false, reason: '', startedAt: 0, duration: 0 };
      this.containmentTransitionTimer = null;
      this.lastHardHeightGuardAt = 0;
      this.renderPhase = 'waiting-geometry';
      this.pidController = createPidControllerState();
      this.onComponentChangedBound = this.onComponentChanged.bind(this);
      this.onGeometryReadyBound = this.onGeometryReady.bind(this);
      this.onChartRenderedBound = this.onChartRendered.bind(this);

      if (!this.data.enabled) {
        return;
      }

      this.ensureInitialPlacement();
      this.el.addEventListener('componentchanged', this.onComponentChangedBound);
      this.el.addEventListener('child-attached', this.onGeometryReadyBound);
      this.el.addEventListener('object3dset', this.onGeometryReadyBound);
      this.el.addEventListener('codexr-boats-rendered', this.onChartRenderedBound);

      this.tryNormalize('init', this.bumpNormalizationGeneration());
    },

    markWaitingGeometry: function (reason, generation, details) {
      this.renderPhase = 'waiting-geometry';
      this.normalized = false;
      this.deactivateSteadyController();
      this.lastNormalizationIssue = {
        reason: reason || 'waiting-geometry',
        details: details || null,
        retryCount: this.retryCount,
        generation: generation,
        at: Date.now()
      };
      if (this.el && this.el.object3D) {
        if (this.lastStableTransform) {
          restoreTransform(this.el.object3D, this.lastStableTransform);
        }
        this.el.object3D.visible = true;
      }
    },

    captureStableTransform: function () {
      if (!this.el || !this.el.object3D) {
        return;
      }
      this.lastStableTransform = cloneTransform(this.el.object3D) || this.lastStableTransform;
    },

    cancelContainmentTransition: function () {
      if (this.containmentTransitionTimer) {
        clearTimeout(this.containmentTransitionTimer);
        this.containmentTransitionTimer = null;
      }
      if (this.el && this.el.removeAttribute) {
        this.el.removeAttribute('animation__codexr_containment_position');
        this.el.removeAttribute('animation__codexr_containment_scale');
      }
      if (this.containmentTransition) {
        this.containmentTransition.active = false;
      }
    },

    startContainmentTransition: function (fromTransform, toTransform, reason) {
      var duration = Math.max(0, Number.isFinite(this.data.transformTransitionMs) ? this.data.transformTransitionMs : DEFAULTS.transformTransitionMs);
      if (!this.el || !this.el.setAttribute || duration <= 0 || !transformsDiffer(fromTransform, toTransform)) {
        return false;
      }

      this.cancelContainmentTransition();
      this.containmentTransition = {
        active: true,
        reason: reason || 'containment-transition',
        startedAt: Date.now(),
        duration: duration
      };
      this.el.setAttribute('animation__codexr_containment_position', {
        property: 'position',
        from: formatVector3Like(fromTransform.position),
        to: formatVector3Like(toTransform.position),
        dur: duration,
        easing: 'easeInOutCubic'
      });
      this.el.setAttribute('animation__codexr_containment_scale', {
        property: 'scale',
        from: formatVector3Like(fromTransform.scale),
        to: formatVector3Like(toTransform.scale),
        dur: duration,
        easing: 'easeInOutCubic'
      });

      var self = this;
      this.containmentTransitionTimer = setTimeout(function () {
        self.containmentTransitionTimer = null;
        if (self.containmentTransition) {
          self.containmentTransition.active = false;
        }
        if (self.el && self.el.object3D && toTransform) {
          restoreTransform(self.el.object3D, toTransform);
          self.syncTransformAttributes();
          self.captureStableTransform();
        }
      }, duration);
      return true;
    },

    warnInvalidTransform: function (reason, details) {
      var now = Date.now();
      if (now < this.nextInvalidTransformWarnAt) {
        return;
      }
      this.nextInvalidTransformWarnAt = now + 2000;
      console.warn('[CodeXR][AnalysisTable] Skipping invalid transform state:', {
        reason: reason,
        details: details || null
      });
    },

    warnMinimumCompromised: function (details) {
      var now = Date.now();
      if (now < this.nextMinimumCompromisedWarnAt) {
        return;
      }
      this.nextMinimumCompromisedWarnAt = now + 4000;
      resizeTrace('minimum-occupancy-relaxed', details || null);
      console.warn('[CodeXR][AnalysisTable] Minimum occupancy relaxed to preserve containment:', details || null);
    },

    requestRenormalize: function (reason) {
      if (isChartAnimationActive(this.el)) {
        this.pendingRenormalizeReason = reason || 'chart-animation-active';
        return;
      }
      var now = Date.now();
      var debounceMs = Math.max(80, this.data.renormalizeDebounceMs || DEFAULTS.renormalizeDebounceMs);
      if ((now - this.lastRenormalizeRequestAt) < debounceMs) {
        return;
      }
      this.lastRenormalizeRequestAt = now;
      this.renormalize(reason || 'componentchanged');
    },

    inspectAxisIssue: function () {
      return inspectInvalidAxisState(this.el);
    },

    getChartStatus: function () {
      var axisIssue = this.inspectAxisIssue();
      if (axisIssue) {
        return {
          ready: true,
          valid: false,
          stabilized: false,
          geometryState: 'invalid',
          reason: axisIssue.reason || 'invalid-axis-length',
          message: 'The selected mapping generated invalid axis values.',
          details: axisIssue
        };
      }

      var measurements = this.measureBounds();
      if (!hasUsableMeasurements(measurements)) {
        return {
          ready: false,
          valid: false,
          stabilized: false,
          geometryState: 'rebuilding',
          reason: this.lastNormalizationIssue ? this.lastNormalizationIssue.reason : 'waiting-geometry',
          message: 'The chart is still rebuilding its geometry.',
          details: Object.assign({
            phase: this.renderPhase
          }, this.lastNormalizationIssue || {})
        };
      }

      var correctionState = buildContainmentCorrectionState(measurements, this.el && this.el.object3D, this.data);
      var needsCorrection = !!(correctionState && correctionState.needsCorrection);
      var animationActive = isChartAnimationActive(this.el);
      var transitionActive = !!(this.containmentTransition && this.containmentTransition.active);
      var heightOverflow = !!(correctionState && correctionState.heightOverflow);
      var stabilized = this.renderPhase === 'steady-fit'
        && (!this.pidController || !this.pidController.active)
        && !needsCorrection
        && !animationActive
        && !transitionActive
        && !heightOverflow;
      return {
        ready: true,
        valid: true,
        stabilized: stabilized,
        geometryState: stabilized ? 'stabilized' : 'valid',
        reason: animationActive
          ? 'chart-animation-active'
          : transitionActive
          ? 'containment-transition-active'
          : heightOverflow
          ? 'height-overflow'
          : needsCorrection
          ? 'containment-correcting'
          : (this.renderPhase === 'steady-fit' ? 'ok' : this.renderPhase),
        details: {
          phase: this.renderPhase,
          animationActive: animationActive,
          transitionActive: transitionActive,
          primaryWidth: toFixedNumber(measurements.primary.size.x),
          primaryHeight: toFixedNumber(measurements.primary.size.y),
          primaryDepth: toFixedNumber(measurements.primary.size.z),
          peakHeight: toFixedNumber(measurements.peakHeight),
          xRatio: correctionState ? toFixedNumber(correctionState.x.ratio) : null,
          yHeight: toFixedNumber(measurements.peakHeight),
          zRatio: correctionState ? toFixedNumber(correctionState.z.ratio) : null,
          needsCorrection: needsCorrection,
          compromised: correctionState ? !!correctionState.compromised : false,
          tabletopAnchor: buildTabletopAnchorDiagnostics(measurements, this.data),
          minPlanar: correctionState ? toFixedNumber(resolveSteadyPlanarRange(this.data).min) : null,
          maxPlanar: correctionState ? toFixedNumber(resolveSteadyPlanarRange(this.data).max) : null,
          minHeight: correctionState ? toFixedNumber(correctionState.minHeight) : null,
          maxHeight: correctionState ? toFixedNumber(correctionState.maxHeight) : null,
          heightOverflow: heightOverflow,
          heightGuardApplied: !!(this.lastHardHeightGuardAt && Date.now() - this.lastHardHeightGuardAt < 1500),
          heightRatio: correctionState ? toFixedNumber(correctionState.heightRatio) : null
        }
      };
    },

    bumpNormalizationGeneration: function () {
      this.normalizationGeneration += 1;
      return this.normalizationGeneration;
    },

    isCurrentGeneration: function (generation) {
      return generation === this.normalizationGeneration;
    },

    onComponentChanged: function (event) {
      if (!event || !event.detail || !this.data.enabled || !this.el || event.target !== this.el) {
        return;
      }
      var name = event.detail.name || '';
      if (typeof name !== 'string') {
        return;
      }
      if ((name.indexOf('babia-') === 0 && name !== 'babia-queryjson') || name === 'codexr-boats') {
        this.requestRenormalize('chart-componentchanged:' + name);
      }
    },

    onGeometryReady: function (event) {
      if (!this.data.enabled || !this.el || !event) {
        return;
      }
      if (event.target !== this.el && !(this.el.contains && this.el.contains(event.target))) {
        return;
      }
      this.requestRenormalize(event.type || 'geometry-ready');
    },

    onChartRendered: function (event) {
      if (!this.data.enabled || !this.el || !event || event.target !== this.el) {
        return;
      }
      var pendingReason = this.pendingRenormalizeReason;
      this.pendingRenormalizeReason = null;
      this.renormalize(pendingReason || event.type || 'chart-rendered');
    },

    update: function (oldData) {
      if (!oldData) {
        return;
      }

      if (!this.data.enabled) {
        this.stopStabilizationLoop();
        return;
      }

      if (
        oldData.targetWidth !== this.data.targetWidth
        || oldData.targetHeight !== this.data.targetHeight
        || oldData.targetDepth !== this.data.targetDepth
        || oldData.anchorX !== this.data.anchorX
        || oldData.anchorY !== this.data.anchorY
        || oldData.anchorZ !== this.data.anchorZ
        || oldData.tableTopSurfaceOffsetY !== this.data.tableTopSurfaceOffsetY
        || oldData.tabletopAnchorEpsilon !== this.data.tabletopAnchorEpsilon
        || oldData.bootstrapPlanarMaxRatio !== this.data.bootstrapPlanarMaxRatio
        || oldData.minPlanarOccupancyRatio !== this.data.minPlanarOccupancyRatio
        || oldData.maxPlanarOccupancyRatio !== this.data.maxPlanarOccupancyRatio
        || oldData.minHeightOccupancyRatio !== this.data.minHeightOccupancyRatio
        || oldData.heightBandMinRatio !== this.data.heightBandMinRatio
        || oldData.heightBandMaxRatio !== this.data.heightBandMaxRatio
        || oldData.tableEdgeMargin !== this.data.tableEdgeMargin
        || oldData.yScaleMin !== this.data.yScaleMin
        || oldData.yScaleMax !== this.data.yScaleMax
        || oldData.containmentToleranceRatio !== this.data.containmentToleranceRatio
        || oldData.stabilizationCheckMs !== this.data.stabilizationCheckMs
        || oldData.stabilizationMaxChecks !== this.data.stabilizationMaxChecks
        || oldData.stabilizationStablePasses !== this.data.stabilizationStablePasses
        || oldData.heightUnderflowCorrectionEnabled !== this.data.heightUnderflowCorrectionEnabled
        || oldData.planarUnderflowCorrectionEnabled !== this.data.planarUnderflowCorrectionEnabled
      ) {
        this.ensureInitialPlacement();
        this.renormalize('update');
      }
    },

    tick: function (time, timeDelta) {
      if (!this.data.enabled || !this.normalized || !this.el || !this.el.object3D) {
        return;
      }

      if (!isFiniteVector3Like(this.el.object3D.position) || !isFiniteVector3Like(this.el.object3D.scale)) {
        this.warnInvalidTransform('tick-non-finite-object3d', {
          position: this.el.object3D.position,
          scale: this.el.object3D.scale
        });
        this.renormalize('tick-non-finite-object3d');
        return;
      }

      var tickMeasurements = this.measureBounds();
      if (tickMeasurements && this.applyHardHeightGuard(tickMeasurements, 'tick-hard-height-guard')) {
        return;
      }

      if ((this.containmentTransition && this.containmentTransition.active) || isChartAnimationActive(this.el)) {
        return;
      }

      if (this.renderPhase === 'steady-fit' && this.pidController && this.pidController.active) {
        this.runSteadyControllerStep('tick', timeDelta);
      }

      if (!this.data.periodicContainmentEnabled) {
        return;
      }

      if (time < this.nextContainmentCheckAt) {
        return;
      }

      this.nextContainmentCheckAt = time + Math.max(120, this.data.containmentCheckMs);
      if (!(this.renderPhase === 'steady-fit' && this.pidController && this.pidController.active)) {
        this.runMaintenancePass('tick');
      }
    },

    remove: function () {
      if (this.onComponentChangedBound && this.el && this.el.removeEventListener) {
        this.el.removeEventListener('componentchanged', this.onComponentChangedBound);
      }
      if (this.onGeometryReadyBound && this.el && this.el.removeEventListener) {
        this.el.removeEventListener('child-attached', this.onGeometryReadyBound);
        this.el.removeEventListener('object3dset', this.onGeometryReadyBound);
      }
      if (this.onChartRenderedBound && this.el && this.el.removeEventListener) {
        this.el.removeEventListener('codexr-boats-rendered', this.onChartRenderedBound);
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      this.deactivateSteadyController();
      this.stopStabilizationLoop();
      this.cancelContainmentTransition();

    },

    ensureInitialPlacement: function () {
      this.el.setAttribute('position', this.data.anchorX + ' ' + this.data.anchorY + ' ' + this.data.anchorZ);
    },

    ensureBaseScale: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !object3D.scale) {
        return;
      }

      if (!this.baseScale) {
        this.baseScale = cloneScale(object3D);
      }
    },

    resetToBaseScale: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !object3D.scale || !this.baseScale) {
        return false;
      }

      object3D.scale.set(this.baseScale.x, this.baseScale.y, this.baseScale.z);
      object3D.updateMatrixWorld(true);
      return true;
    },

    measureBounds: function () {
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      var object3D = this.el && this.el.object3D;
      if (!object3D || !three || !three.Box3 || !three.Vector3) {
        return null;
      }

      object3D.updateMatrixWorld(true);
      var full = buildRenderableBounds(three, object3D) || buildBounds(three, object3D);
      if (!isFiniteBoundsInfo(full)) {
        return null;
      }

      var contentCandidate = buildContentBounds(three, object3D);
      var containmentCandidate = buildContainmentBounds(three, object3D);
      var containment = shouldUseDerivedBounds(containmentCandidate, full) ? containmentCandidate : full;
      var content = shouldUseContentBounds(contentCandidate, containment) ? contentCandidate : null;
      var primary = content || containment;
      var heightReference = content || primary;
      var peakHeight = computePeakHeight(heightReference, this.data);

      return {
        full: full,
        containment: containment,
        content: content,
        primary: primary,
        peakHeight: peakHeight
      };
    },

    applyAnchorPlacement: function (measurements) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !measurements || !isFiniteBoundsInfo(measurements.full) || !isFiniteBoundsInfo(measurements.primary)) {
        return false;
      }

      var offset = computeAnchorOffset(measurements, this.data);
      if (!offset) {
        return false;
      }

      if (!Number.isFinite(offset.deltaX) || !Number.isFinite(offset.deltaY) || !Number.isFinite(offset.deltaZ)) {
        this.warnInvalidTransform('non-finite-anchor-target', {
          deltaX: offset.deltaX,
          deltaY: offset.deltaY,
          deltaZ: offset.deltaZ
        });
        return false;
      }

      var anchorDeadbandY = Math.max(0, Number.isFinite(this.data.tabletopAnchorDeadbandY) ? this.data.tabletopAnchorDeadbandY : DEFAULTS.tabletopAnchorDeadbandY);
      if (Math.abs(offset.deltaY) <= anchorDeadbandY) {
        offset.deltaY = 0;
      }

      var moved = Math.abs(offset.deltaX) > 0.0005
        || Math.abs(offset.deltaY) > 0.0005
        || Math.abs(offset.deltaZ) > 0.0005;

      if (!moved) {
        return false;
      }

      object3D.position.set(
        object3D.position.x + offset.deltaX,
        object3D.position.y + offset.deltaY,
        object3D.position.z + offset.deltaZ
      );
      object3D.updateMatrixWorld(true);
      return true;
    },

    syncTransformAttributes: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return;
      }

      if (!isFiniteVector3Like(object3D.position) || !isFiniteVector3Like(object3D.scale)) {
        this.warnInvalidTransform('sync-transform-non-finite', {
          position: object3D.position,
          scale: object3D.scale
        });
        return;
      }

      this.el.setAttribute(
        'position',
        toTransformNumber(object3D.position.x) + ' '
          + toTransformNumber(object3D.position.y) + ' '
          + toTransformNumber(object3D.position.z)
      );
      this.el.setAttribute(
        'scale',
        toTransformNumber(object3D.scale.x) + ' '
          + toTransformNumber(object3D.scale.y) + ' '
          + toTransformNumber(object3D.scale.z)
      );
    },

    applyHardHeightGuard: function (measurements, source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !this.data.hardHeightGuardEnabled || !hasUsableMeasurements(measurements)) {
        return false;
      }

      var bandTargets = resolveHeightBandTargets(this.data);
      var guard = computeHardHeightGuardTarget(
        measurements.peakHeight,
        object3D.scale.y,
        bandTargets,
        Math.max(0.001, this.data.yScaleMin),
        Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax),
        this.data.hardHeightGuardEnabled !== false
      );

      if (!guard || !guard.overflowing) {
        return false;
      }

      if (this.containmentTransition && this.containmentTransition.active) {
        this.cancelContainmentTransition();
      }

      if (!guard.changed) {
        this.lastHardHeightGuardAt = Date.now();
        debugLog('hard-height-guard-compromised', {
          source: source || 'height-guard',
          peakHeight: toFixedNumber(measurements.peakHeight),
          maxHeight: toFixedNumber(guard.maxHeight),
          heightRatio: toFixedNumber(guard.heightRatio),
          yScale: toFixedNumber(object3D.scale.y)
        });
        return false;
      }

      object3D.scale.y = guard.targetY;
      object3D.updateMatrixWorld(true);

      var nextMeasurements = this.measureBounds();
      if (nextMeasurements) {
        this.applyAnchorPlacement(nextMeasurements);
      }
      this.syncTransformAttributes();
      this.lastHardHeightGuardAt = Date.now();
      if (this.pidController) {
        this.pidController.stableTicks = 0;
        resetPidAxisState(this.pidController.axes.y);
      }

      debugLog('hard-height-guard-applied', {
        source: source || 'height-guard',
        peakHeight: toFixedNumber(measurements.peakHeight),
        maxHeight: toFixedNumber(guard.maxHeight),
        heightRatio: toFixedNumber(guard.heightRatio),
        targetY: toFixedNumber(guard.targetY),
        yScale: toFixedNumber(object3D.scale.y)
      });
      return true;
    },

    applyScaleFactors: function (xFactor, yFactor, zFactor) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var nextX = object3D.scale.x * (Number.isFinite(xFactor) ? xFactor : 1);
      var nextY = clamp(object3D.scale.y * yFactor, Math.max(0.001, this.data.yScaleMin), Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax));
      var nextZ = object3D.scale.z * (Number.isFinite(zFactor) ? zFactor : (Number.isFinite(xFactor) ? xFactor : 1));

      if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZ) || nextX <= 0 || nextY <= 0 || nextZ <= 0) {
        this.warnInvalidTransform('apply-scale-invalid-target', {
          nextX: nextX,
          nextY: nextY,
          nextZ: nextZ,
          xFactor: xFactor,
          zFactor: zFactor,
          yFactor: yFactor
        });
        return false;
      }

      var changed = Math.abs(nextX - object3D.scale.x) > 0.0001
        || Math.abs(nextY - object3D.scale.y) > 0.0001
        || Math.abs(nextZ - object3D.scale.z) > 0.0001;

      if (!changed) {
        return false;
      }

      object3D.scale.set(nextX, nextY, nextZ);
      object3D.updateMatrixWorld(true);
      return true;
    },

    axisContributesToPeakHeight: function (axis, currentHeight) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !object3D.scale || !Number.isFinite(object3D.scale[axis]) || object3D.scale[axis] <= 0 || !Number.isFinite(currentHeight)) {
        return false;
      }

      var originalScale = object3D.scale[axis];
      object3D.scale[axis] = originalScale * 1.08;
      object3D.updateMatrixWorld(true);
      var probeMeasurements = this.measureBounds();
      object3D.scale[axis] = originalScale;
      object3D.updateMatrixWorld(true);

      if (!probeMeasurements || !Number.isFinite(probeMeasurements.peakHeight)) {
        return false;
      }
      var minimumDelta = Math.max(0.01, Math.abs(currentHeight) * 0.02);
      return probeMeasurements.peakHeight > currentHeight + minimumDelta;
    },

    constrainPlanarTargetForMeasuredHeight: function (axis, target, currentScale, yTarget, measurements, heightTargets) {
      if (!target || !measurements || !heightTargets || !this.axisContributesToPeakHeight(axis, measurements.peakHeight)) {
        return target;
      }
      return constrainPlanarTargetForHeightCompromise(
        target,
        currentScale,
        yTarget,
        measurements.peakHeight,
        heightTargets.maxHeight
      );
    },

    activateSteadyController: function () {
      if (!this.pidController) {
        this.pidController = createPidControllerState();
      }
      this.pidController.active = true;
      this.pidController.stableTicks = 0;
      resetPidAxisState(this.pidController.axes.x);
      resetPidAxisState(this.pidController.axes.y);
      resetPidAxisState(this.pidController.axes.z);
      this.scheduleSteadyControllerStep('steady-controller');
    },

    deactivateSteadyController: function () {
      if (this.steadyControllerTimer) {
        clearTimeout(this.steadyControllerTimer);
        this.steadyControllerTimer = null;
      }
      if (!this.pidController) {
        this.pidController = createPidControllerState();
      }
      this.pidController.active = false;
      this.pidController.stableTicks = 0;
      resetPidAxisState(this.pidController.axes.x);
      resetPidAxisState(this.pidController.axes.y);
      resetPidAxisState(this.pidController.axes.z);
    },

    scheduleSteadyControllerStep: function (source) {
      var self = this;
      if (!this.pidController || !this.pidController.active || this.steadyControllerTimer) {
        return;
      }
      this.steadyControllerTimer = setTimeout(function () {
        self.steadyControllerTimer = null;
        if (!self.pidController || !self.pidController.active || self.renderPhase !== 'steady-fit') {
          return;
        }
        self.runSteadyControllerStep(source || 'steady-controller', self.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs);
        self.scheduleSteadyControllerStep(source || 'steady-controller');
      }, Math.max(50, this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs));
    },

    resolveControllerDtSeconds: function (dtMs) {
      var fallbackMs = Math.max(16, this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs);
      var resolvedMs = Number.isFinite(dtMs) && dtMs > 0 ? dtMs : fallbackMs;
      return clamp(resolvedMs / 1000, PID_PROFILE.dtMin, PID_PROFILE.dtMax);
    },

    applyEmergencyContainment: function (measurements, xTarget, yTarget, zTarget, source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !measurements || !xTarget || !yTarget || !zTarget) {
        return false;
      }

      var needsXGuard = xTarget.overflowing || xTarget.underflowing;
      var needsZGuard = zTarget.overflowing || zTarget.underflowing;
      var needsPlanarGuard = needsXGuard || needsZGuard;
      var needsHeightGuard = !yTarget.withinBand;
      if (!needsPlanarGuard && !needsHeightGuard) {
        return false;
      }

      var nextX = needsXGuard
        ? xTarget.targetScale
        : object3D.scale.x;
      var nextZ = needsZGuard
        ? zTarget.targetScale
        : object3D.scale.z;
      var nextY = needsHeightGuard ? yTarget.targetScale : object3D.scale.y;

      if (yTarget.overflowing && yTarget.compromised && Number.isFinite(measurements.peakHeight) && measurements.peakHeight > 0) {
        var heightFactor = (Number.isFinite(yTarget.setpointHeight) ? yTarget.setpointHeight : measurements.peakHeight)
          / measurements.peakHeight;
        if (Number.isFinite(heightFactor) && heightFactor > 0 && heightFactor < 1) {
          var dampedHeightFactor = Math.max(0.000001, heightFactor * 0.985);
          if (this.axisContributesToPeakHeight('x', measurements.peakHeight)) {
            nextX = Math.min(nextX, object3D.scale.x * dampedHeightFactor);
          }
          if (this.axisContributesToPeakHeight('z', measurements.peakHeight)) {
            nextZ = Math.min(nextZ, object3D.scale.z * dampedHeightFactor);
          }
        }
      }

      if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZ) || nextX <= 0 || nextY <= 0 || nextZ <= 0) {
        this.warnInvalidTransform('emergency-containment-invalid-target', {
          source: source || 'steady-fit',
          nextX: nextX,
          nextY: nextY,
          nextZ: nextZ
        });
        return false;
      }

      var changed = Math.abs(nextX - object3D.scale.x) > 0.0001
        || Math.abs(nextY - object3D.scale.y) > 0.0001
        || Math.abs(nextZ - object3D.scale.z) > 0.0001;
      if (!changed) {
        return false;
      }

      object3D.scale.set(nextX, nextY, nextZ);
      object3D.updateMatrixWorld(true);
      var nextMeasurements = this.measureBounds();
      if (nextMeasurements) {
        this.applyAnchorPlacement(nextMeasurements);
      }
      this.syncTransformAttributes();
      if (this.pidController) {
        this.pidController.stableTicks = 0;
        resetPidAxisState(this.pidController.axes.x);
        resetPidAxisState(this.pidController.axes.y);
        resetPidAxisState(this.pidController.axes.z);
      }
      debugLog('emergency-containment-applied', {
        source: source || 'steady-fit',
        xUnderflowing: !!xTarget.underflowing,
        xOverflowing: !!xTarget.overflowing,
        yUnderflowing: !!yTarget.underflowing,
        yOverflowing: !!yTarget.overflowing,
        zUnderflowing: !!zTarget.underflowing,
        zOverflowing: !!zTarget.overflowing,
        xScale: toFixedNumber(object3D.scale.x),
        yScale: toFixedNumber(object3D.scale.y),
        zScale: toFixedNumber(object3D.scale.z)
      });
      return true;
    },

    runSteadyControllerStep: function (source, dtMs) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var measurements = this.measureBounds();
      if (!hasUsableMeasurements(measurements)) {
        this.markWaitingGeometry('waiting-geometry', this.normalizationGeneration, {
          source: source || 'steady-fit',
          phase: this.renderPhase
        });
        return false;
      }

      if (this.applyHardHeightGuard(measurements, (source || 'steady-fit') + '-hard-height-guard')) {
        this.scheduleSteadyControllerStep(source || 'steady-fit');
        return true;
      }

      var steadyRange = resolveSteadyPlanarRange(this.data);
      var containmentLimits = computeContainmentLimits(this.data);
      var xTarget = computePlanarAxisTargetScale(
        measurements.primary.size.x,
        measurements.containment.size.x,
        object3D.scale.x,
        containmentLimits.containmentWidthLimit,
        steadyRange,
        this.data.containmentToleranceRatio,
        this.data.planarUnderflowCorrectionEnabled !== false
      );
      var zTarget = computePlanarAxisTargetScale(
        measurements.primary.size.z,
        measurements.containment.size.z,
        object3D.scale.z,
        containmentLimits.containmentDepthLimit,
        steadyRange,
        this.data.containmentToleranceRatio,
        this.data.planarUnderflowCorrectionEnabled !== false
      );
      var heightTargets = resolveHeightBandTargets(this.data);
      var yTarget = computeHeightBandTargetScale(
        measurements.peakHeight,
        object3D.scale.y,
        heightTargets,
        Math.max(0.001, this.data.yScaleMin),
        Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax),
        this.data.heightUnderflowCorrectionEnabled !== false
      ) || createNeutralHeightBandTarget(object3D.scale.y, 'height-unavailable');

      if (!xTarget || !zTarget) {
        return false;
      }

      xTarget = this.constrainPlanarTargetForMeasuredHeight('x', xTarget, object3D.scale.x, yTarget, measurements, heightTargets);
      zTarget = this.constrainPlanarTargetForMeasuredHeight('z', zTarget, object3D.scale.z, yTarget, measurements, heightTargets);

      if (this.applyEmergencyContainment(measurements, xTarget, yTarget, zTarget, source || 'steady-fit')) {
        this.scheduleSteadyControllerStep(source || 'steady-fit');
        return true;
      }

      if (xTarget.compromised || zTarget.compromised) {
        this.warnMinimumCompromised({
          source: source || 'steady-fit',
          reason: xTarget.compromised && zTarget.compromised ? 'axis-mixed' : (xTarget.compromised ? xTarget.reason : zTarget.reason),
          xRatio: toFixedNumber(xTarget.ratio),
          zRatio: toFixedNumber(zTarget.ratio),
          xSetpointRatio: toFixedNumber(xTarget.setpointRatio),
          zSetpointRatio: toFixedNumber(zTarget.setpointRatio),
          xTargetScale: toFixedNumber(xTarget.targetScale),
          zTargetScale: toFixedNumber(zTarget.targetScale),
          containmentWidthLimit: toFixedNumber(containmentLimits.containmentWidthLimit),
          containmentDepthLimit: toFixedNumber(containmentLimits.containmentDepthLimit)
        });
      }

      var dtSeconds = this.resolveControllerDtSeconds(dtMs);
      var xStep = stepPidAxis(this.pidController.axes.x, object3D.scale.x, xTarget.targetScale, dtSeconds, PID_PROFILE.planar);
      var yStep = stepPidAxis(this.pidController.axes.y, object3D.scale.y, yTarget.targetScale, dtSeconds, PID_PROFILE.vertical);
      var zStep = stepPidAxis(this.pidController.axes.z, object3D.scale.z, zTarget.targetScale, dtSeconds, PID_PROFILE.planar);

      var changed = false;
      if (
        Number.isFinite(xStep.nextValue)
        && Number.isFinite(yStep.nextValue)
        && Number.isFinite(zStep.nextValue)
        && xStep.nextValue > 0
        && yStep.nextValue > 0
        && zStep.nextValue > 0
      ) {
        changed = Math.abs(xStep.nextValue - object3D.scale.x) > 0.0001
          || Math.abs(yStep.nextValue - object3D.scale.y) > 0.0001
          || Math.abs(zStep.nextValue - object3D.scale.z) > 0.0001;
        if (changed) {
          object3D.scale.set(xStep.nextValue, yStep.nextValue, zStep.nextValue);
          object3D.updateMatrixWorld(true);
        }
      }

      var nextMeasurements = this.measureBounds();
      var moved = nextMeasurements ? this.applyAnchorPlacement(nextMeasurements) : false;
      if (nextMeasurements && hasUsableMeasurements(nextMeasurements)) {
        this.captureStableTransform();
      }
      if (changed || moved) {
        this.syncTransformAttributes();
      }

      if (xStep.stable && yStep.stable && zStep.stable) {
        this.pidController.stableTicks += 1;
      } else {
        this.pidController.stableTicks = 0;
      }

      if (this.pidController.stableTicks >= PID_PROFILE.stableTicks) {
        this.deactivateSteadyController();
      } else {
        this.scheduleSteadyControllerStep(source || 'steady-fit');
      }

      debugLog('steady-controller-step', {
        source: source || 'steady-fit',
        xScale: toFixedNumber(object3D.scale.x),
        yScale: toFixedNumber(object3D.scale.y),
        zScale: toFixedNumber(object3D.scale.z),
        xTarget: toFixedNumber(xTarget.targetScale),
        yTarget: toFixedNumber(yTarget.targetScale),
        zTarget: toFixedNumber(zTarget.targetScale),
        stableTicks: this.pidController.stableTicks
      });

      return changed || moved;
    },

    applyBootstrapPlanarFit: function (measurements, source) {
      if (!measurements || !isFiniteBoundsInfo(measurements.primary) || !isFiniteBoundsInfo(measurements.containment)) {
        return false;
      }

      var bootstrapScale = computeBootstrapPlanarScale(measurements.primary, measurements.containment, this.data);
      if (!bootstrapScale) {
        return false;
      }

      var changed = false;
      if (Math.abs(bootstrapScale.xFactor - 1) > 0.0005 || Math.abs(bootstrapScale.zFactor - 1) > 0.0005) {
        changed = this.applyScaleFactors(
          clamp(bootstrapScale.xFactor, 0.2, 4),
          1,
          clamp(bootstrapScale.zFactor, 0.2, 4)
        );
      }

      if (changed) {
        debugTable('bootstrap-planar-adjusted', [{
          source: source || 'bootstrap',
          xFactor: toFixedNumber(bootstrapScale.xFactor),
          zFactor: toFixedNumber(bootstrapScale.zFactor),
          bootstrapPlanarMaxRatio: toFixedNumber(bootstrapScale.bootstrapPlanarMaxRatio)
        }]);
      }

      return changed;
    },

    applySteadyPlanarFit: function (measurements, source) {
      if (!measurements || !isFiniteBoundsInfo(measurements.primary) || !isFiniteBoundsInfo(measurements.containment)) {
        return false;
      }

      var planarBand = computePlanarBandScale(measurements.primary, measurements.containment, this.data);
      if (!planarBand) {
        return false;
      }

      if (planarBand.compromised) {
        this.warnMinimumCompromised({
          source: source || 'steady-fit',
          reason: planarBand.reason,
          xMinRequiredFactor: toFixedNumber(planarBand.x.minRequiredFactor),
          zMinRequiredFactor: toFixedNumber(planarBand.z.minRequiredFactor),
          xMaxAllowedByRange: Number.isFinite(planarBand.x.maxAllowedByRange) ? toFixedNumber(planarBand.x.maxAllowedByRange) : null,
          zMaxAllowedByRange: Number.isFinite(planarBand.z.maxAllowedByRange) ? toFixedNumber(planarBand.z.maxAllowedByRange) : null,
          xMaxAllowedByContainment: Number.isFinite(planarBand.x.maxAllowedByContainment) ? toFixedNumber(planarBand.x.maxAllowedByContainment) : null,
          zMaxAllowedByContainment: Number.isFinite(planarBand.z.maxAllowedByContainment) ? toFixedNumber(planarBand.z.maxAllowedByContainment) : null,
          primaryWidth: toFixedNumber(measurements.primary.size.x),
          primaryDepth: toFixedNumber(measurements.primary.size.z),
          containmentWidth: toFixedNumber(measurements.containment.size.x),
          containmentDepth: toFixedNumber(measurements.containment.size.z),
          containmentWidthLimit: toFixedNumber(planarBand.containmentWidthLimit),
          containmentDepthLimit: toFixedNumber(planarBand.containmentDepthLimit)
        });
      }

      var xFactor = softenFactor(planarBand.xFactor, clamp(this.data.containmentDamping, 0.8, 0.999));
      var zFactor = softenFactor(planarBand.zFactor, clamp(this.data.containmentDamping, 0.8, 0.999));
      var changed = false;
      if (Math.abs(xFactor - 1) > 0.0005 || Math.abs(zFactor - 1) > 0.0005) {
        changed = this.applyScaleFactors(
          clamp(xFactor, 0.2, 4),
          1,
          clamp(zFactor, 0.2, 4)
        );
      }

      if (changed) {
        debugTable('steady-planar-adjusted', [{
          source: source || 'steady-fit',
          xFactor: toFixedNumber(planarBand.xFactor),
          zFactor: toFixedNumber(planarBand.zFactor),
          xRatio: toFixedNumber(planarBand.x.ratio),
          zRatio: toFixedNumber(planarBand.z.ratio)
        }]);
      }

      return changed;
    },

    enforceHeightBand: function (source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var measurements = this.measureBounds();
      if (!measurements || !isFiniteBoundsInfo(measurements.primary)) {
        return false;
      }

      var bandTargets = resolveHeightBandTargets(this.data);
      var result = computeHeightBandScale(
        measurements.peakHeight,
        object3D.scale.y,
        bandTargets,
        Math.max(0.001, this.data.yScaleMin),
        Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax),
        this.data.heightUnderflowCorrectionEnabled !== false
      );

      if (!result || !result.changed) {
        return false;
      }

      object3D.scale.y = result.targetY;
      object3D.updateMatrixWorld(true);

      var nextMeasurements = this.measureBounds();
      if (nextMeasurements) {
        this.applyAnchorPlacement(nextMeasurements);
      }
      this.syncTransformAttributes();
      debugLog('height-band-adjusted', {
        source: source || 'unknown',
        minHeight: toFixedNumber(bandTargets.minHeight),
        maxHeight: toFixedNumber(bandTargets.maxHeight),
        peakHeight: nextMeasurements ? toFixedNumber(nextMeasurements.peakHeight) : null,
        yScale: toFixedNumber(object3D.scale.y)
      });
      return true;
    },

    enforceEnvelope: function (source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var maxIterations = Math.max(1, this.data.containmentMaxIterations);
      var changed = false;

      for (var i = 0; i < maxIterations; i += 1) {
        var measurements = this.measureBounds();
      if (!measurements || !isFiniteBoundsInfo(measurements.primary) || !isFiniteBoundsInfo(measurements.containment) || !isFiniteBoundsInfo(measurements.full)) {
        this.warnInvalidTransform('envelope-invalid-bounds', { source: source || 'unknown', iteration: i });
        return changed;
      }

        if (!hasPositiveSize(measurements.primary.size)) {
          return changed;
        }

        var localChanged = this.renderPhase === 'steady-fit'
          ? this.applySteadyPlanarFit(measurements, source || 'steady-fit')
          : this.applyBootstrapPlanarFit(measurements, source || 'bootstrap-visible');

        var nextMeasurements = this.measureBounds();
        var moved = nextMeasurements ? this.applyAnchorPlacement(nextMeasurements) : false;
        changed = changed || localChanged || moved;

        if (!localChanged && !moved) {
          break;
        }
      }

      if (changed) {
        object3D.updateMatrixWorld(true);
        this.syncTransformAttributes();
        debugTable('envelope-adjusted', [{
          source: source || 'unknown',
          scaleX: toFixedNumber(object3D.scale.x),
          scaleY: toFixedNumber(object3D.scale.y),
          scaleZ: toFixedNumber(object3D.scale.z)
        }]);
      }

      return changed;
    },

    runMaintenancePass: function (source) {
      var axisIssue = this.inspectAxisIssue();
      if (axisIssue) {
        this.lastNormalizationIssue = {
          reason: axisIssue.reason || 'invalid-axis-length',
          details: axisIssue,
          retryCount: this.retryCount,
          generation: this.normalizationGeneration,
          at: Date.now()
        };
        resizeTrace('invalid-axis-length-detected', {
          source: source || 'maintenance',
          issue: axisIssue
        });
        return false;
      }
      var guardMeasurements = this.measureBounds();
      if (guardMeasurements && this.applyHardHeightGuard(guardMeasurements, (source || 'maintenance') + '-hard-height-guard')) {
        return true;
      }
      if ((this.containmentTransition && this.containmentTransition.active) || isChartAnimationActive(this.el)) {
        return false;
      }
      if (this.renderPhase === 'steady-fit') {
        return this.runSteadyControllerStep(source || 'steady-fit', this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs);
      }
      var changedEnvelope = this.enforceEnvelope(source);
      var changedHeight = this.enforceHeightBand(source || 'maintenance-height-band');
      var measurements = this.measureBounds();
      var moved = measurements ? this.applyAnchorPlacement(measurements) : false;
      if (measurements && this.el && this.el.object3D) {
        this.lastStableTransform = cloneTransform(this.el.object3D) || this.lastStableTransform;
      }
      if (changedHeight || changedEnvelope || moved) {
        this.syncTransformAttributes();
      }
      return changedHeight || changedEnvelope || moved;
    },

    stopStabilizationLoop: function () {
      if (this.stabilizationTimer) {
        clearTimeout(this.stabilizationTimer);
        this.stabilizationTimer = null;
      }
      this.stabilizationChecksRemaining = 0;
      this.stabilizationStableCount = 0;
    },

    startStabilizationWindow: function (reason, generation) {
      this.stopStabilizationLoop();
      this.stabilizationChecksRemaining = Math.max(1, this.data.stabilizationMaxChecks || DEFAULTS.stabilizationMaxChecks);
      this.stabilizationStableCount = 0;
      this.scheduleStabilizationStep(reason || 'normalize', generation);
    },

    scheduleStabilizationStep: function (reason, generation) {
      var self = this;
      if (this.stabilizationChecksRemaining <= 0) {
        return;
      }
      this.stabilizationTimer = setTimeout(function () {
        self.stabilizationTimer = null;
        self.runStabilizationStep(reason || 'stabilization', generation);
      }, Math.max(50, this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs));
    },

    runStabilizationStep: function (reason, generation) {
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      if (!this.data.enabled || !this.normalized || !this.el || !this.el.object3D) {
        this.stopStabilizationLoop();
        return;
      }

      var changed = this.runMaintenancePass(reason || 'stabilization');
      var measurements = this.measureBounds();
      var signature = measurements ? buildMeasurementSignature(measurements, this.el.object3D) : null;

      if (!hasUsableMeasurements(measurements)) {
        this.markWaitingGeometry('waiting-geometry', generation, {
          source: reason || 'stabilization',
          phase: this.renderPhase
        });
        this.stabilizationChecksRemaining -= 1;
        if (this.stabilizationChecksRemaining > 0) {
          this.scheduleStabilizationStep(reason || 'stabilization', generation);
        } else {
          this.stopStabilizationLoop();
        }
        return;
      }

      if (changed || !signature || signature !== this.lastMeasurementSignature) {
        this.stabilizationStableCount = 0;
      } else {
        this.stabilizationStableCount += 1;
      }

      this.lastMeasurementSignature = signature;
      this.stabilizationChecksRemaining -= 1;

      debugLog('stabilization-step', {
        reason: reason || 'stabilization',
        changed: changed,
        phase: this.renderPhase,
        remaining: this.stabilizationChecksRemaining,
        stableCount: this.stabilizationStableCount
      });

      if (
        this.renderPhase === 'bootstrap-visible'
        && this.stabilizationStableCount >= Math.max(1, this.data.stabilizationStablePasses || DEFAULTS.stabilizationStablePasses)
      ) {
        this.renderPhase = 'steady-fit';
        this.stabilizationStableCount = 0;
        this.lastMeasurementSignature = null;
        this.activateSteadyController();
        this.runSteadyControllerStep('steady-transition', this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs);
        this.stopStabilizationLoop();
        return;
      }

      if (this.stabilizationChecksRemaining <= 0 || this.stabilizationStableCount >= Math.max(1, this.data.stabilizationStablePasses || DEFAULTS.stabilizationStablePasses)) {
        this.stopStabilizationLoop();
        return;
      }

      this.scheduleStabilizationStep(reason || 'stabilization', generation);
    },

    renormalize: function (reason) {
      var generation = this.bumpNormalizationGeneration();
      if (this.containmentTransition && this.containmentTransition.active) {
        this.cancelContainmentTransition();
      }
      this.captureStableTransform();
      this.normalized = false;
      this.renderPhase = 'waiting-geometry';
      this.retryCount = 0;
      this.deactivateSteadyController();
      this.stopStabilizationLoop();
      if (this.el && this.el.object3D) {
        if (this.lastStableTransform) {
          restoreTransform(this.el.object3D, this.lastStableTransform);
        } else if (this.baseScale) {
          this.resetToBaseScale();
        }
        this.el.object3D.visible = true;
      }
      this.tryNormalize(reason || 'manual-renormalize', generation);
    },

    tryNormalize: function (reason, generation) {
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      var el = this.el;
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!el || !el.object3D || !three || !three.Box3 || !three.Vector3) {
        this.scheduleRetry('missing-three-or-object', generation);
        return;
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      this.ensureBaseScale();
      var previousTransform = cloneTransform(el.object3D) || this.lastStableTransform;
      var axisIssue = this.inspectAxisIssue();
      if (axisIssue) {
        resizeTrace('invalid-axis-length-detected', {
          reason: reason || 'normalize',
          generation: generation,
          issue: axisIssue
        });
        this.scheduleRetry(axisIssue.reason || 'invalid-axis-length', generation, axisIssue);
        return;
      }

      var initialMeasurements = this.measureBounds();
      if (!hasUsableMeasurements(initialMeasurements)) {
        resizeTrace('invalid-initial-bounds', {
          reason: reason || 'normalize',
          generation: generation,
          hasMeasurements: !!initialMeasurements,
          primaryWidth: initialMeasurements && initialMeasurements.primary ? toFixedNumber(initialMeasurements.primary.size.x) : null,
          primaryHeight: initialMeasurements && initialMeasurements.primary ? toFixedNumber(initialMeasurements.primary.size.y) : null,
          primaryDepth: initialMeasurements && initialMeasurements.primary ? toFixedNumber(initialMeasurements.primary.size.z) : null
        });
        if (previousTransform) {
          restoreTransform(el.object3D, previousTransform);
        }
        this.markWaitingGeometry('waiting-geometry', generation, {
          source: reason || 'normalize',
          generation: generation
        });
        this.scheduleRetry('waiting-geometry', generation);
        return;
      }

      this.renderPhase = 'bootstrap-visible';
      this.applyBootstrapPlanarFit(initialMeasurements, reason || 'bootstrap-visible');

      var fittedMeasurements = this.measureBounds();
      if (!hasUsableMeasurements(fittedMeasurements)) {
        resizeTrace('invalid-fitted-bounds', {
          reason: reason || 'normalize',
          generation: generation
        });
        if (previousTransform) {
          restoreTransform(el.object3D, previousTransform);
        }
        this.markWaitingGeometry('waiting-geometry', generation, {
          source: reason || 'normalize',
          generation: generation
        });
        this.scheduleRetry('waiting-geometry', generation);
        return;
      }

      this.applyAnchorPlacement(fittedMeasurements);
      this.runMaintenancePass('bootstrap-visible');
      var guardedMeasurements = this.measureBounds();
      if (guardedMeasurements) {
        this.applyHardHeightGuard(guardedMeasurements, (reason || 'normalize') + '-hard-height-guard');
      }

      if (!isFiniteVector3Like(el.object3D.position) || !isFiniteVector3Like(el.object3D.scale)) {
        resizeTrace('invalid-final-transform', {
          reason: reason || 'normalize',
          generation: generation,
          position: el.object3D.position,
          scale: el.object3D.scale
        });
        if (previousTransform) {
          restoreTransform(el.object3D, previousTransform);
        }
        this.scheduleRetry('invalid-final-transform', generation);
        return;
      }

      this.syncTransformAttributes();
      this.normalized = true;
      this.lastNormalizationIssue = null;
      this.lastSuccessfulNormalizeAt = Date.now();
      this.nextContainmentCheckAt = 0;
      this.lastMeasurementSignature = buildMeasurementSignature(this.measureBounds(), el.object3D);
      var finalTransform = cloneTransform(el.object3D);
      if (finalTransform && shouldAnimateContainmentTransform(reason, previousTransform, finalTransform, this.data)) {
        restoreTransform(el.object3D, previousTransform);
        this.syncTransformAttributes();
        this.startContainmentTransition(previousTransform, finalTransform, reason || 'normalize');
      } else {
        this.captureStableTransform();
      }
      this.deactivateSteadyController();
      el.object3D.visible = true;

      var finalMeasurements = this.measureBounds();
      if (finalMeasurements) {
        debugTable('normalized-chart', [{
          reason: reason || 'normalize',
          primaryWidth: toFixedNumber(finalMeasurements.primary.size.x),
          primaryHeight: toFixedNumber(finalMeasurements.primary.size.y),
          peakHeight: toFixedNumber(finalMeasurements.peakHeight),
          primaryDepth: toFixedNumber(finalMeasurements.primary.size.z),
          containmentWidth: toFixedNumber(finalMeasurements.containment.size.x),
          containmentDepth: toFixedNumber(finalMeasurements.containment.size.z),
          fullWidth: toFixedNumber(finalMeasurements.full.size.x),
          fullHeight: toFixedNumber(finalMeasurements.full.size.y),
          fullDepth: toFixedNumber(finalMeasurements.full.size.z),
          targetWidth: this.data.targetWidth,
          targetHeight: this.data.targetHeight,
          targetDepth: this.data.targetDepth
        }]);
      }

      this.startStabilizationWindow(reason || 'normalize', generation);
    },

    scheduleRetry: function (reason, generation, details) {
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      this.retryCount += 1;
      this.lastNormalizationIssue = {
        reason: reason,
        details: details || null,
        retryCount: this.retryCount,
        generation: generation,
        at: Date.now()
      };
      if (
        this.retryCount === 1
        || this.retryCount === 5
        || this.retryCount % 10 === 0
        || this.retryCount > this.data.retries
      ) {
        resizeTrace('retry-normalize', {
          reason: reason,
          generation: generation,
          retryCount: this.retryCount,
          maxRetries: this.data.retries
        });
      }
      if (this.retryCount > this.data.retries) {
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        if (this.el.object3D) {
          this.el.object3D.visible = true;
        }
        this.markWaitingGeometry(reason === 'invalid-axis-length' ? reason : 'waiting-geometry', generation, details);
        if (reason === 'invalid-axis-length' || DEBUG_STATE.enabled) {
          console.warn('[CodeXR][AnalysisTable] Could not normalize after retries:', {
            reason: reason,
            retries: this.retryCount - 1,
            approxWaitMs: (this.retryCount - 1) * this.data.retryDelayMs
          });
        }
        return;
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
      }

      var self = this;
      var backoffDelay = Math.min(
        this.data.retryDelayMs + (this.retryCount * 20),
        Math.max(this.data.retryDelayMs, 420)
      );
      debugLog('retry-normalize', {
        reason: reason,
        retryCount: this.retryCount,
        delayMs: backoffDelay
      });
      this.retryTimer = setTimeout(function () {
        self.tryNormalize(reason, generation);
      }, backoffDelay);
    }
  };

  var analysisTableDefinition = {
    schema: {
      mode: { default: 'single', oneOf: ['selection', 'single', 'historical-compare', 'project-evolution', 'dependency-graph'] },
      width: { type: 'number', default: 6.514 },
      depth: { type: 'number', default: 4.118 },
      anchorX: { type: 'number', default: DEFAULTS.anchorX },
      anchorY: { type: 'number', default: DEFAULTS.anchorY },
      anchorZ: { type: 'number', default: DEFAULTS.anchorZ },
      topThickness: { type: 'number', default: 0.14 },
      baseRadius: { type: 'number', default: 1.45 },
      baseHeight: { type: 'number', default: 0.78 }
    },

    init: function () {
      this.groupEl = root.document.createElement('a-entity');
      this.baseEl = root.document.createElement('a-cylinder');
      this.topEl = root.document.createElement('a-box');
      this.trimEl = root.document.createElement('a-box');
      this.leftZoneEl = root.document.createElement('a-box');
      this.rightZoneEl = root.document.createElement('a-box');
      this.dividerEl = root.document.createElement('a-box');
      this.anchorPlaneEl = root.document.createElement('a-plane');
      this.warningGroupEl = root.document.createElement('a-entity');
      this.warningTextEls = ['front', 'back', 'left', 'right'].map(function (edge) {
        var textEl = root.document.createElement('a-text');
        textEl.setAttribute('data-codexr-role', 'analysis-table-warning auxiliary');
        textEl.setAttribute('data-codexr-warning-edge', edge);
        textEl.setAttribute('align', 'center');
        textEl.setAttribute('baseline', 'center');
        textEl.setAttribute('width', 2.6);
        textEl.setAttribute('wrap-count', 28);
        return textEl;
      });

      this.groupEl.setAttribute('id', 'codexr-analysis-table-geometry');
      this.topEl.setAttribute('class', 'babiaxraycasterclass');
      this.baseEl.setAttribute('class', 'babiaxraycasterclass');
      this.anchorPlaneEl.setAttribute('id', 'codexr-analysis-table-anchor-plane');
      this.anchorPlaneEl.setAttribute('class', 'codexr-tabletop-anchor-plane codexr-analysis-table-debug');
      this.anchorPlaneEl.setAttribute('data-codexr-role', 'tabletop-anchor debug');
      this.anchorPlaneEl.setAttribute('visible', false);
      this.warningGroupEl.setAttribute('id', 'codexr-analysis-table-warning');
      this.warningGroupEl.setAttribute('data-codexr-role', 'analysis-table-warning auxiliary');
      this.warningGroupEl.setAttribute('visible', false);

      this.groupEl.appendChild(this.baseEl);
      this.groupEl.appendChild(this.trimEl);
      this.groupEl.appendChild(this.topEl);
      this.groupEl.appendChild(this.leftZoneEl);
      this.groupEl.appendChild(this.rightZoneEl);
      this.groupEl.appendChild(this.dividerEl);
      this.groupEl.appendChild(this.anchorPlaneEl);
      this.warningTextEls.forEach(function (textEl) {
        this.warningGroupEl.appendChild(textEl);
      }, this);
      this.groupEl.appendChild(this.warningGroupEl);
      this.el.appendChild(this.groupEl);

      this.refreshGeometry();
    },

    update: function () {
      this.refreshGeometry();
    },

    remove: function () {
      if (this.groupEl && this.groupEl.parentNode) {
        this.groupEl.parentNode.removeChild(this.groupEl);
      }
    },

    refreshGeometry: function () {
      if (!this.groupEl) {
        return;
      }
      var comparison = this.data.mode === 'historical-compare';
      var theme = MODE_THEME_BY_ID[this.data.mode] || MODE_THEME_BY_ID.single;
      var topY = this.data.anchorY - 0.15;
      var halfWidth = (this.data.width - 0.18) / 2;
      this.groupEl.setAttribute('position', this.data.anchorX + ' ' + topY + ' ' + this.data.anchorZ);

      this.topEl.setAttribute('width', this.data.width);
      this.topEl.setAttribute('height', this.data.topThickness);
      this.topEl.setAttribute('depth', this.data.depth);
      this.topEl.setAttribute(
        'material',
        theme.top
      );

      this.trimEl.setAttribute('width', this.data.width + 0.08);
      this.trimEl.setAttribute('height', 0.05);
      this.trimEl.setAttribute('depth', this.data.depth + 0.08);
      this.trimEl.setAttribute('position', '0 -0.085 0');
      this.trimEl.setAttribute(
        'material',
        theme.trim
      );

      this.baseEl.setAttribute('radius', this.data.baseRadius);
      this.baseEl.setAttribute('height', this.data.baseHeight);
      this.baseEl.setAttribute('position', '0 ' + (-(this.data.baseHeight / 2) - 0.07) + ' 0');
      this.baseEl.setAttribute(
        'material',
        theme.base
      );

      [
        { el: this.leftZoneEl, x: -(halfWidth / 2) - 0.045, color: '#256d85' },
        { el: this.rightZoneEl, x: (halfWidth / 2) + 0.045, color: '#2b8a66' }
      ].forEach(function (zone) {
        zone.el.setAttribute('visible', comparison);
        zone.el.setAttribute('width', halfWidth);
        zone.el.setAttribute('height', 0.018);
        zone.el.setAttribute('depth', Math.max(0.2, this.data.depth - 0.24));
        zone.el.setAttribute('position', zone.x + ' 0.082 0');
        zone.el.setAttribute('material', 'color: ' + zone.color + '; opacity: 0.42; transparent: true');
      }, this);

      this.dividerEl.setAttribute('visible', comparison);
      this.dividerEl.setAttribute('width', 0.05);
      this.dividerEl.setAttribute('height', 0.05);
      this.dividerEl.setAttribute('depth', this.data.depth - 0.18);
      this.dividerEl.setAttribute('position', '0 0.09 0');
      this.dividerEl.setAttribute('material', 'color: #b8f3ff; emissive: #246d7a; emissiveIntensity: 0.25');

      var anchorPlaneLocalY = getTableTopY({
        anchorY: this.data.anchorY,
        tableTopSurfaceOffsetY: DEFAULTS.tableTopSurfaceOffsetY,
        tabletopAnchorEpsilon: DEFAULTS.tabletopAnchorEpsilon
      }) - topY;
      this.anchorPlaneEl.setAttribute('position', '0 ' + anchorPlaneLocalY + ' 0');
      this.anchorPlaneEl.setAttribute('rotation', '-90 0 0');
      this.anchorPlaneEl.setAttribute('width', Math.max(0.01, this.data.width - 0.18));
      this.anchorPlaneEl.setAttribute('height', Math.max(0.01, this.data.depth - 0.18));
      this.anchorPlaneEl.setAttribute('material', 'color: #22d3ee; opacity: 0.26; transparent: true; side: double; shader: flat');

      var warningY = anchorPlaneLocalY + 0.085;
      var halfDepth = this.data.depth / 2;
      var halfWidth = this.data.width / 2;
      var warningPositions = {
        front: '0 ' + warningY + ' ' + (halfDepth - 0.18),
        back: '0 ' + warningY + ' ' + (-(halfDepth - 0.18)),
        left: (-(halfWidth - 0.18)) + ' ' + warningY + ' 0',
        right: (halfWidth - 0.18) + ' ' + warningY + ' 0'
      };
      var warningRotations = {
        front: '-35 0 0',
        back: '-35 180 0',
        left: '-35 90 0',
        right: '-35 -90 0'
      };
      this.warningTextEls.forEach(function (textEl) {
        var edge = textEl.getAttribute('data-codexr-warning-edge');
        textEl.setAttribute('position', warningPositions[edge] || warningPositions.front);
        textEl.setAttribute('rotation', warningRotations[edge] || warningRotations.front);
      });
    },

    setContainmentWarning: function (diagnostic) {
      if (!this.warningGroupEl || !this.warningTextEls) {
        return false;
      }
      var active = !!(diagnostic && diagnostic.level && diagnostic.level !== 'ok' && diagnostic.message);
      this.warningGroupEl.setAttribute('visible', active);
      if (!active) {
        return true;
      }
      var color = diagnostic.level === 'error' ? '#fecaca' : '#fde68a';
      var materialColor = diagnostic.level === 'error' ? '#dc2626' : '#d97706';
      this.warningTextEls.forEach(function (textEl) {
        textEl.setAttribute('value', diagnostic.message);
        textEl.setAttribute('color', color);
        textEl.setAttribute('material', 'color: ' + materialColor + '; opacity: 0.76; transparent: true; shader: flat');
      });
      return true;
    }
  };

  if (registerTable) {
    AFRAME.registerComponent(TABLE_COMPONENT_NAME, analysisTableDefinition);
  }
  if (registerContainment) {
    AFRAME.registerComponent(COMPONENT_NAME, componentDefinition);
  }
  function getContainmentCharts(doc) {
    if (!doc || !doc.querySelectorAll) {
      return [];
    }

    var charts = doc.querySelectorAll('[' + COMPONENT_NAME + ']');
    return Array.prototype.slice.call(charts || []);
  }

  function resolveContainmentComponentInfo(chartEl) {
    if (!chartEl) {
      return null;
    }

    var component = chartEl.components && chartEl.components[COMPONENT_NAME];
    if (!component) {
      return null;
    }

    return {
      chartEl: chartEl,
      component: component,
      attrName: COMPONENT_NAME,
      data: component.data || DEFAULTS
    };
  }

  function getAnalysisTableElement() {
    var doc = root.document;
    return doc && doc.getElementById ? doc.getElementById('codexrAnalysisTable') : null;
  }

  function getAnalysisTableComponent() {
    var table = getAnalysisTableElement();
    return table && table.components ? table.components[TABLE_COMPONENT_NAME] : null;
  }

  function getCurrentTableMode() {
    var component = getAnalysisTableComponent();
    if (component && component.data && component.data.mode) {
      return component.data.mode;
    }
    var table = getAnalysisTableElement();
    var attr = table && table.getAttribute ? table.getAttribute(TABLE_COMPONENT_NAME) : null;
    if (attr && typeof attr === 'object' && attr.mode) {
      return attr.mode;
    }
    if (typeof attr === 'string') {
      var match = attr.match(/(?:^|;\s*)mode:\s*([^;]+)/);
      if (match) {
        return match[1].trim();
      }
    }
    return 'single';
  }

  function applyTableWarning(diagnostic) {
    var component = getAnalysisTableComponent();
    if (!component || typeof component.setContainmentWarning !== 'function') {
      return false;
    }
    return component.setContainmentWarning(diagnostic || { level: 'ok' });
  }

  function isEntityVisible(el) {
    var current = el;
    while (current && current !== root.document) {
      if (current.getAttribute) {
        var visibleAttr = current.getAttribute('visible');
        if (visibleAttr === false || visibleAttr === 'false') {
          return false;
        }
      }
      if (current.object3D && current.object3D.visible === false) {
        return false;
      }
      current = current.parentNode;
    }
    return true;
  }

  function getVisibleContainmentCharts(doc) {
    return getContainmentCharts(doc).filter(isEntityVisible);
  }

  function getVisibleDependencyGraphRoots(doc) {
    if (!doc || !doc.querySelectorAll) {
      return [];
    }
    var roots = doc.querySelectorAll(
      '#codexrDependencyGraph, [codexr-dependency-graph], [data-codexr-analysis-mode="dependency-graph"], [data-codexr-dependency-axes]'
    );
    return Array.prototype.slice.call(roots || []).filter(isEntityVisible);
  }

  function resolveWaitTarget(target, doc) {
    if (typeof target === 'function') {
      try {
        return resolveWaitTarget(target(), doc);
      } catch (error) {
        debugLog('wait-target-resolution-failed', {
          error: error && error.message ? error.message : String(error)
        });
        return null;
      }
    }

    if (typeof target === 'string') {
      var rawTarget = target.trim();
      if (!rawTarget || !doc) {
        return null;
      }

      var idCandidate = rawTarget.charAt(0) === '#' ? rawTarget.slice(1) : rawTarget;
      if (idCandidate && doc.getElementById) {
        var byId = doc.getElementById(idCandidate);
        if (byId) {
          return byId;
        }
      }

      if (doc.querySelector) {
        try {
          return doc.querySelector(rawTarget);
        } catch (error) {
          debugLog('wait-target-selector-failed', {
            target: rawTarget,
            error: error && error.message ? error.message : String(error)
          });
        }
      }
      return null;
    }

    return target || null;
  }

  function resolveDiagnosticTargets(targets, doc) {
    if (Array.isArray(targets) && targets.length) {
      return targets.map(function (target) {
        return resolveWaitTarget(target, doc);
      }).filter(function (chart) {
        return !!chart && isEntityVisible(chart);
      });
    }
    if (targets) {
      var chart = resolveWaitTarget(targets, doc);
      return chart && isEntityVisible(chart) ? [chart] : [];
    }
    return getVisibleContainmentCharts(doc);
  }

  function summarizeChartDiagnostic(status) {
    if (!status) {
      return {
        level: 'warning',
        reason: 'chart-status-unavailable',
        message: 'No chart detected'
      };
    }
    if (status.valid === false) {
      return {
        level: 'error',
        reason: status.reason || 'invalid-chart',
        message: status.message || 'Chart exceeds table limits'
      };
    }
    var details = status.details || {};
    if (details.heightOverflow || status.reason === 'height-overflow') {
      return {
        level: 'error',
        reason: 'height-overflow',
        message: 'Chart exceeds table limits',
        details: details
      };
    }
    if (details.compromised) {
      return {
        level: 'warning',
        reason: 'compromised',
        message: 'Chart is constrained by table limits',
        details: details
      };
    }
    if (details.needsCorrection) {
      return {
        level: 'ok',
        reason: status.reason === 'containment-correcting' || details.phase !== 'steady-fit'
          ? 'containment-correcting'
          : 'normalizing',
        message: '',
        details: details
      };
    }
    return {
      level: 'ok',
      reason: 'ok',
      message: ''
    };
  }

  function stabilizeTableDiagnostic(diagnostic) {
    if (!diagnostic || diagnostic.level === 'ok') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic || { level: 'ok' };
    }
    if (diagnostic.level === 'error') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic;
    }

    var reason = diagnostic.reason || diagnostic.message || 'warning';
    if (reason !== 'underflow' && reason !== 'normalizing') {
      TABLE_DIAGNOSTIC_STATE.key = '';
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = 0;
      return diagnostic;
    }

    var key = (diagnostic.mode || '') + ':' + reason + ':' + (diagnostic.chartCount || 0);
    var now = Date.now();
    if (TABLE_DIAGNOSTIC_STATE.key !== key) {
      TABLE_DIAGNOSTIC_STATE.key = key;
      TABLE_DIAGNOSTIC_STATE.firstSeenAt = now;
      return Object.assign({}, diagnostic, {
        level: 'ok',
        reason: reason + '-pending',
        message: ''
      });
    }
    if ((now - TABLE_DIAGNOSTIC_STATE.firstSeenAt) < TABLE_WARNING_PERSISTENCE_MS) {
      return Object.assign({}, diagnostic, {
        level: 'ok',
        reason: reason + '-pending',
        message: ''
      });
    }
    return diagnostic;
  }

  function buildActiveContainmentDiagnostics(targets) {
    var doc = root.document;
    var mode = getCurrentTableMode();
    if (mode === 'selection') {
      return {
        level: 'ok',
        mode: mode,
        chartCount: 0,
        statuses: [],
        reason: 'selection-mode'
      };
    }
    var charts = resolveDiagnosticTargets(targets, doc);
    if (!charts.length) {
      if (mode === 'dependency-graph' && getVisibleDependencyGraphRoots(doc).length) {
        return {
          level: 'ok',
          mode: mode,
          chartCount: 0,
          visualCount: getVisibleDependencyGraphRoots(doc).length,
          statuses: [],
          reason: 'dependency-graph-visible'
        };
      }
      return stabilizeTableDiagnostic({
        level: 'warning',
        mode: mode,
        chartCount: 0,
        statuses: [],
        reason: 'chart-not-found',
        message: 'No chart detected'
      });
    }
    var statuses = charts.map(function (chart) {
      return root[RUNTIME_GLOBAL_NAME].getChartStatus(chart);
    });
    var summaries = statuses.map(summarizeChartDiagnostic);
    var worst = summaries.find(function (diagnostic) {
      return diagnostic.level === 'error';
    }) || summaries.find(function (diagnostic) {
      return diagnostic.level === 'warning';
    }) || { level: 'ok', reason: 'ok', message: '' };
    return stabilizeTableDiagnostic(Object.assign({}, worst, {
      mode: mode,
      chartCount: charts.length,
      statuses: statuses
    }));
  }

  function buildScaleRangeSnapshot(data, chartCount) {
    var source = data || DEFAULTS;
    var min = Number.isFinite(source.minPlanarOccupancyRatio) ? source.minPlanarOccupancyRatio : DEFAULTS.minPlanarOccupancyRatio;
    var max = Number.isFinite(source.maxPlanarOccupancyRatio) ? source.maxPlanarOccupancyRatio : DEFAULTS.maxPlanarOccupancyRatio;

    return {
      charts: chartCount || 0,
      min: min,
      max: max,
      planar: {
        min: min,
        max: max
      }
    };
  }

  function buildScalePolicySnapshot(data, chartCount) {
    var source = data || DEFAULTS;
    return {
      charts: chartCount || 0,
      bootstrap: {
        max: Number.isFinite(source.bootstrapPlanarMaxRatio) ? source.bootstrapPlanarMaxRatio : DEFAULTS.bootstrapPlanarMaxRatio
      },
      steady: {
        min: Number.isFinite(source.minPlanarOccupancyRatio) ? source.minPlanarOccupancyRatio : DEFAULTS.minPlanarOccupancyRatio,
        max: Number.isFinite(source.maxPlanarOccupancyRatio) ? source.maxPlanarOccupancyRatio : DEFAULTS.maxPlanarOccupancyRatio
      },
      vertical: {
        min: Number.isFinite(source.heightBandMinRatio) ? source.heightBandMinRatio : DEFAULTS.heightBandMinRatio,
        max: Number.isFinite(source.heightBandMaxRatio) ? source.heightBandMaxRatio : DEFAULTS.heightBandMaxRatio
      }
    };
  }

  root[RUNTIME_GLOBAL_NAME] = root[RUNTIME_GLOBAL_NAME] || {};
  root[RUNTIME_GLOBAL_NAME].getChartStatus = function (target) {
    var doc = root.document;
    var chartEl = typeof target === 'string'
      ? (doc && doc.querySelector ? doc.querySelector(target) : null)
      : target;
    if (!chartEl && doc) {
      var charts = getVisibleContainmentCharts(doc);
      chartEl = charts.length ? charts[0] : null;
    }
    if (!chartEl) {
      return {
        ready: false,
        valid: false,
        reason: 'chart-not-found',
        message: 'The chart could not be found.'
      };
    }

    var component = chartEl.components && chartEl.components[COMPONENT_NAME];
    if (!component || typeof component.getChartStatus !== 'function') {
      return {
        ready: false,
        valid: false,
        reason: 'containment-component-missing',
        message: 'The chart containment runtime is not attached.'
      };
    }

    return component.getChartStatus();
  };
  root[RUNTIME_GLOBAL_NAME].waitForChartsStable = function (targets, options) {
    var doc = root.document;
    var targetList = Array.isArray(targets) ? targets : [targets];
    var timeoutMs = Math.max(1000, Number(options && options.timeoutMs) || 10000);
    var pollMs = Math.max(50, Number(options && options.pollMs) || 120);
    var stablePassesRequired = Math.max(1, Number(options && options.stablePasses) || 2);
    var startedAt = Date.now();
    var stablePasses = 0;

    return new Promise(function (resolve) {
      function inspect() {
        var statuses = targetList.map(function (target) {
          var chart = resolveWaitTarget(target, doc);
          return root[RUNTIME_GLOBAL_NAME].getChartStatus(chart);
        });
        applyTableWarning(buildActiveContainmentDiagnostics(targetList));
        var invalid = statuses.find(function (status) {
          return status && status.ready === true && status.valid === false;
        });
        if (invalid) {
          resolve({
            state: 'invalid',
            valid: false,
            stabilized: false,
            statuses: statuses,
            reason: invalid.reason || 'invalid-chart'
          });
          return;
        }

        var allReady = statuses.length > 0 && statuses.every(function (status) {
          return status && status.ready === true && status.valid === true;
        });
        var allStabilized = allReady && statuses.every(function (status) {
          return status.stabilized === true || status.geometryState === 'stabilized';
        });
        stablePasses = allStabilized ? stablePasses + 1 : 0;
        if (stablePasses >= stablePassesRequired) {
          resolve({
            state: 'stabilized',
            valid: true,
            stabilized: true,
            statuses: statuses
          });
          return;
        }

        if ((Date.now() - startedAt) >= timeoutMs) {
          resolve({
            state: allReady ? 'valid-timeout' : 'timeout',
            valid: allReady,
            stabilized: false,
            statuses: statuses,
            reason: allReady ? 'stabilization-timeout' : 'geometry-timeout'
          });
          return;
        }
        setTimeout(inspect, pollMs);
      }
      inspect();
    });
  };
  root[RUNTIME_GLOBAL_NAME].setMode = function (mode) {
    var nextMode = String(mode || 'single');
    var validModes = ['selection', 'single', 'historical-compare', 'project-evolution', 'dependency-graph'];
    if (validModes.indexOf(nextMode) === -1) {
      nextMode = 'single';
    }
    var table = root.document.getElementById?.('codexrAnalysisTable');
    table?.setAttribute?.(TABLE_COMPONENT_NAME, 'mode', nextMode);
    var component = table?.components?.[TABLE_COMPONENT_NAME];
    if (component?.data) {
      component.data.mode = nextMode;
      component.refreshGeometry?.();
    }
    applyTableWarning(nextMode === 'selection' ? { level: 'ok' } : buildActiveContainmentDiagnostics());
    return nextMode;
  };
  root[RUNTIME_GLOBAL_NAME].getAnalysisTableZones = function (mode) {
    return getAnalysisTableZonesForMode(mode).map(function (zone) {
      return Object.assign({}, zone);
    });
  };
  root[RUNTIME_GLOBAL_NAME].getContainmentProfile = function (mode, zone) {
    var profile = resolveContainmentProfile(mode, zone);
    return {
      id: profile.id,
      zone: profile.zone ? Object.assign({}, profile.zone) : null,
      position: Object.assign({}, profile.position),
      containment: Object.assign({}, profile.containment)
    };
  };
  root[RUNTIME_GLOBAL_NAME].applyContainmentProfile = function (chart, profileIdOrObject) {
    var doc = root.document;
    var chartEl = typeof chart === 'string' ? resolveWaitTarget(chart, doc) : chart;
    if (!chartEl || !chartEl.setAttribute) {
      return null;
    }
    var profile = resolveContainmentProfile(profileIdOrObject || 'default');
    var currentAttr = chartEl.getAttribute ? chartEl.getAttribute(COMPONENT_NAME) : null;
    var nextAttr = {};
    if (currentAttr && typeof currentAttr === 'object') {
      Object.keys(currentAttr).forEach(function (key) {
        nextAttr[key] = currentAttr[key];
      });
    }
    Object.keys(profile.containment || {}).forEach(function (key) {
      nextAttr[key] = profile.containment[key];
    });
    chartEl.setAttribute('position', vectorToAttribute(profile.position || profilePosition(nextAttr)));
    chartEl.setAttribute(COMPONENT_NAME, nextAttr);
    return {
      id: profile.id,
      zone: profile.zone ? Object.assign({}, profile.zone) : null,
      position: Object.assign({}, profile.position),
      containment: Object.assign({}, nextAttr)
    };
  };
  root[RUNTIME_GLOBAL_NAME].getActiveContainmentDiagnostics = function (targets) {
    var diagnostic = buildActiveContainmentDiagnostics(targets);
    applyTableWarning(diagnostic);
    return diagnostic;
  };
  root[RUNTIME_GLOBAL_NAME].getScaleRange = function () {
    var doc = root.document;
    var charts = getContainmentCharts(doc);
    if (charts.length === 0) {
      return buildScaleRangeSnapshot(DEFAULTS, 0);
    }

    var info = resolveContainmentComponentInfo(charts[0]);
    return buildScaleRangeSnapshot(info ? info.data : DEFAULTS, charts.length);
  };
  root[RUNTIME_GLOBAL_NAME].setScaleRange = function (min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('Scale range values must be finite numbers.');
    }
    if (min <= 0 || max <= 0) {
      throw new Error('Scale range values must be greater than zero.');
    }
    if (max <= min) {
      throw new Error('The maximum scale range value must be greater than the minimum.');
    }
    if (max > 0.99) {
      throw new Error('Planar occupancy values must be percentages below 1.');
    }

    var doc = root.document;
    var charts = getContainmentCharts(doc);
    charts.forEach(function (chartEl) {
      var info = resolveContainmentComponentInfo(chartEl);
      if (!info || !chartEl.getAttribute || !chartEl.setAttribute) {
        return;
      }

      var currentAttr = chartEl.getAttribute(info.attrName);
      var nextAttr = {};

      if (typeof currentAttr === 'string') {
        nextAttr = {
          minPlanarOccupancyRatio: min,
          maxPlanarOccupancyRatio: max
        };
      } else if (currentAttr && typeof currentAttr === 'object') {
        Object.keys(currentAttr).forEach(function (key) {
          nextAttr[key] = currentAttr[key];
        });
        nextAttr.minPlanarOccupancyRatio = min;
        nextAttr.maxPlanarOccupancyRatio = max;
      } else {
        nextAttr = {
          minPlanarOccupancyRatio: min,
          maxPlanarOccupancyRatio: max
        };
      }

      chartEl.setAttribute(info.attrName, nextAttr);
    });

    var firstInfo = charts.length ? resolveContainmentComponentInfo(charts[0]) : null;
    return buildScaleRangeSnapshot(firstInfo ? firstInfo.data : {
      minPlanarOccupancyRatio: min,
      maxPlanarOccupancyRatio: max
    }, charts.length);
  };
  root[RUNTIME_GLOBAL_NAME].getScalePolicy = function () {
    var doc = root.document;
    var charts = getContainmentCharts(doc);
    if (charts.length === 0) {
      return buildScalePolicySnapshot(DEFAULTS, 0);
    }

    var info = resolveContainmentComponentInfo(charts[0]);
    return buildScalePolicySnapshot(info ? info.data : DEFAULTS, charts.length);
  };
  root[RUNTIME_GLOBAL_NAME].setHeightBand = function (min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('Height band values must be finite numbers.');
    }
    if (min <= 0 || max <= 0) {
      throw new Error('Height band values must be greater than zero.');
    }
    if (max <= min) {
      throw new Error('The maximum height band value must be greater than the minimum.');
    }

    var doc = root.document;
    var charts = getContainmentCharts(doc);
    charts.forEach(function (chartEl) {
      var info = resolveContainmentComponentInfo(chartEl);
      if (!info || !chartEl.getAttribute || !chartEl.setAttribute) {
        return;
      }

      var currentAttr = chartEl.getAttribute(info.attrName);
      var nextAttr = {};
      if (currentAttr && typeof currentAttr === 'object') {
        Object.keys(currentAttr).forEach(function (key) {
          nextAttr[key] = currentAttr[key];
        });
      }
      nextAttr.heightBandMinRatio = min;
      nextAttr.heightBandMaxRatio = max;
      chartEl.setAttribute(info.attrName, nextAttr);
    });

    var firstInfo = charts.length ? resolveContainmentComponentInfo(charts[0]) : null;
    return buildScalePolicySnapshot(firstInfo ? firstInfo.data : DEFAULTS, charts.length);
  };
  root[RUNTIME_GLOBAL_NAME].renormalizeAll = function (reason) {
    var doc = root.document;
    if (!doc || !doc.querySelectorAll) {
      return 0;
    }

    var charts = doc.querySelectorAll('[' + COMPONENT_NAME + ']');
    var count = 0;
    charts.forEach(function (chartEl) {
      var component = chartEl.components && chartEl.components[COMPONENT_NAME];
      if (component && typeof component.renormalize === 'function') {
        component.renormalize(reason || 'runtime-request');
        count += 1;
      }
    });
    applyTableWarning(buildActiveContainmentDiagnostics());
    return count;
  };
  root[RUNTIME_GLOBAL_NAME].enableDebug = function () {
    DEBUG_STATE.enabled = true;
    return true;
  };
  root[RUNTIME_GLOBAL_NAME].disableDebug = function () {
    DEBUG_STATE.enabled = false;
    return true;
  };
  root[RUNTIME_GLOBAL_NAME].setDebug = function (enabled) {
    DEBUG_STATE.enabled = !!enabled;
    return DEBUG_STATE.enabled;
  };
  root[RUNTIME_GLOBAL_NAME].isDebugEnabled = function () {
    return !!DEBUG_STATE.enabled;
  };
  root[RUNTIME_GLOBAL_NAME].showTabletopAnchorPlane = function (visible) {
    var doc = root.document;
    var plane = doc && doc.querySelector ? doc.querySelector('#codexr-analysis-table-anchor-plane') : null;
    if (!plane || !plane.setAttribute) {
      return false;
    }
    plane.setAttribute('visible', visible !== false);
    return true;
  };
  root[RUNTIME_GLOBAL_NAME].hideTabletopAnchorPlane = function () {
    return root[RUNTIME_GLOBAL_NAME].showTabletopAnchorPlane(false);
  };
  root[RUNTIME_GLOBAL_NAME].__testing = {
    PID_PROFILE: PID_PROFILE,
    matchesIgnoredBoundsMeta: matchesIgnoredBoundsMeta,
    matchesIgnoredContainmentBoundsMeta: matchesIgnoredContainmentBoundsMeta,
    computePlanarFitFactor: computePlanarFitFactor,
    computeContainmentPlanarLimit: computeContainmentPlanarLimit,
    computeBootstrapPlanarScale: computeBootstrapPlanarScale,
    computePlanarBandScale: computePlanarBandScale,
    computePlanarAxisTargetScale: computePlanarAxisTargetScale,
    computePeakHeight: computePeakHeight,
    resolveHeightBandTargets: resolveHeightBandTargets,
    computeHeightBandScale: computeHeightBandScale,
    computeHeightBandTargetScale: computeHeightBandTargetScale,
    computeHardHeightGuardTarget: computeHardHeightGuardTarget,
    targetNeedsCorrection: targetNeedsCorrection,
    shouldAnimateContainmentTransform: shouldAnimateContainmentTransform,
    constrainPlanarTargetForHeightCompromise: constrainPlanarTargetForHeightCompromise,
    buildContainmentCorrectionState: buildContainmentCorrectionState,
    createPidAxisState: createPidAxisState,
    stepPidAxis: stepPidAxis,
    buildMeasurementSignature: buildMeasurementSignature,
    computeAnchorOffset: computeAnchorOffset,
    getTableTopY: getTableTopY,
    buildTabletopAnchorDiagnostics: buildTabletopAnchorDiagnostics,
    getAnalysisTableZonesForMode: getAnalysisTableZonesForMode,
    getVisibleDependencyGraphRoots: getVisibleDependencyGraphRoots,
    resolveContainmentProfile: resolveContainmentProfile,
    buildActiveContainmentDiagnostics: buildActiveContainmentDiagnostics,
    collectNonFiniteValueIssues: collectNonFiniteValueIssues,
    inspectInvalidAxisState: inspectInvalidAxisState
  };
  root[DEBUG_GLOBAL_NAME] = root[DEBUG_GLOBAL_NAME] || {
    _els: [],

    _cleanup: function () {
      this._els.forEach(function (el) {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      this._els = [];
    },

    _mk: function (parent, tag, attrs) {
      var el = root.document.createElement(tag);
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
      parent.appendChild(el);
      this._els.push(el);
      return el;
    },

    show: function (target) {
      this._cleanup();

      var selector = target || '[' + COMPONENT_NAME + ']';
      var chart = typeof selector === 'string' ? root.document.querySelector(selector) : selector;
      if (!chart) {
        console.warn('[CodeXR][ChartBands] Chart not found for target:', selector);
        return null;
      }

      var component = chart.components && chart.components[COMPONENT_NAME];
      if (!component) {
        console.warn('[CodeXR][ChartBands] chart containment component not found on target.');
        return null;
      }

      var measurements = component.measureBounds();
      if (!measurements) {
        console.warn('[CodeXR][ChartBands] Could not measure chart bounds.');
        return null;
      }

      var d = component.data;
      var scene = chart.sceneEl || root.document.querySelector('a-scene');
      if (!scene) {
        console.warn('[CodeXR][ChartBands] Scene not found.');
        return null;
      }

      var tableBottomY = getTableTopY(d);
      var bandTargets = resolveHeightBandTargets(d);

      this._mk(scene, 'a-box', {
        position: d.anchorX + ' ' + (tableBottomY + (d.targetHeight / 2)) + ' ' + d.anchorZ,
        width: d.targetWidth,
        height: d.targetHeight,
        depth: d.targetDepth,
        material: 'color: #2bb3ff; opacity: 0.12; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-plane', {
        position: d.anchorX + ' ' + (tableBottomY + bandTargets.minHeight) + ' ' + d.anchorZ,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #22c55e; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-plane', {
        position: d.anchorX + ' ' + (tableBottomY + bandTargets.maxHeight) + ' ' + d.anchorZ,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #ef4444; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-box', {
        position: measurements.primary.center.x + ' ' + measurements.primary.center.y + ' ' + measurements.primary.center.z,
        width: Math.max(0.01, measurements.primary.size.x),
        height: Math.max(0.01, measurements.primary.size.y),
        depth: Math.max(0.01, measurements.primary.size.z),
        material: 'color: #4ade80; opacity: 0.1; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-box', {
        position: measurements.full.center.x + ' ' + measurements.full.center.y + ' ' + measurements.full.center.z,
        width: Math.max(0.01, measurements.full.size.x),
        height: Math.max(0.01, measurements.full.size.y),
        depth: Math.max(0.01, measurements.full.size.z),
        material: 'color: #f59e0b; opacity: 0.1; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      console.table({
        chartId: chart.id || '(no-id)',
        targetWidth: d.targetWidth,
        targetDepth: d.targetDepth,
        targetHeight: d.targetHeight,
        primaryWidth: toFixedNumber(measurements.primary.size.x),
        primaryHeight: toFixedNumber(measurements.primary.size.y),
        primaryDepth: toFixedNumber(measurements.primary.size.z),
        fullWidth: toFixedNumber(measurements.full.size.x),
        fullHeight: toFixedNumber(measurements.full.size.y),
        fullDepth: toFixedNumber(measurements.full.size.z),
        bandMin: toFixedNumber(bandTargets.minHeight),
        bandMax: toFixedNumber(bandTargets.maxHeight),
        yScale: chart.object3D && chart.object3D.scale ? toFixedNumber(chart.object3D.scale.y) : null
      });

      return {
        chart: chart,
        measurements: measurements,
        band: bandTargets,
        envelope: { width: d.targetWidth, depth: d.targetDepth, height: d.targetHeight }
      };
    },

    hide: function () {
      this._cleanup();
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : this);
