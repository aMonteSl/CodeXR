// == xrChartDebugRuntime.js | debugModeAndPointer (assembled per manifest.json; see COMPONENTS.md) ==
  function deactivateDebugMode(reason) {
    if (!state.debugActive) {
      return;
    }

    var activeChart = getActiveChart();
    var finalPosition = activeChart ? getChartWorldPosition(activeChart) : null;

    state.debugActive = false;
    state.activeChartId = null;
    removeGizmo();

    if (finalPosition) {
      console.log('[CodeXR][ChartDebug] Debug mode OFF (' + (reason || 'manual') + '). Final chart coordinates:', finalPosition);
    } else {
      console.log('[CodeXR][ChartDebug] Debug mode OFF (' + (reason || 'manual') + '). Active chart not found.');
    }
  }

  function activateForChart(chartEl) {
    if (!chartEl) {
      return;
    }

    if (!chartEl.id) {
      chartEl.id = 'codexr-debug-chart-' + Date.now();
    }

    state.activeChartId = chartEl.id;
    state.debugActive = true;
    ensureGizmo(chartEl);

    var position = getChartWorldPosition(chartEl);
    console.log('[CodeXR][ChartDebug] Debug mode ON for chart #' + chartEl.id + ' at', position);
  }

  function nudgeChartPosition(chartEl, axis, delta) {
    var three = getThree();
    if (!three || !chartEl || !chartEl.object3D) {
      return;
    }

    var worldPosition = new three.Vector3();
    chartEl.object3D.getWorldPosition(worldPosition);
    worldPosition[axis] += delta;

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
  }

  function moveActiveChart(axis, directionMultiplier) {
    if (!state.enabled || !state.debugActive) {
      return;
    }

    var chartEl = getActiveChart();
    if (!chartEl) {
      deactivateDebugMode('chart-missing');
      return;
    }

    if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
      return;
    }

    var direction = directionMultiplier === -1 ? -1 : 1;
    var delta = state.steps[axis] * direction;

    nudgeChartPosition(chartEl, axis, delta);
    syncGizmoToChart(chartEl);
    console.log('[CodeXR][ChartDebug] Move ' + delta + ' on ' + axis + '. New position:', getChartWorldPosition(chartEl));
  }

  function handleMiddleClick(event) {
    if (!state.enabled || !event || event.button !== 1) {
      return;
    }

    var intersections = raycastFromMouse(event.clientX, event.clientY);
    if (!intersections.length) {
      return;
    }

    var targetEl = findElementFromIntersection(intersections[0]);
    if (!targetEl) {
      return;
    }

    if (targetEl.hasAttribute && targetEl.hasAttribute('data-codexr-debug-axis')) {
      return;
    }

    var chartEl = findChartEntityFromTarget(targetEl);
    if (!chartEl) {
      return;
    }

    if (state.debugActive && state.activeChartId === chartEl.id) {
      event.preventDefault();
      deactivateDebugMode('wheel-click-toggle');
      return;
    }

    event.preventDefault();
    activateForChart(chartEl);
  }

  function handleArrowPointer(event) {
    if (!state.enabled || !event) {
      return false;
    }

    if (event.button !== 0 && event.button !== 2) {
      return false;
    }

    var axis = getPointerAxis(event);
    if (!axis) {
      return false;
    }

    event.preventDefault();
    moveActiveChart(axis, event.button === 2 ? -1 : 1);
    return true;
  }

  function attachPointerHandler() {
    if (refs.pointerDownHandler || !getDoc()) {
      return;
    }

    refs.pointerDownHandler = function (event) {
      if (handleArrowPointer(event)) {
        return;
      }
      handleMiddleClick(event);
    };

    getDoc().addEventListener('pointerdown', refs.pointerDownHandler, true);
  }

  function detachPointerHandler() {
    if (!refs.pointerDownHandler || !getDoc()) {
      return;
    }

    getDoc().removeEventListener('pointerdown', refs.pointerDownHandler, true);
    refs.pointerDownHandler = null;
  }

  function attachContextMenuHandler() {
    if (refs.contextMenuHandler || !getDoc()) {
      return;
    }

    refs.contextMenuHandler = function (event) {
      if (getPointerAxis(event)) {
        event.preventDefault();
      }
    };

    getDoc().addEventListener('contextmenu', refs.contextMenuHandler, true);
  }

  function detachContextMenuHandler() {
    if (!refs.contextMenuHandler || !getDoc()) {
      return;
    }

    getDoc().removeEventListener('contextmenu', refs.contextMenuHandler, true);
    refs.contextMenuHandler = null;
  }
