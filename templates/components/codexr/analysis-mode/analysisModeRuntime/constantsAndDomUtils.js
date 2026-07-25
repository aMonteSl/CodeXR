// == analysisModeRuntime.js | constantsAndDomUtils (assembled per manifest.json; see COMPONENTS.md) ==
(function registerCodeXRAnalysisModeRuntime(root) {
  'use strict';

  var VALID_MODES = new Set(['selection', 'single', 'historical-compare', 'project-evolution', 'dependency-graph']);
  var MODE_PANEL_VIEW_BY_ID = {
    selection: 'visualization-mode',
    single: 'mapping',
    'historical-compare': 'mapping',
    'dependency-graph': 'dependency-graph',
    'project-evolution': 'project-evolution'
  };
  var MODE_CONTROLLER_VIEW_BY_ID = {
    selection: 'visualization-menu',
    single: 'single.mapping',
    'historical-compare': 'historical.selection',
    'dependency-graph': 'dependency.settings',
    'project-evolution': 'project-evolution'
  };
  var PANEL_VIEW_BY_CONTROLLER_VIEW = {
    'visualization-menu': 'visualization-mode',
    'single.mapping': 'mapping',
    'dependency.settings': 'dependency-graph',
    'historical.selection': 'historical-selection',
    'historical.mapping': 'mapping',
    'project-evolution': 'project-evolution',
    'project-evolution.selection': 'project-evolution',
    'project-evolution.playback': 'project-evolution',
    'project-evolution.mapping': 'mapping'
  };
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var SUSPENDED_INTERACTIVE_ATTR = 'data-codexr-suspended-interactive';
  var SUSPENDED_RAYCAST_ATTR = 'data-codexr-suspended-raycast-class';
  var lifecycles = {};
  var state = {
    mode: 'single',
    activeLifecycleMode: 'single',
    requestedMode: 'single',
    transitioning: false,
    pendingTransitionMode: null,
    generation: 0,
    transition: Promise.resolve(),
    collaborationRegistered: false,
    pendingNormalRefresh: null,
    lastNormalModeRevision: 0,
    modeOptions: [],
    unregisterPanelView: null,
    selectionPanelView: 'visualization-mode',
    controllerView: 'single.mapping',
    panelRoot: null,
    openingSelectorFromPanel: false
  };

  function debugLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[CodeXR.Debug]:');
    root.console?.log?.apply?.(root.console, args);
  }

  function removeAttribute(element, name) {
    if (!element || !name) { return; }
    if (typeof element.removeAttribute === 'function') {
      element.removeAttribute(name);
    } else if (element.attributes && Object.prototype.hasOwnProperty.call(element.attributes, name)) {
      delete element.attributes[name];
    }
  }

  function getClassTokens(element) {
    var value = String(element.getAttribute?.('class') || element.className || '').trim();
    return value ? value.split(/\s+/).filter(Boolean) : [];
  }

  function setClassTokens(element, tokens) {
    if (!element.setAttribute) { return; }
    var value = Array.from(new Set(tokens || [])).filter(Boolean).join(' ');
    element.setAttribute('class', value);
  }

  function setRaycastClass(element, enabled) {
    if (!element) { return; }
    var tokens = getClassTokens(element);
    var hasToken = tokens.includes(RAYCAST_CLASS);
    if (enabled && !hasToken) {
      tokens.push(RAYCAST_CLASS);
      setClassTokens(element, tokens);
      element.classList?.add?.(RAYCAST_CLASS);
    } else if (!enabled && hasToken) {
      setClassTokens(element, tokens.filter(function (token) { return token !== RAYCAST_CLASS; }));
      element.classList?.remove?.(RAYCAST_CLASS);
    } else if (!enabled) {
      element.classList?.remove?.(RAYCAST_CLASS);
    }
  }

  function walkElementTree(element, callback) {
    if (!element || typeof callback !== 'function') { return; }
    callback(element);
    Array.from(element.children || []).forEach(function (child) {
      walkElementTree(child, callback);
    });
  }

  function clearElementRuntimeOverlays(element) {
    var components = element.components || {};
    Object.keys(components).forEach(function (key) {
      var component = components[key];
      if (typeof component.clearTooltips === 'function') {
        component.clearTooltips({ reason: 'analysis-mode-hidden' });
      } else if (typeof component.hideTooltip === 'function') {
        component.hideTooltip({ reason: 'analysis-mode-hidden' });
      }
    });
  }

  function setElementTreeInteractive(element, enabled) {
    walkElementTree(element, function (node) {
      if (!enabled) {
        clearElementRuntimeOverlays(node);
      }
      var interactive = node.getAttribute?.('data-codexr-interactive');
      var raycastTokens = getClassTokens(node);
      var hasRaycastClass = raycastTokens.includes(RAYCAST_CLASS)
        || !!node.classList?.contains?.(RAYCAST_CLASS);
      if (!enabled) {
        if (interactive != null && node.getAttribute?.(SUSPENDED_INTERACTIVE_ATTR) == null) {
          node.setAttribute?.(SUSPENDED_INTERACTIVE_ATTR, String(interactive));
          node.setAttribute?.('data-codexr-interactive', 'false');
        }
        if (hasRaycastClass && node.getAttribute?.(SUSPENDED_RAYCAST_ATTR) == null) {
          node.setAttribute?.(SUSPENDED_RAYCAST_ATTR, 'true');
          setRaycastClass(node, false);
        }
        return;
      }
      var storedInteractive = node.getAttribute?.(SUSPENDED_INTERACTIVE_ATTR);
      if (storedInteractive != null) {
        node.setAttribute?.('data-codexr-interactive', storedInteractive);
        removeAttribute(node, SUSPENDED_INTERACTIVE_ATTR);
      }
      if (node.getAttribute?.(SUSPENDED_RAYCAST_ATTR) === 'true') {
        setRaycastClass(node, true);
        removeAttribute(node, SUSPENDED_RAYCAST_ATTR);
      }
    });
  }

  function setElementTreeVisible(element, visible) {
    if (!element) { return; }
    if (!visible) {
      setElementTreeInteractive(element, false);
    }
    element.setAttribute?.('visible', !!visible);
    if (element.object3D) {
      element.object3D.visible = !!visible;
      element.object3D.traverse?.(function (object) {
        object.visible = !!visible;
      });
    }
    if (visible) {
      setElementTreeInteractive(element, true);
    }
  }

  function setElementSelfVisible(element, visible) {
    if (!element) { return; }
    element.setAttribute?.('visible', !!visible);
    if (element.object3D) {
      element.object3D.visible = !!visible;
    }
  }

  function removeElement(element) {
    if (!element) { return; }
    element.components?.['codexr-dependency-graph']?.disposeView?.();
    if (element.parentNode) {
      element.parentNode.removeChild(element);
      return;
    }
    element.remove?.();
  }
