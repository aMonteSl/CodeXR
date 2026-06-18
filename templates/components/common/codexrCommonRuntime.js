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
      align: align || 'center',
      baseline: 'center',
      'wrap-count': 46
    });
    return el;
  }

  function createTooltip(options) {
    var opts = options || {};
    var rootEl = createEntity('a-entity', { visible: false });
    if (!rootEl) {
      return null;
    }
    var width = Number(opts.width) || 3.25;
    var height = Number(opts.height) || 1.42;
    var accentColor = opts.accentColor || '#f59e0b';
    var background = createEntity('a-plane', {
      width: width,
      height: height,
      material: 'color: #0f172a; opacity: .94; shader: flat; side: double'
    });
    var accent = createEntity('a-plane', {
      position: '0 ' + ((height / 2) - .05) + ' .014',
      width: width,
      height: .08,
      material: 'color: ' + accentColor + '; shader: flat'
    });
    var title = tooltipText('', '0 .43 .018', width - .25, '#fcd34d', 'center');
    var subtitle = tooltipText('', '0 .15 .018', width - .3, '#cbd5e1', 'center');
    var primary = tooltipText('', '0 -.14 .018', width - .3, '#f8fafc', 'center');
    var secondary = tooltipText('', '0 -.41 .018', width - .3, '#94a3b8', 'center');
    title.setAttribute('wrap-count', 34);
    subtitle.setAttribute('wrap-count', 46);
    primary.setAttribute('wrap-count', 46);
    secondary.setAttribute('wrap-count', 46);
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
      width: width,
      height: height
    };
  }

  function updateTooltip(tooltip, detail, position, options) {
    if (!tooltip || !tooltip.root) {
      return false;
    }
    var opts = options || {};
    var model = detail || {};
    var height = Number(opts.height) || tooltip.height || 1.42;
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)) {
      tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
    } else if (typeof position === 'string') {
      tooltip.root.setAttribute('position', position);
    }
    tooltip.background?.setAttribute('height', height);
    tooltip.accent?.setAttribute('position', '0 ' + ((height / 2) - .05) + ' .014');
    tooltip.title?.setAttribute('value', truncateText(model.title, opts.titleLength || 42));
    tooltip.subtitle?.setAttribute('value', truncateText(model.subtitle, opts.subtitleLength || 60));
    tooltip.primary?.setAttribute('value', truncateText(model.primary, opts.primaryLength || 68));
    tooltip.secondary?.setAttribute('value', truncateText(model.secondary, opts.secondaryLength || 68));
    tooltip.root.setAttribute('visible', true);
    return true;
  }

  function hideTooltip(tooltip) {
    if (tooltip && tooltip.root) {
      tooltip.root.setAttribute('visible', false);
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
