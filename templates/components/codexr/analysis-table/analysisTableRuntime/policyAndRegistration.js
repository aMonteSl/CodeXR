// == analysisTableRuntime.js | policyAndRegistration (assembled per manifest.json; see COMPONENTS.md) ==
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
    var component = table?.components?.[TABLE_COMPONENT_NAME];
    // Rebuild the table geometry only on a real mode change, and only once:
    // setAttribute drives A-Frame's update() → refreshGeometry(), so calling
    // refreshGeometry() by hand as well rebuilt it twice per change, and
    // re-applying the active mode rebuilt it for nothing. Both together were
    // the visible table flash when an entry applies its state repeatedly.
    if (component?.data?.mode !== nextMode) {
      table?.setAttribute?.(TABLE_COMPONENT_NAME, 'mode', nextMode);
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
    // A-Frame does not mirror a programmatic component to the DOM, so charts
    // built at runtime were invisible to '[codexr-chart-containment]' lookups
    // (the table then reported "No chart detected" over a chart it was already
    // containing). This plain data attribute keeps them discoverable.
    chartEl.setAttribute(CONTAINMENT_MARKER_ATTRIBUTE, 'true');
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

  /**
   * Targeted renormalization: only the given chart entity ids. Callers that
   * refreshed a single chart (e.g. the historical live side) must use this —
   * renormalizing every chart resets untouched ones to their 'rebuilding'
   * containment state, waiting for a build event that never comes.
   */
  root[RUNTIME_GLOBAL_NAME].renormalizeCharts = function (chartIds, reason) {
    var doc = root.document;
    if (!doc || !doc.getElementById || !Array.isArray(chartIds)) {
      return 0;
    }
    var count = 0;
    chartIds.forEach(function (chartId) {
      var chartEl = chartId ? doc.getElementById(String(chartId)) : null;
      var component = chartEl && chartEl.components && chartEl.components[COMPONENT_NAME];
      if (component && typeof component.renormalize === 'function') {
        component.renormalize(reason || 'runtime-request');
        count += 1;
      }
    });
    applyTableWarning(buildActiveContainmentDiagnostics());
    return count;
  };
  function callChartDataTransition(chartIds, methodName, reason) {
    var doc = root.document;
    if (!doc || !doc.getElementById || !Array.isArray(chartIds)) {
      return 0;
    }
    var count = 0;
    chartIds.forEach(function (chartId) {
      var chartEl = chartId ? doc.getElementById(String(chartId)) : null;
      var component = chartEl && chartEl.components && chartEl.components[COMPONENT_NAME];
      if (component && typeof component[methodName] === 'function') {
        component[methodName](reason);
        count += 1;
      }
    });
    applyTableWarning(buildActiveContainmentDiagnostics(chartIds));
    return count;
  }
  root[RUNTIME_GLOBAL_NAME].beginChartDataTransition = function (chartIds, reason) {
    return callChartDataTransition(chartIds, 'beginDataTransition', reason || 'chart-data-transition');
  };
  root[RUNTIME_GLOBAL_NAME].finishChartDataTransition = function (chartIds, reason) {
    return callChartDataTransition(chartIds, 'finishDataTransition', reason || 'chart-data-transition-finished');
  };
  root[RUNTIME_GLOBAL_NAME].cancelChartDataTransition = function (chartIds, reason) {
    return callChartDataTransition(chartIds, 'cancelDataTransition', reason || 'chart-data-transition-cancelled');
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
    collectNodeMeta: collectNodeMeta,
    SETTLED_WATCH: SETTLED_WATCH,
    computeContainmentPlanarLimit: computeContainmentPlanarLimit,
    computeBootstrapPlanarScale: computeBootstrapPlanarScale,
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
    isObject3DVisibleInScene: isObject3DVisibleInScene,
    computeAnchorOffset: computeAnchorOffset,
    getTableTopY: getTableTopY,
    resolveChartFitMode: resolveChartFitMode,
    resolveChartSurfaceLift: resolveChartSurfaceLift,
    buildTabletopAnchorDiagnostics: buildTabletopAnchorDiagnostics,
    getAnalysisTableZonesForMode: getAnalysisTableZonesForMode,
    getVisibleDependencyGraphRoots: getVisibleDependencyGraphRoots,
    resolveContainmentProfile: resolveContainmentProfile,
    buildActiveContainmentDiagnostics: buildActiveContainmentDiagnostics,
    collectNonFiniteValueIssues: collectNonFiniteValueIssues,
    inspectInvalidAxisState: inspectInvalidAxisState,
    computeStableBoatsZoneElevation: computeStableBoatsZoneElevation
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
