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
  var AXIS_TICK_COUNT = 10;
  var EXTERNAL_SUMMARY_ID = 'codexr:external-summary';
  var EDGE_ENCODINGS = ['relation-type', 'intensity-color', 'intensity-width', 'intensity-combined'];
  var INTENSITY_COLORS = ['#67e8f9', '#38bdf8', '#818cf8', '#f59e0b', '#f97316'];
  var FALLBACK_INTENSITY_WIDTHS = [.006, .009, .013, .018, .024];
  var FALLBACK_CONFIDENCE_OPACITY = { exact: .78, probable: .52, ambiguous: .28 };
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
  var RELATION_COLORS = {
    import: '#67e8f9', include: '#22d3ee', require: '#60a5fa',
    inheritance: '#e879f9', implementation: '#c084fc', call: '#f59e0b',
    contains: '#a3e635'
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
  function text(value, position, width, color, align) {
    return entity('a-text', {
      value: value || '', position: position || '0 0 0.02', width: width || 5,
      color: color || '#fff', align: align || 'center', baseline: 'center',
      'wrap-count': 42
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
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var center = entity('a-plane', {
      position: '0 0 0.012', width: centerWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var right = entity('a-plane', {
      position: (width / 2 - segmentWidth / 2) + ' 0 0.012',
      width: segmentWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
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