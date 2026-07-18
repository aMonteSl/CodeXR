// == analysisTableRuntime.js | part 50: containment-component-core (assembled with its siblings; see COMPONENTS.md) ==
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
