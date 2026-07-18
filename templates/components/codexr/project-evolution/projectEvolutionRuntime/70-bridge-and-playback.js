// == projectEvolutionRuntime.js | part 70: bridge-and-playback (assembled with its siblings; see COMPONENTS.md) ==
  function bridgeUrl() {
    return String(state.result?.bridgeUrl || (state.result?.revision ? '/evolution/revision-' + state.result.revision + '/data.json' : ''));
  }

  function frameUrlWithCache(frame, rawUrl) {
    var raw = String(rawUrl || bridgeUrl() || frame.url || '');
    if (!raw) { return ''; }
    var separator = raw.indexOf('?') === -1 ? '?' : '&';
    return raw + separator
      + 'revision=' + encodeURIComponent(String(state.result?.revision || ''))
      + '&frame=' + encodeURIComponent(String((frame.index || 0) + 1))
      + '&t=' + Date.now();
  }

  async function applyBridgeFrameToChart(frame, appliedBridgeUrl) {
    var chartId = getActiveChartId();
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) {
      return false;
    }
    var frameUrl = frameUrlWithCache(frame, appliedBridgeUrl);
    if (!frameUrl) {
      setStatus('This evolution movie has no bridge data URL.', 'error');
      return false;
    }
    var template = getTemplateChart(chartId);
    if (!template) {
      setStatus('Project evolution chart is not available.', 'error');
      return false;
    }
    var playbackRoot = ensureEvolutionPlaybackRoot(frame);
    var dataSource = ensureEvolutionDataSource(playbackRoot, frameUrl);
    await waitForComponent(dataSource, 'babia-queryjson', 1200);
    await nextRenderFrame();
    var mapping = getActiveMappingForChart(chartId);
    var chart = ensureEvolutionChart(chartId);
    if (!chart) {
      setStatus('Project evolution chart is not available.', 'error');
      return false;
    }
    prepareChartForEvolution(chart, chartId, { force: true });
    var current = chart.getAttribute(componentName) || {};
    var data = root.CodeXRMappingUiRuntime?.__testing?.buildRuntimeChartData
      ? root.CodeXRMappingUiRuntime?.__testing.buildRuntimeChartData(chartId, current, mapping)
      : Object.assign({}, current, mapping);
    delete data.data;
    delete data.field;
    if (isHierarchicalBoatsChart(chartId, componentName)) {
      var treeBuilder = ensureEvolutionTreeBuilder(playbackRoot, config().targetType);
      await waitForComponent(treeBuilder, 'babia-treebuilder', 1200);
      await nextRenderFrame();
      data.from = 'codexrProjectEvolutionTree';
    } else {
      data.from = 'codexrProjectEvolutionData';
    }
    chart.setAttribute('data-codexr-active-chart-id', chartId);
    if (chart.parentNode !== playbackRoot) {
      playbackRoot.appendChild(chart);
    }
    var signature = chartId + ':' + JSON.stringify(data);
    if (state.chartDataSignature !== signature || !chart.hasAttribute?.(componentName)) {
      chart.setAttribute(componentName, data);
      state.chartDataSignature = signature;
      await waitForComponent(chart, componentName, 1200);
      await nextRenderFrame();
    }
    chart.setAttribute('visible', true);
    refreshEvolutionDataSource(frameUrl);
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.(getChartEntities().map(function (chart) { return chart.id; }).filter(Boolean));
    scheduleFrameRenormalization();
    return true;
  }

  function requestBridgeFrame(frameIndex) {
    var revision = state.result.revision;
    if (!revision) {
      return Promise.reject(new Error('project-evolution-missing-revision'));
    }
    if (state.pendingFrameApply?.reject) {
      if (state.pendingFrameApply?.requestId) {
        state.supersededFrameApplyIds[state.pendingFrameApply?.requestId] = true;
      }
      state.pendingFrameApply?.reject(Object.assign(new Error('project-evolution-frame-apply-superseded'), {
        code: 'project-evolution-frame-apply-superseded'
      }));
    }
    var runtimeClient = client();
    if (!runtimeClient?.sendMessage) {
      return Promise.resolve({
        revision: revision,
        frameIndex: frameIndex,
        bridgeUrl: bridgeUrl()
      });
    }
    return new Promise(function (resolve, reject) {
      var requestId = 'frame-' + (++state.frameApplyRequestId) + '-' + Date.now();
      var timeoutId = root.setTimeout(function () {
        if (
          state.pendingFrameApply?.frameIndex === frameIndex
          && state.pendingFrameApply?.revision === revision
          && state.pendingFrameApply?.requestId === requestId
        ) {
          state.pendingFrameApply = null;
          reject(Object.assign(new Error('project-evolution-frame-apply-timeout'), {
            code: 'project-evolution-frame-apply-timeout'
          }));
        }
      }, 8000);
      state.pendingFrameApply = {
        revision: revision,
        frameIndex: frameIndex,
        requestId: requestId,
        resolve: function (payload) {
          root.clearTimeout?.(timeoutId);
          resolve(payload);
        },
        reject: function (error) {
          root.clearTimeout?.(timeoutId);
          reject(error);
        }
      };
      var sent = runtimeClient?.sendMessage('project-evolution-apply-frame', {
        revision: revision,
        frameIndex: frameIndex,
        requestId: requestId
      });
      if (sent === false) {
        state.pendingFrameApply = null;
        root.clearTimeout?.(timeoutId);
        reject(Object.assign(new Error('project-evolution-frame-apply-unavailable'), {
          code: 'project-evolution-frame-apply-unavailable'
        }));
      }
    });
  }

  function scheduleFrameRenormalization() {
    root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('project-evolution-frame');
    [260, 650, 1100, 2200, 3600].forEach(function (delay) {
      root.setTimeout(function () {
        if (refs.evolutionChart?.isConnected !== false) {
          root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('project-evolution-frame');
        }
      }, delay);
    });
  }

  function waitForFrameStable(generation) {
    var chartIds = getChartEntities().map(function (chart) { return chart.id; }).filter(Boolean);
    var wait = root.CodeXRAnalysisTableRuntime?.waitForChartsStable;
    var promise = typeof wait === 'function' && chartIds.length
      ? wait(chartIds, { timeoutMs: 12000, pollMs: 160, stablePasses: 2 })
      : new Promise(function (resolve) { root.setTimeout(resolve, 900); });
    return Promise.resolve(promise).catch(function () {
      if (state.playing && generation === state.playbackGeneration) {
        setStatus('Chart did not report stable in time; continuing playback.', 'info');
      }
    });
  }

  function waitOneSecond() {
    return new Promise(function (resolve) { root.setTimeout(resolve, 1000); });
  }

  async function waitBeforeNextFrame(generation) {
    if (state.frameIndex >= (state.result.frames || []).length - 1) {
      return;
    }
    setStatus('Waiting for chart animation to settle...', 'info');
    await waitForFrameStable(generation);
    var seconds = Math.max(1, Math.round((state.settleDelayMs || 2200) / 1000 / Math.max(0.25, state.speed)));
    while (seconds > 0 && state.playing && generation === state.playbackGeneration) {
      setStatus('Next frame in ' + seconds + 's...', 'info');
      await waitOneSecond();
      seconds -= 1;
    }
  }

  async function seek(index) {
    var frames = state.result.frames || [];
    if (!frames.length) {
      return false;
    }
    state.frameIndex = Math.max(0, Math.min(frames.length - 1, Number(index) || 0));
    var applied = null;
    try {
      applied = await requestBridgeFrame(state.frameIndex);
    } catch (error) {
      if (
        error.code === 'project-evolution-frame-apply-superseded'
        || error.message === 'project-evolution-frame-apply-superseded'
      ) {
        return false;
      }
      setStatus(error instanceof Error ? error.message : 'Project evolution frame could not be applied.', 'error');
      return false;
    }
    await applyBridgeFrameToChart(frames[state.frameIndex], applied.bridgeUrl);
    render();
    updatePlaybackOverlay(frames[state.frameIndex], frames.length, state.playing);
    await waitOneSecond();
    return true;
  }

  async function scheduleNext(generation) {
    clearTimeout(state.timer);
    await waitBeforeNextFrame(generation);
    if (!state.playing || generation !== state.playbackGeneration) { return; }
    if (state.frameIndex >= (state.result.frames || []).length - 1) {
      state.playing = false;
      state.playbackGeneration += 1;
      clearTimeout(state.timer);
      state.timer = null;
      hidePlaybackOverlay();
      setStatus('Project evolution finished.', 'info');
      render();
      return;
    }
    void seek(state.frameIndex + 1).then(function () {
      if (state.playing && generation === state.playbackGeneration) {
        void scheduleNext(generation);
      }
    });
  }
