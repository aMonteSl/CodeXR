// == dependencyGraphRuntime.js | part 70: tooltips-and-selection (assembled with its siblings; see COMPONENTS.md) ==
      ensureTooltip: function () {
        if (this.tooltip?.root?.parentNode) { return this.tooltip; }
        if (root.CodeXRCommonRuntime?.createTooltip) {
          this.tooltip = root.CodeXRCommonRuntime.createTooltip({ accentColor: '#f59e0b', width: 3.55, height: .96 });
          this.el.appendChild(this.tooltip.root);
          return this.tooltip;
        }
        var tooltipRoot = entity('a-entity', { visible: false });
        var background = entity('a-plane', {
          width: 3.25, height: 1.42,
          material: 'color: #0f172a; opacity: .94; shader: flat; side: double'
        });
        var title = text('', '0 .2 .018', 3, '#fcd34d', 'center');
        var primary = text('', '0 -.18 .018', 2.95, '#f8fafc', 'center');
        tooltipRoot.appendChild(background);
        tooltipRoot.appendChild(title);
        tooltipRoot.appendChild(primary);
        this.el.appendChild(tooltipRoot);
        this.tooltip = {
          root: tooltipRoot, background: background, title: title,
          subtitle: primary, primary: primary, secondary: primary, action: null
        };
        return this.tooltip;
      },
      positionPinnedTooltip: function () {
        if (!this.pinnedSelection || !this.tooltip?.root?.getAttribute('visible') || !root.THREE) { return; }
        var record = this.pinnedSelection.type === 'node'
          ? this.nodes[this.pinnedSelection.id]
          : this.edgeRecords[this.pinnedSelection.id];
        if (!record) { return; }
        var anchor = this.pinnedSelection.type === 'node'
          ? record.el.object3D.position
          : record.midpoint;
        var position = new root.THREE.Vector3(
          Math.max(-1.55, Math.min(1.55, Number(anchor.x || 0))),
          this.graphTopY + .92,
          .18
        );
        this.tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
        root.CodeXRCommonRuntime.updateTooltipConnector?.(this.tooltip, position, {
          x: Number(anchor.x || 0),
          y: Number(anchor.y || 0),
          z: Number(anchor.z || 0)
        }, { connectorColor: '#f59e0b' });
      },
      showSelection: function (selection) {
        var tooltip = this.ensureTooltip();
        var record = selection.type === 'node'
          ? this.nodes[selection.id]
          : this.edgeRecords[selection.id];
        if (!record) {
          if (this.pinnedSelection
              && this.pinnedSelection.type === selection.type
              && this.pinnedSelection.id === selection.id) {
            this.pinnedSelection = null;
          }
          tooltip.root.setAttribute('visible', false);
          return;
        }
        var anchor = selection.type === 'node' ? record.el.object3D.position : record.midpoint;
        var position = new root.THREE.Vector3(
          Math.max(-1.55, Math.min(1.55, Number(anchor.x || 0))),
          this.graphTopY + .92,
          .18
        );
        var detail = selection.type === 'node'
          ? nodeDetailModel(record.data)
          : edgeDetailModel(record.data, this.nodes);
        if (tooltip.action?.parentNode) { tooltip.action.parentNode.removeChild(tooltip.action); }
        tooltip.action = null;
        var canNavigate = selection.type === 'node'
          && (record.data.kind === 'group' || record.data.kind === 'file' || record.data.syntheticExternal);
        if (root.CodeXRCommonRuntime?.updateTooltip) {
          root.CodeXRCommonRuntime.updateTooltip(tooltip, detail, position, {
            width: 3.55,
            height: canNavigate ? 1.52 : 1.04,
            titleLength: 30,
            subtitleLength: 42,
            primaryLength: 48,
            secondaryLength: 48,
            footerReserve: canNavigate ? .28 : 0,
            connectorTarget: this.pinnedSelection
              && this.pinnedSelection.type === selection.type
              && this.pinnedSelection.id === selection.id
              ? {
                x: Number(anchor.x || 0),
                y: Number(anchor.y || 0),
                z: Number(anchor.z || 0)
              }
              : null,
            connectorColor: '#f59e0b'
          });
        } else {
          tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
          tooltip.title.setAttribute('value', truncateText(detail.title, 42));
          tooltip.subtitle.setAttribute('value', truncateText(detail.subtitle, 60));
          tooltip.primary.setAttribute('value', truncateText(detail.primary, 68));
          tooltip.secondary.setAttribute('value', truncateText(detail.secondary, 68));
          tooltip.root.setAttribute('visible', true);
          tooltip.background.setAttribute('height', canNavigate ? 1.78 : 1.42);
        }
        if (canNavigate) {
          var actionLabel = record.data.syntheticExternal
            ? 'Show external details'
            : record.data.syntheticKind === 'parent'
              ? 'Go to parent'
              : record.data.syntheticKind === 'directory'
                ? 'Open folder'
                : record.data.kind === 'file'
                  ? 'Open file'
                  : 'Open';
          tooltip.action = button(
            actionLabel,
            '0 -0.62 0.02',
            record.data.syntheticExternal ? 2.15 : 1.55,
            function (event) {
              event.stopPropagation?.();
              if (record.data.syntheticExternal) {
                publishState({ showExternal: true });
              } else if (record.data.kind === 'file') {
                openFile(record.data.relativePath || record.data.label);
              } else {
                openDirectory(record.data.navigationPath || record.data.relativePath || '');
              }
            },
            record.data.syntheticExternal ? '#c2410c' : '#7c3aed'
          );
          tooltip.root.appendChild(tooltip.action);
        }
        this.applyHighlight(selection);
      },
      hideTooltip: function () {
        if (root.CodeXRCommonRuntime?.hideTooltip) {
          root.CodeXRCommonRuntime.hideTooltip(this.tooltip);
        } else if (this.tooltip?.root) {
          this.tooltip.root.setAttribute('visible', false);
        }
        this.clearHighlight();
      },
      showTransientSelection: function (selection) {
        if (this.pinnedSelection) { return; }
        this.hoveredSelection = selection;
        this.showSelection(selection);
      },
      hideTransientSelection: function (selection) {
        if (this.pinnedSelection
            || this.hoveredSelection?.type !== selection.type
            || this.hoveredSelection?.id !== selection.id) { return; }
        this.hoveredSelection = null;
        this.hideTooltip();
      },
      togglePinnedSelection: function (selection) {
        var isSame = this.pinnedSelection?.type === selection.type
          && this.pinnedSelection?.id === selection.id;
        this.pinnedSelection = isSame ? null : selection;
        this.hoveredSelection = null;
        if (this.pinnedSelection) { this.showSelection(this.pinnedSelection); }
        else { this.hideTooltip(); }
      },
      restorePinnedSelection: function () {
        if (this.pinnedSelection) { this.showSelection(this.pinnedSelection); }
      },
      applyHighlight: function (selection) {
        var related = new Set();
        if (selection.type === 'node') {
          related.add(selection.id);
          (this.dataset?.edges || []).forEach(function (edge) {
            if (edge.source === selection.id) { related.add(edge.target); }
            if (edge.target === selection.id) { related.add(edge.source); }
          });
        } else {
          var edge = this.edgeRecords[selection.id]?.data;
          if (edge) { related.add(edge.source); related.add(edge.target); }
        }
        Object.keys(this.nodes).forEach(function (nodeId) {
          this.nodes[nodeId].highlightTarget = related.has(nodeId) ? 1 : .18;
          this.nodes[nodeId].highlightColor = related.has(nodeId);
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          var selected = selection.type === 'edge'
            ? edgeId === selection.id
            : record.data.source === selection.id || record.data.target === selection.id;
          record.highlighted = selected;
        }, this);
        this.selectionStartedAt = root.performance?.now?.() || Date.now();
        this.ensureSelectionHalo(selection);
        this.refreshEdgeColors(selection);
        this.rebuildFocusEdges();
        this.updateFlowVisibility();
        var detail = selection.type === 'node'
          ? nodeDetailModel(this.nodes[selection.id]?.data)
          : edgeDetailModel(this.edgeRecords[selection.id]?.data, this.nodes);
        setStatus([detail.title, detail.subtitle, detail.primary, detail.secondary].join(' | '), false);
      },
      clearHighlight: function () {
        Object.keys(this.nodes).forEach(function (nodeId) {
          this.nodes[nodeId].highlightTarget = 1;
          this.nodes[nodeId].highlightColor = false;
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          this.edgeRecords[edgeId].highlighted = false;
        }, this);
        this.disposeSelectionHalo();
        this.refreshEdgeColors(null);
        this.disposeFocusEdges();
        this.updateFlowVisibility();
        setStatus('', false);
      },
      selectNode: function (id) {
        this.togglePinnedSelection({ type: 'node', id: id });
      },
      getDebugSnapshot: function () {
        var visibleRecords = Object.values(this.edgeRecords || {}).filter(function (record) {
          return !record.remove && record.batch;
        });
        var activeSelection = this.pinnedSelection || this.hoveredSelection || null;
        return {
          layout: this.view?.layout || null,
          scope: this.view?.scope ? Object.assign({}, this.view.scope) : null,
          mapping: Object.assign({}, this.view?.mapping || {}),
          edgeEncoding: this.view?.edgeEncoding || 'relation-type',
          datasetNodes: Number(state.dataset?.nodes?.length || this.dataset?.nodes?.length || 0),
          datasetEdges: Number(state.dataset?.edges?.length || this.dataset?.edges?.length || 0),
          visibleNodes: Object.keys(this.nodes || {}).length,
          visibleEdges: visibleRecords.length,
          arrowCount: visibleRecords.filter(function (record) {
            return this.visualBudget?.arrowsForAll || this.focusEdgeIds.has(record.data.id);
          }, this).length,
          animatedFlowCount: Number(this.lastFlowCount || 0),
          focusEdgeCount: Number(this.focusEdgeObjects?.length || 0),
          selection: activeSelection ? Object.assign({}, activeSelection) : null,
          transitionActive: !!this.transition,
          transitionProgress: this.el.getAttribute('data-codexr-transition-progress') || null,
          layoutGeneration: Number(this.layoutGeneration || 0),
          detailOverride: this.visualBudget?.override || 'auto',
          densityProfile: this.visualBudget?.profile || 'unknown',
          effectiveProfile: this.visualBudget?.effectiveProfile || 'unknown'
        };
      }
    });
  }

  function numericGradient(value, maxValue) {
    var ratio = Math.max(0, Math.min(1, Number(value || 0) / Math.max(1, Number(maxValue || 1))));
    var red = Math.round(38 + (217 * ratio));
    var green = Math.round(198 - (110 * ratio));
    var blue = Math.round(218 - (174 * ratio));
    return '#' + [red, green, blue].map(function (part) {
      return part.toString(16).padStart(2, '0');
    }).join('');
  }

  function renderGraph() {
    if (!state.active || !state.dataset || !state.snapshot || state.snapshot.status !== 'ready') { return; }
    parkOriginal();
    if (refs.graph && !refs.graph.isConnected) {
      refs.graph = null;
    }
    if (!refs.graph) {
      refs.graph = entity('a-entity', {
        id: 'codexrDependencyGraph',
        position: '0 1.02 -18',
        'data-codexr-analysis-root': 'true',
        'data-codexr-analysis-mode': 'dependency-graph',
        'codexr-dependency-graph': ''
      });
      refs.graph.addEventListener('componentinitialized', function (event) {
        if (event?.detail?.name !== COMPONENT) { return; }
        renderCurrentGraphIfReady();
      });
      if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
        root.CodeXRAnalysisSurfaceRuntime.mountRoot('dependency-graph', refs.graph);
      } else {
        doc()?.querySelector('a-scene')?.appendChild(refs.graph);
      }
    } else {
      root.CodeXRAnalysisSurfaceRuntime?.mountRoot?.('dependency-graph', refs.graph);
    }
    var graph = filteredDataset();
    renderGraphWhenReady(graph, state.snapshot, state.viewGeneration, 0);
  }
