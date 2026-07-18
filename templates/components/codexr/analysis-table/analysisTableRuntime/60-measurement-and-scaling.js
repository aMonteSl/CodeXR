// == analysisTableRuntime.js | part 60: measurement-and-scaling (assembled with its siblings; see COMPONENTS.md) ==
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
