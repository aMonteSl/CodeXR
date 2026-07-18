// == analysisTableRuntime.js | part 70: steady-controller (assembled with its siblings; see COMPONENTS.md) ==
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
