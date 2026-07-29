/**
 * Shared LivePanel Historical Comparison panel.
 *
 * One implementation for every LivePanel template (file and directory). Lets
 * the user pick two versions of the analyzed target — the live working copy
 * and/or any local Git branch/tag/commit — and compares them:
 *
 *  - initialize(): GET /api/historical/references → populates both source
 *    selects (or shows why the feature is unavailable, e.g. not a Git repo).
 *  - compare():    POST /api/historical/compare {leftSourceId, rightSourceId}.
 *    The server answers 202 and streams progress over SSE
 *    (`historical-progress`), then announces the finished revision
 *    (`historical-updated`) — which is also pushed whenever the working-copy
 *    side is re-analyzed by the incremental watcher chain, keeping an open
 *    comparison live.
 *  - loadResult(): fetches the /comparison/revision-N.json artifact plus both
 *    side payloads and renders delta tiles, a left/right metric chart and a
 *    per-item detail table (added/removed/modified/unchanged).
 *
 * Mount contract (same element ids in every template):
 *   #historical-status, #historical-controls,
 *   #historical-left-source, #historical-right-source, #historical-compare-btn,
 *   #historical-results, #historical-added-count, #historical-removed-count,
 *   #historical-modified-count, #historical-unchanged-count,
 *   #historical-metrics-chart, #historical-detail-table, #historical-meta
 *
 * Depends on the shared DataTable and chart components being bundled first.
 */

const CODEXR_HISTORICAL_STATUS_BADGE = {
  added: 'is-good',
  removed: 'is-bad',
  modified: 'is-warn',
  unchanged: 'is-neutral',
};

class CodexrHistoricalPanel {
  constructor() {
    this.references = null;
    this.metricsChart = null;
    this.detailTable = null;
    this.busy = false;
  }

  initialize() {
    return fetch('/api/historical/references')
      .then((response) => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then((payload) => {
        if (!payload.enabled) {
          this.setStatus(payload.reason || 'Historical comparison is not available.', false);
          return;
        }
        this.references = payload.references;
        this.populateSelects();
        this.showControls();
        this.setStatus('Select two versions to compare.', false);
        this.bindCompareButton();
      })
      .catch((error) => {
        console.error('Failed to load historical references:', error);
        this.setStatus('Historical comparison unavailable: ' + error.message, true);
      });
  }

  populateSelects() {
    const sources = (this.references && this.references.sources) || [];
    ['historical-left-source', 'historical-right-source'].forEach((selectId, position) => {
      const select = document.getElementById(selectId);
      if (!select) {
        return;
      }
      select.textContent = '';
      sources.forEach((source) => {
        const option = document.createElement('option');
        option.value = source.id;
        option.textContent = source.description
          ? `${source.label} — ${source.description}`
          : source.label;
        select.appendChild(option);
      });
      // Default: working copy on the left, the first Git reference on the right.
      const defaultSource = position === 0
        ? sources.find((source) => source.id === 'working-copy')
        : sources.find((source) => source.id !== 'working-copy');
      if (defaultSource) {
        select.value = defaultSource.id;
      }
    });
  }

  showControls() {
    const controls = document.getElementById('historical-controls');
    if (controls) {
      controls.classList.remove('hidden');
    }
  }

  bindCompareButton() {
    const button = document.getElementById('historical-compare-btn');
    if (button && !button.dataset.codexrBound) {
      button.dataset.codexrBound = 'true';
      button.addEventListener('click', () => this.compare());
    }
  }

  compare() {
    const left = document.getElementById('historical-left-source');
    const right = document.getElementById('historical-right-source');
    if (!left || !right) {
      return Promise.resolve();
    }
    if (left.value === right.value) {
      this.setStatus('Pick two different versions to compare.', true);
      return Promise.resolve();
    }
    this.setBusy(true);
    this.setStatus('Starting comparison...', false);
    return fetch('/api/historical/compare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leftSourceId: left.value, rightSourceId: right.value }),
    })
      .then((response) => {
        if (response.status === 409) {
          throw new Error('Another comparison is already running.');
        }
        if (!response.ok) {
          return response.json().catch(() => ({})).then((body) => {
            throw new Error(body.message || ('HTTP ' + response.status));
          });
        }
        // Progress and the finished revision arrive over SSE.
        return null;
      })
      .catch((error) => {
        this.setBusy(false);
        this.setStatus('Comparison failed: ' + error.message, true);
      });
  }

