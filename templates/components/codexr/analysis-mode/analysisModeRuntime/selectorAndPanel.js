// == analysisModeRuntime.js | selectorAndPanel (assembled per manifest.json; see COMPONENTS.md) ==
  function invoke(lifecycle, method, context) {
    if (typeof lifecycle?.[method] !== 'function') {
      return Promise.resolve();
    }
    return Promise.resolve(lifecycle[method](context));
  }

  /**
   * Like invoke(), but failures are logged and swallowed (sync throws too).
   * Cleanup hooks (deactivate/disposeView) run through this: a mode that
   * fails to clean up may degrade itself, but it must never abort the
   * transition — otherwise the table keeps the old mode's theme and the
   * suspended interactions are never restored (dead clicks).
   */
  function invokeSafely(lifecycle, method, context) {
    try {
      return invoke(lifecycle, method, context).catch(function (error) {
        root.console?.error?.('[CodeXR][AnalysisMode] Lifecycle ' + method + ' failed:', error);
      });
    } catch (error) {
      root.console?.error?.('[CodeXR][AnalysisMode] Lifecycle ' + method + ' failed:', error);
      return Promise.resolve();
    }
  }

  function register(mode, lifecycle) {
    if (!VALID_MODES.has(mode) || !lifecycle) {
      return function () {};
    }
    lifecycles[mode] = lifecycle;
    if (state.mode === mode && !state.transitioning) {
      void invoke(lifecycle, 'activate', {
        from: mode,
        to: mode,
        generation: state.generation,
        context: { reason: 'late-registration' }
      }).then(function () {
        if (!state.transitioning && state.mode === mode) {
          state.activeLifecycleMode = mode;
        }
      });
    }
    return function () {
      if (lifecycles[mode] === lifecycle) {
        delete lifecycles[mode];
      }
    };
  }

  function createEntity(tagName, attributes) {
    var element = root.document?.createElement?.(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      element?.setAttribute?.(key, attributes[key]);
    });
    return element;
  }

  function createModeButton(option, y) {
    var disabled = option.disabled === true;
    var disabledReason = String(option.disabledReason || 'This visualization mode is not available right now.');
    var button = createEntity('a-plane', {
      position: '0 ' + y + ' 0.02',
      width: 4.5,
      height: 0.48,
      material: 'color: ' + (disabled ? '#475569' : (option.color || '#0e7490')) + '; opacity: ' + (disabled ? '0.62' : '0.96') + '; shader: flat',
      class: 'codexr-analysis-mode-option',
      'data-codexr-interactive': 'true',
      'data-codexr-mode-option': option.id,
      'data-codexr-disabled': disabled ? 'true' : 'false'
    });
    var label = createEntity('a-text', {
      value: option.label,
      position: '0 0 0.02',
      width: 6.8,
      color: disabled ? '#cbd5e1' : '#ffffff',
      align: 'center',
      baseline: 'center'
    });
    button?.appendChild?.(label);
    if (disabled) {
      var tooltip = createEntity('a-entity', {
        visible: false,
        position: '0 -0.46 0.08',
        'data-codexr-mode-disabled-tooltip': option.id
      });
      tooltip.appendChild?.(createEntity('a-plane', {
        width: 4.7,
        height: 0.5,
        material: 'color: #111827; opacity: 0.96; shader: flat'
      }));
      tooltip.appendChild?.(createEntity('a-text', {
        value: disabledReason,
        position: '0 0 0.03',
        width: 5.8,
        color: '#fde68a',
        align: 'center',
        baseline: 'center',
        'wrap-count': 44
      }));
      var setTooltipVisible = function (visible) {
        tooltip.setAttribute?.('visible', !!visible);
      };
      button.appendChild?.(tooltip);
      button.addEventListener?.('mouseenter', function () { setTooltipVisible(true); });
      button.addEventListener?.('mouseleave', function () { setTooltipVisible(false); });
      button.addEventListener?.('raycaster-intersected', function () { setTooltipVisible(true); });
      button.addEventListener?.('raycaster-intersected-cleared', function () { setTooltipVisible(false); });
    }
    button?.addEventListener?.('click', function () {
      if (disabled) {
        debugLog('Visualization mode option disabled', option.id, disabledReason);
        return;
      }
      debugLog('Visualization mode option clicked', option.id);
      option.onSelect?.();
    });
    return button;
  }

  function requestModeActivation(mode) {
    if (!VALID_MODES.has(mode) || mode === 'selection') {
      return Promise.resolve(false);
    }
    debugLog('Requesting analysis mode activation', mode, {
      currentMode: state.mode,
      activeLifecycleMode: state.activeLifecycleMode,
      transitioning: state.transitioning
    });
    var client = root.CodeXRCollaborationRuntime?.getClient?.(root);
    client?.sendMessage?.('analysis-mode-activate', { mode: mode });
    return transitionTo(mode, {
      reason: 'local-analysis-mode-option',
      controllerView: getDefaultControllerViewForMode(mode),
      panelViewId: getPanelViewForControllerView(getDefaultControllerViewForMode(mode))
    });
  }

  function renderModeOptions() {
    if (!state.panelRoot) { return; }
    while (state.panelRoot.firstChild) {
      state.panelRoot.removeChild(state.panelRoot.firstChild);
    }
    state.panelRoot.appendChild(createEntity('a-text', {
      value: 'Choose how the analysis table represents the data.',
      position: '0 1.18 0.02',
      width: 5.5,
      color: '#cde7ff',
      align: 'center',
      baseline: 'center'
    }));
    var options = [{
      id: 'single',
      label: 'Normal analysis',
      color: '#0e7490',
      onSelect: function () {
        void requestModeActivation('single');
      }
    }].concat(state.modeOptions);
    options.forEach(function (option, index) {
      state.panelRoot.appendChild(createModeButton(option, 0.55 - (index * 0.62)));
    });
  }

  function registerModeOption(option) {
    if (!option?.id || typeof option.onSelect !== 'function') {
      return function () {};
    }
    state.modeOptions = state.modeOptions.filter(function (candidate) {
      return candidate.id !== option.id;
    });
    state.modeOptions.push(option);
    renderModeOptions();
    return function () {
      state.modeOptions = state.modeOptions.filter(function (candidate) {
        return candidate.id !== option.id;
      });
      renderModeOptions();
    };
  }

  function resumeRequestedMode() {
    debugLog('Resuming requested analysis mode', state.requestedMode || 'single');
    root.CodeXRCollaborationRuntime?.getClient?.(root)
      ?.sendMessage?.('analysis-mode-activate', { mode: state.requestedMode || 'single' });
    void transitionTo(state.requestedMode || 'single', {
      reason: 'local-visualization-mode-toggle',
      controllerView: getDefaultControllerViewForMode(state.requestedMode || 'single')
    });
  }

  function openSelector() {
    debugLog('Opening visualization mode selector', {
      currentMode: state.mode,
      activeLifecycleMode: state.activeLifecycleMode,
      transitioning: state.transitioning
    });
    state.selectionPanelView = 'visualization-mode';
    return transitionTo('selection', {
      reason: 'local-mode-selection',
      controllerView: 'visualization-menu',
      panelViewId: 'visualization-mode'
    }).then(function () {
      root.CodeXRCollaborationRuntime?.getClient?.(root)
        ?.sendMessage?.('analysis-mode-selection', {});
      return true;
    });
  }

  function mountModePanel(attempt) {
    if (state.unregisterPanelView) { return; }
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (!mappingRuntime?.registerPanelView || !mappingRuntime.isPanelReady?.()) {
      // Event-driven: the controller calls back the moment its panel exists.
      // A capped retry here used to permanently lose the analysis selector on
      // slow scenes. The interval is only a fallback for a controller build
      // without whenPanelReady (mixed-version scene) or one that loads late.
      if (!state.modePanelMountQueued) {
        state.modePanelMountQueued = true;
        var rearm = function () {
          state.modePanelMountQueued = false;
          mountModePanel(attempt);
        };
        if (mappingRuntime?.whenPanelReady) {
          mappingRuntime.whenPanelReady(rearm);
        } else {
          // unref (Node-only) keeps this browser-oriented retry from pinning
          // test processes open; in the browser it is a no-op.
          root.setTimeout?.(rearm, 250)?.unref?.();
        }
      }
      return;
    }
    state.panelRoot = createEntity('a-entity', {
      id: 'codexrVisualizationModePanel',
      position: '0 0 0.04'
    });
    state.unregisterPanelView = mappingRuntime.registerPanelView({
      id: 'visualization-mode',
      title: 'Visualization mode',
      buttonLabel: 'V',
      headerButton: true,
      panelHeight: 3.35,
      content: state.panelRoot,
      onShow: function () {
        state.selectionPanelView = 'visualization-mode';
        if (state.mode !== 'selection' && !state.openingSelectorFromPanel) {
          state.openingSelectorFromPanel = true;
          debugLog('Visualization mode panel shown directly; forcing selection mode', {
            currentMode: state.mode,
            activeLifecycleMode: state.activeLifecycleMode,
            transitioning: state.transitioning
          });
          void openSelector().finally(function () {
            state.openingSelectorFromPanel = false;
          });
        }
      },
      onToggleActive: resumeRequestedMode
    });
    if (!state.unregisterPanelView) {
      state.panelRoot = null;
      root.CodeXRMappingUiRuntime?.whenPanelReady?.(function () {
        mountModePanel(attempt);
      });
      return;
    }
    // One unconditional marker so a scene can be checked at a glance: if this
    // line is absent from the console, the selector view never registered.
    root.console?.log?.('[CodeXR] Analysis selector registered on the controller panel.');
    renderModeOptions();
  }

  async function performTransition(mode, context, generation) {
    var previousMode = state.activeLifecycleMode;
    debugLog('Analysis mode transition started', {
      from: previousMode,
      to: mode,
      generation: generation,
      reason: context?.reason || ''
    });
    if (previousMode !== mode) {
      await invokeSafely(lifecycles[previousMode], 'deactivate', {
        from: previousMode,
        to: mode,
        generation: generation
      });
      if (state.activeLifecycleMode === previousMode) {
        state.activeLifecycleMode = null;
      }
    }
    if (generation !== state.generation) { return false; }
    applyAnalysisMode(mode, context || null);
    try {
      await invoke(lifecycles[mode], 'activate', {
        from: previousMode,
        to: mode,
        generation: generation,
        context: context || null
      });
    } catch (error) {
      if (generation === state.generation) {
        await invokeSafely(lifecycles[mode], 'disposeView', {
          from: mode,
          to: 'selection',
          generation: generation,
          context: { reason: 'activation-error', error: error }
        });
        applyAnalysisMode('selection', { panelViewId: state.selectionPanelView });
        await clearVisualizationsForSelection({ generation: generation });
      }
      console.error('[CodeXR][AnalysisMode] Could not activate mode:', mode, error);
      return false;
    }
    if (generation !== state.generation) {
      await invokeSafely(lifecycles[mode], 'deactivate', {
        from: mode,
        to: null,
        generation: generation,
        context: { reason: 'superseded-activation' }
      });
      if (state.activeLifecycleMode === mode) {
        state.activeLifecycleMode = null;
      }
      return false;
    }
    applyAnalysisMode(mode, context || null);
    debugLog('Analysis mode transition completed', {
      mode: mode,
      activeLifecycleMode: state.activeLifecycleMode,
      generation: generation
    });
    return true;
  }
