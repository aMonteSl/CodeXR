// == projectEvolutionRuntime.js | offlineGitData (assembled per manifest.json; see COMPONENTS.md) ==
  // Real offline movie generation for self-contained exports.
  //
  // When the export shipped per-revision payloads (manifest.gitData), the
  // timeline panel works for real: Auto samples with the SAME algorithm the
  // live server uses (CodeXRGitRefPickerRuntime.sampleTimeline, a parity-
  // tested port), Range slices the exported timeline, Manual picks exact
  // revisions, and every frame plays from its exported payload file.

  function getOfflineGitData() {
    var manifest = client()?.getOfflineExportManifest?.();
    var gitData = manifest?.gitData;
    return gitData && Array.isArray(gitData.references?.sources) ? gitData : null;
  }

  function synthesizeOfflineEvolutionReferences(gitData) {
    return {
      repositoryRoot: gitData.references.repositoryRoot || '',
      targetRelativePath: gitData.references.targetRelativePath || '',
      workingTreeDirty: gitData.references.workingTreeDirty === true,
      activeBranch: gitData.references.activeBranch || null,
      sources: gitData.references.sources,
      pageSize: gitData.references.pageSize || 5,
      suggestedSourceIds: gitData.suggestedSourceIds || [],
      maxFrames: gitData.maxFrames || 24,
      activeRequest: null
    };
  }

  function offlineSourceById(gitData, sourceId) {
    return gitData.references.sources.find(function (source) {
      return source && source.id === sourceId;
    }) || null;
  }

  function offlineTimeline(gitData) {
    return (gitData.timelineSourceIds || [])
      .map(function (sourceId) { return offlineSourceById(gitData, sourceId); })
      .filter(function (source) { return !!source; });
  }

  function offlinePayloadUrl(gitData, source) {
    if (!source) {
      return null;
    }
    if (source.kind === 'workingCopy' || source.id === 'working-copy') {
      return gitData.workingCopyPayloadUrl || String(source.payloadUrl || '') || null;
    }
    return String(source.payloadUrl || '') || null;
  }

  function offlineTimelineIndex(timeline, sourceId, gitData) {
    for (var index = 0; index < timeline.length; index += 1) {
      if (timeline[index].id === sourceId) {
        return index;
      }
    }
    if (sourceId === 'working-copy') {
      return timeline.length - 1;
    }
    var source = offlineSourceById(gitData, sourceId);
    var sha = source && source.commitSha;
    if (sha) {
      for (var shaIndex = 0; shaIndex < timeline.length; shaIndex += 1) {
        if (timeline[shaIndex].commitSha === sha) {
          return shaIndex;
        }
      }
    }
    return -1;
  }

  function buildOfflineFrames(gitData, mode, options) {
    var timeline = offlineTimeline(gitData);
    var maxFrames = Math.max(1, Math.min(96, Math.floor(Number(options.maxFrames || gitData.maxFrames || 24))));
    var sampler = root.CodeXRGitRefPickerRuntime?.sampleTimeline;
    var selected = [];

    if (mode === 'manual' && Array.isArray(options.sourceIds) && options.sourceIds.length) {
      selected = options.sourceIds
        .map(function (sourceId) { return offlineSourceById(gitData, sourceId); })
        .filter(function (source) { return !!source; })
        .sort(function (a, b) {
          return offlineTimelineIndex(timeline, a.id, gitData) - offlineTimelineIndex(timeline, b.id, gitData);
        })
        .slice(0, maxFrames);
    } else if (mode === 'range' && options.startSourceId && options.endSourceId) {
      var startIndex = offlineTimelineIndex(timeline, options.startSourceId, gitData);
      var endIndex = offlineTimelineIndex(timeline, options.endSourceId, gitData);
      if (startIndex < 0 || endIndex < 0) {
        return [];
      }
      var from = Math.min(startIndex, endIndex);
      var to = Math.max(startIndex, endIndex);
      var sliced = timeline.slice(from, to + 1);
      selected = sampler ? sampler(sliced, maxFrames, null) : sliced.slice(0, maxFrames);
    } else {
      // Auto: with the exported default the shipped suggestion is used
      // verbatim (exact parity with the live suggestion); any other maxFrames
      // resamples with the shared algorithm.
      if (maxFrames === (gitData.maxFrames || 24) && Array.isArray(gitData.suggestedSourceIds) && gitData.suggestedSourceIds.length) {
        selected = gitData.suggestedSourceIds
          .map(function (sourceId) { return offlineSourceById(gitData, sourceId); })
          .filter(function (source) { return !!source; });
      } else {
        var endAnchor = offlineSourceById(gitData, 'working-copy') || timeline[timeline.length - 1] || null;
        selected = sampler ? sampler(timeline, maxFrames, endAnchor) : timeline.slice(0, maxFrames);
      }
    }

    return selected
      .map(function (source, index) {
        var url = offlinePayloadUrl(gitData, source);
        if (!url) {
          return null;
        }
        return {
          index: index,
          url: url,
          source: source,
          label: source.label || source.id,
          date: source.date || '',
          itemCount: Number(source.itemCount || 0)
        };
      })
      .filter(function (frame) { return !!frame; })
      .map(function (frame, index) {
        frame.index = index;
        return frame;
      });
  }

  function startOfflineTimeline() {
    var gitData = getOfflineGitData();
    if (!gitData) {
      return;
    }
    var frames = buildOfflineFrames(gitData, state.timelineMode, {
      maxFrames: state.references?.maxFrames,
      startSourceId: state.startSourceId,
      endSourceId: state.endSourceId,
      sourceIds: (state.manualSourceIds || []).slice()
    });
    if (!frames.length) {
      setStatus('No exported revisions match that selection.', 'error');
      return;
    }
    clearChartVisualization();
    state.offlineMovieRevision = (state.offlineMovieRevision || 0) + 1;
    setStatus('Movie built from ' + frames.length + ' exported revisions.', 'info');
    // Explicit user action while the mode is active: applying locally is the
    // passive-entity contract's sanctioned path (the entity never self-
    // activates; the user just pressed Generate).
    applySharedState({
      entityKind: ENTITY_KIND,
      entityId: 'main',
      mode: MODE,
      result: {
        revision: state.offlineMovieRevision,
        mode: MODE,
        frames: frames,
        generatedAt: new Date().toISOString()
      }
    });
  }
