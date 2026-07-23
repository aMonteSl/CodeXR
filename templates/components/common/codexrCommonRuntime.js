(function registerCodeXRCommonRuntime(root) {
  'use strict';

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

  function truncateText(value, maxLength) {
    var text = String(value == null ? '' : value);
    var limit = Math.max(1, Number(maxLength) || 80);
    return text.length > limit ? text.slice(0, Math.max(0, limit - 3)) + '...' : text;
  }

  function tooltipText(value, position, width, color, align) {
    var el = createEntity('a-text', {
      value: value || '',
      position: position || '0 0 0.02',
      width: width || 3,
      color: color || '#ffffff',
      align: align || 'left',
      baseline: 'center',
      'wrap-count': 56
    });
    return el;
  }

  function formatPosition(value) {
    return value.x + ' ' + value.y + ' ' + value.z;
  }

  function normalizeTooltipRows(model) {
    if (Array.isArray(model.rows) && model.rows.length) {
      return model.rows.map(function (row) {
        if (typeof row === 'string') {
          return { label: '', value: row };
        }
        return {
          label: String(row && row.label != null ? row.label : ''),
          value: String(row && row.value != null ? row.value : '')
        };
      });
    }
    return [
      model.primary ? { label: '', value: String(model.primary) } : null,
      model.secondary ? { label: '', value: String(model.secondary) } : null
    ].filter(Boolean);
  }

  function setVisible(entity, visible) {
    if (entity && entity.setAttribute) {
      entity.setAttribute('visible', !!visible);
    }
  }

  function ensureTooltipRows(tooltip, count) {
    tooltip.rows = tooltip.rows || [];
    while (tooltip.rows.length < count) {
      // A metric cell = a muted mini-label + a bright value, laid out in a
      // compact grid by updateTooltip (positions/widths set there).
      var label = tooltipText('', '0 0 .019', .7, '#7c8aa5', 'left');
      var value = tooltipText('', '0 0 .019', .7, '#f1f5f9', 'left');
      label.setAttribute('wrap-count', 16);
      value.setAttribute('wrap-count', 14);
      tooltip.root.appendChild(label);
      tooltip.root.appendChild(value);
      tooltip.rows.push({ label: label, value: value });
    }
    tooltip.rows.forEach(function (row, index) {
      setVisible(row.label, index < count);
      setVisible(row.value, index < count);
    });
    return tooltip.rows;
  }

  function createTooltip(options) {
    var opts = options || {};
    var rootEl = createEntity('a-entity', { visible: false });
    if (!rootEl) {
      return null;
    }
    var width = Number(opts.width) || 2.8;
    var height = Number(opts.height) || .9;
    var accentColor = opts.accentColor || '#38bdf8';
    // Accent-tinted frame just behind the panel for a crisp, non-bland edge.
    var border = createEntity('a-plane', {
      position: '0 0 -0.012',
      width: width + .06,
      height: height + .06,
      material: 'color: ' + accentColor + '; opacity: .5; shader: flat; side: double; transparent: true; depthTest: false'
    });
    var background = createEntity('a-plane', {
      width: width,
      height: height,
      material: 'color: #0e1626; opacity: .97; shader: flat; side: double; transparent: true; depthTest: false'
    });
    // Left vertical accent bar carries the selected element's type colour.
    var accent = createEntity('a-plane', {
      position: (-(width / 2) + .035) + ' 0 .008',
      width: .07,
      height: height,
      material: 'color: ' + accentColor + '; shader: flat; depthTest: false'
    });
    // Thin accent divider under the header.
    var divider = createEntity('a-plane', {
      position: '0 0 .01',
      width: width - .3,
      height: .006,
      material: 'color: ' + accentColor + '; opacity: .4; shader: flat; depthTest: false'
    });
    var textX = -(width / 2) + .2;
    var title = tooltipText('', (textX + .02) + ' .26 .018', width - .4, '#f8fafc', 'left');
    var subtitle = tooltipText('', textX + ' .06 .018', width - .4, '#93a7c4', 'left');
    var primary = tooltipText('', textX + ' -.14 .018', width - .4, '#e2e8f0', 'left');
    var secondary = tooltipText('', textX + ' -.33 .018', width - .4, '#93a7c4', 'left');
    title.setAttribute('wrap-count', 26);
    subtitle.setAttribute('wrap-count', 40);
    primary.setAttribute('wrap-count', 40);
    secondary.setAttribute('wrap-count', 40);
    rootEl.appendChild(border);
    rootEl.appendChild(background);
    rootEl.appendChild(accent);
    rootEl.appendChild(divider);
    rootEl.appendChild(title);
    rootEl.appendChild(subtitle);
    rootEl.appendChild(primary);
    rootEl.appendChild(secondary);
    return {
      root: rootEl,
      border: border,
      background: background,
      accent: accent,
      divider: divider,
      title: title,
      subtitle: subtitle,
      primary: primary,
      secondary: secondary,
      action: null,
      rows: [],
      width: width,
      height: height,
      accentColor: accentColor
    };
  }

  function ensureTooltipConnector(tooltip) {
    if (!tooltip || !tooltip.root || !tooltip.root.parentNode) {
      return null;
    }
    if (tooltip.connectorRoot && tooltip.connectorRoot.parentNode === tooltip.root.parentNode) {
      return tooltip.connectorRoot;
    }
    var connectorRoot = tooltip.connectorRoot || createEntity('a-entity', {
      visible: false,
      class: 'codexr-tooltip-connector codexr-tooltip-auxiliary',
      'data-codexr-role': 'tooltip connector'
    });
    if (!connectorRoot) {
      return null;
    }
    if (!tooltip.connectorLine) {
      tooltip.connectorLine = createEntity('a-entity', {
        class: 'codexr-tooltip-connector-line codexr-tooltip-auxiliary',
        'data-codexr-role': 'tooltip connector line'
      });
      connectorRoot.appendChild(tooltip.connectorLine);
    }
    if (!tooltip.connectorMarker) {
      tooltip.connectorMarker = createEntity('a-sphere', {
        radius: .035,
        segmentsWidth: 10,
        segmentsHeight: 6,
        class: 'codexr-tooltip-connector-marker codexr-tooltip-auxiliary',
        'data-codexr-role': 'tooltip connector marker',
        material: 'color: #f59e0b; shader: flat; opacity: .92; transparent: true; depthTest: false'
      });
      connectorRoot.appendChild(tooltip.connectorMarker);
    }
    tooltip.connectorRoot = connectorRoot;
    tooltip.root.parentNode.appendChild(connectorRoot);
    return connectorRoot;
  }

  function updateTooltipConnector(tooltip, tooltipPosition, targetPosition, options) {
    if (!tooltip || !targetPosition || !Number.isFinite(targetPosition.x) || !Number.isFinite(targetPosition.y) || !Number.isFinite(targetPosition.z)) {
      if (tooltip && tooltip.connectorRoot) {
        tooltip.connectorRoot.setAttribute('visible', false);
      }
      return false;
    }
    var connectorRoot = ensureTooltipConnector(tooltip);
    if (!connectorRoot) {
      return false;
    }
    var opts = options || {};
    var position = tooltipPosition && Number.isFinite(tooltipPosition.x)
      ? tooltipPosition
      : { x: 0, y: 0, z: 0 };
    var height = Number(tooltip.height) || .92;
    var color = opts.connectorColor || opts.color || '#f59e0b';
    var start = opts.connectorStart || {
      x: position.x,
      y: position.y - (height * .5),
      z: position.z
    };
    var end = {
      x: targetPosition.x,
      y: targetPosition.y + (Number(opts.targetLift) || .045),
      z: targetPosition.z
    };
    tooltip.connectorLine.setAttribute('line', {
      start: formatPosition(start),
      end: formatPosition(end),
      color: color,
      opacity: Number(opts.opacity) || .88
    });
    tooltip.connectorMarker.setAttribute('position', formatPosition(end));
    tooltip.connectorMarker.setAttribute('material', 'color: ' + color + '; shader: flat; opacity: .92; transparent: true; depthTest: false');
    connectorRoot.setAttribute('visible', true);
    return true;
  }

  function updateTooltip(tooltip, detail, position, options) {
    if (!tooltip || !tooltip.root) {
      return false;
    }
    var opts = options || {};
    var model = detail || {};
    var rows = normalizeTooltipRows(model);
    // A structured metric grid (model.rows) is the compact/rich path; otherwise
    // fall back to the legacy stacked primary/secondary lines.
    var useGrid = Array.isArray(model.rows) && model.rows.length > 0;
    var columns = Math.max(1, Math.round(Number(opts.columns) || 2));
    var width = Number(opts.width) || tooltip.width || 2.8;
    var accentColor = model.accentColor || opts.accentColor || tooltip.accentColor || '#38bdf8';
    var hasSubtitle = !!model.subtitle;
    var headerH = hasSubtitle ? .5 : .34;
    var rowStep = Number(opts.rowStep) || .19;
    var footerReserve = Math.max(0, Number(opts.footerReserve) || 0);
    var gridRows = useGrid ? Math.ceil(rows.length / columns) : 0;
    var height = useGrid
      ? Math.max(Number(opts.minHeight) || .68, headerH + gridRows * rowStep + .16 + footerReserve)
      : (Number(opts.height) || tooltip.height || .9);
    var half = height / 2;
    var textX = -(width / 2) + .2;
    var textWidth = Math.max(.9, width - .4);
    var contentW = Math.max(.9, width - .42);

    var resolvedPosition = null;
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)) {
      tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
      resolvedPosition = position;
    } else if (typeof position === 'string') {
      tooltip.root.setAttribute('position', position);
    }
    tooltip.width = width;
    tooltip.height = height;
    tooltip.accentColor = accentColor;

    // Chrome (panel, accent-tinted frame, left accent bar, header swatch/divider).
    tooltip.background.setAttribute('width', width);
    tooltip.background.setAttribute('height', height);
    if (tooltip.border) {
      tooltip.border.setAttribute('width', width + .06);
      tooltip.border.setAttribute('height', height + .06);
      tooltip.border.setAttribute('material', 'color', accentColor);
    }
    tooltip.accent.setAttribute('width', .07);
    tooltip.accent.setAttribute('height', height);
    tooltip.accent.setAttribute('position', (-(width / 2) + .035) + ' 0 .008');
    tooltip.accent.setAttribute('material', 'color', accentColor);
    if (tooltip.divider) {
      tooltip.divider.setAttribute('width', width - .3);
      tooltip.divider.setAttribute('material', 'color', accentColor);
      tooltip.divider.setAttribute('position', '0 ' + (half - headerH + .05) + ' .01');
      setVisible(tooltip.divider, useGrid);
    }

    // Header.
    tooltip.title.setAttribute('position', (textX + .02) + ' ' + (half - .2) + ' .018');
    tooltip.subtitle.setAttribute('position', textX + ' ' + (half - .4) + ' .018');
    tooltip.title.setAttribute('width', textWidth);
    tooltip.subtitle.setAttribute('width', textWidth);
    tooltip.title.setAttribute('value', truncateText(model.title, opts.titleLength || 30));
    tooltip.subtitle.setAttribute('value', truncateText(model.subtitle, opts.subtitleLength || 46));
    setVisible(tooltip.subtitle, hasSubtitle);

    if (useGrid) {
      setVisible(tooltip.primary, false);
      setVisible(tooltip.secondary, false);
      var gridTop = half - headerH - .02;
      var cellW = contentW / columns;
      ensureTooltipRows(tooltip, rows.length).forEach(function (row, index) {
        var rowModel = rows[index] || {};
        var r = Math.floor(index / columns);
        var c = index % columns;
        var cellX = textX + c * cellW;
        var cellY = gridTop - r * rowStep;
        row.label.setAttribute('position', cellX + ' ' + cellY + ' .019');
        row.value.setAttribute('position', (cellX + cellW * .52) + ' ' + cellY + ' .019');
        row.label.setAttribute('width', cellW * .66);
        row.value.setAttribute('width', cellW * .52);
        row.label.setAttribute('value', truncateText(rowModel.label, opts.rowLabelLength || 12));
        row.value.setAttribute('value', truncateText(rowModel.value, opts.rowValueLength || 12));
      });
    } else {
      ensureTooltipRows(tooltip, 0);
      var secondaryY = -half + .18 + footerReserve;
      var primaryY = footerReserve > 0 ? secondaryY + .21 : -0.04;
      tooltip.primary.setAttribute('position', textX + ' ' + primaryY + ' .018');
      tooltip.secondary.setAttribute('position', textX + ' ' + secondaryY + ' .018');
      tooltip.primary.setAttribute('width', textWidth);
      tooltip.secondary.setAttribute('width', textWidth);
      tooltip.primary.setAttribute('value', truncateText(model.primary, opts.primaryLength || 62));
      tooltip.secondary.setAttribute('value', truncateText(model.secondary, opts.secondaryLength || 62));
      setVisible(tooltip.primary, !!model.primary);
      setVisible(tooltip.secondary, !!model.secondary);
    }

    tooltip.root.setAttribute('scale', '.96 .96 .96');
    tooltip.root.setAttribute('animation__codexr_tooltip_in', {
      property: 'scale',
      from: '.96 .96 .96',
      to: '1 1 1',
      dur: Number(opts.animationDuration) || 200,
      easing: 'easeOutCubic'
    });
    tooltip.root.setAttribute('visible', true);
    updateTooltipConnector(tooltip, resolvedPosition, opts.connectorTarget || model.connectorTarget || null, opts);
    return true;
  }

  function hideTooltip(tooltip) {
    if (tooltip && tooltip.root) {
      tooltip.root.setAttribute('visible', false);
    }
    if (tooltip && tooltip.connectorRoot) {
      tooltip.connectorRoot.setAttribute('visible', false);
    }
  }

  // Non-overlapping grid slot for the Nth of `count` legend cards — a shared
  // primitive so any Code-XR legend surface can lay multiple cards out without
  // them overlapping (centered rows, wrapping upward into a grid).
  function legendSlotPosition(index, count, options) {
    var opts = options || {};
    var perRow = Math.max(1, Math.round(Number(opts.perRow) || 3));
    var cardWidth = Number(opts.cardWidth) || 2.8;
    var cardHeight = Number(opts.cardHeight) || 1.1;
    var gapX = opts.gapX != null ? Number(opts.gapX) : .3;
    var gapY = opts.gapY != null ? Number(opts.gapY) : .3;
    var originX = Number(opts.originX) || 0;
    var originY = Number(opts.originY) || 0;
    var z = opts.z != null ? Number(opts.z) : 0;
    var total = Math.max(1, Number(count) || 1);
    var i = Math.max(0, Number(index) || 0);
    var row = Math.floor(i / perRow);
    var col = i % perRow;
    var itemsInRow = Math.min(perRow, total - row * perRow);
    return {
      x: originX + (col - (itemsInRow - 1) / 2) * (cardWidth + gapX),
      y: originY + row * (cardHeight + gapY),
      z: z
    };
  }

  function faceCamera(entity, scene) {
    if (!entity || !entity.object3D || !root.THREE) {
      return false;
    }
    var camera = scene?.camera || entity.sceneEl?.camera;
    if (!camera || !camera.getWorldPosition) {
      return false;
    }
    var cameraPosition = new root.THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    entity.object3D.lookAt(cameraPosition);
    return true;
  }

  // Yaw-only billboard: rotates the entity around Y (in its parent's space) so
  // it faces the camera while staying upright. Rotating a GROUP of legend cards
  // this way keeps their relative layout rigid — they follow the user without
  // ever rotating into each other.
  function faceCameraYaw(entity, scene) {
    if (!entity || !entity.object3D || !root.THREE) {
      return false;
    }
    var camera = scene?.camera || entity.sceneEl?.camera;
    if (!camera || !camera.getWorldPosition) {
      return false;
    }
    var cameraPosition = new root.THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    var parent = entity.object3D.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(cameraPosition);
    }
    var dx = cameraPosition.x - entity.object3D.position.x;
    var dz = cameraPosition.z - entity.object3D.position.z;
    entity.object3D.rotation.set(0, Math.atan2(dx, dz), 0);
    return true;
  }

  function attachPickHitbox(entity, options) {
    if (!entity || !root.THREE || typeof entity.setObject3D !== 'function') {
      return null;
    }
    var opts = options || {};
    var radius = Math.max(.001, Number(opts.radius) || .12);
    var height = Math.max(.001, Number(opts.height) || radius * 2);
    var geometry = opts.shape === 'box'
      ? new root.THREE.BoxGeometry(radius * 2, height, radius * 2)
      : new root.THREE.SphereGeometry(radius, 10, 8);
    var material = new root.THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      visible: false
    });
    var mesh = new root.THREE.Mesh(geometry, material);
    if (opts.position && mesh.position) {
      mesh.position.set(Number(opts.position.x) || 0, Number(opts.position.y) || 0, Number(opts.position.z) || 0);
    }
    entity.setObject3D(opts.name || 'codexr-hitbox', mesh);
    if (entity.classList && opts.raycastClass) {
      entity.classList.add(opts.raycastClass);
    }
    entity.setAttribute?.('data-codexr-interactive', 'true');
    return mesh;
  }

  var api = {
    createTooltip: createTooltip,
    updateTooltip: updateTooltip,
    updateTooltipConnector: updateTooltipConnector,
    hideTooltip: hideTooltip,
    legendSlotPosition: legendSlotPosition,
    faceCamera: faceCamera,
    faceCameraYaw: faceCameraYaw,
    attachPickHitbox: attachPickHitbox,
    truncateText: truncateText,
    createEntity: createEntity
  };

  root.CodeXRCommonRuntime = root.CodeXRCommonRuntime || api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
