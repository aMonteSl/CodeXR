// == xrChartDebugRuntime.js | part 20: raycast-and-gizmo (assembled with its siblings; see COMPONENTS.md) ==
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
