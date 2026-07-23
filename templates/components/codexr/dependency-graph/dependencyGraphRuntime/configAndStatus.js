// == dependencyGraphRuntime.js | configAndStatus (assembled per manifest.json; see COMPONENTS.md) ==
(function registerCodeXRDependencyGraphRuntime(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  var COMPONENT = 'codexr-dependency-graph';
  var ENTITY_KIND = 'dependency-graph';
  var ENTITY_ID = 'main';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var GRAPH_WIDTH = 4.7;
  var GRAPH_DEPTH = 2.35;
  var GRAPH_BASE_Y = 0.12;
  var GRAPH_HEIGHT = 1.05;
  // The scope breadcrumb (path label) lives at HOME by default; while a detail
  // card is visible it dodges to DOCKED — a low, forward band the card (anchored
  // at graphTopY + 0.92, lower edge >= ~1.33) never reaches. The tween is driven
  // manually in tick() (see updateScopeLabelDock), so the numeric endpoints are
  // the source of truth; HOME's string form seeds the initial position attribute.
  var SCOPE_LABEL_HOME_VEC = { x: 0, y: 1.52, z: 0.18 };
  var SCOPE_LABEL_DOCKED_VEC = { x: 0, y: 0.2, z: 1.28 };
  var SCOPE_LABEL_HOME = SCOPE_LABEL_HOME_VEC.x + ' ' + SCOPE_LABEL_HOME_VEC.y + ' ' + SCOPE_LABEL_HOME_VEC.z;
  // Multiple legends can be pinned at once; cards are laid out in a
  // non-overlapping grid above the graph (see legendSlotPosition), each with a
  // connector to its node/edge. Oldest is evicted past MAX_PINNED_LEGENDS.
  var MAX_PINNED_LEGENDS = 6;
  // cardHeight must cover the tallest rendered card (a navigable node card with
  // 7 metrics + an action button is ~1.72) so grid rows never overlap.
  var LEGEND_SLOT = {
    perRow: 2, cardWidth: 2.5, cardHeight: 1.85, gapX: 0.34, gapY: 0.3, originYOffset: 1.05, z: 0.18
  };
  // Flow-particle catalogues — part of the SHARED room contract: the ids travel
  // in the dependency-graph entity as `flowSize` / `flowSpeed` (validated by the
  // analysis server), so every participant sees the same particles.
  var FLOW_SIZE_OPTIONS = [
    { id: 's', label: 'S', scale: 0.6 },
    { id: 'm', label: 'M', scale: 1 },
    { id: 'l', label: 'L', scale: 1.5 },
    { id: 'xl', label: 'XL', scale: 2.2 }
  ];
  var FLOW_SPEED_OPTIONS = [
    { id: 'x05', label: 'x0.5', multiplier: 0.5 },
    { id: 'x1', label: 'x1', multiplier: 1 },
    { id: 'x2', label: 'x2', multiplier: 2 },
    { id: 'x3', label: 'x3', multiplier: 3 }
  ];
  var FLOW_DEFAULTS = { flowSize: 'm', flowSpeed: 'x1' };
  // Edge traversals per second at x1 (matches the pre-configurable behaviour).
  var FLOW_BASE_SPEED = 0.42;
  function flowSizeOption(id) {
    return FLOW_SIZE_OPTIONS.find(function (option) { return option.id === id; })
      || FLOW_SIZE_OPTIONS[1];
  }
  function flowSpeedOption(id) {
    return FLOW_SPEED_OPTIONS.find(function (option) { return option.id === id; })
      || FLOW_SPEED_OPTIONS[1];
  }
  // Single source of truth for the settings panel's row Y positions (and its
  // registered height) — keep every renderControls row anchored here instead of
  // scattering magic numbers through the layout code.
  var PANEL_ROWS = {
    scope: 2.95,
    layout: 2.45,
    nav: 1.95,
    mapping: 1.35,
    relationsBase: 0.75,
    relationsStep: 0.52,
    edges: -0.40,
    detail: -0.85,
    flow: -1.30,
    legendMarks: -1.74,
    legendLabels: -1.88,
    density: -2.04,
    shapes: -2.20,
    actions: -2.58,
    hover: -2.92,
    status: -3.20,
    waitingText: 0.6,
    waitingButton: -1.4,
    panelHeight: 6.8
  };
  var AXIS_TICK_COUNT = 10;
  var EXTERNAL_SUMMARY_ID = 'codexr:external-summary';
  // Edge-encoding palettes, buckets and legend models live in edgeEncoding.js.
  var RELATIONS = ['import', 'include', 'require', 'inheritance', 'implementation', 'call', 'contains'];
  var RELATION_HELP = {
    import: 'Imports: module dependencies declared with import or equivalent syntax.',
    include: 'Includes: source or header files included during compilation or preprocessing.',
    require: 'Requires: modules or packages loaded with require-style syntax.',
    inheritance: 'Inheritance: classes or types that extend another type.',
    implementation: 'Implementation: classes or types implementing interfaces or traits.',
    call: 'Calls: detectable function or method calls; some languages are best-effort.',
    contains: 'Contains: a module or type owns the connected symbol.'
  };
  var COLORS = {
    Python: '#3776ab', Ruby: '#cc342d', Java: '#e76f00', C: '#659ad2',
    'C++': '#00599c', 'C#': '#9b4f96', JavaScript: '#f7df1e',
    TypeScript: '#3178c6', Go: '#00add8', PHP: '#777bb4',
    Swift: '#f05138', Kotlin: '#7f52ff', external: '#94a3b8',
    directory: '#22d3ee', parent: '#f59e0b', symbol: '#a78bfa'
  };
  var state = {
    initialized: false,
    availability: 'loading',
    unavailableReason: '',
    snapshot: null,
    dataset: null,
    projectDataset: null,
    fileDatasets: {},
    originalRoots: [],
    unregisterMode: null,
    unregisterPanel: null,
    unregisterLifecycle: null,
    disposables: [],
    datasetLoadGeneration: 0,
    viewGeneration: 0,
    active: false,
    transitionLocked: false,
    retryTimers: new Set()
  };
  var refs = {};

  function doc() { return root.document; }
  function client() { return root.CodeXRCollaborationRuntime?.getClient?.(root) || null; }
  function config() {
    var script = doc()?.getElementById('codexr-tooling-config-xr-mapping-ui');
    try { return JSON.parse(script?.textContent || '{}'); } catch { return {}; }
  }
  function entity(tag, attributes) {
    var el = doc().createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) { el.setAttribute(key, attributes[key]); });
    return el;
  }
  function text(value, position, width, color, align, wrapCount) {
    return entity('a-text', {
      value: value || '', position: position || '0 0 0.02', width: width || 5,
      color: color || '#fff', align: align || 'center', baseline: 'center',
      'wrap-count': wrapCount || 42
    });
  }
  function button(label, position, width, onClick, color) {
    var el = entity('a-plane', {
      position: position, width: width || 1.5, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.96; shader: flat',
      class: onClick ? RAYCAST_CLASS : '', 'data-codexr-interactive': onClick ? 'true' : 'false'
    });
    el.appendChild(text(label, '0 0 0.02', Math.max(2, (width || 1.5) * 1.7)));
    if (onClick) { el.addEventListener('click', onClick); }
    return el;
  }
  function attachHelp(el, message) {
    if (!message) { return el; }
    el.setAttribute('data-codexr-help', message);
    el.addEventListener('mouseenter', function () { setStatus(message, false); });
    el.addEventListener('mouseleave', function () {
      setStatus(state.snapshot?.status === 'ready' ? '' : (state.snapshot?.message || ''), false);
    });
    return el;
  }
  function cycleButton(label, position, width, onPrevious, onNext, color, help) {
    var rootEl = entity('a-entity', { position: position });
    var segmentWidth = 0.46;
    var centerWidth = Math.max(0.5, width - (segmentWidth * 2));
    var background = entity('a-plane', {
      width: width, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.96; shader: flat'
    });
    var left = entity('a-plane', {
      position: (-width / 2 + segmentWidth / 2) + ' 0 0.012',
      width: segmentWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat; depthWrite: false',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var center = entity('a-plane', {
      position: '0 0 0.012', width: centerWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat; depthWrite: false',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var right = entity('a-plane', {
      position: (width / 2 - segmentWidth / 2) + ' 0 0.012',
      width: segmentWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat; depthWrite: false',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    left.appendChild(text('<', '0 0 0.012', 1.1));
    center.appendChild(text(label, '0 0 0.012', Math.max(2, centerWidth * 1.7)));
    right.appendChild(text('>', '0 0 0.012', 1.1));
    left.addEventListener('click', onPrevious);
    center.addEventListener('click', onNext);
    right.addEventListener('click', onNext);
    [left, center, right].forEach(function (part) { attachHelp(part, help); });
    rootEl.appendChild(background);
    rootEl.appendChild(left);
    rootEl.appendChild(center);
    rootEl.appendChild(right);
    return rootEl;
  }
  function setStatus(message, error) {
    if (!refs.status) { return; }
    refs.status.setAttribute('value', message || '');
    refs.status.setAttribute('color', error ? '#fca5a5' : '#fde68a');
    refs.status.setAttribute('visible', !!message);
  }
  function collectConfiguredIds(cfg, keys) {
    var ids = [];
    keys.forEach(function (key) {
      var value = cfg?.[key];
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