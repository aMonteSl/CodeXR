// == xrChartMappingUiRuntime.js | pendingValidation (assembled per manifest.json; see COMPONENTS.md) ==
  function confirmPendingMapping(config, token) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }
    clearInvalidOption(state.pendingMapping.dimensionId, state.pendingMapping.fieldName);
    state.lastKnownGoodMapping = cloneMapping(state.pendingMapping.nextMapping);
    state.pendingMapping = null;
    clearPendingValidationTimers();
    saveActiveMappingProfile();
    resizeTrace('mapping-confirmed', {
      token: token,
      selectedByDimension: state.lastKnownGoodMapping
    });
    publishSharedMappingState(config);
    notifyMappingConfirmed(state.lastKnownGoodMapping);
  }

  function revertPendingMapping(config, token, reason) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }
    var friendlyMessage = buildFriendlyInvalidMappingMessage(
      config,
      state.pendingMapping.dimensionId,
      state.pendingMapping.fieldName,
      reason,
      true
    );
    markInvalidOption(state.pendingMapping.dimensionId, state.pendingMapping.fieldName, friendlyMessage);
    applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-revert');
    setStatusMessage(friendlyMessage, 'error', 4800);
    resizeTrace('mapping-reverted-invalid-babia-frame', {
      token: token,
      reason: reason || 'invalid-chart-state'
    });
    state.pendingMapping = null;
    clearPendingValidationTimers();
    renderRows(config);
  }

  function evaluatePendingMapping(config, token, result) {
    if (!state.pendingMapping || state.pendingMapping.token !== token) {
      return;
    }

    if (result && result.valid && result.stabilized) {
      confirmPendingMapping(config, token);
      renderRows(config);
      return;
    }

    if (result && result.valid && !result.stabilized) {
      applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-unstable-revert');
      state.pendingMapping = null;
      clearPendingValidationTimers();
      scheduleContainmentValidationBursts('mapping-ui-revert');
      setStatusMessage(
        'The chart did not stabilize inside the table after changing this metric. CodeXR restored the previous mapping.',
        'error',
        4800
      );
      resizeTrace('mapping-reverted-unstable-containment', {
        token: token,
        reason: result.reason || result.state || 'not-stabilized'
      });
      renderRows(config);
      return;
    }

    if (result && result.state === 'invalid') {
      var invalidStatus = (result.statuses || []).find(function (status) {
        return status && status.valid === false && status.ready === true;
      });
      revertPendingMapping(
        config,
        token,
        invalidStatus?.message || 'The selected mapping produced invalid chart geometry.'
      );
      return;
    }

    applyMappingSnapshot(config, state.pendingMapping.previousMapping, 'mapping-ui-timeout-revert');
    state.pendingMapping = null;
    clearPendingValidationTimers();
    scheduleContainmentValidationBursts('mapping-ui-timeout-revert');
    setStatusMessage(
      'The chart did not finish rebuilding. CodeXR restored the previous mapping; you can try this field again.',
      'error',
      4800
    );
    renderRows(config);
  }

  function schedulePendingMappingValidation(config, token) {
    clearPendingValidationTimers();
    var runtime = root.CodeXRAnalysisTableRuntime;
    var chartTargets = buildChartValidationTargets(config);
    requestChartContainmentRenormalize('mapping-ui-validation-start');
    scheduleContainmentValidationBursts('mapping-ui-validation');
    if (!runtime || typeof runtime.waitForChartsStable !== 'function') {
      var timer = setTimeout(function () {
        var status = inspectChartStatus(config);
        evaluatePendingMapping(config, token, {
          state: status && status.valid ? 'stabilized' : 'invalid',
          valid: !!(status && status.valid),
          stabilized: !!(status && status.valid),
          statuses: status ? [status] : []
        });
      }, 1200);
      state.pendingValidationTimers.push(timer);
      return;
    }

    runtime.waitForChartsStable(chartTargets, {
      timeoutMs: 26000,
      pollMs: 120,
      stablePasses: 2
    }).then(function (result) {
      evaluatePendingMapping(config, token, result);
    });
  }

  function scheduleContainmentValidationBursts(reason) {
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.renormalizeAll !== 'function') {
      return;
    }
    [650, 1300, 2200, 3600, 5200, 7600, 10500, 14000, 18000].forEach(function (delayMs, index) {
      var timer = setTimeout(function () {
        analysisTableRuntime.renormalizeAll((reason || 'mapping-ui-validation') + '-burst-' + (index + 1));
      }, delayMs);
      state.pendingValidationTimers.push(timer);
    });
  }

  function resizeTrace(label, payload) {
    if (payload !== undefined) {
      console.log('[Re-size] ' + label, payload);
      return;
    }
    console.log('[Re-size] ' + label);
  }

  function requestChartContainmentRenormalize(reason) {
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.renormalizeAll !== 'function') {
      return;
    }

    var nextFrame = root.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
    nextFrame(function () {
      analysisTableRuntime.renormalizeAll(reason || 'mapping-ui-change');
    });

    if (state.delayedRenormalizeTimer) {
      clearTimeout(state.delayedRenormalizeTimer);
    }
    state.delayedRenormalizeTimer = setTimeout(function () {
      state.delayedRenormalizeTimer = null;
      analysisTableRuntime.renormalizeAll((reason || 'mapping-ui-change') + '-settled');
    }, 300);
  }
