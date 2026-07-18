// == xrChartDebugRuntime.js | part 30: rig-flight-and-scale (assembled with its siblings; see COMPONENTS.md) ==
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
