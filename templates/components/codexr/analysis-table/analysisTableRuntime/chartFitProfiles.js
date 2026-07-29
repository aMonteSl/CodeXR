// == analysisTableRuntime.js | chartFitProfiles (assembled per manifest.json; see COMPONENTS.md) ==
  //
  // Per-chart containment fit strategy.
  //
  // The default pipeline scales the chart's LOCAL axes independently against
  // the table's world limits, assuming the entity is not rotated. Circular
  // charts break both assumptions: pie/doughnut geometry lies flat by
  // construction and stands up via entity rotation (90 0 0, the same one
  // Babia's own demos use), which swaps the local axes the world limits map
  // to — the per-axis controller then "lowers the height" by squashing the
  // disk's vertical world extent to zero while inflating its depth. And even
  // unrotated, anisotropic scaling would turn a circle into an ellipse.
  //
  // Charts whose presentation profile declares `fit: 'uniform'` therefore get
  // a single-factor fit: one multiplicative factor on all three local axes,
  // sized so the WORLD bounds fill the tightest table budget (width, depth or
  // height band). The factor preserves aspect by construction, so no
  // minimum-occupancy requirement applies — a standing disk is height-bound
  // and can never legitimately fill the table's width.

  // 'uniform': one factor on all three axes (circular charts — anything else
  // squashes the rotated disk or turns the circle into an ellipse).
  // 'planar-uniform': x and z share one SCALE VALUE, y stays independent
  // (row charts whose geometry is round or whose axis labels lie flat along
  // z: independent planar axes left the labels at raw size, flooding the
  // room floor, and made cylinders/spheres elliptical).
  var FIT_MODE_BY_CHART_ID = {
    pie: 'uniform',
    donut: 'uniform',
    bubbles: 'uniform',
    bars: 'planar-uniform',
    cyls: 'planar-uniform',
    cylsmap: 'planar-uniform'
  };
  var FIT_MODE_BY_COMPONENT_NAME = {
    'babia-pie': 'uniform',
    'babia-doughnut': 'uniform',
    'babia-bubbles': 'uniform',
    'babia-bars': 'planar-uniform',
    'babia-cyls': 'planar-uniform',
    'babia-cylsmap': 'planar-uniform'
  };
  var KNOWN_FIT_MODES = { uniform: true, 'planar-uniform': true };
  var UNIFORM_FIT_MARGIN = 0.98;

  // Clearance above the anchor plane, per chart. The anchor plane sits at the
  // tabletop slab, ~1.7 cm under the glass drawn over it: flat-bottomed
  // charts hide that inside the glass, spheres get sliced by it. Mirrors
  // chartPresentation.ts (surfaceLift) for scenes generated before it.
  var SURFACE_LIFT_BY_CHART_ID = { bubbles: 0.03 };
  var SURFACE_LIFT_BY_COMPONENT_NAME = { 'babia-bubbles': 0.03 };

  function resolveChartSurfaceLift(el) {
    if (!el) {
      return 0;
    }
    var chartId = (typeof el.getAttribute === 'function' && el.getAttribute('data-codexr-active-chart-id')) || '';
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (chartId && mappingRuntime && typeof mappingRuntime.getChartPresentation === 'function') {
      var profile = mappingRuntime.getChartPresentation(chartId);
      if (profile && Number.isFinite(profile.surfaceLift)) {
        return Math.max(0, profile.surfaceLift);
      }
    }
    if (chartId) {
      return SURFACE_LIFT_BY_CHART_ID[chartId] || 0;
    }
    var componentNames = Object.keys(SURFACE_LIFT_BY_COMPONENT_NAME);
    for (var i = 0; i < componentNames.length; i += 1) {
      if ((el.components && el.components[componentNames[i]])
        || (typeof el.hasAttribute === 'function' && el.hasAttribute(componentNames[i]))) {
        return SURFACE_LIFT_BY_COMPONENT_NAME[componentNames[i]];
      }
    }
    return 0;
  }

  function resolveChartFitMode(el) {
    if (!el) {
      return 'per-axis';
    }
    var chartId = (typeof el.getAttribute === 'function' && el.getAttribute('data-codexr-active-chart-id')) || '';
    // The canonical presentation profile (generator-injected, mirrored by the
    // mapping runtime) wins when available.
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (chartId && mappingRuntime && typeof mappingRuntime.getChartPresentation === 'function') {
      var profile = mappingRuntime.getChartPresentation(chartId);
      if (profile && profile.fit) {
        return KNOWN_FIT_MODES[profile.fit] ? profile.fit : 'per-axis';
      }
    }
    if (FIT_MODE_BY_CHART_ID[chartId]) {
      return FIT_MODE_BY_CHART_ID[chartId];
    }
    // Harness scenes and generated initial charts carry no chart id: detect
    // the chart by its live babia component.
    var componentNames = Object.keys(FIT_MODE_BY_COMPONENT_NAME);
    for (var i = 0; i < componentNames.length; i += 1) {
      var componentName = componentNames[i];
      if ((el.components && el.components[componentName])
        || (typeof el.hasAttribute === 'function' && el.hasAttribute(componentName))) {
        return FIT_MODE_BY_COMPONENT_NAME[componentName];
      }
    }
    return 'per-axis';
  }

  // Planar uniformity: both axes converge to the same SCALE VALUE — the
  // tightest of the two per-axis targets. The fixed point is stable: at
  // convergence the binding axis reports "within band, keep scale" and the
  // other axis's midpoint-up wish is overruled by the min.
  function unifyPlanarTargets(xTarget, zTarget) {
    if (!xTarget || !zTarget || !Number.isFinite(xTarget.targetScale) || !Number.isFinite(zTarget.targetScale)) {
      return { x: xTarget, z: zTarget };
    }
    var sharedScale = Math.min(xTarget.targetScale, zTarget.targetScale);
    // The non-binding axis's midpoint-up wish being capped is the DESIGN of
    // planar uniformity, not a compromise: leaving the per-axis `compromised`
    // flag standing kept the "constrained by table limits" warning on screen
    // forever on a perfectly settled chart.
    return {
      x: Object.assign({}, xTarget, { targetScale: sharedScale, compromised: false, reason: 'planar-uniform' }),
      z: Object.assign({}, zTarget, { targetScale: sharedScale, compromised: false, reason: 'planar-uniform' })
    };
  }

  // One multiplicative factor that takes the chart's current WORLD bounds to
  // the tightest table budget. Returns null when the measurements cannot
  // support a decision.
  function computeUniformFitState(measurements, object3D, data) {
    if (!hasUsableMeasurements(measurements) || !object3D || !object3D.scale || !data) {
      return null;
    }
    var size = measurements.containment.size;
    var peakHeight = Number.isFinite(measurements.peakHeight) && measurements.peakHeight > 0
      ? measurements.peakHeight
      : measurements.primary.size.y;
    var limits = computeContainmentLimits(data);
    var heightTargets = resolveHeightBandTargets(data);

    var widthCap = size.x > 0.000001 ? limits.containmentWidthLimit / size.x : Number.POSITIVE_INFINITY;
    var depthCap = size.z > 0.000001 ? limits.containmentDepthLimit / size.z : Number.POSITIVE_INFINITY;
    var heightCap = Number.isFinite(peakHeight) && peakHeight > 0.000001 && heightTargets
      ? heightTargets.maxHeight / peakHeight
      : Number.POSITIVE_INFINITY;

    var rawFactor = Math.min(widthCap, depthCap, heightCap);
    if (!Number.isFinite(rawFactor) || rawFactor <= 0) {
      return null;
    }
    var targetFactor = rawFactor * UNIFORM_FIT_MARGIN;

    // Uniformity survives the y clamp: if the clamp binds, every axis takes
    // the clamped factor.
    var yScaleMin = Math.max(0.001, data.yScaleMin);
    var yScaleMax = Math.max(yScaleMin + 0.001, data.yScaleMax);
    var currentY = object3D.scale.y;
    var clampedY = clamp(currentY * targetFactor, yScaleMin, yScaleMax);
    var factor = currentY > 0 ? clampedY / currentY : targetFactor;

    var toleranceRatio = clamp(
      Number.isFinite(data.containmentToleranceRatio) ? data.containmentToleranceRatio : DEFAULTS.containmentToleranceRatio,
      0.002,
      0.2
    );
    // Overflow means a budget is exceeded NOW; convergence means the factor
    // stopped asking for meaningful change.
    var overflowing = rawFactor < 1 - toleranceRatio;
    var converged = Math.abs(factor - 1) <= Math.max(toleranceRatio, 0.02);

    return {
      factor: factor,
      rawFactor: rawFactor,
      widthCap: widthCap,
      depthCap: depthCap,
      heightCap: heightCap,
      heightOverflow: heightCap < 1 - toleranceRatio,
      overflowing: overflowing,
      converged: converged,
      limits: limits,
      heightTargets: heightTargets,
      peakHeight: peakHeight
    };
  }

  // Correction-state shape compatible with the per-axis one, for
  // getChartStatus and the diagnostics surface.
  function buildUniformCorrectionState(measurements, object3D, data) {
    var fit = computeUniformFitState(measurements, object3D, data);
    if (!fit) {
      return null;
    }
    var size = measurements.containment.size;
    var axis = function (current, limit) {
      var ratio = limit > 0 ? current / limit : null;
      return {
        ratio: Number.isFinite(ratio) ? toFixedNumber(ratio) : null,
        targetScale: null,
        setpoint: null,
        withinBand: Number.isFinite(ratio) ? ratio <= 1 : true,
        underflowing: false,
        underflowAllowed: true,
        overflowing: Number.isFinite(ratio) ? ratio > 1 : false,
        compromised: false,
        reason: 'uniform-fit'
      };
    };
    var heightRatio = fit.heightTargets && fit.heightTargets.maxHeight > 0
      ? fit.peakHeight / fit.heightTargets.maxHeight
      : null;
    // Axes still unequal (inherited from a previous chart's fit) mean the
    // equalization step has not landed yet: the chart is not done correcting.
    var minAxisScale = Math.min(object3D.scale.x, object3D.scale.y, object3D.scale.z);
    var maxAxisScale = Math.max(object3D.scale.x, object3D.scale.y, object3D.scale.z);
    var anisotropic = Number.isFinite(minAxisScale) && minAxisScale > 0
      && (maxAxisScale - minAxisScale) > minAxisScale * 0.02;
    return {
      fitMode: 'uniform',
      x: axis(size.x, fit.limits.containmentWidthLimit),
      y: axis(fit.peakHeight, fit.heightTargets ? fit.heightTargets.maxHeight : 0),
      z: axis(size.z, fit.limits.containmentDepthLimit),
      axes: null,
      needsCorrection: !fit.converged || anisotropic,
      compromised: false,
      outOfBand: fit.overflowing,
      containmentWidthLimit: fit.limits.containmentWidthLimit,
      containmentDepthLimit: fit.limits.containmentDepthLimit,
      minHeight: fit.heightTargets ? fit.heightTargets.minHeight : null,
      maxHeight: fit.heightTargets ? fit.heightTargets.maxHeight : null,
      heightOverflow: fit.heightOverflow,
      heightRatio: Number.isFinite(heightRatio) ? toFixedNumber(heightRatio) : null,
      hardHeightGuardTargetY: null,
      hardHeightGuardCompromised: false
    };
  }
