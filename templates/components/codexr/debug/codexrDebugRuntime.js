(function registerCodeXRDebugRuntime(root) {
  'use strict';

  if (root.CodeXRDebug) { return; }

  var watchHandle = null;
  var hudHandle = null;
  var hudEnabled = false;
  var hudRoot = null;
  var hudText = null;
  var sceneListenersAttached = false;

  function doc() { return root.document; }
  function scene() { return doc()?.querySelector?.('a-scene') || null; }
  function graphComponent() {
    return doc()?.getElementById?.('codexrDependencyGraph')
      ?.components?.['codexr-dependency-graph'] || null;
  }
  function rendererStats() {
    var renderer = scene()?.renderer;
    var info = renderer?.info || {};
    return {
      drawCalls: Number(info.render?.calls || 0),
      triangles: Number(info.render?.triangles || 0),
      points: Number(info.render?.points || 0),
      lines: Number(info.render?.lines || 0),
      geometries: Number(info.memory?.geometries || 0),
      textures: Number(info.memory?.textures || 0)
    };
  }
  function getXrSession(currentScene) {
    try {
      return currentScene?.renderer?.xr?.getSession?.() || null;
    } catch {
      return null;
    }
  }
  function graphStats() {
    var component = graphComponent();
    if (!component?.getDebugSnapshot) {
      return {
        active: false,
        layout: null,
        scope: null,
        datasetNodes: 0,
        datasetEdges: 0,
        visibleNodes: 0,
        visibleEdges: 0
      };
    }
    return Object.assign({ active: true }, component.getDebugSnapshot());
  }
  function surfaceStats() {
    return root.CodeXRAnalysisSurfaceRuntime?.getSnapshot?.() || {
      surfaceId: null,
      surfaceVisible: false,
      childCount: 0,
      visualRootCount: 0,
      roots: [],
      registeredRootCount: 0
    };
  }
  function collectStatus() {
    var performance = root.CodeXRRenderBudgetRuntime?.getSnapshot?.() || {};
    var density = root.CodeXRDependencyVisualBudgetRuntime?.getSnapshot?.() || {};
    var currentScene = scene();
    var xrSession = getXrSession(currentScene);
    return {
      timestamp: new Date().toISOString(),
      performance: {
        averageFps: Number(performance.averageFps || 0),
        frameTimeP95: Number(performance.frameTimeP95 || 0),
        targetFps: Number(performance.targetFps || xrSession?.frameRate || 60),
        quality: performance.quality || 'unknown',
        xrSession: !!xrSession,
        xrMode: currentScene?.is?.('ar-mode') ? 'ar' : currentScene?.is?.('vr-mode') ? 'vr' : 'desktop'
      },
      density: {
        profile: density.profile || 'unknown',
        effectiveProfile: density.effectiveProfile || 'unknown',
        score: Number(density.score || 0),
        override: density.override || 'auto',
        edgeNodeRatio: Number(density.edgeNodeRatio || 0),
        maxDegree: Number(density.maxDegree || 0),
        widthRange: Array.isArray(density.widths) && density.widths.length
          ? [density.widths[0], density.widths[density.widths.length - 1]]
          : []
      },
      graph: graphStats(),
      surface: surfaceStats(),
      renderer: rendererStats()
    };
  }
  function printStatus(snapshot) {
    var value = snapshot || collectStatus();
    if (root.console?.groupCollapsed) {
      root.console.groupCollapsed('[CodeXR][Debug] Visualization status');
      root.console.table?.([value.performance]);
      root.console.table?.([value.density]);
      root.console.table?.([value.graph]);
      root.console.table?.([value.surface]);
      root.console.table?.([value.renderer]);
      root.console.log(value);
      root.console.groupEnd();
    } else {
      root.console?.log?.('[CodeXR][Debug] Visualization status', value);
    }
    return value;
  }
  function status() {
    var snapshot = collectStatus();
    printStatus(snapshot);
    updateHud(snapshot);
    return snapshot;
  }
  function stopWatch() {
    if (watchHandle !== null) {
      root.clearInterval?.(watchHandle);
      watchHandle = null;
    }
    return false;
  }
  function watch(intervalMs) {
    stopWatch();
    var interval = Math.max(250, Number(intervalMs || 1000));
    status();
    watchHandle = root.setInterval?.(status, interval) ?? null;
    return interval;
  }
  function isImmersive() {
    var currentScene = scene();
    return !!currentScene?.is?.('vr-mode') || !!currentScene?.is?.('ar-mode');
  }
  function ensureHud() {
    if (hudRoot?.isConnected) { return; }
    var currentScene = scene();
    var camera = currentScene?.camera?.el || doc()?.querySelector?.('[camera]');
    if (!camera || !doc()?.createElement) { return; }
    hudRoot = doc().createElement('a-entity');
    hudRoot.setAttribute('id', 'codexrDebugHud');
    hudRoot.setAttribute('position', '0.72 0.43 -1.25');
    hudRoot.setAttribute('codexr-desktop-only', '');
    var panel = doc().createElement('a-plane');
    panel.setAttribute('width', '0.72');
    panel.setAttribute('height', '0.38');
    panel.setAttribute('material', 'color: #07111f; opacity: .88; shader: flat');
    hudText = doc().createElement('a-text');
    hudText.setAttribute('position', '-0.33 0 0.012');
    hudText.setAttribute('width', '0.64');
    hudText.setAttribute('align', 'left');
    hudText.setAttribute('baseline', 'center');
    hudText.setAttribute('wrap-count', '34');
    hudText.setAttribute('color', '#d9f99d');
    hudRoot.appendChild(panel);
    hudRoot.appendChild(hudText);
    camera.appendChild(hudRoot);
  }
  function updateHud(snapshot) {
    if (!hudEnabled) { return; }
    ensureHud();
    if (!hudRoot || !hudText) { return; }
    var value = snapshot || collectStatus();
    hudRoot.setAttribute('visible', !isImmersive());
    hudText.setAttribute('value', [
      'CodeXR diagnostics',
      'FPS ' + value.performance.averageFps + '  P95 ' + value.performance.frameTimeP95 + 'ms',
      'Quality ' + value.performance.quality + '  Detail ' + value.density.effectiveProfile,
      'Nodes ' + value.graph.visibleNodes + '  Edges ' + value.graph.visibleEdges,
      'Calls ' + value.renderer.drawCalls + '  Triangles ' + value.renderer.triangles
    ].join('\n'));
  }
  function attachSceneListeners() {
    if (sceneListenersAttached || !scene()?.addEventListener) { return; }
    sceneListenersAttached = true;
    ['enter-vr', 'enter-ar', 'exit-vr', 'exit-ar'].forEach(function (eventName) {
      scene().addEventListener(eventName, function () { updateHud(); });
    });
  }
  function hud(enabled) {
    hudEnabled = enabled !== false;
    attachSceneListeners();
    if (hudEnabled) {
      ensureHud();
      updateHud();
      if (hudHandle === null) {
        hudHandle = root.setInterval?.(function () { updateHud(); }, 500) ?? null;
      }
    } else {
      if (hudRoot) { hudRoot.setAttribute('visible', false); }
      if (hudHandle !== null) {
        root.clearInterval?.(hudHandle);
        hudHandle = null;
      }
    }
    return hudEnabled;
  }
  function toggleHud() { return hud(!hudEnabled); }

  // Immersive simulation, for checking AR/VR layout on a plain desktop
  // browser. These set the very states and events A-Frame sets around a real
  // session, so everything that keys off them runs for real: hide-on-enter-ar
  // clears the room, the rig recenters for AR, and the pointer policy hands
  // over. What they canNOT give you is a WebXR session — no headset pose, no
  // stereo, no camera passthrough — so use them to answer "what is hidden and
  // where do I end up", and an emulator or a real headset for the rest.
  function simulateImmersive(mode) {
    var currentScene = scene();
    if (!currentScene?.emit) {
      root.console?.warn?.('[CodeXR][Debug] No scene to simulate on.');
      return false;
    }
    currentScene.removeState?.('ar-mode');
    currentScene.removeState?.('vr-mode');
    currentScene.addState?.(mode);
    currentScene.emit('enter-vr');
    root.console?.log?.('[CodeXR][Debug] Simulated ' + mode + ' (no WebXR session: no headset pose, no stereo, no passthrough).');
    return true;
  }
  function simulateAR() { return simulateImmersive('ar-mode'); }
  function simulateVR() { return simulateImmersive('vr-mode'); }
  function exitSimulated() {
    var currentScene = scene();
    if (!currentScene?.emit) { return false; }
    currentScene.emit('exit-vr');
    currentScene.removeState?.('ar-mode');
    currentScene.removeState?.('vr-mode');
    root.console?.log?.('[CodeXR][Debug] Left simulated immersive mode.');
    return true;
  }

  function help() {
    var commands = [
      'CodeXRDebug.status()',
      'CodeXRDebug.watch(1000)',
      'CodeXRDebug.stopWatch()',
      'CodeXRDebug.hud(true)',
      'CodeXRDebug.toggleHud()',
      'CodeXRDebug.simulateAR()',
      'CodeXRDebug.simulateVR()',
      'CodeXRDebug.exitSimulated()',
      'CodeXRDebug.help()'
    ];
    root.console?.log?.('[CodeXR][Debug] Commands\n  ' + commands.join('\n  '));
    return commands;
  }
  function registerDesktopOnlyComponent() {
    var AFRAME = root.AFRAME;
    if (!AFRAME?.registerComponent || AFRAME.components['codexr-desktop-only']) { return; }
    AFRAME.registerComponent('codexr-desktop-only', {
      init: function () {
        var self = this;
        this.updateVisibility = function () {
          self.el.setAttribute('visible', !self.el.sceneEl?.is?.('vr-mode') && !self.el.sceneEl?.is?.('ar-mode'));
        };
        ['enter-vr', 'enter-ar', 'exit-vr', 'exit-ar'].forEach(function (eventName) {
          self.el.sceneEl?.addEventListener?.(eventName, self.updateVisibility);
        });
        this.updateVisibility();
      },
      remove: function () {
        ['enter-vr', 'enter-ar', 'exit-vr', 'exit-ar'].forEach(function (eventName) {
          this.el.sceneEl?.removeEventListener?.(eventName, this.updateVisibility);
        }, this);
      }
    });
  }

  function registerCodeXRConsoleFacade() {
    var groups = {};
    function register(group, commands) {
      groups[group] = (commands || []).map(function (command) {
        return Object.assign({ group: group }, command);
      });
    }
    function catalog() {
      var values = Object.keys(groups).flatMap(function (group) { return groups[group]; });
      if (root.CodeXRChartDebug) {
        var chartDescriptions = {
          enable: 'Enable chart debugging and optionally select a chart.',
          disable: 'Disable chart debugging controls.',
          select: 'Select a chart by ID, alias, or CSS selector.',
          actualDimensions: 'Show the measured dimensions of the active chart.',
          scale: 'Apply a manual scale to the active chart.',
          setPosition: 'Move the active chart to an exact position.',
          setFlight: 'Enable or disable free-flight movement.',
          listCharts: 'List charts detected in the current scene.',
          commands: 'List the CodeXRChartDebug command names.',
          help: 'Show detailed chart-debug usage and examples.'
        };
        Object.keys(chartDescriptions).forEach(function (name) {
          values.push({
            group: 'Chart debugging',
            command: 'CodeXRChartDebug.' + name + '()',
            description: chartDescriptions[name],
            available: typeof root.CodeXRChartDebug?.[name] === 'function'
          });
        });
      }
      return values.map(function (item) {
        return Object.assign({}, item, {
          available: item.available !== undefined
            ? item.available
            : typeof item.resolve === 'function' ? !!item.resolve() : true
        });
      });
    }
    function facadeHelp() {
      var commands = catalog();
      root.console?.group?.('[CodeXR] Browser console commands');
      Object.keys(groups).forEach(function (group) {
        var rows = commands.filter(function (command) { return command.group === group; })
          .map(function (command) {
            return {
              Command: command.command,
              Description: command.description,
              Available: command.available ? 'yes' : 'no'
            };
          });
        if (rows.length) {
          root.console?.groupCollapsed?.(group);
          root.console?.table?.(rows);
          root.console?.groupEnd?.();
        }
      });
      var chartRows = commands.filter(function (command) {
        return command.group === 'Chart debugging';
      }).map(function (command) {
        return {
          Command: command.command,
          Description: command.description,
          Available: command.available ? 'yes' : 'no'
        };
      });
      if (chartRows.length) {
        root.console?.groupCollapsed?.('Chart debugging');
        root.console?.table?.(chartRows);
        root.console?.groupEnd?.();
      }
      root.console?.groupEnd?.();
      return commands;
    }
    root.CodeXR = root.CodeXR || {};
    root.CodeXR.registerCommands = register;
    root.CodeXR.commands = catalog;
    root.CodeXR.help = facadeHelp;
    register('Diagnostics', [
      { command: 'CodeXRDebug.status()', description: 'Print current FPS, graph, density, and renderer status.' },
      { command: 'CodeXRDebug.watch(1000)', description: 'Print visualization status repeatedly at the requested interval.' },
      { command: 'CodeXRDebug.stopWatch()', description: 'Stop the periodic status monitor.' },
      { command: 'CodeXRDebug.hud(true)', description: 'Show or hide the desktop diagnostics HUD.' },
      { command: 'CodeXRDebug.toggleHud()', description: 'Toggle the desktop diagnostics HUD.' },
      { command: 'CodeXRDebug.simulateAR()', description: 'Simulate entering AR (hides room and environment, recenters you at the pedestal). No WebXR session: no headset pose, stereo or passthrough.' },
      { command: 'CodeXRDebug.simulateVR()', description: 'Simulate entering VR (nothing is hidden). No WebXR session: no headset pose, stereo or passthrough.' },
      { command: 'CodeXRDebug.exitSimulated()', description: 'Leave the simulated AR/VR mode and restore the desktop view.' },
      { command: 'CodeXRDebug.help()', description: 'List the diagnostics-only commands.' },
      {
        command: 'CodeXRAnalysisSurfaceRuntime.getSnapshot()',
        description: 'Inspect the owned analysis surface and its active visual roots.',
        resolve: function () { return root.CodeXRAnalysisSurfaceRuntime?.getSnapshot; }
      }
    ]);
    register('Dependency graph', [
      {
        command: 'CodeXRDependencyGraphRuntime.start()',
        description: 'Open or refresh dependency mode.',
        resolve: function () { return root.CodeXRDependencyGraphRuntime?.start; }
      },
      {
        command: 'CodeXRDependencyGraphRuntime.openModeSelector()',
        description: 'Open the visualization-mode selector from the dependency graph.',
        resolve: function () { return root.CodeXRDependencyGraphRuntime?.openModeSelector; }
      },
      {
        command: 'CodeXRDependencyGraphRuntime.openDirectory(path)',
        description: 'Navigate the shared dependency view to a project-relative directory.',
        resolve: function () { return root.CodeXRDependencyGraphRuntime?.openDirectory; }
      },
      {
        command: 'CodeXRDependencyGraphRuntime.openFile(path)',
        description: 'Load and open symbol dependencies for a project-relative file.',
        resolve: function () { return root.CodeXRDependencyGraphRuntime?.openFile; }
      }
    ]);
  }

  registerDesktopOnlyComponent();
  root.CodeXRDebug = {
    status: status,
    watch: watch,
    stopWatch: stopWatch,
    hud: hud,
    toggleHud: toggleHud,
    simulateAR: simulateAR,
    simulateVR: simulateVR,
    exitSimulated: exitSimulated,
    help: help,
    getStatus: collectStatus,
    isWatching: function () { return watchHandle !== null; },
    isHudEnabled: function () { return hudEnabled; }
  };
  registerCodeXRConsoleFacade();
  root.console?.log?.('[CodeXR][Debug] Runtime ready. Use CodeXR.help() in the browser console.');
})(typeof window !== 'undefined' ? window : this);
