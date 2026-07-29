// == analysisTableRuntime.js | boatsLayoutStability (assembled per manifest.json; see COMPONENTS.md) ==
  var BOATS_LAYOUT_STABILITY_OWNER_KEY = '__codexrBoatsLayoutStability';
  var DEFAULT_BOATS_INITIAL_SCALE_Y = 0.05;

  function positiveFiniteNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function parseScaleY(value) {
    if (value && typeof value === 'object') {
      return positiveFiniteNumber(value.y);
    }
    if (typeof value !== 'string') {
      return null;
    }
    var parts = value.trim().split(/\s+/);
    return parts.length >= 2 ? positiveFiniteNumber(parts[1]) : null;
  }

  function computeStableBoatsZoneElevation(zoneElevation, referenceScaleY, currentScaleY) {
    var zone = positiveFiniteNumber(zoneElevation);
    var reference = positiveFiniteNumber(referenceScaleY);
    var current = positiveFiniteNumber(currentScaleY);
    if (zone === null || reference === null || current === null) {
      return null;
    }
    return (zone / reference) * current;
  }

  function resolveBoatsReferenceScaleY(el, data) {
    var configured = positiveFiniteNumber(data && data.referenceScaleY);
    if (configured !== null) {
      return configured;
    }
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var presentation = mappingRuntime
      && typeof mappingRuntime.getChartPresentation === 'function'
      ? mappingRuntime.getChartPresentation('boats')
      : null;
    return parseScaleY(presentation && presentation.initialScale)
      || DEFAULT_BOATS_INITIAL_SCALE_Y;
  }

  function resolveCurrentChartScaleY(el) {
    var objectScale = positiveFiniteNumber(el && el.object3D && el.object3D.scale
      ? el.object3D.scale.y
      : null);
    if (objectScale !== null) {
      return objectScale;
    }
    return parseScaleY(el && typeof el.getAttribute === 'function'
      ? el.getAttribute('scale')
      : null);
  }

  var boatsLayoutStabilityDefinition = {
    schema: {
      enabled: { default: true },
      referenceScaleY: { type: 'number', default: 0 }
    },

    init: function () {
      this.boatsComponent = null;
      this.originalGenerateElements = null;
      this.wrappedGenerateElements = null;
      this.layoutDepth = 0;
      this.onComponentInitialized = this.onComponentInitialized.bind(this);
      this.onComponentRemoved = this.onComponentRemoved.bind(this);
      this.el.addEventListener?.('componentinitialized', this.onComponentInitialized);
      this.el.addEventListener?.('componentremoved', this.onComponentRemoved);
      if (this.data.enabled) {
        this.attachToCurrentBoats();
      }
    },

    update: function () {
      if (!this.data.enabled) {
        this.detachFromBoats();
        return;
      }
      this.attachToCurrentBoats();
    },

    tick: function () {
      if (!this.data.enabled) {
        return;
      }
      var current = this.el.components && this.el.components['babia-boats'];
      if (current !== this.boatsComponent
        || (current && current.generateElements !== this.wrappedGenerateElements)) {
        this.attachToCurrentBoats();
      }
    },

    onComponentInitialized: function (event) {
      if (event && event.detail && event.detail.name === 'babia-boats' && this.data.enabled) {
        this.attachToCurrentBoats();
      }
    },

    onComponentRemoved: function (event) {
      if (event && event.detail && event.detail.name === 'babia-boats') {
        this.detachFromBoats();
      }
    },

    attachToCurrentBoats: function () {
      var boats = this.el.components && this.el.components['babia-boats'];
      if (!boats || typeof boats.generateElements !== 'function') {
        if (this.boatsComponent && this.boatsComponent !== boats) {
          this.detachFromBoats();
        }
        return false;
      }
      if (boats === this.boatsComponent
        && boats.generateElements === this.wrappedGenerateElements) {
        return true;
      }

      this.detachFromBoats();
      var existingOwner = boats[BOATS_LAYOUT_STABILITY_OWNER_KEY];
      if (existingOwner && existingOwner.owner !== this) {
        return false;
      }

      var owner = this;
      var original = boats.generateElements;
      var wrapped = function () {
        if (!owner.data.enabled || owner.layoutDepth > 0) {
          return original.apply(this, arguments);
        }
        var publicZoneElevation = boats.data && boats.data.zone_elevation;
        var effectiveZoneElevation = computeStableBoatsZoneElevation(
          publicZoneElevation,
          resolveBoatsReferenceScaleY(owner.el, owner.data),
          resolveCurrentChartScaleY(owner.el)
        );
        if (effectiveZoneElevation === null) {
          return original.apply(this, arguments);
        }

        owner.layoutDepth += 1;
        boats.data.zone_elevation = effectiveZoneElevation;
        try {
          return original.apply(this, arguments);
        } finally {
          boats.data.zone_elevation = publicZoneElevation;
          owner.layoutDepth -= 1;
        }
      };

      this.boatsComponent = boats;
      this.originalGenerateElements = original;
      this.wrappedGenerateElements = wrapped;
      boats[BOATS_LAYOUT_STABILITY_OWNER_KEY] = {
        owner: this,
        original: original,
        wrapped: wrapped
      };
      boats.generateElements = wrapped;
      return true;
    },

    detachFromBoats: function () {
      var boats = this.boatsComponent;
      if (!boats) {
        return false;
      }
      var marker = boats[BOATS_LAYOUT_STABILITY_OWNER_KEY];
      if (marker && marker.owner === this) {
        if (boats.generateElements === marker.wrapped) {
          boats.generateElements = marker.original;
        }
        delete boats[BOATS_LAYOUT_STABILITY_OWNER_KEY];
      } else if (boats.generateElements === this.wrappedGenerateElements) {
        boats.generateElements = this.originalGenerateElements;
      }
      this.boatsComponent = null;
      this.originalGenerateElements = null;
      this.wrappedGenerateElements = null;
      this.layoutDepth = 0;
      return true;
    },

    remove: function () {
      this.detachFromBoats();
      this.el.removeEventListener?.('componentinitialized', this.onComponentInitialized);
      this.el.removeEventListener?.('componentremoved', this.onComponentRemoved);
    }
  };

  if (registerBoatsLayoutStability) {
    AFRAME.registerComponent(
      BOATS_LAYOUT_STABILITY_COMPONENT_NAME,
      boatsLayoutStabilityDefinition
    );
  }
