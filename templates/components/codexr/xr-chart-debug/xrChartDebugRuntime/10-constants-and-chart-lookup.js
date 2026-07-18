// == xrChartDebugRuntime.js | part 10: constants-and-chart-lookup (assembled with its siblings; see COMPONENTS.md) ==
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
    'babia-boats'
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
    boats: 'babia-boats'
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
