// == historicalComparisonRuntime.js | compareFlowAndMessages (assembled per manifest.json; see COMPONENTS.md) ==
  function startComparison() {
    if (!state.selected.left || !state.selected.right) {
      setStatus('Select both comparison sources.', 'error');
      return;
    }
    if (state.selected.left === state.selected.right) {
      setStatus('Choose two different comparison sources.', 'error');
      return;
    }
    setStatus('Analyzing historical comparison. Please wait...', 'info');
    getClient()?.sendMessage?.('historical-comparison-start', {
      leftSourceId: state.selected.left,
      rightSourceId: state.selected.right
    });
  }

  function showHistoricalSelectionPanel() {
    root.CodeXRAnalysisModeRuntime.setSelectionPanel?.('historical-selection');
    root.CodeXRMappingUiRuntime.showPanelView?.('historical-selection');
    showSourceSelection();
  }

  async function enterHistoricalSelection() {
    getClient().sendMessage?.('analysis-mode-activate', {
      mode: 'historical-compare'
    });
    await root.CodeXRAnalysisModeRuntime.transitionTo?.('historical-compare', {
      reason: 'historical-selection',
      controllerView: 'historical.selection',
      panelViewId: 'historical-selection'
    });
  }

  function selectHistoricalMode() {
    if (state.result) {
      root.console?.log?.('[CodeXR.Debug]: Historical comparison mode selected from visualization panel', {
        hasResult: true,
        revision: state.result.revision
      });
      getClient()?.sendMessage?.('analysis-mode-activate', {
        mode: 'historical-compare'
      });
      void root.CodeXRAnalysisModeRuntime?.transitionTo?.('historical-compare', {
        reason: 'local-historical-mode-option',
        controllerView: 'historical.mapping',
        panelViewId: 'mapping'
      });
      return;
    }
    root.console?.log?.('[CodeXR.Debug]: Historical comparison selected; opening source selector');
    void enterHistoricalSelection();
  }

  function handleReferences(message) {
    state.references = message?.payload || null;
    var activeRequest = state.references?.activeRequest;
    if (activeRequest?.leftSourceId && activeRequest?.rightSourceId) {
      state.selected = {
        left: activeRequest.leftSourceId,
        right: activeRequest.rightSourceId
      };
    }
    state.pageSize = Math.min(5, Number(state.references?.pageSize || 5));
    state.page = 0;
    if (!getCategorySources().length) {
      state.activeCategory = state.references?.sources?.some(function (source) {
        return source.kind === 'gitRef' && source.refType === 'branch';
      }) ? 'branch' : 'branch';
    }
    renderCategoryTabs();
    renderReferences();
    setStatus('', 'info');
  }

  function handleProgress(message) {
    setStatus(message?.payload?.message || 'Analyzing...', 'info');
  }

  function handleError(message) {
    var code = String(message?.payload?.code || '');
    var rawMessage = String(message?.payload?.message || '');
    var friendlyMessage = code === 'references-unavailable' || /not a git repository|git-command-failed/i.test(rawMessage)
      ? 'History compare requires an analysis inside a local Git repository.'
      : code === 'comparison-busy'
        ? 'Another comparison is already being generated.'
        : 'Historical comparison failed. Please try again.';
    setStatus(friendlyMessage, 'error');
  }

  async function applySharedState(snapshot) {
    if (!snapshot || !snapshot.result) {
      return;
    }
    if (!isHistoricalModeActiveOrActivating()) {
      state.result = snapshot.result;
      return;
    }
    try {
      var loadGeneration = ++state.loadGeneration;
      setStatus('Loading comparison datasets...', 'info');
      var result = snapshot.result;
      var responses = await Promise.all([
        fetch(result.left.url + '?revision=' + result.revision, { cache: 'no-store' }),
        fetch(result.right.url + '?revision=' + result.revision, { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) {
        throw new Error('Comparison datasets could not be loaded.');
      }
      var datasets = await Promise.all(responses.map(function (response) { return response.json(); }));
      if (
        loadGeneration !== state.loadGeneration
        || !isHistoricalModeActiveOrActivating()
      ) {
        return;
      }
      var previousResult = state.result;
      state.result = result;
      if (canRefreshLiveSide(result, previousResult)) {
        await refreshLiveSide(result, datasets);
      } else {
        await renderComparison(result, datasets[0], datasets[1]);
      }
      closePanel();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }
