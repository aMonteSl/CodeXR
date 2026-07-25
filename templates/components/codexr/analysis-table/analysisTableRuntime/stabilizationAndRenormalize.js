// == analysisTableRuntime.js | stabilizationAndRenormalize (assembled per manifest.json; see COMPONENTS.md) ==
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
        scheduleTableDiagnosticsRefresh('steady-fit');
        return;
      }

      if (this.stabilizationChecksRemaining <= 0 || this.stabilizationStableCount >= Math.max(1, this.data.stabilizationStablePasses || DEFAULTS.stabilizationStablePasses)) {
        this.stopStabilizationLoop();
        return;
      }

      this.scheduleStabilizationStep(reason || 'stabilization', generation);
    },

    renormalize: function (reason) {
      this.ensureRuntimeState();
      // A hidden chart (another mode's, parked while its analysis is not on
      // screen) must not be re-fitted: measuring it while invisible yields a
      // different fit, which then had to be corrected — visibly — the moment it
      // came back. Remember the request instead; the fit it already has stays
      // valid, and whoever shows the chart again asks for a re-fit (which is a
      // no-op unless its content really changed).
      if (this.normalized && !isObject3DVisibleInScene(this.el)) {
        this.pendingRenormalizeReason = reason || 'hidden-chart';
        resizeTrace('renormalize-deferred-hidden', {
          reason: reason || 'renormalize'
        });
        return;
      }
      // Already fitted and nothing changed → keep the chart exactly as it is.
      // Re-fitting is destructive (it clears `normalized`, resets the transform
      // and runs the bootstrap fit again), so an unconditional re-fit made the
      // chart visibly jump every time something asked "just in case" — the
      // flash on entering an analysis. Real changes (new data, a rebuilt chart,
      // a different containment zone) move the measurements or the transform,
      // so the signature differs and the fit runs normally.
      if (this.normalized && this.normalizedSignature && this.el?.object3D) {
        // A transition in flight is not a reason to re-fit: it IS this
        // component's own animation towards the fit it just computed. Restarting
        // then made captureStableTransform() below record a half-animated
        // transform as the stable one and fit from there — the chained re-fits
        // when several "just in case" requests land inside one 650 ms animation.
        var transitioning = !!(this.containmentTransition && this.containmentTransition.active);
        var currentSignature = transitioning
          ? this.normalizedSignature
          : buildMeasurementSignature(this.measureBounds(), this.el.object3D);
        if (currentSignature && currentSignature === this.normalizedSignature) {
          resizeTrace('renormalize-skipped-unchanged', {
            reason: reason || 'renormalize',
            transitioning: transitioning
          });
          return;
        }
      }
      var generation = this.bumpNormalizationGeneration();
      this.unsettle(reason || 'renormalize');
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
      // Remember the fit that is now on screen so redundant renormalize
      // requests can be skipped instead of re-running the whole fit.
      this.normalizedSignature = this.lastMeasurementSignature;
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
      scheduleTableDiagnosticsRefresh('normalized');
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
