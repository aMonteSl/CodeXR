// == historicalComparisonRuntime.js | part 10: state-and-interaction-guards (assembled with its siblings; see COMPONENTS.md) ==
(function registerCodeXRHistoricalComparisonRuntime(root) {
  'use strict';

  var ENTITY_KIND = 'historical-comparison';
  var ENTITY_ID = 'main';
  var state = {
    initialized: false,
    panelVisible: false,
    references: null,
    page: 0,
    pageSize: 5,
    activeSide: 'left',
    activeCategory: 'branch',
    availability: 'loading',
    unavailableReason: 'Checking Git history availability...',
    selected: { left: 'working-copy', right: '' },
    result: null,
    payloads: { left: [], right: [] },
    selectedMapping: {},
    status: '',
    statusLevel: 'info',
    disposables: [],
    unregisterPanelView: null,
    unregisterLifecycle: null,
    unregisterModeOption: null,
    loadGeneration: 0
  };
  var refs = {};
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var RAYCAST_SUSPENDED_ATTRIBUTE = 'data-codexr-raycast-suspended';
  var CHART_COMPONENT_NAMES = [
    'babia-bars',
    'babia-barsmap',
    'babia-cyls',
    'babia-cylsmap',
    'babia-pie',
    'babia-doughnut',
    'babia-bubbles',
    'babia-boats'
  ];

  function getDocument() {
    return root.document;
  }

  function getConfig() {
    var script = getDocument()?.getElementById('codexr-tooling-config-xr-mapping-ui');
    if (!script) {
      return null;
    }
    try {
      return JSON.parse(script.textContent || '{}');
    } catch {
      return null;
    }
  }

  function getClient() {
    return root.CodeXRCollaborationRuntime?.getClient?.(root) || null;
  }

  function isHistoricalModeActiveOrActivating() {
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.();
    return modeState?.mode === 'historical-compare'
      || (modeState?.transitioning && modeState?.requestedMode === 'historical-compare');
  }

  async function configureAvailability() {
    var client = getClient();
    var sessionInfo = null;
    try {
      sessionInfo = await client?.getSessionInfoAsync?.();
    } catch {
      sessionInfo = null;
    }
    var capabilities = sessionInfo?.capabilities || {};
    var enabled = capabilities.historicalComparison === true;
    var reason = String(
      capabilities.historicalComparisonReason
        || 'Historical comparison requires a local Git repository.'
    );
    state.availability = enabled ? 'enabled' : 'disabled';
    state.unavailableReason = enabled ? '' : reason;
    registerHistoricalModeOption();
  }

  function registerHistoricalModeOption() {
    state.unregisterModeOption?.();
    state.unregisterModeOption = root.CodeXRAnalysisModeRuntime.registerModeOption?.({
      id: 'historical-compare',
      label: 'Historical comparison',
      color: '#be123c',
      disabled: state.availability !== 'enabled',
      disabledReason: state.unavailableReason || 'Historical comparison requires a local Git repository.',
      onSelect: selectHistoricalMode
    }) || null;
  }

  function createEntity(tagName, attributes) {
    var entity = getDocument().createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      entity.setAttribute(key, attributes[key]);
    });
    return entity;
  }

  function suspendRaycastInteraction(rootEntity) {
    if (!rootEntity) {
      return;
    }
    function suspendEntity(entity) {
      if (!entity?.classList?.contains(RAYCAST_CLASS)) {
        return;
      }
      entity.classList.remove(RAYCAST_CLASS);
      entity.setAttribute(RAYCAST_SUSPENDED_ATTRIBUTE, 'true');
    }
    suspendEntity(rootEntity);
    rootEntity.querySelectorAll?.('.' + RAYCAST_CLASS).forEach(suspendEntity);
    refs.originalInteractionObserver?.disconnect?.();
    if (typeof root.MutationObserver !== 'function') {
      return;
    }
    refs.originalInteractionObserver = new root.MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function (node) {
            if (node?.nodeType !== 1) {
              return;
            }
            suspendEntity(node);
            node.querySelectorAll?.('.' + RAYCAST_CLASS).forEach(suspendEntity);
          });
          return;
        }
        if (mutation.type === 'attributes') {
          suspendEntity(mutation.target);
        }
      });
    });
    refs.originalInteractionObserver.observe(rootEntity, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function restoreRaycastInteraction(rootEntity) {
    refs.originalInteractionObserver?.disconnect?.();
    refs.originalInteractionObserver = null;
    if (!rootEntity) {
      return;
    }
    var suspended = [];
    if (rootEntity.getAttribute?.(RAYCAST_SUSPENDED_ATTRIBUTE) === 'true') {
      suspended.push(rootEntity);
    }
    rootEntity.querySelectorAll?.('[' + RAYCAST_SUSPENDED_ATTRIBUTE + '="true"]').forEach(function (entity) {
      suspended.push(entity);
    });
    suspended.forEach(function (entity) {
      entity.classList?.add(RAYCAST_CLASS);
      entity.removeAttribute?.(RAYCAST_SUSPENDED_ATTRIBUTE);
    });
  }

  function collectConfiguredIds(config, keys) {
    var ids = [];
    keys.forEach(function (key) {
      var value = config?.[key];
      if (Array.isArray(value)) {
        value.forEach(function (id) { if (id) { ids.push(String(id)); } });
      } else if (value) {
        ids.push(String(value));
      }
    });
    return ids;
  }

  function uniqueElements(elements) {
    return elements.filter(function (element, index) {
      return !!element && elements.indexOf(element) === index;
    });
  }

  function getNormalVisualizationRoots(config) {
    var document = getDocument();
    if (!document) { return []; }
    var roots = [];
    collectConfiguredIds(config || getConfig(), [
      'normalEntityIds',
      'visualizationEntityIds',
      'chartEntityIds',
      'chartEntityId',
      'chartId'
    ]).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) { roots.push(element); }
    });
    if (config?.chartSelector && typeof document.querySelector === 'function') {
      var selected = document.querySelector(config.chartSelector);
      if (selected) { roots.push(selected); }
    }
    document.querySelectorAll?.('[data-codexr-normal-root="true"], [data-codexr-normal-visualization="true"]')
      .forEach(function (element) { roots.push(element); });
    return uniqueElements(roots);
  }

  function getTemplateChart(config) {
    var document = getDocument();
    if (!document) { return null; }
    if (config?.chartEntityId) {
      return document.getElementById(config.chartEntityId);
    }
    if (Array.isArray(config?.chartEntityIds) && config.chartEntityIds.length) {
      return document.getElementById(config.chartEntityIds[0]);
    }
    return getNormalVisualizationRoots(config)[0] || null;
  }

  function getNormalMappingTargetIds(config) {
    var ids = collectConfiguredIds(config, ['chartEntityIds', 'chartEntityId', 'chartId']);
    if (!ids.length) {
      ids = getNormalVisualizationRoots(config)
        .map(function (element) { return element.id; })
        .filter(Boolean);
    }
    return Array.from(new Set(ids));
  }
