// == xrChartMappingUiRuntime.js | part 70: dimension-and-views (assembled with its siblings; see COMPONENTS.md) ==
  function applyDimensionSelection(config, dimensionId, fieldName, options) {
    var chartEntities = getChartEntities(config);
    var componentName = getChartComponentName(config);
    var alreadySelected = state.selectedByDimension[dimensionId] === fieldName;
    var forceSelection = !!(options && options.force === true);
    var invalidOptionReason = getInvalidOptionReason(dimensionId, fieldName);

    if (!chartEntities.length || !componentName) {
      return false;
    }

    if (alreadySelected && !forceSelection) {
      return false;
    }

    if (invalidOptionReason && !forceSelection) {
      setStatusMessage(invalidOptionReason, 'error', 3600);
      resizeTrace('mapping-selection-blocked', {
        chartId: config && config.chartId,
        dimensionId: dimensionId,
        fieldName: fieldName,
        reason: invalidOptionReason,
        phase: 'disabled-option'
      });
      return false;
    }

    var previousMapping = cloneMapping(state.selectedByDimension);
    var nextMapping = cloneMapping(previousMapping);
    nextMapping[dimensionId] = fieldName;

    applyMappingToCharts(chartEntities, componentName, nextMapping);

    state.selectedByDimension = cloneMapping(nextMapping);
    clearStatusTimer();

    if (!options || options.trackPending !== false) {
      clearPendingValidationTimers();
      state.pendingMappingToken += 1;
      state.pendingMapping = {
        token: state.pendingMappingToken,
        dimensionId: dimensionId,
        fieldName: fieldName,
        previousMapping: previousMapping,
        nextMapping: nextMapping
      };
      schedulePendingMappingValidation(config, state.pendingMappingToken);
    } else {
      clearInvalidOption(dimensionId, fieldName);
      state.lastKnownGoodMapping = cloneMapping(nextMapping);
      saveActiveMappingProfile();
      state.pendingMapping = null;
    }

    if (!options || options.renormalize !== false) {
      requestChartContainmentRenormalize('mapping-ui-change');
    }

    return true;
  }

  function syncToggleLabel(config) {
    if (!refs.toggle) {
      return;
    }
    refs.toggle.setAttribute('material', {
      color: state.visible ? '#f3b108' : '#16a34a',
      opacity: 0.98,
      shader: 'flat',
      transparent: true
    });
    refs.toggle.setAttribute('text', {
      value: state.visible ? '-' : '+',
      align: 'center',
      color: '#ffffff',
      width: 1,
      baseline: 'center',
      anchor: 'center'
    });
  }

  function setVisible(config, visible) {
    state.visible = !!visible;
    if (refs.panelContent) {
      refs.panelContent.setAttribute('visible', state.visible);
    }
    syncPanelInteractions();
    syncToggleLabel(config);
  }

  function setEntityInteractionEnabled(entity, enabled) {
    if (!entity) {
      return;
    }
    var controls = [entity].concat(
      entity.querySelectorAll
        ? Array.prototype.slice.call(entity.querySelectorAll('[data-codexr-interactive="true"]'))
        : []
    );
    controls.forEach(function (control) {
      if (!control || !control.classList) {
        return;
      }
      if (enabled) {
        control.classList.add('babiaxraycasterclass');
      } else {
        control.classList.remove('babiaxraycasterclass');
      }
    });
  }

  function syncPanelViewInteraction(viewId) {
    var view = state.panelViews[viewId];
    if (!view || !view.content) {
      return;
    }
    setEntityInteractionEnabled(view.content, state.visible && state.activePanelView === viewId);
  }

  function syncPanelInteractions() {
    if (refs.rowsRoot) {
      setEntityInteractionEnabled(refs.rowsRoot, state.visible && state.activePanelView === 'mapping');
    }
    if (refs.chartRoot) {
      setEntityInteractionEnabled(refs.chartRoot, state.visible && state.activePanelView === 'mapping');
    }
    Object.keys(state.panelViews).forEach(syncPanelViewInteraction);
  }

  function applyPanelHeight(panelHeight) {
    var height = Math.max(2.45, Number(panelHeight) || 2.45);
    if (refs.panelBackground) {
      refs.panelBackground.setAttribute('height', height);
    }
    if (refs.panelBorder) {
      refs.panelBorder.setAttribute('height', height + 0.05);
    }
    if (refs.panelTitleBackdrop) {
      refs.panelTitleBackdrop.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.02');
    }
    if (refs.panelTitle) {
      refs.panelTitle.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.03');
    }
    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('position', '-0.05 ' + (height * 0.45 - PANEL_LAYOUT.rowsRootHeightOffset) + ' 0.02');
    }
    if (refs.chartRoot) {
      refs.chartRoot.setAttribute('position', '-0.05 ' + (height * 0.45 - PANEL_LAYOUT.chartRootHeightOffset) + ' 0.03');
    }
    if (refs.statusText) {
      refs.statusText.setAttribute('position', '-2.85 ' + (-height * 0.5 + 0.36) + ' 0.03');
    }
    if (refs.toggle) {
      refs.toggle.setAttribute('position', '2.95 ' + (height * 0.5 + 0.17) + ' 0.04');
    }
    Object.keys(state.panelViews).map(function (viewId) {
      return state.panelViews[viewId];
    }).filter(function (view) {
      return !!view.button;
    }).forEach(function (view, index) {
      view.button?.setAttribute(
        'position',
        (2.53 - (index * 0.42)) + ' ' + (height * 0.5 + 0.17) + ' 0.04'
      );
    });
  }

  function syncPanelViewButtons() {
    Object.keys(state.panelViews).forEach(function (viewId) {
      var view = state.panelViews[viewId];
      var active = state.activePanelView === viewId;
      view.button?.setAttribute('material', {
        color: active ? '#be123c' : '#0e7490',
        opacity: 0.98,
        shader: 'flat',
        transparent: true
      });
      view.button?.setAttribute('text', {
        value: view.buttonLabel,
        align: 'center',
        color: '#ffffff',
        width: 1,
        baseline: 'center',
        anchor: 'center'
      });
    });
  }

  function showPanelView(viewId) {
    var targetView = viewId && viewId !== 'mapping' ? state.panelViews[viewId] : null;
    var nextViewId = targetView ? viewId : 'mapping';
    if (CONTROLLER_VIEW_BY_PANEL[nextViewId]) {
      state.activeControllerView = CONTROLLER_VIEW_BY_PANEL[nextViewId];
    }
    root.console?.log?.('[CodeXR.Debug]: Mapping panel view requested', {
      requested: viewId || 'mapping',
      resolved: nextViewId,
      previous: state.activePanelView
    });
    var previousView = state.panelViews[state.activePanelView];
    if (previousView && previousView.id !== nextViewId) {
      previousView.content.setAttribute('visible', false);
      previousView.onHide?.();
    }

    state.activePanelView = nextViewId;
    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('visible', nextViewId === 'mapping');
    }
    if (refs.chartRoot) {
      refs.chartRoot.setAttribute('visible', nextViewId === 'mapping');
    }
    if (refs.statusText) {
      refs.statusText.setAttribute('visible', nextViewId === 'mapping' && !!state.statusMessage);
    }

    if (nextViewId === 'mapping') {
      if (refs.panelTitle) {
        refs.panelTitle.setAttribute('value', 'CodeXR Field Mapping');
      }
      Object.keys(state.panelViews).forEach(function (registeredViewId) {
        state.panelViews[registeredViewId].content.setAttribute('visible', false);
      });
      applyPanelHeight(state.mappingPanelHeight);
    } else {
      targetView.content.setAttribute('visible', true);
      if (refs.panelTitle) {
        refs.panelTitle.setAttribute('value', targetView.title);
      }
      applyPanelHeight(targetView.panelHeight);
      targetView.onShow?.();
    }

    syncPanelInteractions();
    setVisible(getConfig() || {}, true);
    syncPanelViewButtons();
    return nextViewId;
  }

  function normalizeControllerView(viewId) {
    var requested = String(viewId || 'single.mapping');
    return CONTROLLER_PANEL_BY_VIEW[requested] ? requested : 'single.mapping';
  }

  function inferModeFromControllerView(viewId) {
    if (viewId === 'visualization-menu') {
      return 'selection';
    }
    if (viewId.indexOf('dependency.') === 0) {
      return 'dependency-graph';
    }
    if (viewId.indexOf('historical.') === 0) {
      return 'historical-compare';
    }
    if (viewId.indexOf('project-evolution') === 0) {
      return 'project-evolution';
    }
    return 'single';
  }

  function showControllerView(viewId, context) {
    var nextViewId = normalizeControllerView(viewId);
    state.activeControllerView = nextViewId;
    state.mode = String(context.mode || inferModeFromControllerView(nextViewId));
    var panelId = CONTROLLER_PANEL_BY_VIEW[nextViewId] || 'mapping';
    if (context.mappingContextId) {
      switchMappingContext(context.mappingContextId, {
        reason: context.reason || ('controller-view-' + nextViewId)
      });
    }
    var resolvedPanel = showPanelView(panelId);
    state.activeControllerView = nextViewId;
    state.mode = String(context.mode || inferModeFromControllerView(nextViewId));
    return {
      mode: state.mode,
      controllerView: nextViewId,
      panelView: resolvedPanel
    };
  }

  function getModeMemory(mode) {
    var key = String(mode || state.mode || 'single');
    return Object.assign({}, state.modeMemory[key] || {});
  }

  function saveModeMemory(mode, patch) {
    var key = String(mode || state.mode || 'single');
    var previous = state.modeMemory[key] || {};
    state.modeMemory[key] = Object.assign({}, previous, patch || {});
    return getModeMemory(key);
  }
