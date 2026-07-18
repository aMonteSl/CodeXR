// == xrChartMappingUiRuntime.js | configAndLabels (assembled per manifest.json; see COMPONENTS.md) ==
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.CodeXRMappingUiRuntime = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var CONFIG_KEY = '__CODEXR_XR_MAPPING_UI__';
  var CONFIG_SCRIPT_ID = 'codexr-tooling-config-xr-mapping-ui';
  var SHARED_ENTITY_KIND = 'mapping';
  var COMPONENT_BY_CHART = {
    bars: 'babia-bars',
    barsmap: 'babia-barsmap',
    cyls: 'babia-cyls',
    cylsmap: 'babia-cylsmap',
    donut: 'babia-doughnut',
    pie: 'babia-pie',
    bubbles: 'babia-bubbles',
    boats: 'babia-boats'
  };

  var DEFAULT_ROTATION_BY_CHART = {
    donut: '0 0 0',
    pie: '0 0 0'
  };

  var CONTROLLER_PANEL_BY_VIEW = {
    'visualization-menu': 'visualization-mode',
    'single.mapping': 'mapping',
    'dependency.settings': 'dependency-graph',
    'historical.selection': 'historical-selection',
    'historical.mapping': 'mapping',
    'project-evolution': 'project-evolution',
    'project-evolution.selection': 'project-evolution',
    'project-evolution.playback': 'project-evolution'
  };

  var CONTROLLER_VIEW_BY_PANEL = {
    'visualization-mode': 'visualization-menu',
    mapping: 'single.mapping',
    'dependency-graph': 'dependency.settings',
    'historical-selection': 'historical.selection',
    'project-evolution': 'project-evolution'
  };

  var refs = {
    panel: null,
    panelContent: null,
    panelTitle: null,
    panelTitleBackdrop: null,
    toggle: null,
    rowsRoot: null,
    chartRoot: null,
    panelBackground: null,
    panelBorder: null,
    statusText: null
  };

  var state = {
    initialized: false,
    visible: true,
    selectedByDimension: {},
    lastKnownGoodMapping: {},
    invalidOptionsByDimension: {},
    adaptiveLoopActive: false,
    activeCornerId: null,
    lastCornerSwitchAt: 0,
    lastConfigSnapshot: null,
    delayedRenormalizeTimer: null,
    pendingValidationTimers: [],
    pendingMappingToken: 0,
    pendingMapping: null,
    statusMessage: '',
    statusLevel: 'info',
    statusClearTimer: null,
    suppressSharedPublish: false,
    chartEntityIdsOverride: null,
    activeMappingContextId: 'normal-analysis',
    mappingProfiles: {},
    activePanelView: 'mapping',
    mappingPanelHeight: 2.45,
    panelViews: {},
    panelViewObservers: {},
    runtimeConfig: null,
    activeChartId: null,
    mode: 'single',
    activeControllerView: 'single.mapping',
    modeMemory: {}
  };

  var ADAPTIVE_DEFAULTS = {
    cornerSwitchThreshold: 0.35,
    cornerSwitchCooldownMs: 500,
    panelLift: 0.04,
    panelForwardOffset: 0.12
  };

  var PANEL_LAYOUT = {
    left: -2.85,
    right: 2.55,
    labelWidth: 7.4,
    buttonGap: 0.08,
    rowGap: 0.28,
    sectionGap: 0.32,
    labelToButtonsGap: 0.3,
    maxChartRows: 3,
    chartRootHeightOffset: 0.34,
    rowsRootHeightOffset: 1.72,
    panelHeightPadding: 2.95
  };

  function getPanelContentWidth() {
    return PANEL_LAYOUT.right - PANEL_LAYOUT.left;
  }

  function getGridButtonWidth(cols) {
    var safeCols = Math.max(1, Number(cols) || 1);
    return (getPanelContentWidth() - PANEL_LAYOUT.buttonGap * (safeCols - 1)) / safeCols;
  }

  function getGridButtonX(colIndex, buttonWidth) {
    return PANEL_LAYOUT.left + colIndex * (buttonWidth + PANEL_LAYOUT.buttonGap) + buttonWidth * 0.5;
  }

  function getDoc() {
    return root.document;
  }

  function getConfig() {
    if (state.runtimeConfig) {
      return state.runtimeConfig;
    }
    var document = getDoc();
    var configScript = document ? document.getElementById(CONFIG_SCRIPT_ID) : null;
    if (configScript && typeof configScript.textContent === 'string') {
      try {
        state.runtimeConfig = JSON.parse(configScript.textContent);
        state.activeChartId = state.runtimeConfig.chartId || null;
        return state.runtimeConfig;
      } catch (error) {
        console.warn('CODEXR_MAPPING_UI: invalid JSON config script', error);
      }
    }
    state.runtimeConfig = root[CONFIG_KEY] || null;
    state.activeChartId = state.runtimeConfig.chartId || null;
    return state.runtimeConfig;
  }

  function createEntity(tagName, attributes) {
    var entity = getDoc().createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      entity.setAttribute(key, attributes[key]);
    });
    return entity;
  }

  function clearEntity(entity) {
    while (entity && entity.firstChild) {
      entity.removeChild(entity.firstChild);
    }
  }

  function pickColumns(fieldCount) {
    if (fieldCount <= 5) {
      return 2;
    }
    if (fieldCount <= 10) {
      return 3;
    }
    return 4;
  }

  function compactLabel(rawName) {
    var map = {
      Complexity: 'Cplx',
      Number: 'No',
      Function: 'Fn',
      Average: 'Avg',
      Cyclomatic: 'Cyclo',
      Nesting: 'Nest',
      Parameters: 'Params',
      Parameter: 'Param',
      Count: 'Cnt',
      Maximum: 'Max',
      Minimum: 'Min'
    };
    var normalized = String(rawName || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();

    var compacted = normalized
      .split(/\s+/)
      .map(function (word) {
        return map[word] || word;
      })
      .join(' ');

    if (compacted.length <= 18) {
      return compacted;
    }
    return compacted.slice(0, 15) + '...';
  }

  function humanizeFieldName(rawName) {
    return String(rawName || '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
  }

  function getFriendlyAxisLabel(config, dimensionId) {
    var dimension = getDimensionConfig(config, dimensionId);
    if (dimension && dimension.label) {
      return String(dimension.label);
    }
    return humanizeFieldName(dimensionId || 'this axis') || 'this axis';
  }

  function buildFriendlyInvalidMappingMessage(config, dimensionId, fieldName, reason, includeRestoreLine) {
    var axisLabel = getFriendlyAxisLabel(config, dimensionId);
    var fieldLabel = humanizeFieldName(fieldName);
    var lines = [];

    if (reason && /no chart data is available yet/i.test(reason)) {
      lines.push('This chart is still loading data for ' + axisLabel + '.');
      lines.push('CodeXR kept the last valid mapping until the visualization is ready.');
      lines.push('Try again once the chart finishes loading.');
      return lines.join('\n');
    }

    if (fieldLabel) {
      lines.push('"' + fieldLabel + '" caused an invalid chart for ' + axisLabel + '.');
    } else {
      lines.push('That field caused an invalid chart for ' + axisLabel + '.');
    }

    if (includeRestoreLine === false) {
      lines.push('CodeXR blocked this option because Babia failed the last time it was used.');
    } else {
      lines.push('CodeXR restored the last valid mapping to keep the visualization stable.');
    }

    lines.push('Try another field for this axis.');
    return lines.join('\n');
  }
