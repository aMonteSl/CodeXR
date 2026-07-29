// == xrChartMappingUiRuntime.js | dimensionAndViews (assembled per manifest.json; see COMPONENTS.md) ==
  function applyDimensionSelection(config, dimensionId, fieldName, options) {
    if (state.mappingControlsLocked && !(options && options.forceWhenLocked === true)) {
      setStatusMessage('Playback running - pause to change chart or axes.', 'info', 0);
      return false;
    }
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
    var delegatedEntityApply = state.activeMappingContextId === 'project-evolution';

    if (!delegatedEntityApply) {
      applyMappingToCharts(chartEntities, componentName, nextMapping);
    }

    state.selectedByDimension = cloneMapping(nextMapping);
    clearStatusTimer();

    if (delegatedEntityApply) {
      clearPendingValidationTimers();
      clearInvalidOption(dimensionId, fieldName);
      state.lastKnownGoodMapping = cloneMapping(nextMapping);
      state.pendingMapping = null;
      saveActiveMappingProfile();
      publishSharedMappingState(config);
      notifyMappingConfirmed(state.lastKnownGoodMapping);
    } else if (!options || options.trackPending !== false) {
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

    if (!delegatedEntityApply && (!options || options.renormalize !== false)) {
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
    var activeCompanion = getActiveMappingCompanion();
    Object.keys(state.mappingCompanions).forEach(function (contextId) {
      var companion = state.mappingCompanions[contextId];
      setEntityInteractionEnabled(
        companion.content,
        state.visible && state.activePanelView === 'mapping' && companion === activeCompanion
      );
    });
    Object.keys(state.panelViews).forEach(syncPanelViewInteraction);
  }

  // ── Mapping companions ────────────────────────────────────────────────────
  // A companion is a per-mapping-context child section of the Field Mapping
  // view: extra content (and optionally a child title) shown under the mapping
  // rows only while its context is active. Registered once, toggled by
  // context/view switches — never rebuilt.

  function getActiveMappingCompanion() {
    return state.mappingCompanions[state.activeMappingContextId] || null;
  }

  // Panel layout constants shared by the side-companion geometry. The base
  // background (6.2 wide, centred at x=0) spans -3.1..3.1; a 'side' companion
  // widens the panel and re-centres the whole block on the mount axis, so the
  // left mapping column and the right companion straddle the centre evenly
  // (the widened panel stays aligned with the table axis, not shifted right).
  var BASE_PANEL_WIDTH = 6.2;
  var BASE_RIGHT_EDGE = BASE_PANEL_WIDTH / 2;
  var COMPANION_SIDE_GAP = 0.12;

  function registerMappingCompanion(contextId, options) {
    var id = String(contextId || '');
    if (!id || !options?.content || !refs.panelContent) {
      return null;
    }
    var companion = {
      content: options.content,
      placement: options?.placement === 'side' ? 'side' : 'bottom',
      // 'side' → width of the right column; 'bottom' → extra panel height.
      width: Math.max(1.5, Number(options.width) || 3),
      height: Math.max(0.4, Number(options.height) || 0.9),
      // Optional: called with the available column height when the panel is
      // (re)laid out, so a 'side' companion can fill its lateral space.
      layout: typeof options.layout === 'function' ? options.layout : null,
      title: options.title || null
    };
    setCompanionContentVisible(companion.content, false);
    refs.panelContent.appendChild(companion.content);
    state.mappingCompanions[id] = companion;
    syncMappingCompanion();
    return function () {
      if (state.mappingCompanions[id] === companion) {
        companion.content?.remove();
        delete state.mappingCompanions[id];
        syncMappingCompanion();
      }
    };
  }

  // Title of the mapping view: the active context's companion names it (child
  // view), otherwise the generic one. Single source so the header is written
  // once per update instead of generic-then-overwritten.
  function getMappingPanelTitle() {
    return getActiveMappingCompanion()?.title || 'CodeXR Field Mapping';
  }

  // Companion visibility owner. Sets BOTH the attribute and object3D.visible:
  // A-Frame 1.7.1 caches the `visible` attribute on reused entities, and a
  // cached no-op left another analysis' companion painted over the mapping rows.
  function setCompanionContentVisible(content, visible) {
    if (!content) { return; }
    content.setAttribute('visible', !!visible);
    if (content.object3D) {
      content.object3D.visible = !!visible;
    }
  }

  // Re-syncs companion visibility/title/height for the current context. Runs
  // on context switches and whenever the mapping view is (re)shown.
  function syncMappingCompanion() {
    if (state.activePanelView !== 'mapping') {
      return;
    }
    var active = getActiveMappingCompanion();
    Object.keys(state.mappingCompanions).forEach(function (contextId) {
      var companion = state.mappingCompanions[contextId];
      var isActive = companion === active;
      setCompanionContentVisible(companion.content, isActive);
      setEntityInteractionEnabled(companion.content, isActive && state.visible);
    });
    if (refs.panelTitle) {
      refs.panelTitle.setAttribute('value', getMappingPanelTitle());
    }
    // A bottom companion grows the panel height; a side companion keeps the
    // height and widens it (handled inside applyPanelHeight).
    applyPanelHeight(state.mappingPanelHeight + (active && active.placement === 'bottom' ? active.height : 0));
  }

  function applyPanelHeight(panelHeight) {
    var height = Math.max(2.45, Number(panelHeight) || 2.45);
    var companion = state.activePanelView === 'mapping' ? getActiveMappingCompanion() : null;
    var sideCompanion = companion && companion.placement === 'side' ? companion : null;
    // A side companion widens the panel by sideWidth. Rather than growing to the
    // right only (which pushes the centre off the mount axis), the whole block
    // is re-centred: the background sits at x=0 and every element is shifted left
    // by centreShift so the left column and the right companion straddle the
    // mount evenly — the widened panel stays aligned with the table axis.
    var sideWidth = sideCompanion ? sideCompanion.width + COMPANION_SIDE_GAP : 0;
    var centreShift = sideWidth / 2;
    var rightEdge = BASE_RIGHT_EDGE + sideWidth;

    if (companion) {
      companion.content.setAttribute(
        'position',
        sideCompanion
          // Right column: anchored top, under the title, flush with the right edge.
          ? (BASE_RIGHT_EDGE + COMPANION_SIDE_GAP + sideCompanion.width * 0.5 - centreShift) + ' ' + (height * 0.5 - 0.12) + ' 0.03'
          // Bottom strip: above the status line.
          : '0 ' + (-(height * 0.5) + companion.height * 0.5 + 0.5) + ' 0.03'
      );
      // Let a side companion fill the available column height.
      if (sideCompanion && typeof sideCompanion.layout === 'function') {
        sideCompanion.layout(height);
      }
    }
    if (refs.panelBackground) {
      refs.panelBackground.setAttribute('width', BASE_PANEL_WIDTH + sideWidth);
      refs.panelBackground.setAttribute('height', height);
      refs.panelBackground.setAttribute('position', '0 0 0');
    }
    if (refs.panelBorder) {
      refs.panelBorder.setAttribute('width', BASE_PANEL_WIDTH + 0.05 + sideWidth);
      refs.panelBorder.setAttribute('height', height + 0.05);
      refs.panelBorder.setAttribute('position', '0 0 -0.01');
    }
    if (refs.panelTitleBackdrop) {
      refs.panelTitleBackdrop.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.02');
    }
    if (refs.panelTitle) {
      refs.panelTitle.setAttribute('position', '0 ' + (height * 0.5 + 0.23) + ' 0.03');
    }
    if (refs.rowsRoot) {
      refs.rowsRoot.setAttribute('position', (-0.05 - centreShift) + ' ' + (height * 0.45 - PANEL_LAYOUT.rowsRootHeightOffset) + ' 0.02');
    }
    if (refs.chartRoot) {
      refs.chartRoot.setAttribute('position', (-0.05 - centreShift) + ' ' + (height * 0.45 - PANEL_LAYOUT.chartRootHeightOffset) + ' 0.03');
    }
    if (refs.statusText) {
      refs.statusText.setAttribute('position', (-2.85 - centreShift) + ' ' + (-height * 0.5 + 0.36) + ' 0.03');
    }
    if (refs.toggle) {
      // Follows the (possibly widened) right edge of the re-centred panel.
      refs.toggle.setAttribute('position', (rightEdge - centreShift - 0.15) + ' ' + (height * 0.5 + 0.17) + ' 0.04');
    }
    // Header buttons are laid out from the right, each against the previous
    // one: they no longer share a width, so a fixed pitch would either overlap
    // the +/- toggle or leave a hole.
    var headerCursor = rightEdge - centreShift - 0.32 - HEADER_BUTTON_GAP;
    Object.keys(state.panelViews).map(function (viewId) {
      return state.panelViews[viewId];
    }).filter(function (view) {
      return !!view.button;
    }).forEach(function (view) {
      var width = view.buttonWidth || HEADER_BUTTON_MIN_WIDTH;
      view.button?.setAttribute(
        'position',
        (headerCursor - (width * 0.5)) + ' ' + (height * 0.5 + 0.17) + ' 0.04'
      );
      headerCursor -= width + HEADER_BUTTON_GAP;
    });
  }

  function syncPanelViewButtons() {
    Object.keys(state.panelViews).forEach(function (viewId) {
      var view = state.panelViews[viewId];
      var active = state.activePanelView === viewId;
      var width = view.buttonWidth || HEADER_BUTTON_MIN_WIDTH;
      view.button?.setAttribute('material', {
        // A declared colour is the view saying what the button MEANS (the
        // analysis selector paints it with the colour of the analysis you are
        // in); without one, the button just reports whether its view is open.
        color: view.buttonColor || (active ? '#be123c' : '#0e7490'),
        opacity: 0.98,
        shader: 'flat',
        transparent: true
      });
      view.button?.setAttribute('text', {
        value: view.buttonLabel,
        align: 'center',
        color: '#ffffff',
        width: width * HEADER_BUTTON_TEXT_RATIO,
        baseline: 'center',
        anchor: 'center'
      });
    });
  }

  function setPanelViewButtonColor(viewId, color) {
    var view = state.panelViews[viewId];
    if (!view) {
      return false;
    }
    view.buttonColor = color ? String(color) : '';
    syncPanelViewButtons();
    return true;
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
    // updateStatusText owns the status visibility (mapping view only, attr +
    // object3D); re-running it here applies the view switch just stored above.
    updateStatusText();

    if (nextViewId === 'mapping') {
      if (refs.panelTitle) {
        // Resolved once: writing the generic title here and letting
        // syncMappingCompanion overwrite it made the header flicker.
        refs.panelTitle.setAttribute('value', getMappingPanelTitle());
      }
      Object.keys(state.panelViews).forEach(function (registeredViewId) {
        state.panelViews[registeredViewId].content.setAttribute('visible', false);
      });
      applyPanelHeight(state.mappingPanelHeight);
      // Child version of the mapping view: the active context's companion
      // (title + extra section) overlays the defaults set just above.
      syncMappingCompanion();
    } else {
      Object.keys(state.mappingCompanions).forEach(function (contextId) {
        setCompanionContentVisible(state.mappingCompanions[contextId].content, false);
        setEntityInteractionEnabled(state.mappingCompanions[contextId].content, false);
      });
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
    var nextMode = String(context.mode || inferModeFromControllerView(nextViewId));
    var panelId = CONTROLLER_PANEL_BY_VIEW[nextViewId] || 'mapping';
    state.activeControllerView = nextViewId;
    state.mode = nextMode;
    if (context.mappingContextId) {
      // Idempotent inside: re-applying the active context would rebuild every
      // panel row.
      switchMappingContext(context.mappingContextId, {
        reason: context.reason || ('controller-view-' + nextViewId)
      });
    }
    var resolvedPanel = showPanelView(panelId);
    // showPanelView maps the panel back to its own default controller view
    // (several controller views share one panel, e.g. historical.mapping and
    // single.mapping both use 'mapping'), so re-assert the caller's view.
    state.activeControllerView = nextViewId;
    state.mode = nextMode;
    return {
      mode: state.mode,
      controllerView: nextViewId,
      panelView: resolvedPanel
    };
  }

