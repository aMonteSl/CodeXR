// == dependencyGraphRuntime.js | componentCore (assembled per manifest.json; see COMPONENTS.md) ==
  function registerComponent() {
    if (!AFRAME?.registerComponent || AFRAME.components[COMPONENT]) { return; }
    AFRAME.registerComponent(COMPONENT, {
      init: function () {
        this.worker = null;
        this.nodes = {};
        this.edges = [];
        this.edgeObjects = [];
        this.edgeRecords = {};
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
        this.edgeTransform = root.THREE ? new root.THREE.Object3D() : null;
        this.flowPoints = null;
        this.flowGeometry = null;
        this.flowPositions = null;
        this.flowColors = null;
        this.flowQuality = root.CodeXRRenderBudgetRuntime?.getSnapshot?.().quality || 'full';
        this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.getSnapshot?.() || {
          profile: 'sparse',
          effectiveProfile: 'sparse',
          override: 'auto',
          widths: FALLBACK_INTENSITY_WIDTHS,
          flowLimit: 300,
          arrowsForAll: true
        };
        this.focusEdgeObjects = [];
        this.focusEdgeIds = new Set();
        this.lastFlowCount = 0;
        this.visibleArrowCount = 0;
        this.selectionHalo = null;
        this.selectionStartedAt = 0;
        this.axisObjects = [];
        this.axesRoot = null;
        this.tooltip = null;
        this.pinnedSelection = null;
        this.hoveredSelection = null;
        this.graphTopY = GRAPH_BASE_Y;
        this.layoutGeneration = 0;
        this.pendingGraph = null;
        this.transition = null;
        this.transitionFrame = null;
        this.transitionDuration = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 600;
        this.ensureWorker();
        var self = this;
        this.disposeRenderBudget = root.CodeXRRenderBudgetRuntime?.subscribe?.(function (budget) {
          var qualityChanged = self.flowQuality !== budget.quality;
          self.flowQuality = budget.quality;
          self.refreshVisualBudget();
          if (qualityChanged) { renderControls(); }
        }) || null;
      },
      tick: function (time) {
        if (this.tooltip?.root?.getAttribute('visible') && root.THREE) {
          root.CodeXRCommonRuntime?.faceCamera?.(this.tooltip.root, this.el.sceneEl);
        }
        this.updateHighlightTransition();
        this.updateSelectionHalo(time || 0);
        this.updateFocusEdges();
        this.updateFlow(time || 0);
      },
      remove: function () {
        this.disposeView();
        this.disposeRenderBudget?.();
        this.disposeRenderBudget = null;
        this.worker?.terminate?.();
        this.worker = null;
      },
      ensureWorker: function () {
        if (this.worker) {
          return this.worker;
        }
        this.worker = createLayoutWorker();
        this.worker.onmessage = this.applyPositions.bind(this);
        return this.worker;
      },
      disposeView: function () {
        this.layoutGeneration += 1;
        this.pendingGraph = null;
        this.transition = null;
        if (this.transitionFrame !== null) {
          root.cancelAnimationFrame?.(this.transitionFrame);
          this.transitionFrame = null;
        }
        this.clear();
      },
      resetView: function () {
        this.pinnedSelection = null;
        this.hoveredSelection = null;
        this.tooltip?.root?.setAttribute?.('visible', false);
        this.clear(false);
        if (this.currentDataset && this.currentView) {
          this.setGraph(this.currentDataset, this.currentView);
        }
      },
      clear: function (preserveSelection) {
        (this.edgeObjects || []).forEach(function (line) {
          line.parent?.remove?.(line);
          line.geometry?.dispose?.();
          line.material?.dispose?.();
        }, this);
        this.disposeEdgeBatches();
        this.disposeFlowLayer();
        this.disposeFocusEdges();
        this.disposeSelectionHalo();
        (this.axisObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        while (this.el.firstChild) { this.el.removeChild(this.el.firstChild); }
        this.nodes = {};
        this.edges = [];
        this.edgeObjects = [];
        this.edgeRecords = {};
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
        this.axisObjects = [];
        this.axesRoot = null;
        this.tooltip = null;
        this.scopeLabel = null;
        this.hoveredSelection = null;
        this.lastFlowCount = 0;
        this.visibleArrowCount = 0;
        this.graphTopY = GRAPH_BASE_Y;
        if (!preserveSelection) { this.pinnedSelection = null; }
      },
      setGraph: function (dataset, view) {
        dataset = dataset || { nodes: [], edges: [] };
        dataset.nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
        dataset.edges = Array.isArray(dataset.edges) ? dataset.edges : [];
        var renderableIds = new Set(dataset.nodes.map(function (node) { return node.id; }));
        dataset = Object.assign({}, dataset, {
          nodes: dataset.nodes.slice(),
          edges: dataset.edges.filter(function (edge) {
            return renderableIds.has(edge.source) && renderableIds.has(edge.target);
          })
        });
        this.currentDataset = dataset;
        this.currentView = view;
        if (!this.scopeLabel?.isConnected) {
          this.scopeLabel = text('', '0 1.52 0.18', 5.4, '#67e8f9');
          this.scopeLabel.setAttribute('side', 'double');
          this.el.appendChild(this.scopeLabel);
        }
        this.scopeLabel.setAttribute(
          'value',
          (view.scope?.kind === 'file' ? 'File: ' : 'Folder: ')
            + (normalizeRelativePath(view.scope?.relativePath) || '(project root)')
        );
        var layoutNodes = dataset.nodes.filter(function (node) { return !node.syntheticExternal; });
        var metricScales = buildMetricScales(layoutNodes, view.mapping);
        var maxMetric = Math.max.apply(Math, layoutNodes.map(function (node) {
          return Number(node.metrics?.[view.mapping?.size || 'degree'] || 0);
        }).concat([1]));
        var visuals = {};
        dataset.nodes.forEach(function (node) {
          var metric = Number(node.metrics?.[view.mapping?.size || 'degree'] || 0);
          var radius = 0.055 + Math.sqrt(metric / maxMetric) * 0.14;
          var colorMetric = view.mapping?.color || 'language';
          var numericColor = Number(node.metrics?.[colorMetric]);
          var color = colorMetric === 'language'
            ? (COLORS[node.language] || COLORS[node.external ? 'external' : 'TypeScript'])
            : numericGradient(numericColor, maxMetric);
          var semanticVisual = symbolVisual(node, view.layout);
          if (semanticVisual) {
            color = semanticVisual.color;
          }
          if (node.syntheticExternal || node.syntheticKind) {
            radius = .16;
          }
          visuals[node.id] = {
            radius: radius,
            color: color,
            shape: semanticVisual?.shape || (node.kind === 'group' ? 'box' : 'sphere')
          };
        });
        var visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
          graphDensityStats(dataset),
          this.flowQuality
        ) || this.visualBudget;
        var generation = ++this.layoutGeneration;
        this.pendingGraph = {
          generation: generation,
          dataset: dataset,
          view: view,
          metricScales: metricScales,
          visuals: visuals,
          edges: dataset.edges,
          visualBudget: visualBudget
        };
        this.ensureWorker().postMessage({
          generation: generation,
          nodes: layoutNodes,
          edges: this.pendingGraph.edges,
          layout: view.layout,
          mapping: view.mapping,
          scales: metricScales,
          width: GRAPH_WIDTH,
          depth: GRAPH_DEPTH
        });
      },
      applyPositions: function (event) {
        var response = event.data || {};
        if (!this.pendingGraph || response.generation !== this.pendingGraph.generation) { return; }
        var positions = response.positions || {};
        var pending = this.pendingGraph;
        var summary = pending.dataset.nodes.find(function (node) { return node.syntheticExternal; });
        if (summary) {
          positions[summary.id] = pending.view.layout === 'force-3d'
            ? { x: GRAPH_WIDTH * .38, y: GRAPH_HEIGHT * .72, z: -GRAPH_DEPTH * .36 }
            : { x: GRAPH_WIDTH * .39, y: GRAPH_HEIGHT * .62, z: GRAPH_DEPTH * .34 };
        }
        this.pendingGraph = null;
        this.beginTransition(pending, positions);
      },
      createNodeRecord: function (node, visual, startPosition) {
        var self = this;
        var nodeEl = entity('a-entity', {
          geometry: nodeGeometry(visual.shape, visual.radius),
          material: 'color: ' + visual.color + '; shader: flat; transparent: true; opacity: 0',
          class: RAYCAST_CLASS,
          'data-node-id': node.id,
          'data-codexr-interactive': 'true'
        });
        nodeEl.object3D.position.copy(startPosition);
        nodeEl.object3D.scale.setScalar(0);
        nodeEl.addEventListener('mouseenter', function () {
          self.showTransientSelection({ type: 'node', id: node.id });
        });
        nodeEl.addEventListener('mouseleave', function () {
          self.hideTransientSelection({ type: 'node', id: node.id });
        });
        nodeEl.addEventListener('click', function (clickEvent) {
          clickEvent.stopPropagation?.();
          self.togglePinnedSelection({ type: 'node', id: node.id });
        });
        this.el.appendChild(nodeEl);
        return {
          el: nodeEl,
          data: node,
          radius: visual.radius,
          shape: visual.shape,
          highlightTarget: 1,
          highlightColor: false,
          baseColor: visual.color
        };
      },
      beginTransition: function (pending, positions) {
        if (!root.THREE) { return; }
        var self = this;
        var heightMetric = pending.view.mapping?.height || 'fanIn';
        var heightMaximum = Math.max(1, Number(pending.metricScales?.y?.maximum || 1));
        var targetIds = new Set();
        var nodeTransitions = [];
        Object.keys(positions).forEach(function (id) {
          var node = pending.dataset.nodes.find(function (candidate) { return candidate.id === id; });
          var visual = pending.visuals[id];
          if (!node || !visual) { return; }
          targetIds.add(id);
          var p = positions[id];
          var mappedHeight = (Math.max(0, Number(node.metrics?.[heightMetric] || 0)) / heightMaximum) * GRAPH_HEIGHT;
          var targetPosition = new root.THREE.Vector3(p.x, p.y + mappedHeight, p.z);
          var record = self.nodes[id];
          if (!record) {
            var connected = pending.edges.find(function (edge) {
              return edge.source === id && self.nodes[edge.target]
                || edge.target === id && self.nodes[edge.source];
            });
            var neighborId = connected
              ? (connected.source === id ? connected.target : connected.source)
              : null;
            var startPosition = neighborId && self.nodes[neighborId]
              ? self.nodes[neighborId].el.object3D.position.clone()
              : new root.THREE.Vector3(0, GRAPH_BASE_Y, 0);
            record = self.createNodeRecord(node, visual, startPosition);
            self.nodes[id] = record;
          }
          var material = record.el.getAttribute('material') || {};
          var previousRadius = Math.max(.0001, Number(record.radius || visual.radius));
          nodeTransitions.push({
            id: id,
            record: record,
            remove: false,
            fromPosition: record.el.object3D.position.clone(),
            toPosition: targetPosition,
            fromScale: Number(record.el.object3D.scale.x || 0),
            toScale: visual.radius / previousRadius,
            fromOpacity: Number(material.opacity ?? 1),
            toOpacity: 1,
            fromColor: new root.THREE.Color(material.color || visual.color),
            toColor: new root.THREE.Color(visual.color)
          });
          record.data = node;
          record.targetRadius = visual.radius;
          record.shape = visual.shape;
          record.baseColor = visual.color;
        });
        Object.keys(this.nodes).forEach(function (id) {
          if (targetIds.has(id)) { return; }
          var record = self.nodes[id];
          var material = record.el.getAttribute('material') || {};
          nodeTransitions.push({
            id: id,
            record: record,
            remove: true,
            fromPosition: record.el.object3D.position.clone(),
            toPosition: record.el.object3D.position.clone(),
            fromScale: Number(record.el.object3D.scale.x || 1),
            toScale: 0,
            fromOpacity: Number(material.opacity ?? 1),
            toOpacity: 0,
            fromColor: new root.THREE.Color(material.color || '#64748b'),
            toColor: new root.THREE.Color(material.color || '#64748b')
          });
        });
        this.visualBudget = pending.visualBudget || this.visualBudget;
        this.reconcileEdges(pending.edges, pending.view);
        this.dataset = pending.dataset;
        this.edges = pending.edges;
        this.view = pending.view;
        this.metricScales = pending.metricScales;
        this.transition = {
          startedAt: null,
          duration: this.transitionDuration,
          nodes: nodeTransitions,
          edgeIds: new Set(pending.edges.map(function (edge) { return edge.id; }))
        };
        this.scheduleTransitionFrame();
      },
      refreshVisualBudget: function () {
        if (!this.edges?.length) {
          this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
            { nodeCount: Object.keys(this.nodes || {}).length, edgeCount: 0, maxDegree: 0 },
            this.flowQuality
          ) || this.visualBudget;
          return;
        }
        this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
          graphDensityStats({ nodes: Object.values(this.nodes).map(function (record) { return record.data; }), edges: this.edges }),
          this.flowQuality
        ) || this.visualBudget;
        this.reconcileEdges(this.edges, this.view || {});
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.remove) { this.updateEdgeGeometry(record); }
        }, this);
        this.refreshEdgeColors(this.pinnedSelection || this.hoveredSelection);
        this.rebuildFocusEdges();
        this.updateFlowVisibility();
      },
      scheduleTransitionFrame: function () {
        if (!this.transition) { return; }
        if (this.transitionDuration === 0 || !root.requestAnimationFrame) {
          this.updateTransition(root.performance?.now?.() || Date.now(), true);
          return;
        }
        if (this.transitionFrame !== null) {
          root.cancelAnimationFrame?.(this.transitionFrame);
        }
        var self = this;
        this.transitionFrame = root.requestAnimationFrame(function (time) {
          self.transitionFrame = null;
          self.updateTransition(time, false);
        });
      },