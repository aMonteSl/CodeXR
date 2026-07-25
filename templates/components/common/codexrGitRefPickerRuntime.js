(function registerCodeXRGitRefPickerRuntime(root) {
  'use strict';

  // Shared Git-reference facility for the in-room controller. Historical
  // comparison and project evolution both let the user pick things out of
  // .git (working copy, branches, tags, commits); this runtime owns the parts
  // they share: the detection VOCABULARY (how a source is labelled, dated,
  // categorised and coloured) and an embeddable VISUAL PICKER that renders the
  // same source list two ways — 'compare' (two slots) and 'sequence' (ordered
  // multi-select). Data fetch and per-mode actions stay in each analysis; the
  // picker is a pure view that emits selection callbacks.

  function doc() {
    return root.document || null;
  }

  function createEntity(tag, attributes) {
    var document = doc();
    if (!document || !document.createElement) {
      return null;
    }
    var el = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) {
      el.setAttribute(key, attributes[key]);
    });
    return el;
  }

  function text(value, position, width, color, align, wrapCount) {
    return createEntity('a-text', {
      value: value == null ? '' : String(value),
      position: position || '0 0 0.02',
      width: width || 3,
      color: color || '#ffffff',
      align: align || 'left',
      baseline: 'center',
      'wrap-count': wrapCount || 48
    });
  }

  function compact(value, limit) {
    var textValue = String(value == null ? '' : value);
    var max = Math.max(1, Number(limit) || 48);
    return textValue.length > max ? textValue.slice(0, Math.max(1, max - 3)) + '...' : textValue;
  }

  // ── Detection vocabulary ──────────────────────────────────────────────────
  // One source of truth for how a Git source reads on screen, replacing the
  // per-analysis copies of splitSourceDescription / sourceTypeLabel / colors.

  var TYPE_COLORS = {
    LIVE: '#06b6d4',
    BRANCH: '#22c55e',
    TAG: '#a78bfa',
    COMMIT: '#64748b',
    MERGE: '#f97316',
    REF: '#64748b'
  };

  function typeLabel(source) {
    if (!source) { return 'REF'; }
    if (source.revisionType === 'working-copy' || source.kind === 'workingCopy') { return 'LIVE'; }
    if (source.revisionType === 'merge') { return 'MERGE'; }
    if (source.revisionType === 'branch' || source.refType === 'branch') { return 'BRANCH'; }
    if (source.revisionType === 'tag' || source.refType === 'tag') { return 'TAG'; }
    if (source.revisionType === 'commit' || source.refType === 'commit') { return 'COMMIT'; }
    return 'REF';
  }

  function typeColor(source) {
    return TYPE_COLORS[typeLabel(source)] || TYPE_COLORS.REF;
  }

  // The picker categorises each git source into exactly one tab. Merges are
  // split out from plain commits; the working copy is NOT categorised here —
  // it is pinned first in every tab by the picker (see visibleSources).
  function sourceCategory(source) {
    if (!source) { return 'commit'; }
    if (source.revisionType === 'merge') { return 'merge'; }
    if (source.refType === 'tag') { return 'tag'; }
    if (source.refType === 'commit') { return 'commit'; }
    return 'branch';
  }

  function filterByCategory(sources, category) {
    return (Array.isArray(sources) ? sources : []).filter(function (source) {
      // 'all' = every git ref (working copy is pinned separately, not here).
      if (category === 'all') {
        return source && source.kind === 'gitRef';
      }
      return source && source.kind === 'gitRef' && sourceCategory(source) === category;
    });
  }

  // Comparable committer time: the precise epoch timestamp when the server
  // sends one, else the day-granular YYYY-MM-DD date (which ties every
  // same-day ref). Sources with neither sort last regardless of direction.
  function sortKey(source) {
    var timestamp = Number(source && source.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) { return timestamp * 1000; }
    var date = String((describeSource(source).date || ''));
    var parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sortByTime(sources, direction) {
    var dir = direction === 'asc' ? 1 : -1;
    return sources.slice().sort(function (a, b) {
      var ka = sortKey(a);
      var kb = sortKey(b);
      if (ka === null && kb === null) { return 0; }
      if (ka === null) { return 1; }
      if (kb === null) { return -1; }
      return ka < kb ? -dir : (ka > kb ? dir : 0);
    });
  }

  function describeSource(source) {
    if (!source) {
      return { id: '', label: 'Not selected', date: '', subject: '', typeLabel: 'REF', typeColor: TYPE_COLORS.REF, category: 'commit', isLive: false };
    }
    var label = String(source.label || source.refName || source.id || 'unknown');
    var description = String(source.description || '').trim();
    var explicitDate = String(source.date || '').trim();
    var match = description.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
    var date = explicitDate || (match ? match[1] : '');
    var subject = match ? match[2] : description;
    var isLive = source.kind === 'workingCopy' || source.revisionType === 'working-copy';
    if (isLive && !date) {
      date = 'Working copy';
    }
    return {
      id: String(source.id || ''),
      label: label,
      date: date || 'No commit date',
      subject: subject || '',
      typeLabel: typeLabel(source),
      typeColor: typeColor(source),
      category: sourceCategory(source),
      isLive: isLive
    };
  }

  // ── Shared row markup (pooled) ────────────────────────────────────────────
  // Rows are created ONCE per picker and reused: paging/selection only update
  // their attributes (value/color/visibility), never add or remove nodes. This
  // is deliberate — the controller panel runs a childList MutationObserver that
  // re-scans and re-toggles raycast classes on every DOM insertion, so a
  // destroy-and-rebuild render storms the raycaster and freezes the scene on a
  // pager click. Attribute-only updates never trip that observer.
  // Layout (compact): left accent chip by type, name + muted date stacked,
  // subject in the middle, a coloured type chip and an optional order badge.

  function createPoolRow(rowClass, onRowClick) {
    var row = createEntity('a-plane', {
      width: 5.7,
      height: 0.31,
      material: 'color: #1e293b; opacity: 0.95; shader: flat',
      class: 'babiaxraycasterclass ' + (rowClass || 'codexr-git-ref-row'),
      'data-codexr-interactive': 'true',
      visible: 'false'
    });
    if (!row) { return null; }
    row.__chip = createEntity('a-plane', {
      position: '-2.79 0 0.02', width: 0.07, height: 0.31,
      material: 'color: #64748b; opacity: 0.95; shader: flat'
    });
    row.__name = text('', '-2.6 0.06 0.02', 1.3, '#f8fafc', 'left', 18);
    row.__date = text('', '-2.6 -0.08 0.02', 1.3, '#94a3b8', 'left', 18);
    row.__subject = text('', '-1.15 0 0.02', 3.4, '#e2e8f0', 'left', 48);
    row.__typeChip = createEntity('a-plane', {
      position: '1.92 0 0.018', width: 0.72, height: 0.18,
      material: 'color: #64748b; opacity: 0.92; shader: flat'
    });
    row.__typeLabel = text('', '1.92 0 0.035', 0.72, '#0b1220', 'center', 8);
    row.__order = text('', '2.5 0 0.02', 0.5, '#fde68a', 'right', 8);
    row.__order.setAttribute('visible', 'false');
    [row.__chip, row.__name, row.__date, row.__subject, row.__typeChip, row.__typeLabel, row.__order]
      .forEach(function (child) { if (child) { row.appendChild(child); } });
    row.addEventListener('click', function () {
      if (row.__source && typeof onRowClick === 'function') { onRowClick(row.__source); }
    });
    return row;
  }

  // Show/hide pooled rows via object3D.visible — the reliable source of truth
  // for both rendering and raycasting (three.js skips invisible objects). A
  // plain setAttribute('visible', …) is unreliable on reused A-Frame primitives
  // (1.7.1 caches the value and can no-op), so the attribute is kept only for
  // DOM/test introspection.
  function setRowVisible(row, visible) {
    if (!row) { return; }
    if (row.object3D) { row.object3D.visible = !!visible; }
    row.setAttribute('visible', visible ? 'true' : 'false');
  }

  function updatePoolRow(row, source, rowState, y) {
    if (!row) { return; }
    var parts = describeSource(source);
    var state = rowState || {};
    row.__source = source;
    row.setAttribute('position', '0 ' + y + ' 0');
    setRowVisible(row, true);
    row.setAttribute('material', 'color: ' + (state.selected ? (state.color || '#be123c') : '#1e293b') + '; opacity: 0.95; shader: flat');
    row.__chip.setAttribute('material', 'color: ' + parts.typeColor + '; opacity: 0.95; shader: flat');
    row.__name.setAttribute('value', compact(parts.label, 16));
    row.__date.setAttribute('value', parts.date);
    row.__subject.setAttribute('value', compact(parts.subject || parts.label, 48));
    row.__typeChip.setAttribute('material', 'color: ' + parts.typeColor + '; opacity: 0.92; shader: flat');
    row.__typeLabel.setAttribute('value', parts.typeLabel);
    // Attribute AND object3D: A-Frame 1.7.1 caches the visible attribute on
    // reused nodes, so a pooled row handed to another source kept the previous
    // source's order badge painted.
    var hasOrder = !!state.orderLabel;
    row.__order.setAttribute('value', hasOrder ? String(state.orderLabel) : '');
    row.__order.setAttribute('visible', hasOrder ? 'true' : 'false');
    if (row.__order.object3D) {
      row.__order.object3D.visible = hasOrder;
    }
  }

  function hidePoolRow(row) {
    if (!row) { return; }
    row.__source = null;
    setRowVisible(row, false);
  }

  // Shared button chrome for every Git analysis (same look in the comparison and
  // the evolution panels). `options` lets a caller keep its own marker class or
  // label wrapping without forking the factory.
  function buildButton(label, position, width, height, color, onClick, textWidth, options) {
    var opts = options || {};
    var button = createEntity('a-plane', {
      position: position,
      width: width || 1,
      height: height || 0.3,
      material: 'color: ' + (color || '#1e293b') + '; opacity: 0.96; shader: flat',
      class: 'babiaxraycasterclass ' + (opts.className || 'codexr-git-ref-button'),
      'data-codexr-interactive': 'true'
    });
    if (!button) { return null; }
    button._codexrLabel = text(label, '0 0 0.02', textWidth || Math.max(1.6, (width || 1) * 1.7), '#ffffff', 'center', opts.wrapCount || 22);
    button.appendChild(button._codexrLabel);
    if (typeof onClick === 'function') {
      button.addEventListener('click', onClick);
    }
    return button;
  }

  function setButtonLabel(button, value, color) {
    var target = button && button._codexrLabel;
    if (!target) { return; }
    target.setAttribute('value', String(value == null ? '' : value));
    if (color) { target.setAttribute('color', color); }
  }

  // ── Embeddable picker ─────────────────────────────────────────────────────

  function createPicker(options) {
    var opts = options || {};
    var mode = opts.mode === 'sequence' ? 'sequence' : 'compare';
    var pageSize = Math.max(1, Number(opts.pageSize) || 5);
    var rowGap = opts.rowGap || 0.34;
    var listTopY = opts.listTopY == null ? 0.3 : opts.listTopY;

    var pickerState = {
      references: null,
      category: opts.defaultCategory || 'all',
      sortDir: opts.defaultSortDir === 'asc' ? 'asc' : 'desc',
      page: 0,
      activeSlot: (opts.slots && opts.slots[0] && opts.slots[0].id) || 'left'
    };

    var el = createEntity('a-entity', { position: opts.position || '0 0 0.02' });
    var slotRoot = null;
    var slotButtons = {};
    var tabRoot = null;
    var listRoot = createEntity('a-entity', { position: '0 ' + (opts.listY == null ? 0.92 : opts.listY) + ' 0' });
    var pagerRoot = createEntity('a-entity', { position: '0 ' + (opts.pagerY == null ? -1.82 : opts.pagerY) + ' 0' });
    var pageText = null;

    var slots = opts.slots || [
      { id: 'left', label: 'LEFT', color: '#164e63', activeColor: '#67e8f9' },
      { id: 'right', label: 'RIGHT', color: '#166534', activeColor: '#6ee7b7' }
    ];
    var categories = opts.categories || [
      { id: 'all', label: 'All' },
      { id: 'branch', label: 'Branch' },
      { id: 'tag', label: 'Tags' },
      { id: 'commit', label: 'Commits' },
      { id: 'merge', label: 'Merges' }
    ];

    // Category tabs and the time-order toggle are shared Git vocabulary, not a
    // compare-mode feature: any analysis browsing the same reference list wants
    // them (project evolution has hundreds of commits to page through). They
    // default to on for 'compare' and are opt-in for 'sequence'.
    var showTabs = opts.tabs == null ? (mode === 'compare') : !!opts.tabs;
    var showSortToggle = opts.sortToggle == null ? (mode === 'compare') : !!opts.sortToggle;

    if (mode === 'compare') {
      slotRoot = createEntity('a-entity', { position: '0 ' + (opts.slotsY == null ? 2.18 : opts.slotsY) + ' 0' });
      slots.forEach(function (slot, index) {
        var button = buildButton(
          slot.label,
          (index === 0 ? -1.48 : 1.48) + ' 0 0',
          2.75, 0.48, slot.color,
          function () { setActiveSlot(slot.id); },
          2.5
        );
        slotButtons[slot.id] = button;
        if (button) { slotRoot.appendChild(button); }
      });
      if (el && slotRoot) { el.appendChild(slotRoot); }
    }
    if (showTabs) {
      tabRoot = createEntity('a-entity', { position: '0 ' + (opts.tabsY == null ? 1.62 : opts.tabsY) + ' 0' });
      if (el && tabRoot) { el.appendChild(tabRoot); }
    }

    if (el && listRoot) { el.appendChild(listRoot); }

    // Fixed row pool: created once, reused on every render (attribute-only).
    var rowPool = [];
    for (var poolIndex = 0; poolIndex < pageSize; poolIndex += 1) {
      var poolRow = createPoolRow(opts.rowClass, function (source) { handleRowClick(source); });
      if (poolRow) { rowPool.push(poolRow); if (listRoot) { listRoot.appendChild(poolRow); } }
    }

    // Time-order toggle (compare mode): newest-first by default, flips to
    // oldest-first. Built once; render only refreshes its label.
    var sortButton = null;
    if (showSortToggle) {
      sortButton = buildButton('', '-2.32 0 0', 1.2, 0.3, '#0e7490', function () { toggleSort(); }, 1.55);
      if (pagerRoot && sortButton) { pagerRoot.appendChild(sortButton); }
    }
    pagerRoot && pagerRoot.appendChild(buildButton('<', '-1.05 0 0', 0.5, 0.3, '#334155', function () { setPage(pickerState.page - 1); }));
    pageText = text('', '0 0 0.02', 2.6, '#cde7ff', 'center', 30);
    pagerRoot && pagerRoot.appendChild(pageText);
    pagerRoot && pagerRoot.appendChild(buildButton('>', '1.05 0 0', 0.5, 0.3, '#334155', function () { setPage(pickerState.page + 1); }));
    if (el && pagerRoot) { el.appendChild(pagerRoot); }
    // Tabs (compare mode) are built once; render only restyles the active one.
    var tabButtons = {};
    buildTabs();

    function allSources() {
      var sources = pickerState.references && pickerState.references.sources;
      return Array.isArray(sources) ? sources : [];
    }

    function workingCopySource() {
      return allSources().find(function (source) { return source.kind === 'workingCopy'; }) || null;
    }

    // Sequence mode orders working-copy/git refs, suggested ids first.
    function visibleSources() {
      if (mode === 'compare') {
        // Category slice, time-sorted, with Live (working copy) always first.
        var categorySources = sortByTime(
          filterByCategory(allSources(), pickerState.category),
          pickerState.sortDir
        );
        var live = workingCopySource();
        return live ? [live].concat(categorySources) : categorySources;
      }
      // Same category filter and time order as compare mode. The auto-suggested
      // frames do NOT jump the queue: with dozens of suggestions and a few rows
      // per page they used to occupy whole pages in fixed order, which made the
      // Oldest/Newest toggle look broken. Their membership is communicated by
      // the numbered badges (resolveRowState), not by list position.
      var pool = sortByTime(
        filterByCategory(allSources(), pickerState.category),
        pickerState.sortDir
      );
      // Live (working copy) is pinned first, exactly like compare mode:
      // filterByCategory leaves it out by design, so a category filter must not
      // make the current branch disappear from the list.
      var live = workingCopySource();
      return live ? [live].concat(pool) : pool;
    }

    function maxPage(count) {
      return Math.max(0, Math.ceil(count / pageSize) - 1);
    }

    function setPage(page) {
      var count = visibleSources().length;
      pickerState.page = Math.max(0, Math.min(maxPage(count), Number(page) || 0));
      render();
    }

    function setActiveSlot(slotId) {
      pickerState.activeSlot = slotId;
      if (typeof opts.onSlotChange === 'function') { opts.onSlotChange(slotId); }
      render();
    }

    function setCategory(category) {
      pickerState.category = category;
      pickerState.page = 0;
      render();
    }

    function buildTabs() {
      if (!tabRoot) { return; }
      var count = categories.length;
      var pitch = count > 3 ? 1.12 : 1.9;
      var tabWidth = count > 3 ? 1.04 : 1.7;
      var startX = -((count - 1) / 2) * pitch;
      categories.forEach(function (category, index) {
        var button = buildButton(
          category.label,
          (startX + (index * pitch)) + ' 0 0',
          tabWidth, 0.3,
          pickerState.category === category.id ? '#0e7490' : '#1e293b',
          function () { setCategory(category.id); },
          count > 3 ? 1.5 : 2.15
        );
        tabButtons[category.id] = button;
        if (button) { tabRoot.appendChild(button); }
      });
    }

    function toggleSort() {
      pickerState.sortDir = pickerState.sortDir === 'desc' ? 'asc' : 'desc';
      pickerState.page = 0;
      render();
    }

    function updateSortButton() {
      if (sortButton) {
        setButtonLabel(sortButton, pickerState.sortDir === 'desc' ? 'Newest' : 'Oldest');
      }
    }

    function updateTabStyles() {
      if (!tabRoot) { return; }
      categories.forEach(function (category) {
        var button = tabButtons[category.id];
        if (button) {
          button.setAttribute('material', 'color: ' + (pickerState.category === category.id ? '#0e7490' : '#1e293b') + '; opacity: 0.96; shader: flat');
        }
      });
    }

    function renderSlots() {
      if (mode !== 'compare') { return; }
      slots.forEach(function (slot) {
        var selectedId = typeof opts.slotSelection === 'function' ? opts.slotSelection(slot.id) : null;
        // Hard-compacted so the summary stays inside the slot and never bleeds
        // into its neighbour or off the panel edge.
        var summary = compact(describeSource(findSource(selectedId)).label, 18);
        var active = pickerState.activeSlot === slot.id;
        setButtonLabel(slotButtons[slot.id], slot.label + '\n' + summary, active ? (slot.activeColor || '#ffffff') : '#ffffff');
      });
    }

    function findSource(sourceId) {
      return allSources().find(function (source) { return source.id === sourceId; }) || null;
    }

    // Attribute-only render over the fixed row pool (see createPoolRow): no
    // node is added or removed, so the controller panel's childList observer
    // and the raycaster stay quiet — paging never freezes the scene.
    function render() {
      var sources = visibleSources();
      pickerState.page = Math.min(pickerState.page, maxPage(sources.length));
      var start = pickerState.page * pageSize;
      var pageSources = sources.slice(start, start + pageSize);
      for (var i = 0; i < rowPool.length; i += 1) {
        if (i < pageSources.length) {
          var source = pageSources[i];
          var rowState = typeof opts.resolveRowState === 'function'
            ? opts.resolveRowState(source, { activeSlot: pickerState.activeSlot }) || {}
            : {};
          updatePoolRow(rowPool[i], source, rowState, listTopY - (i * rowGap));
        } else {
          hidePoolRow(rowPool[i]);
        }
      }
      updateTabStyles();
      updateSortButton();
      renderSlots();
      if (pageText) {
        var label = sources.length
          ? 'Page ' + (pickerState.page + 1) + ' / ' + Math.max(1, maxPage(sources.length) + 1)
          : (mode === 'compare' ? 'No ' + pickerState.category + ' references' : 'No Git references');
        pageText.setAttribute('value', label);
      }
    }

    function handleRowClick(source) {
      if (mode === 'compare' && typeof opts.onSelect === 'function') {
        opts.onSelect(source.id, pickerState.activeSlot);
      }
      if (typeof opts.onRowClick === 'function') {
        opts.onRowClick(source, pickerState.activeSlot);
      }
      render();
    }

    return {
      el: el,
      mode: mode,
      setReferences: function (references) {
        pickerState.references = references || null;
        pickerState.page = 0;
        render();
        return this;
      },
      setActiveSlot: setActiveSlot,
      setCategory: setCategory,
      setSortDir: function (dir) {
        pickerState.sortDir = dir === 'asc' ? 'asc' : 'desc';
        pickerState.page = 0;
        render();
      },
      getState: function () {
        return {
          category: pickerState.category,
          sortDir: pickerState.sortDir,
          page: pickerState.page,
          activeSlot: pickerState.activeSlot
        };
      },
      getVisibleSources: visibleSources,
      render: render,
      destroy: function () {
        if (el && el.parentNode) { el.parentNode.removeChild(el); }
      }
    };
  }

  // ── Git-gated mode registration ───────────────────────────────────────────
  // Both Git analyses register a controller mode option that is disabled with a
  // shared reason when the target is not inside a repo. One helper reads the
  // session capability flag and registers the option.

  // Lectern-style plate for the table edge closest to the user, naming the Git
  // source a visualization is showing. Shared so every Git analysis labels the
  // table the same way (historical: one per side; evolution: the current frame).
  function buildSourceNameplateText(source) {
    var described = describeSource(source);
    var date = described.isLive ? 'Working copy' : described.date;
    var value = described.label + '  -  ' + date;
    return value.length > 46 ? value.slice(0, 43) + '...' : value;
  }

  function createSourceNameplate(source, zone, color) {
    var zoneDepth = Number(zone.depth || zone.targetDepth) || 3.2;
    var plate = createEntity('a-entity', {
      position: zone.anchorX + ' 1.14 ' + (zone.anchorZ + (zoneDepth / 2) + 0.08),
      rotation: '-28 0 0'
    });
    plate.appendChild(createEntity('a-plane', {
      width: 2.35,
      height: 0.3,
      material: 'color: #0b1220; opacity: 0.88; shader: flat; side: double'
    }));
    plate.appendChild(createEntity('a-plane', {
      position: (-2.35 / 2 + 0.035) + ' 0 0.005',
      width: 0.06,
      height: 0.3,
      material: 'color: ' + color + '; opacity: 0.95; shader: flat'
    }));
    plate._codexrLabel = text(buildSourceNameplateText(source), '0.02 0 0.01', 2.6, color, 'center', 44);
    plate.appendChild(plate._codexrLabel);
    return plate;
  }

  function setSourceNameplate(plate, source, color) {
    var label = plate && plate._codexrLabel;
    if (!label) { return; }
    label.setAttribute('value', buildSourceNameplateText(source));
    if (color) { label.setAttribute('color', color); }
  }

  function registerGitGatedMode(options) {
    var opts = options || {};
    var modeRuntime = root.CodeXRAnalysisModeRuntime;
    if (!modeRuntime || typeof modeRuntime.registerModeOption !== 'function') {
      return function () {};
    }
    var enabled = opts.capabilities ? opts.capabilities[opts.capabilityKey] === true : opts.enabled === true;
    var reason = enabled
      ? ''
      : String((opts.capabilities && opts.capabilities[opts.capabilityKey + 'Reason']) || opts.reasonFallback || 'Requires a local Git repository.');
    return modeRuntime.registerModeOption({
      id: opts.modeId,
      label: opts.label,
      color: opts.color,
      disabled: !enabled,
      disabledReason: reason || opts.reasonFallback || 'Requires a local Git repository.',
      onSelect: opts.onSelect
    }) || function () {};
  }

  async function resolveCapabilities() {
    var client = root.CodeXRCollaborationRuntime && root.CodeXRCollaborationRuntime.getClient
      ? root.CodeXRCollaborationRuntime.getClient(root)
      : null;
    var sessionInfo = null;
    try {
      sessionInfo = client && client.getSessionInfoAsync ? await client.getSessionInfoAsync() : null;
    } catch (error) {
      sessionInfo = null;
    }
    return (sessionInfo && sessionInfo.capabilities) || {};
  }

  var api = {
    describeSource: describeSource,
    sourceCategory: sourceCategory,
    filterByCategory: filterByCategory,
    typeLabel: typeLabel,
    typeColor: typeColor,
    TYPE_COLORS: TYPE_COLORS,
    createPicker: createPicker,
    buildButton: buildButton,
    createSourceNameplate: createSourceNameplate,
    buildSourceNameplateText: buildSourceNameplateText,
    setSourceNameplate: setSourceNameplate,
    registerGitGatedMode: registerGitGatedMode,
    resolveCapabilities: resolveCapabilities
  };

  root.CodeXRGitRefPickerRuntime = root.CodeXRGitRefPickerRuntime || api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
