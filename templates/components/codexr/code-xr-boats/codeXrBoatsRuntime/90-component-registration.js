// == codeXrBoatsRuntime.js | part 90: component-registration (assembled with its siblings; see COMPONENTS.md) ==
  function readSourceData(component) {
    var data = component.data || {};
    if (data.data) {
      return parseJson(data.data, []);
    }
    if (!data.from || !getDocument()) {
      return [];
    }
    var sourceEl = getDocument().getElementById(data.from);
    var sourceComponent = sourceEl && sourceEl.components && (
      sourceEl.components['babia-treebuilder']
      || sourceEl.components['babia-queryjson']
      || sourceEl.components['babia-filter']
    );
    if (sourceComponent && sourceComponent.notiBuffer && sourceComponent.notiBuffer.data !== undefined) {
      return sourceComponent.notiBuffer.data;
    }
    if (sourceComponent && sourceComponent.babiaData !== undefined) {
      return sourceComponent.babiaData;
    }
    return [];
  }

  function scheduleSourceRetry(component) {
    if (component.sourceRetryTimer || !component.data || !component.data.from) {
      return;
    }
    if (component.sourceRetryCount > 20) {
      return;
    }
    component.sourceRetryCount += 1;
    component.sourceRetryTimer = setTimeout(function () {
      component.sourceRetryTimer = null;
      subscribeToSource(component, {});
      component.processData(readSourceData(component));
    }, 100);
  }

  function subscribeToSource(component, oldData) {
    var data = component.data || {};
    if (component.prodComponent && component.notiBufferId !== undefined && oldData && oldData.from !== data.from) {
      component.prodComponent.notiBuffer.unregister?.(component.notiBufferId);
      component.prodComponent = null;
      component.notiBufferId = undefined;
    }
    if (!data.from || component.prodComponent || !getDocument()) {
      return;
    }
    var sourceEl = getDocument().getElementById(data.from);
    var sourceComponent = sourceEl && sourceEl.components && (
      sourceEl.components['babia-treebuilder']
      || sourceEl.components['babia-queryjson']
      || sourceEl.components['babia-filter']
    );
    if (!sourceComponent || !sourceComponent.notiBuffer || typeof sourceComponent.notiBuffer.register !== 'function') {
      scheduleSourceRetry(component);
      return;
    }
    component.prodComponent = sourceComponent;
    component.sourceRetryCount = 0;
    component.notiBufferId = sourceComponent.notiBuffer.register(function (nextData) {
      component.processData(nextData);
    });
  }

  function buildOptions(data) {
    return {
      areaField: data.area || 'area',
      heightField: data.height || 'height',
      colorField: data.color || 'color',
      field: data.field || 'uid',
      palette: data.palette || 'ubuntu',
      border: Math.max(0, toFiniteNumber(data.border, 0.5)),
      extra: Math.max(0, toFiniteNumber(data.extra, 1)),
      separation: Math.max(0, toFiniteNumber(data.separation, 0.5)),
      zoneElevation: Math.max(0.001, toFiniteNumber(data.zone_elevation, 0.01)),
      zoneStepThickness: Math.max(0.001, toFiniteNumber(data.zone_step_thickness, 0.012)),
      zoneStepRise: Math.max(0.001, toFiniteNumber(data.zone_step_rise, 0.018)),
      minBuildingHeight: Math.max(0.001, toFiniteNumber(data.minBuildingHeight, 0.22)),
      maxBuildingHeight: Math.max(0.05, toFiniteNumber(data.maxBuildingHeight, 2)),
      baseColor: data.base_color || '#98e690',
      zoneBaseColor: data.zone_base_color || data.base_color || '#4f9e54',
      zoneTopColor: data.zone_top_color || '#b8f7b0',
      baseAlpha: clamp(toFiniteNumber(data.baseAlpha, 1), 0, 1),
      buildingAlpha: clamp(toFiniteNumber(data.buildingAlpha, 1), 0, 1),
      legend: data.legend !== false,
      legendText: data.legend_text || '{name}',
      legendScale: toFiniteNumber(data.legend_scale, 1),
      heightQuarterLegendBox: toFiniteNumber(data.height_quarter_legend_box, 0.01),
      heightQuarterLegendTitle: toFiniteNumber(data.height_quarter_legend_title, 2.5),
      hideQuarterBoxLegend: data.hideQuarterBoxLegend !== false,
      animation: data.animation !== false,
      animationDuration: Math.max(0, toFiniteNumber(data.animationDuration, 1200)),
      fixedSize: data.fixed_size !== false,
      fixedWidth: Math.max(0.5, toFiniteNumber(data.fixed_width, 17.8)),
      fixedDepth: Math.max(0.5, toFiniteNumber(data.fixed_depth, 6.3)),
      fixedHeight: Math.max(0.05, toFiniteNumber(data.fixed_height, 1.174)),
      fixedPadding: Math.max(0, toFiniteNumber(data.fixed_padding, 0.18)),
      temporalSkinTextureBase: data.temporalSkinTextureBase || './assets/codexr/code-xr-boats/temporal-skins'
    };
  }

  function getChartState(id) {
    if (!id) {
      return Object.keys(state.charts).map(function (key) { return state.charts[key]; });
    }
    return state.charts[id] || null;
  }

  function registerComponent(AFRAME) {
    if (!AFRAME || !AFRAME.registerComponent || AFRAME.components?.[COMPONENT]) {
      return false;
    }
    AFRAME.registerComponent(COMPONENT, {
      schema: {
        data: { type: 'string' },
        from: { type: 'string' },
        border: { type: 'number', default: 0.5 },
        area: { type: 'string', default: 'area' },
        color: { type: 'string', default: 'color' },
        height: { type: 'string', default: 'height' },
        maxBuildingHeight: { type: 'number', default: 2 },
        minBuildingHeight: { type: 'number', default: 0.22 },
        zone_elevation: { type: 'number', default: 0.01 },
        zone_step_thickness: { type: 'number', default: 0.012 },
        zone_step_rise: { type: 'number', default: 0.018 },
        separation: { type: 'number', default: 0.5 },
        extra: { type: 'number', default: 1 },
        buildingAlpha: { type: 'number', default: 1 },
        base_color: { type: 'color', default: '#98e690' },
        zone_base_color: { type: 'color', default: '#4f9e54' },
        zone_top_color: { type: 'color', default: '#b8f7b0' },
        baseAlpha: { type: 'number', default: 1 },
        height_quarter_legend_box: { type: 'number', default: 0.01 },
        height_quarter_legend_title: { type: 'number', default: 2.5 },
        height_building_legend: { type: 'number', default: -0.5 },
        legend_scale: { type: 'number', default: 0.25 },
        legend_lookat: { type: 'string', default: '[laser-controls]' },
        legend_text: { type: 'string', default: '{name}' },
        legend: { type: 'boolean', default: true },
        hideQuarterBoxLegend: { type: 'boolean', default: true },
        animation: { type: 'boolean', default: true },
        animationDuration: { type: 'number', default: 1200 },
        fixed_size: { type: 'boolean', default: true },
        fixed_width: { type: 'number', default: 17.8 },
        fixed_depth: { type: 'number', default: 6.3 },
        fixed_height: { type: 'number', default: 1.174 },
        fixed_padding: { type: 'number', default: 0.18 },
        temporalSkinTextureBase: { type: 'string', default: './assets/codexr/code-xr-boats/temporal-skins' },
        field: { type: 'string', default: 'uid' },
        palette: { type: 'string', default: 'ubuntu' },
        title: { type: 'string' },
        axis_name: { type: 'boolean', default: true }
      },
      init: function () {
        this.runtimeId = 'codexr-boats-' + Date.now() + '-' + Math.round(Math.random() * 100000);
        this.layout = null;
        this.options = buildOptions(this.data || {});
        this.sourceRetryTimer = null;
        this.sourceRetryCount = 0;
        this.tooltip = null;
        this.pinnedTooltips = {};
        this.figureElements = {};
        this.activeRenderRoot = null;
        this.pendingRenderRoot = null;
        this.animationState = { active: false, startedAt: 0, duration: 0, stableKeys: [] };
        this.animationTimer = null;
      },
      update: function (oldData) {
        this.options = buildOptions(this.data || {});
        subscribeToSource(this, oldData || {});
        this.processData(readSourceData(this));
      },
      remove: function () {
        if (this.sourceRetryTimer) {
          clearTimeout(this.sourceRetryTimer);
          this.sourceRetryTimer = null;
        }
        if (this.animationTimer) {
          clearTimeout(this.animationTimer);
          this.animationTimer = null;
        }
        this.prodComponent.notiBuffer.unregister?.(this.notiBufferId);
        removeTooltip(this);
        this.activeRenderRoot = null;
        this.pendingRenderRoot = null;
        delete state.charts[this.el.id || this.runtimeId];
      },
      tick: function () {
        if (this.tooltip && this.tooltip.root && root.CodeXRCommonRuntime.faceCamera) {
          root.CodeXRCommonRuntime.faceCamera(this.tooltip.root, this.el.sceneEl);
        }
        Object.keys(this.pinnedTooltips || {}).forEach(function (key) {
          var tooltip = this.pinnedTooltips[key];
          if (tooltip && tooltip.root && root.CodeXRCommonRuntime.faceCamera) {
            root.CodeXRCommonRuntime.faceCamera(tooltip.root, this.el.sceneEl);
          }
        }, this);
      },
      ensureTooltip: function () {
        if (this.tooltip && this.tooltip.root && this.tooltip.root.parentNode) {
          this.tooltip.root.setAttribute('class', AUX_CLASS + ' codexr-boats-tooltip');
          this.tooltip.root.setAttribute('data-codexr-role', 'tooltip overlay');
          this.tooltip.root.setAttribute('data-codexr-owner', this.el.id || this.runtimeId);
          moveTooltipToHost(this, this.tooltip);
          return this.tooltip;
        }
        this.tooltip = createBoatsTooltip(this, { accentColor: '#22d3ee', width: 3.65, height: .96 });
        return this.tooltip;
      },
      getPinnedKeys: function () {
        return Object.keys(this.pinnedTooltips || {});
      },
      isTooltipPinned: function (key) {
        return !!(key && this.pinnedTooltips && this.pinnedTooltips[key]);
      },
      updateTooltipEntity: function (tooltip, entity, figure, pinned, index) {
        if (!tooltip || !root.CodeXRCommonRuntime?.updateTooltip || !figure) {
          return false;
        }
        var detail = buildReadableTooltipDetail(figure, this.options);
        var rowCount = Array.isArray(detail && detail.rows) ? detail.rows.length : 0;
        var tooltipHeight = Math.max(.96, 0.66 + rowCount * 0.16);
        var position = getTooltipAnchor(this, entity, figure, tooltipHeight);
        if (pinned && Number.isFinite(index)) {
          position = offsetPinnedTooltipPosition(position, index, tooltipHeight);
        } else {
          position = offsetHoverTooltipPosition(position, this.getPinnedKeys ? this.getPinnedKeys().length : 0);
        }
        return root.CodeXRCommonRuntime.updateTooltip(tooltip, detail, position, {
          width: pinned ? 3.78 : 3.65,
          minHeight: .96,
          titleLength: 28,
          subtitleLength: 42,
          primaryLength: 70,
          secondaryLength: 70,
          rowLabelLength: 13,
          rowValueLength: 34,
          connectorTarget: pinned ? getFigureWorldAnchor(this, entity, figure) : null,
          connectorColor: figure.kind === 'quarter' ? '#86efac' : '#f59e0b',
          animationDuration: pinned ? 220 : 260
        });
      },
      showTooltip: function (entity, figure) {
        var tooltip = this.ensureTooltip();
        return this.updateTooltipEntity(tooltip, entity, figure, false, 0);
      },
      hideTooltip: function () {
        if (this.tooltip && root.CodeXRCommonRuntime?.hideTooltip) {
          root.CodeXRCommonRuntime.hideTooltip(this.tooltip);
          return true;
        }
        if (this.tooltip && this.tooltip.root) {
          this.tooltip.root.setAttribute('visible', false);
          return true;
        }
        return false;
      },
      clearTooltips: function () {
        removeTooltip(this);
        updatePinnedTooltipRuntimeCount(this);
        return true;
      },
      togglePinnedTooltip: function (entity, figure) {
        if (!figure || !figure.key) {
          return false;
        }
        if (this.pinnedTooltips[figure.key]) {
          removeTooltipRoot(this.pinnedTooltips[figure.key]);
          delete this.pinnedTooltips[figure.key];
          updatePinnedTooltipRuntimeCount(this);
          return true;
        }
        var tooltip = createBoatsTooltip(this, {
          accentColor: figure.kind === 'quarter' ? '#86efac' : '#f59e0b',
          width: 3.78,
          height: 1.02,
          key: figure.key,
          pinned: true
        });
        if (!tooltip) {
          return false;
        }
        this.pinnedTooltips[figure.key] = tooltip;
        this.hideTooltip();
        var updated = this.updateTooltipEntity(tooltip, entity, figure, true, this.getPinnedKeys().length - 1);
        updatePinnedTooltipRuntimeCount(this);
        return updated;
      },
      refreshPinnedTooltips: function () {
        Object.keys(this.pinnedTooltips || {}).forEach(function (key, index) {
          var match = this.figureElements && this.figureElements[key];
          if (!match || !match.entity || !match.figure) {
            removeTooltipRoot(this.pinnedTooltips[key]);
            delete this.pinnedTooltips[key];
            return;
          }
          this.updateTooltipEntity(this.pinnedTooltips[key], match.entity, match.figure, true, index);
        }, this);
        updatePinnedTooltipRuntimeCount(this);
      },
      processData: function (data) {
        var tree = Array.isArray(data) ? data : [];
        this.options = buildOptions(this.data || {});
        renderLayout(this, buildLayout(tree, this.options));
      }
    });
    return true;
  }

  var runtime = {
    registerComponent: registerComponent,
    getChartState: getChartState,
    __testing: {
      buildOptions: buildOptions,
      buildLayout: buildLayout,
      computeLayoutBounds: computeLayoutBounds,
      normalizeLayoutFixedBox: normalizeLayoutFixedBox,
      normalizeLayoutFloor: normalizeLayoutFloor,
      buildTooltipDetail: buildReadableTooltipDetail,
      buildTemporalShapeDescriptors: buildTemporalShapeDescriptors,
      renderVisibleBuildingPieces: renderVisibleBuildingPieces,
      metricEnvelopeMaterial: metricEnvelopeMaterial,
      visiblePieceMaterial: visiblePieceMaterial,
      compactPath: compactPath,
      getTooltipAnchor: getTooltipAnchor,
      collectBuildings: collectBuildings,
      collectLeaves: collectLeaves,
      normalizeRange: normalizeRange,
      mixHexColor: mixHexColor,
      resolveZoneColor: resolveZoneColor,
      pickColor: pickColor,
      gradientColor: gradientColor,
      buildColorStats: buildColorStats,
      resolveBuildingColor: resolveBuildingColor,
      getVisualStyleRuntime: getVisualStyleRuntime,
      formatModifiedAt: formatModifiedAt,
      buildTemporalSkinDescriptors: buildTemporalSkinDescriptors,
      getChartLocalPosition: getChartLocalPosition,
      collectElementSnapshots: collectElementSnapshots,
      getActiveRenderRoot: getActiveRenderRoot,
      nearlySameVec3: nearlySameVec3,
      resolveAnimationFromPosition: resolveAnimationFromPosition,
      resolveContainmentSafePlanarSize: resolveContainmentSafePlanarSize,
      POSITION_EPSILON: POSITION_EPSILON
    }
  };

  registerComponent(root.AFRAME);
  if (root.AFRAME && root.AFRAME.components && root.AFRAME.components[COMPONENT]) {
    root.CodeXRBoatsRuntime = runtime;
  }
  return runtime;
});
