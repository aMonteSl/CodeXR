// == projectEvolutionRuntime.js | framePlaybackEngine (assembled per manifest.json) ==
  function bridgeUrl() {
    return String(state.result?.bridgeUrl || (state.result?.revision
      ? '/evolution/revision-' + state.result.revision + '/data.json'
      : ''));
  }

  function frameUrlWithCache(frame, rawUrl) {
    var raw = client()?.isOfflineExport?.()
      ? String(frame.url || '')
      : String(rawUrl || bridgeUrl() || frame.url || '');
    if (!raw) { return ''; }
    var separator = raw.indexOf('?') === -1 ? '?' : '&';
    return raw + separator
      + 'revision=' + encodeURIComponent(String(state.result?.revision || ''))
      + '&frame=' + encodeURIComponent(String((frame.index || 0) + 1))
      + '&t=' + Date.now();
  }

  async function applyEvolutionChartSelection(chartChanged, viewGeneration) {
    if (!isEvolutionViewCurrent(viewGeneration) || state.playing) {
      return false;
    }
    if (chartChanged) {
      releaseEvolutionChart();
    }
    var frame = state.result?.frames?.[state.frameIndex];
    var currentUrl = refs.evolutionDataSource?.getAttribute?.(
      'data-codexr-evolution-url'
    ) || frameUrlWithCache(frame || {}, '');
    var pipeline = await ensureDeclarativeEvolutionPipeline(
      frame,
      currentUrl,
      viewGeneration
    );
    if (!pipeline || !isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    beginEvolutionDataTransition('project-evolution-chart-selection');
    if (!chartChanged && !configureEvolutionChart(pipeline.chart, pipeline.chartId)) {
      cancelEvolutionDataTransition('project-evolution-chart-selection-cancelled');
      return false;
    }
    await nextRenderFrame();
    await waitForEvolutionChartAnimation(
      pipeline.chart,
      pipeline.componentName,
      state.dataRefreshGeneration,
      viewGeneration
    );
    if (!isEvolutionViewCurrent(viewGeneration)) {
      cancelEvolutionDataTransition('project-evolution-chart-selection-cancelled');
      return false;
    }
    finishEvolutionDataTransition('project-evolution-chart-selection');
    await waitForEvolutionContainmentStable(viewGeneration);
    return isEvolutionViewCurrent(viewGeneration);
  }

  async function applyBridgeFrameToChart(frame, appliedBridgeUrl) {
    var requestedViewGeneration = arguments.length > 2
      ? arguments[2]
      : state.viewGeneration;
    var viewGeneration = Number.isFinite(Number(requestedViewGeneration))
      ? Number(requestedViewGeneration)
      : state.viewGeneration;
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    var frameUrl = frameUrlWithCache(frame, appliedBridgeUrl);
    if (!frameUrl) {
      setStatus('This evolution movie has no bridge data URL.', 'error');
      return false;
    }
    var previousData = getEvolutionDataBuffer()?.data;
    var pipeline = await ensureDeclarativeEvolutionPipeline(
      frame,
      frameUrl,
      viewGeneration
    );
    if (!pipeline || !isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    var previousTransition = pipeline.dataSourceCreated
      ? null
      : captureEvolutionChartTransition(
        pipeline.chart,
        pipeline.componentName
      );
    beginEvolutionDataTransition('project-evolution-frame');
    var refreshGeneration = pipeline.dataSourceCreated
      ? beginInitialEvolutionDataLoad(frameUrl)
      : refreshEvolutionDataSource(frameUrl);
    if (!refreshGeneration) {
      cancelEvolutionDataTransition('project-evolution-frame-cancelled');
      return false;
    }
    var refreshed = await waitForEvolutionDataRefresh(
      refreshGeneration,
      previousData,
      viewGeneration,
      8000,
      pipeline.dataSourceCreated
    );
    if (!refreshed || !isEvolutionViewCurrent(viewGeneration)) {
      cancelEvolutionDataTransition('project-evolution-frame-refresh-failed');
      if (isEvolutionViewCurrent(viewGeneration)) {
        setStatus('Project evolution data could not be refreshed.', 'error');
      }
      return false;
    }
    var animated = await waitForEvolutionChartAnimation(
      pipeline.chart,
      pipeline.componentName,
      refreshGeneration,
      viewGeneration,
      previousTransition
    );
    if (!animated || !isEvolutionViewCurrent(viewGeneration)) {
      cancelEvolutionDataTransition('project-evolution-frame-animation-cancelled');
      if (isEvolutionViewCurrent(viewGeneration)) {
        setStatus('Project evolution chart did not consume the new frame.', 'error');
      }
      return false;
    }
    finishEvolutionDataTransition('project-evolution-frame');
    await waitForEvolutionContainmentStable(viewGeneration);
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    state.appliedFrameIndex = Number(frame.index) || 0;
    state.appliedResultRevision = Number(state.result?.revision) || 0;
    return true;
  }

  function requestBridgeFrame(frameIndex) {
    var revision = state.result.revision;
    if (!revision) {
      return Promise.reject(new Error('project-evolution-missing-revision'));
    }
    if (state.pendingFrameApply?.reject) {
      if (state.pendingFrameApply?.requestId) {
        state.supersededFrameApplyIds[state.pendingFrameApply.requestId] = true;
      }
      state.pendingFrameApply.reject(Object.assign(
        new Error('project-evolution-frame-apply-superseded'),
        { code: 'project-evolution-frame-apply-superseded' }
      ));
    }
    var runtimeClient = client();
    if (runtimeClient?.isOfflineExport?.()) {
      return Promise.resolve({
        revision: revision,
        frameIndex: frameIndex,
        bridgeUrl: ''
      });
    }
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
          reject(Object.assign(
            new Error('project-evolution-frame-apply-timeout'),
            { code: 'project-evolution-frame-apply-timeout' }
          ));
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
        reject(Object.assign(
          new Error('project-evolution-frame-apply-unavailable'),
          { code: 'project-evolution-frame-apply-unavailable' }
        ));
      }
    });
  }

  function waitForFrameStable(generation) {
    var ids = getEvolutionContainmentIds();
    var wait = root.CodeXRAnalysisTableRuntime?.waitForChartsStable;
    var promise = typeof wait === 'function' && ids.length
      ? wait(ids, { timeoutMs: 12000, pollMs: 160, stablePasses: 2 })
      : Promise.resolve(true);
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
    setCountdownSeconds(0);
    setStatus('Waiting for chart animation to settle...', 'info');
    await waitForFrameStable(generation);
    var seconds = Math.max(
      1,
      Math.round((state.settleDelayMs || 2200) / 1000 / Math.max(0.25, state.speed))
    );
    while (
      seconds > 0
      && state.playing
      && generation === state.playbackGeneration
    ) {
      setCountdownSeconds(seconds);
      setStatus('Next frame in ' + seconds + 's...', 'info');
      await waitOneSecond();
      seconds -= 1;
    }
    setCountdownSeconds(0);
  }

  function setCountdownSeconds(seconds) {
    state.nextFrameSeconds = Math.max(0, Number(seconds) || 0);
    renderMovieCompanion();
  }

  async function seek(index, requestedViewGeneration) {
    var viewGeneration = Number.isFinite(Number(requestedViewGeneration))
      ? Number(requestedViewGeneration)
      : state.viewGeneration;
    var frames = state.result?.frames || [];
    if (
      state.applyingMapping
      || !frames.length
      || !isEvolutionViewCurrent(viewGeneration)
    ) {
      return false;
    }
    state.frameIndex = Math.max(0, Math.min(frames.length - 1, Number(index) || 0));
    var requestedFrameIndex = state.frameIndex;
    var applied = null;
    try {
      applied = await requestBridgeFrame(requestedFrameIndex);
    } catch (error) {
      if (
        error.code === 'project-evolution-frame-apply-superseded'
        || error.message === 'project-evolution-frame-apply-superseded'
        || error.code === 'project-evolution-view-released'
        || error.message === 'project-evolution-view-released'
      ) {
        return false;
      }
      setStatus(
        error instanceof Error
          ? error.message
          : 'Project evolution frame could not be applied.',
        'error'
      );
      return false;
    }
    if (
      requestedFrameIndex !== state.frameIndex
      || !isEvolutionViewCurrent(viewGeneration)
    ) {
      return false;
    }
    var appliedToChart = await applyBridgeFrameToChart(
      frames[requestedFrameIndex],
      applied.bridgeUrl,
      viewGeneration
    );
    if (!appliedToChart || !isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    render();
    updateFrameNameplate(frames[requestedFrameIndex]);
    updatePlaybackOverlay(frames[requestedFrameIndex], frames.length, state.playing);
    return isEvolutionViewCurrent(viewGeneration);
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
