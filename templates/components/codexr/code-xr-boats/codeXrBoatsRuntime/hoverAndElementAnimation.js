// == codeXrBoatsRuntime.js | hoverAndElementAnimation (assembled per manifest.json; see COMPONENTS.md) ==
  function animateHover(entity, active) {
    if (!entity || !entity.setAttribute) {
      return;
    }
    if (entity.getAttribute && entity.getAttribute('data-codexr-visible-body') === 'metric-envelope') {
      return;
    }
    var baseOpacity = Number(entity.getAttribute('data-codexr-base-opacity'));
    if (!Number.isFinite(baseOpacity)) {
      baseOpacity = 1;
    }
    var baseColor = entity.getAttribute('data-codexr-base-color') || extractMaterialColor(entity.getAttribute('material')) || '#ffffff';
    entity.setAttribute('animation__codexr_hover_opacity', {
      property: 'material.opacity',
      to: active ? 1 : baseOpacity,
      dur: active ? 240 : 360,
      easing: 'easeOutQuad'
    });
    entity.setAttribute('animation__codexr_hover_color', {
      property: 'material.color',
      to: active ? lightenHexColor(baseColor, 0.28) : baseColor,
      dur: active ? 260 : 420,
      easing: 'easeOutQuad'
    });
    entity.setAttribute('animation__codexr_hover_emissive', {
      property: 'material.emissive',
      to: active ? '#d9fff2' : '#000000',
      dur: active ? 260 : 420,
      easing: 'easeOutQuad'
    });
  }

  function animateElement(entity, figure, options, snapshots, target) {
    if (!entity || !figure || !options.animation) {
      return false;
    }
    var duration = Math.max(0, Number(options.animationDuration) || 0);
    if (duration <= 0) {
      return false;
    }
    var snapshotEntry = snapshots && snapshots[figure.key];
    var snapshot = snapshotEntry && (
      target.snapshotRole === 'frame'
        ? snapshotEntry.frame
        : (snapshotEntry.visual || snapshotEntry)
    );
    if (snapshot) {
      var fromPosition = resolveAnimationFromPosition(snapshot, target);
      if (fromPosition && target.position) {
        if (nearlySameVec3(fromPosition, target.position)) {
          entity.setAttribute('position', target.position);
        } else {
          entity.setAttribute('position', fromPosition);
          setAnimation(entity, 'position', 'position', fromPosition, target.position, duration);
          scheduleFinalAttribute(entity, 'position', target.position, duration);
        }
      }
      if (snapshot.width != null) {
        entity.setAttribute('width', snapshot.width);
      }
      if (snapshot.height != null) {
        entity.setAttribute('height', snapshot.height);
      }
      if (snapshot.depth != null) {
        entity.setAttribute('depth', snapshot.depth);
      }
      var fromColor = extractMaterialColor(snapshot.material);
      if (fromColor) {
        setMaterialProperty(entity, 'color', fromColor);
      }
      var fromOpacity = extractMaterialOpacity(snapshot.material, null);
      if (fromOpacity != null && Number.isFinite(fromOpacity)) {
        setMaterialProperty(entity, 'opacity', fromOpacity);
      }
      if (target.holdPlanarSize) {
        var safePlanarSize = resolveContainmentSafePlanarSize(snapshot, target);
        if (Number.isFinite(safePlanarSize.width) && safePlanarSize.width > 0) {
          entity.setAttribute('width', safePlanarSize.width);
          if (safePlanarSize.shouldHoldWidth) {
            scheduleFinalAttribute(entity, 'width', target.width, duration);
          }
        }
        if (Number.isFinite(safePlanarSize.depth) && safePlanarSize.depth > 0) {
          entity.setAttribute('depth', safePlanarSize.depth);
          if (safePlanarSize.shouldHoldDepth) {
            scheduleFinalAttribute(entity, 'depth', target.depth, duration);
          }
        }
      } else {
        setAnimation(entity, 'width', 'width', snapshot.width, target.width, duration);
        setAnimation(entity, 'depth', 'depth', snapshot.depth, target.depth, duration);
        scheduleFinalAttribute(entity, 'width', target.width, duration);
        scheduleFinalAttribute(entity, 'depth', target.depth, duration);
      }
      setAnimation(entity, 'height', 'height', snapshot.height, target.height, duration);
      setAnimation(entity, 'color', 'material.color', fromColor, target.color, duration);
      scheduleFinalAttribute(entity, 'height', target.height, duration);
      scheduleFinalMaterialProperty(entity, 'color', target.color, duration);
      if (fromOpacity != null && Number.isFinite(fromOpacity)) {
        setAnimation(entity, 'opacity', 'material.opacity', fromOpacity, target.opacity || 1, duration);
        scheduleFinalMaterialProperty(entity, 'opacity', target.opacity || 1, duration);
      }
      return true;
    }
    setMaterialProperty(entity, 'opacity', 0);
    setAnimation(entity, 'opacity', 'material.opacity', 0, target.opacity || 1, duration);
    scheduleFinalMaterialProperty(entity, 'opacity', target.opacity || 1, duration);
    return true;
  }

  function extractMaterialColor(material) {
    if (!material) {
      return null;
    }
    if (typeof material === 'object' && material.color) {
      return material.color;
    }
    var match = String(material).match(/color:\s*([^;]+)/i);
    return match ? match[1].trim() : null;
  }

  function lightenHexColor(color, amount) {
    var text = String(color || '').trim();
    var match = text.match(/^#([0-9a-f]{6})$/i);
    if (!match) {
      return color || '#ffffff';
    }
    var hex = match[1];
    var ratio = clamp(Number(amount) || 0.18, 0, 1);
    var parts = [0, 2, 4].map(function (start) {
      var channel = parseInt(hex.slice(start, start + 2), 16);
      return Math.round(channel + ((255 - channel) * ratio));
    });
    return '#' + parts.map(function (channel) {
      return channel.toString(16).padStart(2, '0');
    }).join('');
  }
