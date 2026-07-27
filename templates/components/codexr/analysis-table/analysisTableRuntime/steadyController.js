// == analysisTableRuntime.js | steadyController (assembled per manifest.json; see COMPONENTS.md) ==
    // Single-factor actuation for uniform-fit charts (see chartFitProfiles.js):
    // applies the computed factor to all three local axes, re-anchors, and
    // reports whether anything changed. Used by both the bootstrap fit and the
    // steady loop, so a circular chart never goes through per-axis scaling.
    applyUniformFitStep: function (measurements, source) {
      var object3D = this.el && this.el.object3D;
      var fit = computeUniformFitState(measurements, object3D, this.data);
      if (!fit) {
        return null;
      }
      if (!fit.converged) {
        var applied = this.applyScaleFactors(fit.factor, fit.factor, fit.factor);
        var nextMeasurements = this.measureBounds();
        var moved = nextMeasurements ? this.applyAnchorPlacement(nextMeasurements) : false;
        if (applied || moved) {
          this.syncTransformAttributes();
          this.captureStableTransform();
        }
        debugLog('uniform-fit-step', {
          source: source || 'uniform-fit',
          factor: toFixedNumber(fit.factor),
          widthCap: toFixedNumber(fit.widthCap),
          depthCap: toFixedNumber(fit.depthCap),
          heightCap: toFixedNumber(fit.heightCap)
        });
        fit.changed = applied || moved;
        return fit;
      }
      var anchorMeasurements = this.measureBounds();
      var anchored = anchorMeasurements ? this.applyAnchorPlacement(anchorMeasurements) : false;
      if (anchored) {
        this.syncTransformAttributes();
        this.captureStableTransform();
      }
      fit.changed = anchored;
      return fit;
    },

    runUniformSteadyStep: function (source) {
      var fit = this.applyUniformFitStep(this.measureBounds(), source || 'steady-fit');
      if (!fit) {
        this.markWaitingGeometry('waiting-geometry', this.normalizationGeneration, {
          source: source || 'steady-fit',
          phase: this.renderPhase
        });
        return false;
      }
      if (fit.converged && !fit.changed) {
        this.pidController.stableTicks += 1;
      } else {
        this.pidController.stableTicks = 0;
      }
      if (this.pidController.stableTicks >= PID_PROFILE.stableTicks) {
        this.deactivateSteadyController();
        this.enterSettledState(this.measureBounds());
      } else {
        this.scheduleSteadyControllerStep(source || 'steady-fit');
      }
      return !!fit.changed;
    },

    runSteadyControllerStep: function (source, dtMs) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      if (resolveChartFitMode(this.el) === 'uniform') {
        return this.runUniformSteadyStep(source);
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
        this.data.heightUnderflowCorrectionEnabled !== false,
        this.data.containmentToleranceRatio
      ) || createNeutralHeightBandTarget(object3D.scale.y, 'height-unavailable');

      if (!xTarget || !zTarget) {
        return false;
      }

      xTarget = this.constrainPlanarTargetForMeasuredHeight('x', xTarget, object3D.scale.x, yTarget, measurements, heightTargets);
      zTarget = this.constrainPlanarTargetForMeasuredHeight('z', zTarget, object3D.scale.z, yTarget, measurements, heightTargets);

      if (resolveChartFitMode(this.el) === 'planar-uniform') {
        var unified = unifyPlanarTargets(xTarget, zTarget);
        xTarget = unified.x;
        zTarget = unified.z;
      }

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
        // Converged: go quiet. From here on only the settled watch runs.
        this.enterSettledState(nextMeasurements || measurements);
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

      var fitMode = resolveChartFitMode(this.el);
      if (fitMode === 'uniform') {
        var uniformFit = this.applyUniformFitStep(measurements, source || 'bootstrap-uniform');
        return !!(uniformFit && uniformFit.changed);
      }

      var bootstrapScale = computeBootstrapPlanarScale(measurements.primary, measurements.containment, this.data);
      if (!bootstrapScale) {
        return false;
      }

      var xFactor = bootstrapScale.xFactor;
      var zFactor = bootstrapScale.zFactor;
      if (fitMode === 'planar-uniform') {
        // Both planar axes bootstrap to the same SCALE VALUE: the flat axis
        // labels along z and any round geometry follow the binding axis.
        var object3D = this.el && this.el.object3D;
        if (object3D && object3D.scale && object3D.scale.x > 0 && object3D.scale.z > 0) {
          var sharedScale = Math.min(object3D.scale.x * xFactor, object3D.scale.z * zFactor);
          xFactor = sharedScale / object3D.scale.x;
          zFactor = sharedScale / object3D.scale.z;
        }
      }

      var changed = false;
      if (Math.abs(xFactor - 1) > 0.0005 || Math.abs(zFactor - 1) > 0.0005) {
        changed = this.applyScaleFactors(
          clamp(xFactor, fitMode === 'planar-uniform' ? 0.05 : 0.2, fitMode === 'planar-uniform' ? 8 : 4),
          1,
          clamp(zFactor, fitMode === 'planar-uniform' ? 0.05 : 0.2, fitMode === 'planar-uniform' ? 8 : 4)
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

    enforceHeightBand: function (source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      // Uniform-fit charts never take a y-only correction: the uniform pass
      // (already run by enforceEnvelope via applyBootstrapPlanarFit) owns the
      // height budget without distorting the aspect ratio.
      if (resolveChartFitMode(this.el) === 'uniform') {
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

        // Only bootstrap ever reaches here: in steady-fit runMaintenancePass
        // re-engages the controller instead, and the settled state stops the
        // maintenance entirely.
        var localChanged = this.applyBootstrapPlanarFit(measurements, source || 'bootstrap-visible');

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
      if (this.containmentTransition && this.containmentTransition.active) {
        return false;
      }
      if (this.renderPhase === 'steady-fit') {
        // Interrupted convergence (a reset knocked the controller out without
        // leaving steady): re-engage the closed loop instead of stepping it
        // open-loop from maintenance forever — that endless re-entry was the
        // charts that never stopped resizing.
        if (!this.pidController || !this.pidController.active) {
          this.activateSteadyController();
        }
        return false;
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

    // ── Settled state ──────────────────────────────────────────────────────
    // The terminal state the whole controller drives towards: fit converged,
    // component quiet. No per-frame measuring, no maintenance stepping — only
    // the periodic watch below, which re-engages the controller when the chart
    // REALLY changed (persistent relative drift) or is REALLY out (hard
    // violation). One-sample blips — a legend catching the camera, a label
    // loading — never wake it up.

    enterSettledState: function (measurements) {
      var resolved = measurements || this.measureBounds();
      if (!hasUsableMeasurements(resolved)) {
        return;
      }
      this.settled = true;
      this.settledDriftStreak = 0;
      this.settledReference = {
        containmentX: resolved.containment.size.x,
        containmentZ: resolved.containment.size.z,
        peakHeight: Number.isFinite(resolved.peakHeight) ? resolved.peakHeight : null
      };
      resizeTrace('containment-settled', {
        containmentX: toFixedNumber(resolved.containment.size.x),
        containmentZ: toFixedNumber(resolved.containment.size.z),
        peakHeight: toFixedNumber(resolved.peakHeight)
      });
    },

    unsettle: function (reason) {
      if (!this.settled && !this.settledReference) {
        return;
      }
      this.settled = false;
      this.settledReference = null;
      this.settledDriftStreak = 0;
      resizeTrace('containment-unsettled', { reason: reason || '' });
    },

    runSettledWatch: function (source) {
      if (!this.settled || !this.settledReference || !this.el || !this.el.object3D) {
        return;
      }
      if (!isObject3DVisibleInScene(this.el)) {
        return;
      }
      var measurements = this.measureBounds();
      if (!hasUsableMeasurements(measurements)) {
        return;
      }

      var reference = this.settledReference;
      var relativeDrift = function (current, settledValue) {
        if (!Number.isFinite(current) || !Number.isFinite(settledValue) || settledValue <= 0) {
          return 0;
        }
        return Math.abs(current - settledValue) / settledValue;
      };
      var drift = Math.max(
        relativeDrift(measurements.containment.size.x, reference.containmentX),
        relativeDrift(measurements.containment.size.z, reference.containmentZ),
        relativeDrift(measurements.peakHeight, reference.peakHeight)
      );

      // Hard violation: physically past the table limits — react now.
      var limits = computeContainmentLimits(this.data);
      var heightTargets = resolveHeightBandTargets(this.data);
      var hardViolation = measurements.containment.size.x > limits.containmentWidthLimit * SETTLED_WATCH.hardViolationRatio
        || measurements.containment.size.z > limits.containmentDepthLimit * SETTLED_WATCH.hardViolationRatio
        || (Number.isFinite(measurements.peakHeight)
          && heightTargets && Number.isFinite(heightTargets.maxHeight)
          && measurements.peakHeight > heightTargets.maxHeight * SETTLED_WATCH.hardViolationRatio);

      if (hardViolation) {
        this.unsettle((source || 'settled-watch') + '-hard-violation');
        this.activateSteadyController();
        return;
      }

      if (drift >= SETTLED_WATCH.resumeThresholdRatio) {
        this.settledDriftStreak += 1;
        if (this.settledDriftStreak >= SETTLED_WATCH.resumeSamples) {
          this.unsettle((source || 'settled-watch') + '-persistent-drift');
          this.activateSteadyController();
        }
        return;
      }

      this.settledDriftStreak = 0;
    },
