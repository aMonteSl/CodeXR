// == analysisTableRuntime.js | containmentLimits (assembled per manifest.json; see COMPONENTS.md) ==
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

  function computePlanarAxisTargetScale(primarySize, containmentSize, currentScale, containmentLimitSize, range, toleranceRatio, allowUnderflowCorrection) {
    if (!Number.isFinite(primarySize) || !Number.isFinite(containmentSize) || !Number.isFinite(currentScale) || !Number.isFinite(containmentLimitSize) || primarySize <= 0 || containmentSize <= 0 || currentScale <= 0 || containmentLimitSize <= 0 || !range) {
      return null;
    }

    var ratio = primarySize / containmentLimitSize;
    var setpointRatio = midpoint(range.min, range.max);
    var resolvedToleranceRatio = clamp(
      Number.isFinite(toleranceRatio) ? toleranceRatio : DEFAULTS.containmentToleranceRatio,
      0,
      0.25
    );
    var containmentTolerance = containmentLimitSize * resolvedToleranceRatio;
    // The scale ceiling aims INSIDE the limit (half a tolerance of margin), not
    // at the exact edge: an equilibrium sitting on the edge meant any
    // measurement noise flipped it across and triggered a correction — the
    // micro-resizes users saw while simply moving around.
    var maxAllowedScale = currentScale * ((containmentLimitSize * (1 - resolvedToleranceRatio / 2)) / containmentSize);
    if (!Number.isFinite(maxAllowedScale) || maxAllowedScale <= 0) {
      maxAllowedScale = currentScale;
    }

    var correctUnderflow = allowUnderflowCorrection !== false;
    // Hysteresis on the band edges: a chart already accepted as fitted must
    // leave the band by a real margin (one tolerance) before it is corrected.
    var underflowing = ratio < range.min * (1 - resolvedToleranceRatio);
    var overflowing = containmentSize > (containmentLimitSize + containmentTolerance);
    var underflowAllowed = underflowing && !correctUnderflow && !overflowing;
    var withinBand = (ratio >= range.min * (1 - resolvedToleranceRatio) && ratio <= range.max * (1 + resolvedToleranceRatio)) || underflowAllowed;
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

  function computeHeightBandTargetScale(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax, allowUnderflowCorrection, toleranceRatio) {
    if (!Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(currentScaleY) || !bandTargets) {
      return null;
    }

    // Same hysteresis as the planar band: an already-fitted height must leave
    // the band by a real margin before a correction fires (strict edges made
    // measurement noise flip the withinBand flag back and forth).
    var bandTolerance = clamp(
      Number.isFinite(toleranceRatio) ? toleranceRatio : DEFAULTS.containmentToleranceRatio,
      0,
      0.25
    );
    var setpointHeight = midpoint(bandTargets.minHeight, bandTargets.maxHeight);
    var correctUnderflow = allowUnderflowCorrection !== false;
    var targetScale = currentScaleY;
    var desiredScale = currentScaleY;
    var reason = 'within-band';
    var underflowing = currentHeight < bandTargets.minHeight * (1 - bandTolerance);
    var overflowing = currentHeight > bandTargets.maxHeight * (1 + bandTolerance);
    var underflowAllowed = underflowing && !correctUnderflow;
    var withinBand = (!underflowing && !overflowing) || underflowAllowed;

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

  function computeHardHeightGuardTarget(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax, enabled, toleranceRatio) {
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
    // Relative threshold: 1.0005 fired on measurement noise (0.05 % of the
    // ceiling) — the safety guard only reacts to a REAL overshoot now; the
    // band correction handles anything smaller, smoothly.
    var guardTolerance = clamp(
      Number.isFinite(toleranceRatio) ? toleranceRatio : DEFAULTS.containmentToleranceRatio,
      0,
      0.25
    );
    var overflowing = heightRatio > 1 + guardTolerance;
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
