// == analysisTableRuntime.js | part 30: containment-limits (assembled with its siblings; see COMPONENTS.md) ==
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
