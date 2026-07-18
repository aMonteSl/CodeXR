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
      var label = tooltipText('', '0 0 .02', .92, '#67e8f9', 'left');
      var value = tooltipText('', '0 0 .02', 2.2, '#e2e8f0', 'left');
      label.setAttribute('wrap-count', 18);
      value.setAttribute('wrap-count', 34);
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
    var width = Number(opts.width) || 3.75;
    var height = Number(opts.height) || .92;
    var accentColor = opts.accentColor || '#f59e0b';
    var background = createEntity('a-plane', {
      width: width,
      height: height,
      material: 'color: #0b1220; opacity: .96; shader: flat; side: double; transparent: true; depthTest: false'
    });
    var accent = createEntity('a-plane', {
      position: '0 ' + ((height / 2) - .035) + ' .014',
      width: width,
      height: .07,
      material: 'color: ' + accentColor + '; shader: flat; depthTest: false'
    });
    var textX = -(width / 2) + .22;
    var title = tooltipText('', textX + ' .26 .018', width - .44, '#fcd34d', 'left');
    var subtitle = tooltipText('', textX + ' .06 .018', width - .44, '#cbd5e1', 'left');
    var primary = tooltipText('', textX + ' -.14 .018', width - .44, '#f8fafc', 'left');
    var secondary = tooltipText('', textX + ' -.33 .018', width - .44, '#94a3b8', 'left');
    title.setAttribute('wrap-count', 30);
    subtitle.setAttribute('wrap-count', 42);
    primary.setAttribute('wrap-count', 42);
    secondary.setAttribute('wrap-count', 42);
    rootEl.appendChild(background);
    rootEl.appendChild(accent);
    rootEl.appendChild(title);
    rootEl.appendChild(subtitle);
    rootEl.appendChild(primary);
    rootEl.appendChild(secondary);
    return {
      root: rootEl,
      background: background,
      accent: accent,
      title: title,
      subtitle: subtitle,
      primary: primary,
      secondary: secondary,
      action: null,
      rows: [],
      width: width,
      height: height
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
    var hasExplicitRows = Array.isArray(model.rows) && model.rows.length > 0;
    var rowStep = Number(opts.rowStep) || .16;
    var autoHeight = hasExplicitRows && opts.autoHeight !== false;
    var height = autoHeight
      ? Math.max(Number(opts.minHeight) || .92, .66 + rows.length * rowStep)
      : (Number(opts.height) || tooltip.height || .92);
    var width = Number(opts.width) || tooltip.width || 3.75;
    var textWidth = Math.max(1.2, width - .44);
    var textX = -(width / 2) + .22;
    var titleY = (height / 2) - .18;
    var subtitleY = (height / 2) - .37;
    var footerReserve = Math.max(0, Number(opts.footerReserve) || 0);
    var secondaryY = -(height / 2) + .18 + footerReserve;
    var primaryY = footerReserve > 0 ? secondaryY + .21 : -0.06;
    var resolvedPosition = null;
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)) {
      tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
      resolvedPosition = position;
    } else if (typeof position === 'string') {
      tooltip.root.setAttribute('position', position);
    }
    tooltip.width = width;
    tooltip.height = height;
    tooltip.background.setAttribute('width', width);
    tooltip.background?.setAttribute('height', height);
    tooltip.accent.setAttribute('position', '0 ' + ((height / 2) - .035) + ' .014');
    tooltip.accent.setAttribute('width', width);
    tooltip.title.setAttribute('position', textX + ' ' + titleY + ' .018');
    tooltip.subtitle.setAttribute('position', textX + ' ' + subtitleY + ' .018');
    tooltip.primary.setAttribute('position', textX + ' ' + primaryY + ' .018');
    tooltip.secondary.setAttribute('position', textX + ' ' + secondaryY + ' .018');
    tooltip.title.setAttribute('width', textWidth);
    tooltip.subtitle.setAttribute('width', textWidth);
    tooltip.primary.setAttribute('width', textWidth);
    tooltip.secondary.setAttribute('width', textWidth);
    tooltip.title?.setAttribute('value', truncateText(model.title, opts.titleLength || 42));
    tooltip.subtitle?.setAttribute('value', truncateText(model.subtitle, opts.subtitleLength || 60));
    tooltip.primary?.setAttribute('value', truncateText(model.primary, opts.primaryLength || 68));
    tooltip.secondary?.setAttribute('value', truncateText(model.secondary, opts.secondaryLength || 68));
    if (hasExplicitRows) {
      setVisible(tooltip.primary, false);
      setVisible(tooltip.secondary, false);
      ensureTooltipRows(tooltip, rows.length).forEach(function (row, index) {
        var rowModel = rows[index] || {};
        var y = (height / 2) - 0.56 - (index * rowStep);
        row.label.setAttribute('position', textX + ' ' + y + ' .019');
        row.value.setAttribute('position', (textX + .98) + ' ' + y + ' .019');
        row.label.setAttribute('width', .9);
        row.value.setAttribute('width', Math.max(1.25, textWidth - 1.06));
        row.label.setAttribute('value', truncateText(rowModel.label, opts.rowLabelLength || 14));
        row.value.setAttribute('value', truncateText(rowModel.value, opts.rowValueLength || 38));
      });
    } else {
      setVisible(tooltip.primary, true);
      setVisible(tooltip.secondary, true);
      ensureTooltipRows(tooltip, 0);
    }
    tooltip.root.setAttribute('scale', '.96 .96 .96');
    tooltip.root.setAttribute('animation__codexr_tooltip_in', {
      property: 'scale',
      from: '.96 .96 .96',
      to: '1 1 1',
      dur: Number(opts.animationDuration) || 220,
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
    faceCamera: faceCamera,
    attachPickHitbox: attachPickHitbox,
    truncateText: truncateText,
    createEntity: createEntity
  };

  root.CodeXRCommonRuntime = root.CodeXRCommonRuntime || api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
