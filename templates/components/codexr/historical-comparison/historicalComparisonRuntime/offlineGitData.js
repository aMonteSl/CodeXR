// == historicalComparisonRuntime.js | offlineGitData (assembled per manifest.json; see COMPONENTS.md) ==
  // Real offline comparisons for self-contained exports.
  //
  // When the export shipped per-revision payloads (manifest.gitData), the
  // selection panel lists the exported sources through the normal picker and
  // Compare builds the comparison HERE: fetch both payloads, compute the four
  // delta counters the XR scene actually reads (delta.metrics is LivePanel
  // territory), and ride the exact applySharedState path a live result uses.

  function getOfflineGitData() {
    var manifest = getClient()?.getOfflineExportManifest?.();
    var gitData = manifest?.gitData;
    return gitData && Array.isArray(gitData.references?.sources) ? gitData : null;
  }

  function getOfflineTargetType() {
    var manifest = getClient()?.getOfflineExportManifest?.();
    return String(manifest?.target?.type || 'directory');
  }

  function synthesizeOfflineHistoricalReferences(gitData) {
    var sources = gitData.references.sources.filter(function (source) {
      return source && Number(source.itemCount || 0) > 0 && !!resolveOfflinePayloadUrl(gitData, source.id);
    });
    return {
      repositoryRoot: gitData.references.repositoryRoot || '',
      targetRelativePath: gitData.references.targetRelativePath || '',
      workingTreeDirty: gitData.references.workingTreeDirty === true,
      activeBranch: gitData.references.activeBranch || null,
      sources: sources,
      pageSize: gitData.references.pageSize || 5,
      activeRequest: null
    };
  }

  function resolveOfflineSource(gitData, sourceId) {
    return gitData.references.sources.find(function (source) {
      return source && source.id === sourceId;
    }) || null;
  }

  function resolveOfflinePayloadUrl(gitData, sourceId) {
    if (sourceId === 'working-copy') {
      return gitData.workingCopyPayloadUrl || null;
    }
    var source = resolveOfflineSource(gitData, sourceId);
    return source ? String(source.payloadUrl || '') || null : null;
  }

  // Port of the server's buildDelta counters + entriesHaveMetricChanges
  // (historicalComparisonService.ts). metrics stays empty: the XR companion
  // computes its metric table from the live mapping over state.payloads.
  var OFFLINE_DELTA_IGNORED_FIELDS = {
    comparisonKey: true, evolutionKey: true, filePath: true, treePath: true,
    timestamp: true, status: true, lineStart: true, lineEnd: true,
    fileName: true, functionName: true, relativePath: true
  };

  function offlineEntriesDiffer(left, right, targetType) {
    var keys = {};
    Object.keys(left || {}).forEach(function (key) { keys[key] = true; });
    Object.keys(right || {}).forEach(function (key) { keys[key] = true; });
    var names = Object.keys(keys);
    for (var index = 0; index < names.length; index += 1) {
      var key = names[index];
      if (OFFLINE_DELTA_IGNORED_FIELDS[key]) {
        continue;
      }
      var leftValue = left ? left[key] : undefined;
      var rightValue = right ? right[key] : undefined;
      if (
        (typeof leftValue === 'number' || typeof rightValue === 'number')
        && Number(leftValue || 0) !== Number(rightValue || 0)
      ) {
        return true;
      }
      if (
        targetType === 'file'
        && typeof leftValue === 'string'
        && typeof rightValue === 'string'
        && leftValue !== rightValue
      ) {
        return true;
      }
    }
    return false;
  }

  function buildOfflineDelta(leftEntries, rightEntries, targetType) {
    var leftByKey = new Map();
    (leftEntries || []).forEach(function (entry) {
      leftByKey.set(String(entry?.comparisonKey || ''), entry);
    });
    var rightByKey = new Map();
    (rightEntries || []).forEach(function (entry) {
      rightByKey.set(String(entry?.comparisonKey || ''), entry);
    });
    var added = 0;
    var removed = 0;
    var modified = 0;
    var unchanged = 0;
    leftByKey.forEach(function (leftEntry, key) {
      var rightEntry = rightByKey.get(key);
      if (!rightEntry) {
        removed += 1;
      } else if (offlineEntriesDiffer(leftEntry, rightEntry, targetType)) {
        modified += 1;
      } else {
        unchanged += 1;
      }
    });
    rightByKey.forEach(function (_rightEntry, key) {
      if (!leftByKey.has(key)) {
        added += 1;
      }
    });
    return { added: added, removed: removed, modified: modified, unchanged: unchanged, metrics: [] };
  }

  async function fetchOfflinePayload(url) {
    var response = await fetch(String(url), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('An exported revision payload could not be loaded.');
    }
    var payload = await response.json();
    if (
      !Array.isArray(payload)
      || !payload.some(function (entry) {
        return entry && typeof entry === 'object' && !Array.isArray(entry);
      })
    ) {
      throw new Error('The exported revision contains no usable analysis data.');
    }
    return payload.filter(function (entry) {
      return entry && typeof entry === 'object' && !Array.isArray(entry);
    });
  }

  async function startOfflineGitComparison() {
    var gitData = getOfflineGitData();
    if (!gitData) {
      return;
    }
    var leftUrl = resolveOfflinePayloadUrl(gitData, state.selected.left);
    var rightUrl = resolveOfflinePayloadUrl(gitData, state.selected.right);
    if (!leftUrl || !rightUrl) {
      setStatus('One of the selected revisions is not part of this export.', 'error');
      return;
    }
    try {
      setStatus('Comparing exported revisions...', 'info');
      var payloads = await Promise.all([fetchOfflinePayload(leftUrl), fetchOfflinePayload(rightUrl)]);
      var targetType = getOfflineTargetType();
      state.offlineCompareRevision = (state.offlineCompareRevision || 0) + 1;
      var result = {
        revision: state.offlineCompareRevision,
        mode: 'historical-compare',
        left: {
          source: resolveOfflineSource(gitData, state.selected.left)
            || { id: state.selected.left, kind: 'workingCopy', label: 'Working copy' },
          url: leftUrl,
          itemCount: payloads[0].length,
          missingTarget: false,
          warnings: []
        },
        right: {
          source: resolveOfflineSource(gitData, state.selected.right)
            || { id: state.selected.right, kind: 'workingCopy', label: 'Working copy' },
          url: rightUrl,
          itemCount: payloads[1].length,
          missingTarget: false,
          warnings: []
        },
        delta: buildOfflineDelta(payloads[0], payloads[1], targetType),
        generatedAt: new Date().toISOString()
      };
      await applySharedState({
        entityKind: 'historical-comparison',
        entityId: 'main',
        mode: 'historical-compare',
        result: result
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }
