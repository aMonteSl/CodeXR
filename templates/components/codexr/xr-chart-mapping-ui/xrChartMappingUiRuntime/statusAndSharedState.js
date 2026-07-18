// == xrChartMappingUiRuntime.js | statusAndSharedState (assembled per manifest.json; see COMPONENTS.md) ==
  function clearPendingValidationTimers() {
    while (state.pendingValidationTimers.length > 0) {
      clearTimeout(state.pendingValidationTimers.pop());
    }
  }

  function updateStatusText() {
    if (!refs.statusText) {
      return;
    }
    refs.statusText.setAttribute('value', state.statusMessage || '');
    refs.statusText.setAttribute('color', state.statusLevel === 'error' ? '#fca5a5' : '#fde68a');
    refs.statusText.setAttribute('visible', !!state.statusMessage);
  }

  function clearStatusTimer() {
    if (state.statusClearTimer) {
      clearTimeout(state.statusClearTimer);
      state.statusClearTimer = null;
    }
  }

  function setStatusMessage(message, level, ttlMs) {
    state.statusMessage = message || '';
    state.statusLevel = level || 'warning';
    updateStatusText();
    clearStatusTimer();
    if (state.statusMessage && ttlMs !== 0) {
      state.statusClearTimer = setTimeout(function () {
        state.statusClearTimer = null;
        state.statusMessage = '';
        updateStatusText();
      }, typeof ttlMs === 'number' ? ttlMs : 3200);
    }
  }

  function markInvalidOption(dimensionId, fieldName, reason) {
    if (!state.invalidOptionsByDimension[dimensionId]) {
      state.invalidOptionsByDimension[dimensionId] = {};
    }
    state.invalidOptionsByDimension[dimensionId][fieldName] = reason || 'This mapping is currently invalid.';
  }

  function clearInvalidOption(dimensionId, fieldName) {
    if (!state.invalidOptionsByDimension[dimensionId]) {
      return;
    }
    delete state.invalidOptionsByDimension[dimensionId][fieldName];
    if (Object.keys(state.invalidOptionsByDimension[dimensionId]).length === 0) {
      delete state.invalidOptionsByDimension[dimensionId];
    }
  }

  function getInvalidOptionReason(dimensionId, fieldName) {
    return state.invalidOptionsByDimension[dimensionId] && state.invalidOptionsByDimension[dimensionId][fieldName]
      ? state.invalidOptionsByDimension[dimensionId][fieldName]
      : '';
  }

  function applyMappingSnapshot(config, mappingSnapshot, reason) {
    var chartEntities = getChartEntities(config);
    var componentName = getChartComponentName(config);
    if (!chartEntities.length || !componentName || !mappingSnapshot) {
      return false;
    }

    applyMappingToCharts(chartEntities, componentName, mappingSnapshot);
    state.selectedByDimension = cloneMapping(mappingSnapshot);
    requestChartContainmentRenormalize(reason || 'mapping-ui-snapshot');
    return true;
  }

  function inspectChartStatus(config) {
    var chartTargets = buildChartValidationTargets(config);
    var analysisTableRuntime = root.CodeXRAnalysisTableRuntime;
    if (!analysisTableRuntime || typeof analysisTableRuntime.getChartStatus !== 'function') {
      return { ready: true, valid: true, reason: 'containment-runtime-unavailable' };
    }
    var statuses = chartTargets.map(function (resolveChartTarget) {
      return analysisTableRuntime.getChartStatus(resolveChartTarget());
    });
    var pending = statuses.find(function (status) { return !status || status.ready === false; });
    if (pending) {
      return pending;
    }
    return statuses.find(function (status) { return status.valid === false; })
      || { ready: true, valid: true, reason: 'ok' };
  }

  function getSharedMappingEntityId(config) {
    var baseId = config && (config.chartEntityId || config.chartSelector || config.chartId)
        ? String(config.chartEntityId || config.chartSelector || config.chartId)
        : 'default-chart';
    return String(baseId).replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function buildSharedMappingState(config) {
    return {
      entityKind: SHARED_ENTITY_KIND,
      entityId: getSharedMappingEntityId(config),
      chartId: getActiveChartId(config),
      componentName: getChartComponentName(config) || '',
      selectedByDimension: cloneMapping(state.lastKnownGoodMapping || state.selectedByDimension)
    };
  }

  function publishSharedMappingState(config, eventType) {
    if (state.suppressSharedPublish) {
      return false;
    }
    var client = getCollaborationClient();
    if (!client || typeof client.sendEntityState !== 'function') {
      return false;
    }
    return client.sendEntityState(buildSharedMappingState(config), eventType || 'entity-updated');
  }

  function applySharedMappingState(config, snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.selectedByDimension) {
      return false;
    }

    state.suppressSharedPublish = true;
    try {
      clearPendingValidationTimers();
      state.pendingMapping = null;
      if (snapshot.chartId && snapshot.chartId !== getActiveChartId(config)) {
        selectChart(snapshot.chartId);
      }
      state.selectedByDimension = cloneMapping(snapshot.selectedByDimension);
      state.lastKnownGoodMapping = cloneMapping(snapshot.selectedByDimension);
      applyMappingSnapshot(config, snapshot.selectedByDimension, 'mapping-ui-room-sync');
      saveActiveMappingProfile();
      renderRows(config);
      notifyMappingConfirmed(state.lastKnownGoodMapping);
      return true;
    } finally {
      state.suppressSharedPublish = false;
    }
  }

  function publishInitialSharedMappingState(config) {
    return publishSharedMappingState(config, 'entity-added');
  }

  function registerSharedMappingEntity(config) {
    var client = getCollaborationClient();
    if (!client || typeof client.registerEntityRuntime !== 'function') {
      return;
    }

    client.registerEntityRuntime({
      entityKind: SHARED_ENTITY_KIND,
      entityId: getSharedMappingEntityId(config),
      applySharedState: function (snapshot) {
        applySharedMappingState(config, snapshot);
      },
      publishInitialSharedState: function () {
        publishInitialSharedMappingState(config);
      }
    });
  }

  function notifyMappingConfirmed(mapping) {
    var document = getDoc();
    if (!document || typeof document.dispatchEvent !== 'function') {
      return;
    }
    var detail = {
      selectedByDimension: cloneMapping(mapping || {}),
      chartId: getActiveChartId(getConfig()),
      mappingContextId: state.activeMappingContextId
    };
    if (typeof root.CustomEvent === 'function') {
      document.dispatchEvent(new root.CustomEvent('codexr-mapping-confirmed', { detail: detail }));
      return;
    }
    document.dispatchEvent({
      type: 'codexr-mapping-confirmed',
      detail: detail
    });
  }