  /** Route the SSE messages this panel understands (called by the template). */
  handleSseMessage(message) {
    if (message.type === 'historical-progress') {
      this.setStatus(message.message || 'Analyzing...', message.state === 'error');
      if (message.state === 'error') {
        this.setBusy(false);
        // A source that produced no data is removed from the session catalogue.
        // Reload both selectors immediately, then keep the precise server
        // reason visible instead of leaving the rejected option selected.
        this.initialize().then(() => {
          this.setStatus(message.message || 'The selected revision has no usable data.', true);
        });
      }
      return true;
    }
    if (message.type === 'historical-updated') {
      this.setBusy(false);
      this.loadResult(message.revision);
      return true;
    }
    return false;
  }

  loadResult(revision) {
    if (!revision) {
      return Promise.resolve();
    }
    this.setStatus('Loading comparison results...', false);
    return fetch(`./comparison/revision-${revision}.json?t=` + Date.now())
      .then((response) => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then((result) => Promise.all([
        result,
        fetch(result.left.url).then((response) => (response.ok ? response.json() : [])),
        fetch(result.right.url).then((response) => (response.ok ? response.json() : [])),
      ]))
      .then(([result, leftPayload, rightPayload]) => {
        this.render(result, leftPayload, rightPayload);
        this.setStatus(
          `Compared ${result.left.source.label} vs ${result.right.source.label}`
          + ` — updated ${new Date().toLocaleTimeString()}`,
          false,
        );
      })
      .catch((error) => {
        console.error('Failed to load comparison result:', error);
        this.setStatus('Failed to load comparison: ' + error.message, true);
      });
  }

  render(result, leftPayload, rightPayload) {
    const results = document.getElementById('historical-results');
    if (results) {
      results.classList.remove('hidden');
    }

    this.setTileText('historical-added-count', result.delta.added);
    this.setTileText('historical-removed-count', result.delta.removed);
    this.setTileText('historical-modified-count', result.delta.modified);
    this.setTileText('historical-unchanged-count', result.delta.unchanged);

    this.renderMetricsChart(result);
    this.renderDetailTable(result, leftPayload, rightPayload);
    this.renderMeta(result);
  }

  renderMetricsChart(result) {
    if (!this.metricsChart) {
      this.metricsChart = new CodexrPairedBarChart('historical-metrics-chart');
    }
    this.metricsChart.setLabels(result.left.source.label, result.right.source.label);
    this.metricsChart.setData((result.delta.metrics || []).map((metric) => ({
      label: metric.metric,
      left: metric.left,
      right: metric.right,
    })));
  }

  renderDetailTable(result, leftPayload, rightPayload) {
    const metrics = (result.delta.metrics || []).map((metric) => metric.metric).slice(0, 4);
    const rows = this.buildDetailRows(leftPayload, rightPayload, metrics);

    const columns = [
      { key: 'label', label: 'Item' },
      {
        key: 'status', label: 'Status', align: 'center',
        render: (row) => `<span class="data-table-badge ${CODEXR_HISTORICAL_STATUS_BADGE[row.status]}">${escapeHtml(row.status)}</span>`,
      },
    ];
    metrics.forEach((metric) => {
      columns.push({
        key: `delta:${metric}`, label: `Δ ${metric}`, align: 'right', defaultDir: 'desc', searchable: false,
        render: (row) => {
          const left = formatMetricValue(row[`left:${metric}`]);
          const right = formatMetricValue(row[`right:${metric}`]);
          const delta = formatMetricValue(row[`delta:${metric}`]);
          // The sign follows the DISPLAYED delta, so a change too small to
          // survive rounding never shows up as "+0".
          const sign = Number(delta) > 0 ? '+' : '';
          return escapeHtml(`${left} → ${right} (${sign}${delta})`);
        },
      });
    });

    // The columns depend on the compared metrics, so the table is rebuilt per
    // result rather than updated in place.
    const mount = document.getElementById('historical-detail-table');
    if (!mount) {
      return;
    }
    mount.textContent = '';
    this.detailTable = new DataTable(mount, {
      searchPlaceholder: 'Search items...',
      emptyMessage: 'No differences to display.',
      sort: { key: 'status', dir: 'asc' },
      columns,
    });
    this.detailTable.setRows(rows);
  }

  // Join both payloads on comparisonKey and derive a per-item status plus
  // left/right/delta values for each compared metric.
  buildDetailRows(leftPayload, rightPayload, metrics) {
    const leftEntries = Array.isArray(leftPayload) ? leftPayload : [];
    const rightEntries = Array.isArray(rightPayload) ? rightPayload : [];
    const byKey = new Map();

    leftEntries.forEach((entry) => {
      const key = String(entry.comparisonKey || entry.filePath || entry.functionName || '');
      byKey.set(key, { left: entry, right: null });
    });
    rightEntries.forEach((entry) => {
      const key = String(entry.comparisonKey || entry.filePath || entry.functionName || '');
      const existing = byKey.get(key);
      if (existing) {
        existing.right = entry;
      } else {
        byKey.set(key, { left: null, right: entry });
      }
    });

    const rows = [];
    byKey.forEach((pair, key) => {
      const reference = pair.right || pair.left || {};
      const row = {
        // File comparisons are function-scoped — every row is one function of
        // the analyzed file (all rows share the same filePath), so the
        // function name is the identity. Directory rows have no functionName
        // and fall back to their file path.
        label: String(reference.functionName || reference.filePath || key),
        status: !pair.left ? 'added' : !pair.right ? 'removed' : 'unchanged',
      };
      metrics.forEach((metric) => {
        const left = Number(pair.left && pair.left[metric]) || 0;
        const right = Number(pair.right && pair.right[metric]) || 0;
        row[`left:${metric}`] = left;
        row[`right:${metric}`] = right;
        row[`delta:${metric}`] = right - left;
        if (row.status === 'unchanged' && left !== right) {
          row.status = 'modified';
        }
      });
      rows.push(row);
    });

    const statusRank = { added: 0, removed: 1, modified: 2, unchanged: 3 };
    return rows.sort((a, b) => statusRank[a.status] - statusRank[b.status]);
  }

  renderMeta(result) {
    const meta = document.getElementById('historical-meta');
    if (!meta) {
      return;
    }
    const warnings = [...(result.left.warnings || []), ...(result.right.warnings || [])];
    const parts = [
      `${result.left.source.label}: ${result.left.itemCount} items`,
      `${result.right.source.label}: ${result.right.itemCount} items`,
      `generated ${new Date(result.generatedAt).toLocaleString()}`,
    ];
    if (result.left.missingTarget || result.right.missingTarget) {
      parts.push('The analyzed target does not exist in one of the compared versions.');
    }
    meta.textContent = parts.concat(warnings).join(' · ');
  }

  // ── Helpers ────────────────────────────────────────────────────────

  setTileText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  }

  setBusy(busy) {
    this.busy = busy;
    const button = document.getElementById('historical-compare-btn');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? 'Comparing...' : 'Compare';
    }
  }

  setStatus(message, isError) {
    const status = document.getElementById('historical-status');
    if (!status) {
      return;
    }
    status.textContent = message || '';
    status.classList.toggle('error', !!isError);
  }
}
