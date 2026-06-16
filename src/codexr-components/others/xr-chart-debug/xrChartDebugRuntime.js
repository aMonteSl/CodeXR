(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.CodeXRChartDebug = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CHART_COMPONENTS = [
    'babia-bars',
    'babia-barsmap',
    'babia-cyls',
    'babia-cylsmap',
    'babia-pie',
    'babia-doughnut',
    'babia-bubbles',
    'babia-boats',
    'codexr-code-city'
  ];

  var CHART_ALIASES = {
    bars: 'babia-bars',
    barsmap: 'babia-barsmap',
    cyls: 'babia-cyls',
    cylinders: 'babia-cyls',
    cylsmap: 'babia-cylsmap',
    pie: 'babia-pie',
    donut: 'babia-doughnut',
    doughnut: 'babia-doughnut',
    bubbles: 'babia-bubbles',
    boats: 'babia-boats',
    'code-city': 'codexr-code-city',
    codecity: 'codexr-code-city'
  };

  var AXIS_COLORS = {
    x: '#ef4444',
    y: '#22c55e',
    z: '#3b82f6'
  };

  var state = {
    enabled: false,
    initialized: false,
    steps: {
      x: 0.25,
      y: 0.25,
      z: 0.25
    },
    activeChartId: null,
    debugActive: false
  };

  var refs = {
    scene: null,
    gizmoRoot: null,
    pointerDownHandler: null,
    contextMenuHandler: null
  };

  function getDoc() {
    return root.document;
  }

  function getScene() {
    if (refs.scene && refs.scene.isConnected) {
      return refs.scene;
    }
    refs.scene = getDoc() ? getDoc().querySelector('a-scene') : null;
    return refs.scene;
  }

  function getThree() {
    return root.AFRAME && root.AFRAME.THREE ? root.AFRAME.THREE : null;
  }

  function hasChartComponent(entity) {
    if (!entity || !entity.getAttribute) {
      return false;
    }
    for (var i = 0; i < CHART_COMPONENTS.length; i += 1) {
      if (entity.hasAttribute(CHART_COMPONENTS[i])) {
        return true;
      }
    }
    return false;
  }

  function findFirstChartByComponent(componentName) {
    var document = getDoc();
    if (!document) {
      return null;
    }

    var found = document.querySelector('[' + componentName + ']');
    return found && hasChartComponent(found) ? found : null;
  }

  function getAllCharts() {
    var document = getDoc();
    if (!document) {
      return [];
    }

    var charts = [];

    for (var i = 0; i < CHART_COMPONENTS.length; i += 1) {
      var componentName = CHART_COMPONENTS[i];
      var elements = document.querySelectorAll('[' + componentName + ']');

      for (var j = 0; j < elements.length; j += 1) {
        var el = elements[j];
        if (!el) {
          continue;
        }

        var alreadyAdded = false;
        for (var k = 0; k < charts.length; k += 1) {
          if (charts[k].element === el) {
            alreadyAdded = true;
            break;
          }
        }

        if (alreadyAdded) {
          continue;
        }

        charts.push({
          element: el,
          component: componentName,
          type: componentName.replace('babia-', ''),
          id: el.id || ''
        });
      }
    }

    return charts;
  }

  function resolveChartTarget(target) {
    var document = getDoc();
    if (!document || target === undefined || target === null) {
      return null;
    }

    if (typeof target === 'string') {
      var raw = target.trim();
      if (!raw) {
        return null;
      }

      var aliasKey = raw.toLowerCase();
      if (CHART_ALIASES[aliasKey]) {
        return findFirstChartByComponent(CHART_ALIASES[aliasKey]);
      }

      var byId = raw.charAt(0) === '#' ? document.getElementById(raw.slice(1)) : document.getElementById(raw);
      if (byId && hasChartComponent(byId)) {
        return byId;
      }

      try {
        var selected = document.querySelector(raw);
        if (selected) {
          return findChartEntityFromTarget(selected);
        }
      } catch (error) {
        return null;
      }

      return null;
    }

    if (target.nodeType === 1) {
      return findChartEntityFromTarget(target);
    }

    return null;
  }

  function findChartEntityFromTarget(target) {
    var current = target;
    while (current && current !== getDoc().body) {
      if (current.nodeType === 1 && hasChartComponent(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getRenderableObjects() {
    var scene = getScene();
    if (!scene) {
      return [];
    }

    var targets = scene.querySelectorAll('.babiaxraycasterclass');
    var objects = [];

    for (var i = 0; i < targets.length; i += 1) {
      var el = targets[i];
      if (el && el.object3D) {
        objects.push(el.object3D);
      }
    }

    return objects;
  }

  function raycastFromMouse(clientX, clientY) {
    var scene = getScene();
    var three = getThree();

    if (!scene || !scene.canvas || !scene.camera || !three) {
      return [];
    }

    var canvasRect = scene.canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) {
      return [];
    }

    var mouse = new three.Vector2(
      ((clientX - canvasRect.left) / canvasRect.width) * 2 - 1,
      -((clientY - canvasRect.top) / canvasRect.height) * 2 + 1
    );

    var raycaster = new three.Raycaster();
    raycaster.setFromCamera(mouse, scene.camera);

    var objects = getRenderableObjects();
    return raycaster.intersectObjects(objects, true);
  }

  function getChartWorldPosition(chartEl) {
    var three = getThree();
    if (!three || !chartEl || !chartEl.object3D) {
      return { x: 0, y: 0, z: 0 };
    }

    var vector = new three.Vector3();
    chartEl.object3D.getWorldPosition(vector);
    return {
      x: Number(vector.x.toFixed(3)),
      y: Number(vector.y.toFixed(3)),
      z: Number(vector.z.toFixed(3))
    };
  }

  function findElementFromIntersection(intersection) {
    if (!intersection || !intersection.object) {
      return null;
    }

    var node = intersection.object;
    while (node) {
      if (node.el) {
        return node.el;
      }
      node = node.parent;
    }

    return null;
  }

  function removeGizmo() {
    if (refs.gizmoRoot && refs.gizmoRoot.parentNode) {
      refs.gizmoRoot.parentNode.removeChild(refs.gizmoRoot);
    }
    refs.gizmoRoot = null;
  }

  function createArrow(axis) {
    var document = getDoc();
    var arrow = document.createElement('a-entity');
    var color = AXIS_COLORS[axis] || '#ffffff';

    var shaft = document.createElement('a-cylinder');
    shaft.setAttribute('radius', 0.025);
    shaft.setAttribute('height', 0.34);
    shaft.setAttribute('color', color);
    shaft.setAttribute('opacity', 0.95);
    shaft.setAttribute('class', 'babiaxraycasterclass');
    shaft.setAttribute('data-codexr-debug-axis', axis);

    var tip = document.createElement('a-cone');
    tip.setAttribute('radius-bottom', 0.06);
    tip.setAttribute('radius-top', 0.001);
    tip.setAttribute('height', 0.14);
    tip.setAttribute('color', color);
    tip.setAttribute('opacity', 0.98);
    tip.setAttribute('class', 'babiaxraycasterclass');
    tip.setAttribute('data-codexr-debug-axis', axis);

    if (axis === 'x') {
      arrow.setAttribute('rotation', '0 0 -90');
      shaft.setAttribute('position', '0.17 0 0');
      tip.setAttribute('position', '0.4 0 0');
    } else if (axis === 'y') {
      shaft.setAttribute('position', '0 0.17 0');
      tip.setAttribute('position', '0 0.4 0');
    } else {
      arrow.setAttribute('rotation', '90 0 0');
      shaft.setAttribute('position', '0 0.17 0');
      tip.setAttribute('position', '0 0.4 0');
    }

    arrow.appendChild(shaft);
    arrow.appendChild(tip);
    arrow.setAttribute('class', 'babiaxraycasterclass codexr-debug-arrow');
    arrow.setAttribute('data-codexr-debug-axis', axis);

    return arrow;
  }

  function ensureGizmo(chartEl) {
    var scene = getScene();
    if (!scene || !chartEl) {
      return;
    }

    removeGizmo();

    var document = getDoc();
    var gizmoRoot = document.createElement('a-entity');
    gizmoRoot.setAttribute('id', 'codexrChartDebugGizmo');
    gizmoRoot.setAttribute('class', 'codexr-chart-debug-gizmo');

    var center = document.createElement('a-sphere');
    center.setAttribute('radius', 0.045);
    center.setAttribute('color', '#f8fafc');
    center.setAttribute('opacity', 0.98);
    center.setAttribute('class', 'babiaxraycasterclass');
    gizmoRoot.appendChild(center);

    gizmoRoot.appendChild(createArrow('x'));
    gizmoRoot.appendChild(createArrow('y'));
    gizmoRoot.appendChild(createArrow('z'));

    scene.appendChild(gizmoRoot);
    refs.gizmoRoot = gizmoRoot;
    syncGizmoToChart(chartEl);
  }

  function syncGizmoToChart(chartEl) {
    if (!refs.gizmoRoot || !chartEl) {
      return;
    }

    var worldPosition = getChartWorldPosition(chartEl);
    refs.gizmoRoot.setAttribute('position', worldPosition.x + ' ' + worldPosition.y + ' ' + worldPosition.z);
  }

  function getActiveChart() {
    if (!state.activeChartId || !getDoc()) {
      return null;
    }
    return getDoc().getElementById(state.activeChartId);
  }

  function getRigElement() {
    var doc = getDoc();
    if (!doc) {
      return null;
    }
    return doc.getElementById('rig');
  }

  function parseMovementControlsAttribute(attrValue) {
    if (typeof attrValue === 'string') {
      return attrValue;
    }

    if (attrValue && typeof attrValue === 'object') {
      var pairs = [];
      Object.keys(attrValue).forEach(function (key) {
        pairs.push(key + ': ' + attrValue[key]);
      });
      return pairs.join('; ');
    }

    return '';
  }

  function setFlight(enabled) {
    var rigEl = getRigElement();
    if (!rigEl) {
      console.log('[CodeXR][ChartDebug] Rig element not found.');
      return null;
    }

    var nextEnabled = !!enabled;
    var current = parseMovementControlsAttribute(rigEl.getAttribute('movement-controls'));
    var nextAttr = current;

    if (!nextAttr) {
      nextAttr = 'fly: ' + (nextEnabled ? 'true' : 'false');
    } else if (/\bfly\s*:/i.test(nextAttr)) {
      nextAttr = nextAttr.replace(/\bfly\s*:\s*(true|false)/i, 'fly: ' + (nextEnabled ? 'true' : 'false'));
    } else {
      nextAttr = nextAttr.trim();
      if (nextAttr && nextAttr.charAt(nextAttr.length - 1) !== ';') {
        nextAttr += ';';
      }
      nextAttr += ' fly: ' + (nextEnabled ? 'true' : 'false');
    }

    rigEl.setAttribute('movement-controls', nextAttr.trim());
    console.log('[CodeXR][ChartDebug] Flight mode:', nextEnabled ? 'ENABLED' : 'DISABLED');
    return nextEnabled;
  }

  function toggleFlight() {
    var rigEl = getRigElement();
    if (!rigEl) {
      console.log('[CodeXR][ChartDebug] Rig element not found.');
      return null;
    }

    var current = parseMovementControlsAttribute(rigEl.getAttribute('movement-controls'));
    var hasTrue = /\bfly\s*:\s*true\b/i.test(current);
    return setFlight(!hasTrue);
  }

  function getRigPosition() {
    var three = getThree();
    var rigEl = getRigElement();
    if (!three || !rigEl || !rigEl.object3D) {
      return null;
    }

    var vector = new three.Vector3();
    rigEl.object3D.getWorldPosition(vector);
    return {
      x: Number(vector.x.toFixed(3)),
      y: Number(vector.y.toFixed(3)),
      z: Number(vector.z.toFixed(3))
    };
  }

  function getCameraPosition() {
    var three = getThree();
    var scene = getScene();
    if (!three) {
      return null;
    }

    if (scene && scene.camera && typeof scene.camera.getWorldPosition === 'function') {
      var sceneCameraVector = new three.Vector3();
      scene.camera.getWorldPosition(sceneCameraVector);
      return {
        x: Number(sceneCameraVector.x.toFixed(3)),
        y: Number(sceneCameraVector.y.toFixed(3)),
        z: Number(sceneCameraVector.z.toFixed(3))
      };
    }

    var doc = getDoc();
    var cameraEl = null;
    if (doc) {
      cameraEl = doc.querySelector('a-camera') || doc.querySelector('[camera]');
    }
    if (!cameraEl || !cameraEl.object3D) {
      return null;
    }

    var cameraVector = new three.Vector3();
    cameraEl.object3D.getWorldPosition(cameraVector);
    return {
      x: Number(cameraVector.x.toFixed(3)),
      y: Number(cameraVector.y.toFixed(3)),
      z: Number(cameraVector.z.toFixed(3))
    };
  }

  function getUserPosition() {
    var rig = getRigPosition();
    var camera = getCameraPosition();
    if (!rig && !camera) {
      console.log('[CodeXR][ChartDebug] Unable to resolve user position (rig/camera missing).');
      return null;
    }

    var result = {
      rig: rig,
      camera: camera
    };

    console.log('[CodeXR][ChartDebug] User position:', result);
    return result;
  }

  function getChartScale(chartEl) {
    if (!chartEl || !chartEl.object3D || !chartEl.object3D.scale) {
      return { x: 1, y: 1, z: 1 };
    }

    return {
      x: Number(chartEl.object3D.scale.x.toFixed(3)),
      y: Number(chartEl.object3D.scale.y.toFixed(3)),
      z: Number(chartEl.object3D.scale.z.toFixed(3))
    };
  }

  function applyChartScale(chartEl, x, y, z) {
    if (!chartEl || !chartEl.object3D || !chartEl.object3D.scale) {
      return null;
    }

    chartEl.object3D.scale.x = x;
    chartEl.object3D.scale.y = y;
    chartEl.object3D.scale.z = z;
    chartEl.object3D.updateMatrixWorld(true);
    chartEl.setAttribute('scale', x + ' ' + y + ' ' + z);
    return getChartScale(chartEl);
  }

  function getChartDimensions(chartEl) {
    var three = getThree();
    if (!chartEl || !chartEl.object3D || !three || !three.Box3 || !three.Vector3) {
      return null;
    }

    try {
      var bounds = new three.Box3();
      var size = new three.Vector3();
      bounds.setFromObject(chartEl.object3D);
      bounds.getSize(size);
      return {
        width: Number(size.x.toFixed(3)),
        height: Number(size.y.toFixed(3)),
        depth: Number(size.z.toFixed(3))
      };
    } catch (error) {
      return null;
    }
  }

  function findAxisFromTarget(targetEl) {
    var current = targetEl;
    while (current && current !== getDoc().body) {
      if (current.nodeType === 1 && current.hasAttribute && current.hasAttribute('data-codexr-debug-axis')) {
        return current.getAttribute('data-codexr-debug-axis');
      }
      current = current.parentElement;
    }
    return null;
  }

  function getPointerAxis(event) {
    if (!event) {
      return null;
    }

    var intersections = raycastFromMouse(event.clientX, event.clientY);
    if (!intersections.length) {
      return null;
    }

    var targetEl = findElementFromIntersection(intersections[0]);
    return targetEl ? findAxisFromTarget(targetEl) : null;
  }

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
    console.log('  - Aliases: "bars", "barsmap", "cyls", "cylinders", "cylsmap", "pie", "donut", "doughnut", "bubbles", "boats", "code-city"');
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
