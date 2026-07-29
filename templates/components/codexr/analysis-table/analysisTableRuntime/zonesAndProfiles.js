// == analysisTableRuntime.js | zonesAndProfiles (assembled per manifest.json; see COMPONENTS.md) ==
(function registerCodeXRAnalysisTableComponents(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  var COMPONENT_NAME = 'codexr-chart-containment';
  var BOATS_LAYOUT_STABILITY_COMPONENT_NAME = 'codexr-boats-layout-stability';
  // Plain DOM marker stamped next to the component so runtime-built charts
  // (whose component is set programmatically and therefore leaves no DOM
  // attribute) stay discoverable by attribute selectors.
  var CONTAINMENT_MARKER_ATTRIBUTE = 'data-codexr-chart-containment';
  var TABLE_COMPONENT_NAME = 'codexr-analysis-table';
  var RUNTIME_GLOBAL_NAME = 'CodeXRAnalysisTableRuntime';
  var DEBUG_GLOBAL_NAME = 'CodeXRChartDebugBands';
  if (!AFRAME || !AFRAME.registerComponent) {
    return;
  }
  var registerContainment = !AFRAME.components[COMPONENT_NAME];
  var registerTable = !AFRAME.components[TABLE_COMPONENT_NAME];
  var registerBoatsLayoutStability = !AFRAME.components[BOATS_LAYOUT_STABILITY_COMPONENT_NAME];
  if (!registerContainment && !registerTable && !registerBoatsLayoutStability) {
    return;
  }

  var DEFAULTS = {
    targetWidth: 5.614,
    targetHeight: 1.8,
    targetDepth: 3.218,
    anchorX: 0,
    anchorY: 1,
    anchorZ: -18,
    tableTopSurfaceOffsetY: -0.08,
    tabletopAnchorEpsilon: 0.004,
    tabletopAnchorDeadbandY: 0.015,
    retries: 45,
    retryDelayMs: 90,
    tableTopPadding: 0.9,
    bootstrapPlanarMaxRatio: 0.84,
    minPlanarOccupancyRatio: 0.78,
    maxPlanarOccupancyRatio: 0.92,
    heightBandMinRatio: 0.38,
    heightBandMaxRatio: 0.72,
    tableEdgeMargin: 0.18,
    yScaleMin: 0.01,
    yScaleMax: 12,
    containmentToleranceRatio: 0.018,
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
  // Coalesced refresh of the table warning surface. Containment components
  // request a refresh on every lifecycle transition; one shared timer samples
  // the diagnostics so the displayed warning always converges to the current
  // chart state instead of freezing on whatever the last caller observed.
  var TABLE_DIAGNOSTIC_REFRESH = {
    timer: null,
    lastRunAt: 0
  };

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
    dtMax: 0.08,
    // Dead zone relative to the axis' CURRENT scale (the per-axis `epsilon`
    // stays as an absolute floor): boats runs at 0.01 scale and flat charts at
    // 1.5+, so one absolute number cannot serve both.
    relativeEpsilonRatio: 0.002
  };

  // `lookat` keeps camera-facing billboards out of the measurements: their
  // world AABB changes as the user turns, which is measurement noise, never
  // chart content.
  var CONTENT_AUXILIARY_TOKEN_PATTERN = /(legend|label|title|axis|tick|grid|mapping|debug|tooltip|lookat)/i;
  var CONTAINMENT_AUXILIARY_TOKEN_PATTERN = /(legend|label|title|mapping|debug|tooltip|lookat)/i;

  // Terminal-state watchdog. Once a fit converged the component goes settled
  // and only this periodic check runs: a RELATIVE drift must persist for
  // `resumeSamples` consecutive checks before the controller re-engages
  // (one-sample blips are measurement noise), while a hard violation
  // (occupancy past the physical limit by `hardViolationRatio`) re-engages
  // immediately.
  var SETTLED_WATCH = {
    resumeThresholdRatio: 0.02,
    resumeSamples: 2,
    hardViolationRatio: 1.05
  };
  var TEXT_COMPONENT_KEYS = ['text', 'troika-text'];
