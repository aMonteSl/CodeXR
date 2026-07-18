// == xrChartMappingUiRuntime.js | panelUi (assembled per manifest.json; see COMPONENTS.md) ==
  /**
   * Run `callback` as soon as the controller panel exists — immediately when
   * it is already built, otherwise queued until buildUi() completes. This is
   * the supported way for feature runtimes to time their registerPanelView
   * call: polling with capped retries silently loses views on slow scenes.
   */
  function whenPanelReady(callback) {
    if (typeof callback !== 'function') {
      return false;
    }
    if (refs.panel && refs.panelContent) {
      callback();
      return true;
    }
    PANEL_READY_CALLBACKS.push(callback);
    return true;
  }

  function flushPanelReadyCallbacks() {
    while (PANEL_READY_CALLBACKS.length) {
      var callback = PANEL_READY_CALLBACKS.shift();
      try {
        callback();
      } catch (error) {
        console.warn('[CodeXR][MappingUI] panel-ready callback failed:', error);
      }
    }
  }

  function registerPanelView(options) {
    if (!refs.panel || !refs.panelContent) {
      return null;
    }
    if (!options || !options.id || !options.content) {
      return function () {};
    }
    var viewId = String(options.id);
    var existing = state.panelViews[viewId];
    if (existing) {
      state.panelViewObservers[viewId]?.disconnect?.();
      delete state.panelViewObservers[viewId];
      existing.button?.remove();
      existing.content?.remove();
    }

    var content = options.content;
    content.setAttribute('visible', false);
    setEntityInteractionEnabled(content, false);
    refs.panelContent.appendChild(content);
    var observer = null;
    if (typeof root.MutationObserver === 'function') {
      observer = new root.MutationObserver(function () {
        syncPanelViewInteraction(viewId);
      });
      observer.observe(content, { childList: true, subtree: true });
      state.panelViewObservers[viewId] = observer;
    }
    var button = null;
    if (options.headerButton === true) {
      button = createEntity('a-plane', {
        id: 'codexrMappingUiView-' + viewId,
        class: 'babiaxraycasterclass codexr-mapping-ui-view-toggle',
        'data-codexr-interactive': 'true',
        width: 0.34,
        height: 0.34
      });
      refs.panel.appendChild(button);
    }

    state.panelViews[viewId] = {
      id: viewId,
      title: String(options.title || viewId),
      buttonLabel: String(options.buttonLabel || 'V').slice(0, 1).toUpperCase(),
      panelHeight: Math.max(2.45, Number(options.panelHeight) || 2.45),
      content: content,
      button: button,
      onShow: typeof options.onShow === 'function' ? options.onShow : null,
      onHide: typeof options.onHide === 'function' ? options.onHide : null,
      onToggleActive: typeof options.onToggleActive === 'function'
        ? options.onToggleActive
        : null
    };
    button?.addEventListener('click', function () {
      root.console?.log?.('[CodeXR.Debug]: Mapping panel header button clicked', {
        viewId: viewId,
        activePanelView: state.activePanelView
      });
      if (state.activePanelView === viewId && state.panelViews[viewId]?.onToggleActive) {
        state.panelViews[viewId].onToggleActive();
        return;
      }
      showPanelView(viewId);
    });
    applyPanelHeight(state.activePanelView === 'mapping'
      ? state.mappingPanelHeight
      : state.panelViews[state.activePanelView]?.panelHeight);
    syncPanelViewButtons();

    return function () {
      var view = state.panelViews[viewId];
      if (!view) {
        return;
      }
      if (state.activePanelView === viewId) {
        showPanelView('mapping');
      }
      state.panelViewObservers[viewId]?.disconnect?.();
      delete state.panelViewObservers[viewId];
      view.button?.remove();
      view.content?.remove();
      delete state.panelViews[viewId];
      applyPanelHeight(state.mappingPanelHeight);
    };
  }

  function setPanelViewTitle(viewId, title) {
    var view = state.panelViews[String(viewId || '')];
    if (!view) {
      return false;
    }
    view.title = String(title || view.title);
    if (state.activePanelView === view.id && refs.panelTitle) {
      refs.panelTitle.setAttribute('value', view.title);
    }
    return true;
  }

  function setPanelViewHeight(viewId, panelHeight) {
    var view = state.panelViews[String(viewId || '')];
    if (!view) {
      return false;
    }
    view.panelHeight = Math.max(2.45, Number(panelHeight) || view.panelHeight);
    if (state.activePanelView === view.id) {
      applyPanelHeight(view.panelHeight);
    }
    return true;
  }

  function renderRows(config) {
    if (!refs.rowsRoot) {
      return;
    }

    clearEntity(refs.rowsRoot);

    var dimensions = Array.isArray(config.dimensions) ? config.dimensions : [];
    var cursorY = 0;

    dimensions.forEach(function (dimension) {
      if (!dimension || dimension.hidden) {
        return;
      }

      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      if (fields.length === 0) {
        return;
      }

      var label = createEntity('a-text', {
        value: (dimension.label || dimension.id) + (dimension.dataType === 'numeric' ? ' [N]' : ''),
        align: 'left',
        color: '#cde7ff',
        width: PANEL_LAYOUT.labelWidth,
        position: PANEL_LAYOUT.left + ' ' + (cursorY - 0.05) + ' 0.02'
      });
      refs.rowsRoot.appendChild(label);
      cursorY -= PANEL_LAYOUT.labelToButtonsGap;

      var cols = pickColumns(fields.length);
      var buttonWidth = getGridButtonWidth(cols);

      fields.forEach(function (fieldName, fieldIndex) {
        var rowIndex = Math.floor(fieldIndex / cols);
        var colIndex = fieldIndex % cols;
        var isActive = state.selectedByDimension[dimension.id] === fieldName;
        var invalidReason = getInvalidOptionReason(dimension.id, fieldName);
        var isDisabled = !!invalidReason && !isActive;

        var x = getGridButtonX(colIndex, buttonWidth);
        var y = cursorY - rowIndex * PANEL_LAYOUT.rowGap;

        var button = createEntity('a-plane', {
          class: 'babiaxraycasterclass codexr-mapping-ui-option',
          'data-codexr-interactive': 'true',
          color: isActive ? '#be123c' : (isDisabled ? '#334155' : '#1e3a5f'),
          width: buttonWidth,
          height: 0.22,
          opacity: isActive ? 0.98 : (isDisabled ? 0.55 : 0.92),
          position: x + ' ' + y + ' 0.01'
        });

        var text = createEntity('a-text', {
          value: compactLabel(fieldName),
          align: 'center',
          color: isDisabled ? '#cbd5e1' : '#ffffff',
          width: buttonWidth * 1.9,
          position: '0 0 0.01'
        });

        button.appendChild(text);
        button.addEventListener('click', function () {
          if (isDisabled) {
            setStatusMessage(invalidReason, 'error', 4000);
            return;
          }
          var changed = applyDimensionSelection(config, dimension.id, fieldName);
          if (changed) {
            renderRows(config);
          }
        });

        refs.rowsRoot.appendChild(button);
      });

      cursorY -= Math.ceil(fields.length / cols) * PANEL_LAYOUT.rowGap + PANEL_LAYOUT.sectionGap;
    });

    var panelHeight = Math.max(2.9, Math.abs(cursorY) + PANEL_LAYOUT.panelHeightPadding);
    state.mappingPanelHeight = panelHeight;
    if (state.activePanelView === 'mapping') {
      applyPanelHeight(panelHeight);
    }
    if (refs.statusText) {
      updateStatusText();
    }
  }

  function renderChartSelector(config) {
    if (!refs.chartRoot) {
      return;
    }
    clearEntity(refs.chartRoot);
    var charts = Array.isArray(config && config.availableCharts) ? config.availableCharts : [];
    if (!charts.length) {
      return;
    }
    refs.chartRoot.appendChild(createEntity('a-text', {
      value: 'Chart',
      align: 'left',
      color: '#cde7ff',
      width: PANEL_LAYOUT.labelWidth,
      position: PANEL_LAYOUT.left + ' 0.02 0.02'
    }));
    var visibleCharts = charts.slice(0, 9);
    var cols = Math.min(3, Math.max(1, visibleCharts.length));
    var buttonWidth = getGridButtonWidth(cols);
    visibleCharts.forEach(function (chart, index) {
      var rowIndex = Math.floor(index / cols);
      var colIndex = index % cols;
      var active = chart.id === getActiveChartId(config);
      var x = getGridButtonX(colIndex, buttonWidth);
      var y = -PANEL_LAYOUT.labelToButtonsGap - rowIndex * PANEL_LAYOUT.rowGap;
      var button = createEntity('a-plane', {
        class: 'babiaxraycasterclass codexr-mapping-ui-chart-option',
        'data-codexr-interactive': 'true',
        'data-codexr-chart-id': chart.id,
        color: active ? '#be123c' : '#0f3a5f',
        width: buttonWidth,
        height: 0.22,
        opacity: active ? 0.98 : 0.9,
        position: x + ' ' + y + ' 0.01'
      });
      button.appendChild(createEntity('a-text', {
        value: compactLabel(chart.name || chart.id),
        align: 'center',
        color: '#ffffff',
        width: buttonWidth * 1.8,
        position: '0 0 0.01'
      }));
      button.addEventListener('click', function () {
        selectChart(chart.id);
      });
      refs.chartRoot.appendChild(button);
    });
  }

  function selectChart(chartId) {
    var config = getConfig();
    if (!config || !chartId || chartId === getActiveChartId(config)) {
      return false;
    }
    var chart = (config.availableCharts || []).find(function (candidate) {
      return candidate && candidate.id === chartId;
    });
    if (!chart || !COMPONENT_BY_CHART[chartId]) {
      setStatusMessage('This chart is not available in the current XR scene.', 'error', 4200);
      return false;
    }

    saveActiveMappingProfile();
    var previousChartId = getActiveChartId(config);
    var previousDimensions = config.dimensions;
    var nextDimensions = getDimensionsForChart(config, chartId);
    var profileKey = getMappingProfileKey(state.activeMappingContextId, chartId);
    var nextSnapshot = state.mappingProfiles[profileKey] || {
      visible: state.visible,
      selectedByDimension: getDefaultMappingForChart(config, chartId),
      lastKnownGoodMapping: getDefaultMappingForChart(config, chartId),
      invalidOptionsByDimension: {}
    };

    if (!nextDimensions.length) {
      setStatusMessage('This chart has no compatible fields for the current analysis data.', 'error', 4200);
      return false;
    }

    if (!applyChartTypeToEntities(config, chartId, nextSnapshot.lastKnownGoodMapping || nextSnapshot.selectedByDimension)) {
      config.dimensions = previousDimensions;
      state.activeChartId = previousChartId;
      setStatusMessage('CodeXR could not switch chart; the previous chart was kept.', 'error', 4800);
      return false;
    }

    state.activeChartId = chartId;
    config.chartId = chartId;
    config.dimensions = nextDimensions;
    applyMappingRuntimeState(config, nextSnapshot, 'mapping-ui-chart-switch-' + chartId);
    renderChartSelector(config);
    renderRows(config);
    requestChartContainmentRenormalize('mapping-ui-chart-switch');
    scheduleContainmentValidationBursts('mapping-ui-chart-switch');
    setStatusMessage('Chart changed to ' + (chart.name || chartId) + '.', 'info', 2600);
    publishSharedMappingState(config);
    notifyMappingConfirmed(state.lastKnownGoodMapping);
    return true;
  }

  function buildUi(config) {
    var scene = getDoc().querySelector(config.sceneSelector || '#scene');
    if (!scene) {
      return;
    }

    var existingPanel = getDoc().getElementById(config.panelId || 'codexrMappingUiPanel');
    var existingToggle = getDoc().getElementById(config.toggleId || 'codexrMappingUiToggle');
    if (existingPanel) {
      existingPanel.remove();
    }
    if (existingToggle) {
      existingToggle.remove();
    }

    refs.panel = createEntity('a-entity', {
      id: config.panelId || 'codexrMappingUiPanel',
      position: config.panelPosition || '8 2 -8',
      rotation: config.panelRotation || '0 -70 0',
      scale: (config.panelScale || 0.2) + ' ' + (config.panelScale || 0.2) + ' ' + (config.panelScale || 0.2),
      class: 'codexr-mapping-ui-panel',
      visible: true
    });

    if (config.hideOnEnterAr === true) {
      refs.panel.setAttribute('hide-on-enter-ar', '');
    } else {
      refs.panel.removeAttribute('hide-on-enter-ar');
    }

    refs.panelContent = createEntity('a-entity', {
      position: '0 0 0',
      visible: state.visible !== false
    });

    refs.panelBackground = createEntity('a-plane', {
      color: '#0A1628',
      opacity: 0.94,
      width: 6.2,
      height: 2.2,
      position: '0 0 0'
    });

    refs.panelBorder = createEntity('a-box', {
      color: '#22d3ee',
      opacity: 0.5,
      width: 6.25,
      height: 2.25,
      depth: 0.01,
      position: '0 0 -0.01'
    });

    refs.panelTitleBackdrop = createEntity('a-plane', {
      color: '#0b4f6c',
      opacity: 0.96,
      width: 2.7,
      height: 0.34,
      position: '0 1.32 0.02'
    });

    refs.panelTitle = createEntity('a-text', {
      value: 'CodeXR Field Mapping',
      align: 'center',
      color: '#eaf4ff',
      width: 7,
      position: '0 1.32 0.03'
    });

    refs.rowsRoot = createEntity('a-entity', {
      position: '-0.05 -0.18 0.02'
    });

    refs.chartRoot = createEntity('a-entity', {
      position: '-0.05 0.9 0.03'
    });

    refs.statusText = createEntity('a-text', {
      value: '',
      align: 'left',
      color: '#fde68a',
      width: 5.9,
      position: '-2.85 -0.86 0.03',
      visible: false,
      'wrap-count': 30,
      baseline: 'top'
    });

    refs.panelContent.appendChild(refs.panelBackground);
    refs.panelContent.appendChild(refs.panelBorder);
    refs.panelContent.appendChild(refs.panelTitleBackdrop);
    refs.panelContent.appendChild(refs.panelTitle);
    refs.panelContent.appendChild(refs.chartRoot);
    refs.panelContent.appendChild(refs.rowsRoot);
    refs.panelContent.appendChild(refs.statusText);
    refs.panel.appendChild(refs.panelContent);

    refs.toggle = createEntity('a-plane', {
      id: config.toggleId || 'codexrMappingUiToggle',
      class: 'babiaxraycasterclass codexr-mapping-ui-toggle',
      width: 0.34,
      height: 0.34,
      position: '2.95 1.26 0.04'
    });

    refs.toggle.addEventListener('click', function () {
      setVisible(config, !state.visible);
    });

    refs.panel.appendChild(refs.toggle);
    scene.appendChild(refs.panel);
    state.activeCornerId = null;
    syncToggleLabel(config);
    setVisible(config, state.visible);
    updateStatusText();
    renderChartSelector(config);
    renderRows(config);

    if (config.adaptiveCorner) {
      applyAdaptivePlacement(config);
      ensureAdaptivePlacementLoop();
    }

    // The panel is now usable: let every queued feature runtime register its
    // view (analysis selector, dependencies, historical, evolution, ...).
    flushPanelReadyCallbacks();
  }
