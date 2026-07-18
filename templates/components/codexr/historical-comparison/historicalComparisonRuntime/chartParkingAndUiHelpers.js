// == historicalComparisonRuntime.js | chartParkingAndUiHelpers (assembled per manifest.json; see COMPONENTS.md) ==
  function parkOriginalChart(original) {
    if (root.CodeXRAnalysisSurfaceRuntime?.setNormalVisible) {
      root.CodeXRAnalysisSurfaceRuntime.setNormalVisible(false);
      refs.originalCharts = [];
      if (original) { suspendRaycastInteraction(original); }
      return;
    }
    var roots = getNormalVisualizationRoots(getConfig());
    if (original && !roots.includes(original)) {
      roots.push(original);
    }
    refs.originalCharts = uniqueElements(roots);
    refs.originalCharts.forEach(function (element) {
      suspendRaycastInteraction(element);
      element.setAttribute?.('visible', false);
    });
  }

  function restoreOriginalChart() {
    if (root.CodeXRAnalysisSurfaceRuntime?.setNormalVisible) {
      if (root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
        root.CodeXRAnalysisSurfaceRuntime.setNormalVisible(true);
      }
      var original = getTemplateChart(getConfig());
      restoreRaycastInteraction(original);
      refs.originalCharts = null;
      return original;
    }
    var originals = Array.isArray(refs.originalCharts) ? refs.originalCharts : [];
    if (!originals.length) {
      return null;
    }
    if (root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
      originals.forEach(function (element) {
        element.setAttribute?.('visible', true);
      });
    }
    originals.forEach(restoreRaycastInteraction);
    refs.originalCharts = null;
    return originals[0] || null;
  }

  function restoreOriginalChartMapping(config) {
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var ids = getNormalMappingTargetIds(config);
    if (!ids.length || !mappingRuntime?.setChartEntityIds) {
      return;
    }
    mappingRuntime.setChartEntityIds(ids);
    mappingRuntime.switchMappingContext?.('normal-analysis', {
      reason: 'historical-restore-normal-targets'
    });
  }

  function setText(entity, value, width, color) {
    var target = entity?._codexrLabel || entity;
    if (!target) {
      return;
    }
    if (String(target.tagName || '').toLowerCase() === 'a-text') {
      target.setAttribute('value', String(value || ''));
      target.setAttribute('width', width || 3);
      target.setAttribute('color', color || '#ffffff');
      return;
    }
    target.setAttribute('text', {
      value: String(value || ''),
      align: 'center',
      color: color || '#ffffff',
      width: width || 3,
      baseline: 'center',
      wrapCount: 38
    });
  }

  function createText(value, position, width, color, align, wrapCount) {
    return createEntity('a-text', {
      value: String(value || ''),
      position: position || '0 0 0.03',
      width: width || 5.8,
      color: color || '#ffffff',
      align: align || 'center',
      baseline: 'center',
      'wrap-count': wrapCount || 38
    });
  }

  function setStatus(message, level) {
    state.status = String(message || '');
    state.statusLevel = level || 'info';
    refs.status?.setAttribute('value', state.status);
    refs.status?.setAttribute(
      'color',
      state.statusLevel === 'error' ? '#fca5a5' : '#fde68a'
    );
    refs.status?.setAttribute('visible', !!state.status);
  }

  function buildButton(label, position, width, height, onClick, color, textWidth) {
    var button = createEntity('a-plane', {
      position: position,
      width: width || 1.35,
      height: height || 0.3,
      material: 'color: ' + (color || '#1e3a5f') + '; opacity: 0.96; shader: flat',
      class: 'babiaxraycasterclass codexr-history-button',
      'data-codexr-interactive': 'true'
    });
    button._codexrLabel = createText(
      label,
      '0 0 0.02',
      textWidth || Math.max(2.2, (width || 1.35) * 1.85)
    );
    button.appendChild(button._codexrLabel);
    button.addEventListener('click', onClick);
    return button;
  }
