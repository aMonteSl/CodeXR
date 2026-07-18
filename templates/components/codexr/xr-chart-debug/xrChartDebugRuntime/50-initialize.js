// == xrChartDebugRuntime.js | part 50: initialize (assembled with its siblings; see COMPONENTS.md) ==
  function initialize() {
    if (state.initialized) {
      return;
    }

    state.initialized = true;
    attachPointerHandler();
    attachContextMenuHandler();
    console.log('[CodeXR][ChartDebug] Runtime ready. Use CodeXRChartDebug.enable() in browser console.');
  }

  function enable(target) {
    initialize();
    state.enabled = true;

    if (target !== undefined && target !== null) {
      var chartEl = resolveChartTarget(target);
      if (chartEl) {
        activateForChart(chartEl);
        console.log('[CodeXR][ChartDebug] Enabled and selected chart.');
      } else {
        console.log('[CodeXR][ChartDebug] Enabled. No chart found for target:', target);
      }
      return;
    }

    console.log('[CodeXR][ChartDebug] Enabled. Middle-click a chart to toggle debug gizmo.');
  }

  function disable() {
    state.enabled = false;
    deactivateDebugMode('runtime-disabled');
    console.log('[CodeXR][ChartDebug] Disabled.');
  }

  function toggle() {
    if (state.enabled) {
      disable();
    } else {
      enable();
    }
  }

  function select(target) {
    initialize();

    if (target === undefined || target === null) {
      console.log('[CodeXR][ChartDebug] No target provided to select().');
      return false;
    }

    var chartEl = resolveChartTarget(target);
    if (!chartEl) {
      console.log('[CodeXR][ChartDebug] Chart not found for target:', target);
      return false;
    }

    if (!state.enabled) {
      state.enabled = true;
      console.log('[CodeXR][ChartDebug] Enabled for selection.');
    }

    activateForChart(chartEl);
    return true;
  }

  function deactivate() {
    deactivateDebugMode('api-call');
    console.log('[CodeXR][ChartDebug] Debug mode deactivated.');
  }

  function setStep(axis, value) {
    if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
      console.log('[CodeXR][ChartDebug] Invalid axis for setStep(). Use x, y, or z.');
      return null;
    }

    var parsed = value === undefined ? 0.25 : Number(value);
    if (!isFinite(parsed)) {
      return state.steps[axis];
    }

    state.steps[axis] = parsed;
    return state.steps[axis];
  }

  function actualScale() {
    var chartEl = getActiveChart();
    if (!chartEl) {
      console.log('[CodeXR][ChartDebug] No active chart selected for actualScale().');
      return null;
    }

    var currentScale = getChartScale(chartEl);
    console.log('[CodeXR][ChartDebug] Current chart scale:', currentScale);
    return currentScale;
  }

  function scale(x, y, z) {
    var chartEl = getActiveChart();
    if (!chartEl) {
      console.log('[CodeXR][ChartDebug] No active chart selected for scale().');
      return null;
    }

    var parsedX = Number(x);
    var parsedY = Number(y);
    var parsedZ = Number(z);
    if (!isFinite(parsedX) || !isFinite(parsedY) || !isFinite(parsedZ)) {
      console.log('[CodeXR][ChartDebug] scale(x, y, z) requires three numeric values.');
      return null;
    }

    var nextScale = applyChartScale(chartEl, parsedX, parsedY, parsedZ);
    console.log('[CodeXR][ChartDebug] Updated chart scale:', nextScale);
    return nextScale;
  }

  function setPosition(x, y, z) {
    var chartEl = getActiveChart();
    if (!chartEl) {
      console.log('[CodeXR][ChartDebug] No active chart selected for setPosition().');
      return null;
    }

    var parsedX = Number(x);
    var parsedY = Number(y);
    var parsedZ = Number(z);
    if (!isFinite(parsedX) || !isFinite(parsedY) || !isFinite(parsedZ)) {
      console.log('[CodeXR][ChartDebug] setPosition(x, y, z) requires three numeric values.');
      return null;
    }

    var three = getThree();
    if (!three || !chartEl.object3D) {
      return null;
    }

    var worldPosition = new three.Vector3(parsedX, parsedY, parsedZ);
    var parentObject = chartEl.object3D.parent;
    if (parentObject) {
      parentObject.worldToLocal(worldPosition);
    }

    chartEl.object3D.position.copy(worldPosition);
    chartEl.object3D.updateMatrixWorld(true);
    chartEl.setAttribute(
      'position',
      chartEl.object3D.position.x + ' ' + chartEl.object3D.position.y + ' ' + chartEl.object3D.position.z
    );

    syncGizmoToChart(chartEl);
    var nextPosition = getChartWorldPosition(chartEl);
    console.log('[CodeXR][ChartDebug] Updated chart position:', nextPosition);
    return nextPosition;
  }

  function actualDimensions() {
    var chartEl = getActiveChart();
    if (!chartEl) {
      console.log('[CodeXR][ChartDebug] No active chart selected for actualDimensions().');
      return null;
    }

    var dimensions = getChartDimensions(chartEl);
    console.log('[CodeXR][ChartDebug] Current chart dimensions:', dimensions);
    return dimensions;
  }

  function actualWidth() {
    var dimensions = actualDimensions();
    return dimensions ? dimensions.width : null;
  }

  function actualHeight() {
    var dimensions = actualDimensions();
    return dimensions ? dimensions.height : null;
  }

  function actualDepth() {
    var dimensions = actualDimensions();
    return dimensions ? dimensions.depth : null;
  }

  function getState() {
    return {
      enabled: state.enabled,
      step: {
        x: state.steps.x,
        y: state.steps.y,
        z: state.steps.z
      },
      activeChartId: state.activeChartId,
      debugActive: state.debugActive
    };
  }

  function restoreState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return false;
    }

    if (snapshot.step && typeof snapshot.step === 'object') {
      if (typeof snapshot.step.x === 'number' && isFinite(snapshot.step.x)) {
        state.steps.x = snapshot.step.x;
      }
      if (typeof snapshot.step.y === 'number' && isFinite(snapshot.step.y)) {
        state.steps.y = snapshot.step.y;
      }
      if (typeof snapshot.step.z === 'number' && isFinite(snapshot.step.z)) {
        state.steps.z = snapshot.step.z;
      }
    } else if (typeof snapshot.step === 'number' && isFinite(snapshot.step)) {
      state.steps.x = snapshot.step;
      state.steps.y = snapshot.step;
      state.steps.z = snapshot.step;
    }

    if (snapshot.enabled) {
      enable();
    } else {
      disable();
      return true;
    }

    if (snapshot.debugActive && snapshot.activeChartId) {
      var chartEl = getDoc() ? getDoc().getElementById(snapshot.activeChartId) : null;
      if (chartEl) {
        activateForChart(chartEl);
      } else {
        deactivateDebugMode('restore-chart-missing');
      }
    }

    return true;
  }

  function teardown() {
    disable();
    detachPointerHandler();
    detachContextMenuHandler();
    state.initialized = false;
  }

  function getActiveChartPosition() {
    var chartEl = getActiveChart();
    return chartEl ? getChartWorldPosition(chartEl) : null;
  }

  function isEnabled() {
    return state.enabled;
  }

  function listCharts() {
    var charts = getAllCharts();

    if (charts.length === 0) {
      console.log('[CodeXR][ChartDebug] No charts found on page.');
      return [];
    }

    console.log('[CodeXR][ChartDebug] Available charts (' + charts.length + '):');
    for (var i = 0; i < charts.length; i += 1) {
      var chart = charts[i];
      var displayId = chart.id || '(no-id)';
      var marker = state.activeChartId && state.activeChartId === chart.id ? ' <- ACTIVE' : '';
      console.log('  [' + i + '] #' + displayId + ' (' + chart.type + ')' + marker);
    }

    return charts;
  }

  function getActiveChartId() {
    return state.activeChartId;
  }

  function commands() {
    var commandList = [
      'enable(target?) - Enable debug mode; optionally select a chart',
      'disable() - Disable debug mode',
      'toggle() - Toggle debug mode on or off',
      'select(target) - Select a chart for debugging',
      'deactivate() - Deactivate active chart debug gizmo',
      'listCharts() - List all available charts',
      'getActiveChartId() - Get ID of active chart',
      'isEnabled() - Check if debug mode is enabled',
      'setStep(axis, value?) - Set signed movement step for x, y, or z (default 0.25)',
      'getState() - Get current state object',
      'restoreState(snapshot) - Restore state from snapshot',
      'getActiveChart() - Get active chart element',
      'getActiveChartPosition() - Get world position of active chart',
      'actualScale() - Get current scale of active chart',
      'actualDimensions() - Get current width, height, and depth of active chart',
      'actualWidth() - Get current width of active chart',
      'actualHeight() - Get current height of active chart',
      'actualDepth() - Get current depth of active chart',
      'scale(x, y, z) - Set active chart scale',
      'setPosition(x, y, z) - Set active chart position in world coordinates',
      'setFlight(enabled) - Enable or disable fly mode on #rig movement-controls',
      'toggleFlight() - Toggle fly mode on #rig movement-controls',
      'getRigPosition() - Get world position of #rig',
      'getCameraPosition() - Get world position of active camera',
      'getUserPosition() - Get rig and camera world positions',
      'teardown() - Cleanup and disable everything',
      'help() - Show detailed help',
      'commands() - Show this command list'
    ];

    console.log('[CodeXR][ChartDebug] Available API commands:');
    for (var i = 0; i < commandList.length; i += 1) {
      console.log('  ' + commandList[i]);
    }

    return commandList;
  }

  function help() {
    console.log('[CodeXR][ChartDebug] === Chart Debug API Help ===');
    console.log('');
    console.log('Target formats accepted by enable(target) and select(target):');
    console.log('  - Chart ID: "my-chart" or "#my-chart"');
    console.log('  - Aliases: "bars", "barsmap", "cyls", "cylinders", "cylsmap", "pie", "donut", "doughnut", "bubbles", "boats"');
    console.log('  - CSS selector: "[babia-bars]", ".my-class", etc.');
    console.log('');
    console.log('Examples:');
    console.log('  CodeXRChartDebug.enable()');
    console.log('  CodeXRChartDebug.enable("bars")');
    console.log('  CodeXRChartDebug.enable("#my-pie-chart")');
    console.log('  CodeXRChartDebug.select("[babia-bars]")');
    console.log('  CodeXRChartDebug.setStep("x", 0.5)');
    console.log('  CodeXRChartDebug.actualDimensions()');
    console.log('  CodeXRChartDebug.actualWidth()');
    console.log('  CodeXRChartDebug.actualScale()');
    console.log('  CodeXRChartDebug.scale(1.5, 1.5, 1.5)');
    console.log('  CodeXRChartDebug.setPosition(1, 2, 3)');
    console.log('  CodeXRChartDebug.setFlight(true)');
    console.log('  CodeXRChartDebug.toggleFlight()');
    console.log('  CodeXRChartDebug.getUserPosition()');
    console.log('  CodeXRChartDebug.listCharts()');
    console.log('');
    console.log('Controls:');
    console.log('  - Middle-click a chart to select/toggle debug mode');
    console.log('  - Left click red/green/blue arrows to move +step on X/Y/Z');
    console.log('  - Right click red/green/blue arrows to move -step on X/Y/Z');
    console.log('  - Middle-click active chart to deactivate');
  }

  var runtime = {
    enable: enable,
    disable: disable,
    toggle: toggle,
    select: select,
    deactivate: deactivate,
    isEnabled: isEnabled,
    setStep: setStep,
    getState: getState,
    restoreState: restoreState,
    getActiveChart: getActiveChart,
    getActiveChartPosition: getActiveChartPosition,
    actualScale: actualScale,
    actualDimensions: actualDimensions,
    actualWidth: actualWidth,
    actualHeight: actualHeight,
    actualDepth: actualDepth,
    scale: scale,
    setPosition: setPosition,
    setFlight: setFlight,
    toggleFlight: toggleFlight,
    getRigPosition: getRigPosition,
    getCameraPosition: getCameraPosition,
    getUserPosition: getUserPosition,
    teardown: teardown,
    listCharts: listCharts,
    getActiveChartId: getActiveChartId,
    commands: commands,
    help: help
  };

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
      initialize();
    }
  }

  root.CodeXRChartDebug = runtime;
  return runtime;
});
