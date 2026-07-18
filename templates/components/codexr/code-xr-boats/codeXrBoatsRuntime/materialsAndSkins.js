// == codeXrBoatsRuntime.js | materialsAndSkins (assembled per manifest.json; see COMPONENTS.md) ==
  function textureMaterial(textureUrl, opacity) {
    var safeOpacity = clamp(toFiniteNumber(opacity, 0.58), 0, 1);
    return [
      'src: url(' + textureUrl + ')',
      'color: #ffffff',
      'opacity: ' + safeOpacity,
      'transparent: true',
      'shader: flat',
      'side: double',
      'depthWrite: false'
    ].join('; ');
  }

  function skinAccentMaterial(profile, color, opacity) {
    var resolvedOpacity = Number.isFinite(opacity) ? opacity : profile.opacity || 0.3;
    return [
      'color: ' + (color || profile.accent || '#ffffff'),
      'opacity: ' + resolvedOpacity,
      'transparent: true',
      'shader: flat',
      'depthWrite: false'
    ].join('; ');
  }

  function appendTemporalSkinBox(parent, figure, profile, name, dimensions, position, color, opacity) {
    parent.appendChild(createEntity('a-box', {
      width: Math.max(0.001, dimensions.width),
      depth: Math.max(0.001, dimensions.depth),
      height: Math.max(0.001, dimensions.height),
      position: position.x + ' ' + position.y + ' ' + position.z,
      material: skinAccentMaterial(profile, color, opacity),
      class: AUX_CLASS,
      'data-codexr-role': 'aux temporal-skin',
      'data-codexr-boats-skin': name,
      'data-codexr-temporal-tier': figure.temporalTier || 'current'
    }));
  }

  function shapeMaterial(profile, color, opacity) {
    return [
      'color: ' + (color || profile.accent || '#ffffff'),
      'opacity: ' + clamp(toFiniteNumber(opacity, 0.48), 0, 1),
      'transparent: true',
      'shader: flat',
      'depthWrite: false',
      'roughness: 0.72',
      'metalness: 0.04'
    ].join('; ');
  }

  function metricEnvelopeMaterial() {
    return [
      'color: #ffffff',
      'opacity: 0.001',
      'transparent: true',
      'shader: flat',
      'depthWrite: false'
    ].join('; ');
  }

  function visiblePieceMaterial(color) {
    var visualStyle = getVisualStyleRuntime();
    return visualStyle.buildMetricBodyMaterialString
      ? visualStyle.buildMetricBodyMaterialString(color || '#6b7280')
      : 'color: ' + (color || '#6b7280') + '; opacity: 1; transparent: false; roughness: 0.68; metalness: 0.08; emissive: #000000';
  }

  function buildTemporalShapeDescriptors(figure, profile) {
    if (!figure || !profile) {
      return [];
    }
    var shape = profile.shape || (profile.skin === 'fresh' ? 'modern' : profile.skin === 'legacy' ? 'heritage' : profile.skin === 'aged' ? 'ruin' : 'standard');
    var width = Math.max(0.001, figure.width);
    var depth = Math.max(0.001, figure.depth);
    var height = Math.max(0.001, figure.height);
    var halfWidth = width * 0.5;
    var halfDepth = depth * 0.5;
    var halfHeight = height * 0.5;
    var baseY = -halfHeight;
    var topY = halfHeight;
    var minUnit = Math.max(0.008, Math.min(width, depth, height) * 0.045);
    var descriptors = [];

    var addBox = function (name, dimensions, position, color, opacity) {
      var safeDimensions = {
        width: Math.max(0.001, Math.min(width, dimensions.width)),
        depth: Math.max(0.001, Math.min(depth, dimensions.depth)),
        height: Math.max(0.001, Math.min(height, dimensions.height))
      };
      var clampedPosition = {
        x: clamp(position.x, -halfWidth + safeDimensions.width * 0.5, halfWidth - safeDimensions.width * 0.5),
        y: clamp(position.y, baseY + safeDimensions.height * 0.5, topY - safeDimensions.height * 0.5),
        z: clamp(position.z, -halfDepth + safeDimensions.depth * 0.5, halfDepth - safeDimensions.depth * 0.5)
      };
      descriptors.push({
        tag: 'a-box',
        name: name,
        shape: shape,
        dimensions: safeDimensions,
        position: clampedPosition,
        attributes: {
          width: safeDimensions.width,
          depth: safeDimensions.depth,
          height: safeDimensions.height,
          position: clampedPosition.x + ' ' + clampedPosition.y + ' ' + clampedPosition.z,
          material: visiblePieceMaterial(figure.color || color || profile.accent),
          class: AUX_CLASS,
          'data-codexr-role': 'aux temporal-shape',
          'data-codexr-boats-shape': name,
          'data-codexr-temporal-tier': figure.temporalTier || 'current'
        },
        bounds: {
          minX: clampedPosition.x - safeDimensions.width * 0.5,
          maxX: clampedPosition.x + safeDimensions.width * 0.5,
          minY: clampedPosition.y - safeDimensions.height * 0.5,
          maxY: clampedPosition.y + safeDimensions.height * 0.5,
          minZ: clampedPosition.z - safeDimensions.depth * 0.5,
          maxZ: clampedPosition.z + safeDimensions.depth * 0.5
        }
      });
    };

    if (shape === 'ruin') {
      addBox('aged-ruin-main-low', { width: width * 0.68, depth: depth * 0.72, height: height * 0.58 }, { x: -width * 0.08, y: baseY + height * 0.29, z: depth * 0.03 }, profile.accent, 1);
      addBox('aged-ruin-rear-tower', { width: width * 0.34, depth: depth * 0.36, height: height * 0.82 }, { x: width * 0.22, y: baseY + height * 0.41, z: -depth * 0.23 }, profile.secondary, 1);
      addBox('aged-ruin-front-fragment', { width: width * 0.28, depth: depth * 0.28, height: height * 0.36 }, { x: -width * 0.31, y: baseY + height * 0.18, z: halfDepth - depth * 0.14 }, profile.highlight, 1);
      addBox('aged-ruin-broken-chimney', { width: Math.max(minUnit, width * 0.1), depth: Math.max(minUnit, depth * 0.12), height: height * 0.46 }, { x: halfWidth - width * 0.08, y: baseY + height * 0.23, z: -halfDepth + depth * 0.1 }, profile.secondary, 1);
      addBox('aged-ruin-offset-roof', { width: width * 0.5, depth: depth * 0.46, height: Math.max(minUnit, height * 0.08) }, { x: width * 0.04, y: baseY + height * 0.62, z: -depth * 0.08 }, profile.highlight, 1);
      return descriptors;
    }

    if (shape === 'heritage') {
      addBox('legacy-main-house', { width: width * 0.78, depth: depth * 0.78, height: height * 0.66 }, { x: 0, y: baseY + height * 0.33, z: 0 }, profile.accent, 1);
      addBox('legacy-front-annex', { width: width * 0.44, depth: depth * 0.34, height: height * 0.42 }, { x: -width * 0.12, y: baseY + height * 0.21, z: halfDepth - depth * 0.17 }, profile.secondary, 1);
      addBox('legacy-left-gable-roof', { width: width * 0.46, depth: depth * 0.9, height: Math.max(minUnit, height * 0.14) }, { x: -width * 0.13, y: baseY + height * 0.73, z: 0 }, profile.highlight, 1);
      addBox('legacy-right-gable-roof', { width: width * 0.46, depth: depth * 0.9, height: Math.max(minUnit, height * 0.14) }, { x: width * 0.13, y: baseY + height * 0.73, z: 0 }, profile.highlight, 1);
      addBox('legacy-wide-plinth', { width: width * 0.92, depth: depth * 0.9, height: height * 0.1 }, { x: 0, y: baseY + height * 0.05, z: 0 }, profile.secondary, 1);
      addBox('legacy-side-chimney', { width: Math.max(minUnit, width * 0.09), depth: Math.max(minUnit, depth * 0.12), height: height * 0.42 }, { x: halfWidth - width * 0.1, y: baseY + height * 0.52, z: -depth * 0.18 }, profile.accent, 1);
      return descriptors;
    }

    if (shape === 'modern') {
      addBox('fresh-central-tower', { width: width * 0.38, depth: depth * 0.58, height: height * 0.96 }, { x: width * 0.03, y: baseY + height * 0.48, z: 0 }, profile.secondary, 1);
      addBox('fresh-left-wing', { width: width * 0.34, depth: depth * 0.42, height: height * 0.56 }, { x: -width * 0.27, y: baseY + height * 0.28, z: depth * 0.08 }, profile.accent, 1);
      addBox('fresh-right-wing', { width: width * 0.28, depth: depth * 0.48, height: height * 0.68 }, { x: width * 0.31, y: baseY + height * 0.34, z: -depth * 0.06 }, profile.accent, 1);
      addBox('fresh-glass-crown', { width: width * 0.46, depth: depth * 0.64, height: height * 0.12 }, { x: width * 0.03, y: topY - height * 0.06, z: 0 }, profile.highlight, 1);
      addBox('fresh-left-fin', { width: Math.max(minUnit, width * 0.055), depth: depth * 0.74, height: height * 0.88 }, { x: -width * 0.19, y: baseY + height * 0.44, z: 0 }, profile.highlight, 1);
      addBox('fresh-right-fin', { width: Math.max(minUnit, width * 0.055), depth: depth * 0.74, height: height * 0.88 }, { x: width * 0.25, y: baseY + height * 0.44, z: 0 }, profile.highlight, 1);
      return descriptors;
    }

    addBox('current-main-block', { width: width * 0.72, depth: depth * 0.72, height: height * 0.82 }, { x: -width * 0.04, y: baseY + height * 0.41, z: 0 }, profile.accent, 1);
    addBox('current-service-side', { width: width * 0.22, depth: depth * 0.5, height: height * 0.58 }, { x: halfWidth - width * 0.11, y: baseY + height * 0.29, z: -depth * 0.04 }, profile.secondary, 1);
    addBox('current-entry-base', { width: width * 0.42, depth: Math.max(minUnit, depth * 0.18), height: height * 0.24 }, { x: -width * 0.08, y: baseY + height * 0.12, z: halfDepth - depth * 0.09 }, profile.highlight, 1);
    addBox('current-flat-parapet', { width: width * 0.78, depth: depth * 0.78, height: Math.max(minUnit, height * 0.07) }, { x: -width * 0.04, y: baseY + height * 0.855, z: 0 }, profile.secondary, 1);
    return descriptors;
  }

  function appendTemporalShapeDescriptor(parent, descriptor) {
    if (!descriptor || !descriptor.tag) {
      return;
    }
    parent.appendChild(createEntity(descriptor.tag, descriptor.attributes || {}));
  }

  function renderTemporalShape(parent, figure, profile) {
    buildTemporalShapeDescriptors(figure, profile).forEach(function (descriptor) {
      appendTemporalShapeDescriptor(parent, descriptor);
    });
  }

  function appendVisibleBuildingPiece(parent, descriptor, figure, profile, options) {
    if (!parent || !descriptor || !descriptor.tag || !descriptor.dimensions) {
      return null;
    }
    var piece = createEntity(descriptor.tag, descriptor.attributes || {});
    var pieceFigure = {
      width: descriptor.dimensions.width,
      depth: descriptor.dimensions.depth,
      height: descriptor.dimensions.height,
      temporalTier: figure.temporalTier || 'current'
    };
    buildTemporalSkinDescriptors(pieceFigure, profile, options && options.temporalSkinTextureBase).forEach(function (skinDescriptor) {
      if (!skinDescriptor || skinDescriptor.type === 'silhouette') {
        return;
      }
      appendTemporalSkinDescriptor(piece, skinDescriptor);
    });
    parent.appendChild(piece);
    return piece;
  }

  function renderVisibleBuildingPieces(parent, figure, profile, options) {
    var descriptors = buildTemporalShapeDescriptors(figure, profile);
    descriptors.forEach(function (descriptor) {
      appendVisibleBuildingPiece(parent, descriptor, figure, profile, options);
    });
    return descriptors.length;
  }

  function buildTemporalSkinDescriptors(figure, profile, textureBase) {
    if (!figure || !profile) {
      return [];
    }
    var visualStyle = getVisualStyleRuntime();
    var assets = visualStyle.getTemporalSkinAssets
      ? visualStyle.getTemporalSkinAssets(figure.temporalTier || profile.tier || 'current', textureBase)
      : {
        wall: (textureBase || './assets/codexr/code-xr-boats/temporal-skins') + '/' + (figure.temporalTier || 'current') + '-wall.svg',
        roof: (textureBase || './assets/codexr/code-xr-boats/temporal-skins') + '/' + (figure.temporalTier || 'current') + '-roof.svg',
        wallOpacity: 0.58,
        roofOpacity: 0.52,
        silhouette: profile.skin || 'current'
      };
    var descriptors = [];
    var skin = profile.skin || figure.temporalTier || 'current';
    var frontZ = (figure.depth * 0.5) + 0.003;
    var backZ = (-figure.depth * 0.5) - 0.003;
    var sideX = (figure.width * 0.5) + 0.003;
    var otherSideX = (-figure.width * 0.5) - 0.003;
    var topY = (figure.height * 0.5) + 0.003;
    var baseY = (-figure.height * 0.5) + Math.max(0.006, figure.height * 0.045);
    var lineWidth = clamp(figure.width * 0.045, 0.008, 0.035);
    var thinDepth = 0.006;
    var bandHeight = clamp(figure.height * 0.045, 0.008, 0.04);

    var addPlane = function (name, width, height, position, rotation, textureUrl, opacity) {
      descriptors.push({
        tag: 'a-plane',
        name: name,
        attributes: {
          width: Math.max(0.001, width),
          height: Math.max(0.001, height),
          position: position.x + ' ' + position.y + ' ' + position.z,
          rotation: rotation,
          material: textureMaterial(textureUrl, opacity),
          class: AUX_CLASS,
          'data-codexr-role': 'aux temporal-skin',
          'data-codexr-boats-skin': name,
          'data-codexr-temporal-tier': figure.temporalTier || 'current',
          'data-codexr-skin-asset': textureUrl
        }
      });
    };

    addPlane('wall-front', figure.width * 1.01, figure.height * 1.01, { x: 0, y: 0, z: frontZ }, '0 0 0', assets.wall, assets.wallOpacity);
    addPlane('wall-back', figure.width * 1.01, figure.height * 1.01, { x: 0, y: 0, z: backZ }, '0 180 0', assets.wall, assets.wallOpacity * 0.86);
    addPlane('wall-right', figure.depth * 1.01, figure.height * 1.01, { x: sideX, y: 0, z: 0 }, '0 90 0', assets.wall, assets.wallOpacity * 0.82);
    addPlane('wall-left', figure.depth * 1.01, figure.height * 1.01, { x: otherSideX, y: 0, z: 0 }, '0 -90 0', assets.wall, assets.wallOpacity * 0.82);
    addPlane('roof', figure.width * 1.01, figure.depth * 1.01, { x: 0, y: topY, z: 0 }, '-90 0 0', assets.roof, assets.roofOpacity);

    return descriptors.concat([{ type: 'silhouette', skin: skin, assets: assets, baseY: baseY, topY: topY, lineWidth: lineWidth, thinDepth: thinDepth, bandHeight: bandHeight, frontZ: frontZ, sideX: sideX }]);
  }

  function appendTemporalSkinDescriptor(parent, descriptor) {
    if (!descriptor || !descriptor.tag) {
      return;
    }
    parent.appendChild(createEntity(descriptor.tag, descriptor.attributes || {}));
  }

  function renderTemporalSkin(parent, figure, profile, options) {
    if (!parent || !figure || !profile) {
      return;
    }
    var descriptors = buildTemporalSkinDescriptors(figure, profile, options && options.temporalSkinTextureBase);
    descriptors.forEach(function (descriptor) {
      if (!descriptor || descriptor.type === 'silhouette') {
        return;
      }
      appendTemporalSkinDescriptor(parent, descriptor);
    });
    var silhouette = descriptors.find ? descriptors.find(function (descriptor) { return descriptor && descriptor.type === 'silhouette'; }) : null;
    var skin = (silhouette && silhouette.skin) || profile.skin || figure.temporalTier || 'current';
    var frontZ = silhouette ? silhouette.frontZ : ((figure.depth * 0.5) + 0.003);
    var sideX = silhouette ? silhouette.sideX : ((figure.width * 0.5) + 0.003);
    var topY = silhouette ? silhouette.topY : ((figure.height * 0.5) + 0.003);
    var baseY = silhouette ? silhouette.baseY : ((-figure.height * 0.5) + Math.max(0.006, figure.height * 0.045));
    var lineWidth = silhouette ? silhouette.lineWidth : clamp(figure.width * 0.045, 0.008, 0.035);
    var thinDepth = silhouette ? silhouette.thinDepth : 0.006;
    var bandHeight = silhouette ? silhouette.bandHeight : clamp(figure.height * 0.045, 0.008, 0.04);

    if (skin === 'legacy') {
      appendTemporalSkinBox(parent, figure, profile, 'legacy-plinth', {
        width: figure.width * 1.03,
        depth: thinDepth,
        height: bandHeight * 1.7
      }, { x: 0, y: baseY, z: frontZ }, profile.secondary, 0.52);
      appendTemporalSkinBox(parent, figure, profile, 'legacy-cornice', {
        width: figure.width * 1.05,
        depth: figure.depth * 1.05,
        height: bandHeight
      }, { x: 0, y: topY - bandHeight * 0.5, z: 0 }, profile.accent, 0.42);
      [-0.25, 0.04, 0.28].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'legacy-crack-' + index, {
          width: lineWidth * (index === 1 ? 0.72 : 1),
          depth: thinDepth,
          height: figure.height * (index === 1 ? 0.58 : 0.76)
        }, { x: figure.width * offset, y: figure.height * (index === 1 ? -0.05 : 0.03), z: frontZ + 0.001 }, profile.accent, 0.5);
      });
      return;
    }

    if (skin === 'aged') {
      [-0.22, 0.05, 0.32].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'aged-band-' + index, {
          width: figure.width * 1.02,
          depth: thinDepth,
          height: bandHeight
        }, { x: 0, y: figure.height * offset, z: frontZ }, index === 1 ? profile.secondary : profile.accent, 0.34);
      });
      appendTemporalSkinBox(parent, figure, profile, 'aged-top-edge', {
        width: figure.width * 0.86,
        depth: figure.depth * 0.86,
        height: bandHeight
      }, { x: 0, y: topY - bandHeight * 0.5, z: 0 }, profile.secondary, 0.38);
      return;
    }

    if (skin === 'fresh') {
      [-0.28, 0, 0.28].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'fresh-light-' + index, {
          width: Math.max(0.006, lineWidth * 0.65),
          depth: thinDepth,
          height: figure.height * 0.86
        }, { x: figure.width * offset, y: 0, z: frontZ + 0.001 }, index === 1 ? profile.highlight : profile.secondary, index === 1 ? 0.56 : 0.42);
      });
      appendTemporalSkinBox(parent, figure, profile, 'fresh-crown', {
        width: figure.width * 0.86,
        depth: figure.depth * 0.86,
        height: Math.max(0.01, bandHeight * 0.8)
      }, { x: 0, y: topY + bandHeight * 0.2, z: 0 }, profile.highlight, 0.44);
      return;
    }

    [-0.22, 0.22].forEach(function (offset, index) {
      appendTemporalSkinBox(parent, figure, profile, 'current-pane-' + index, {
        width: Math.max(0.01, figure.width * 0.18),
        depth: thinDepth,
        height: figure.height * 0.78
      }, { x: figure.width * offset, y: 0, z: frontZ }, index ? profile.secondary : profile.accent, 0.3);
    });
    appendTemporalSkinBox(parent, figure, profile, 'current-side-pane', {
      width: thinDepth,
      depth: figure.depth * 0.52,
      height: figure.height * 0.72
    }, { x: sideX, y: 0, z: 0 }, profile.highlight, 0.18);
  }
